import { db } from "./db";
import { pedidos, motoboys, tenants, logsN8n } from "@shared/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { calcularETA, verificarForaDeRota, registrarAlertaForaRota, Coordenadas } from "./geo_service";
import { sendToN8n } from "./n8n-requester";

const ETA_THRESHOLD_MINUTES = 2;
const CRON_INTERVAL_MS = 5 * 60 * 1000;

interface PedidoEmTransito {
  id: string;
  tenantId: string;
  motoboyId: string | null;
  etaMinutos: number | null;
  etaCalculadoEm: Date | null;
  destinoLat: string | null;
  destinoLng: string | null;
  rotaPolyline: string | null;
  trackingData: any;
  enderecoEntrega: string | null;
}

async function recalcularETAPedidosEmTransito(): Promise<void> {
  const pedidosEmTransito = await db
    .select({
      id: pedidos.id,
      tenantId: pedidos.tenantId,
      motoboyId: pedidos.motoboyId,
      etaMinutos: pedidos.etaMinutos,
      etaCalculadoEm: pedidos.etaCalculadoEm,
      destinoLat: pedidos.destinoLat,
      destinoLng: pedidos.destinoLng,
      rotaPolyline: pedidos.rotaPolyline,
      trackingData: pedidos.trackingData,
      enderecoEntrega: pedidos.enderecoEntrega,
    })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.status, "saiu_entrega"),
        isNotNull(pedidos.motoboyId)
      )
    );

  console.log(`[ETA Cron] Processando ${pedidosEmTransito.length} pedidos em trânsito`);

  for (const pedido of pedidosEmTransito) {
    try {
      await processarPedidoETA(pedido as PedidoEmTransito);
    } catch (error) {
      console.error(`[ETA Cron] Erro ao processar pedido ${pedido.id}:`, error);
    }
  }
}

async function processarPedidoETA(pedido: PedidoEmTransito): Promise<void> {
  if (!pedido.motoboyId || !pedido.destinoLat || !pedido.destinoLng) {
    return;
  }

  const motoboy = await db
    .select()
    .from(motoboys)
    .where(eq(motoboys.id, pedido.motoboyId))
    .limit(1);

  if (!motoboy[0] || !motoboy[0].lat || !motoboy[0].lng) {
    return;
  }

  const motoboyLat = parseFloat(motoboy[0].lat.toString());
  const motoboyLng = parseFloat(motoboy[0].lng.toString());
  const destinoLat = parseFloat(pedido.destinoLat);
  const destinoLng = parseFloat(pedido.destinoLng);

  const etaResult = await calcularETA(motoboyLat, motoboyLng, destinoLat, destinoLng);
  const novoETA = etaResult.etaMinutos;
  const etaAnterior = pedido.etaMinutos || novoETA;
  const diferencaETA = Math.abs(novoETA - etaAnterior);

  await db
    .update(pedidos)
    .set({
      etaMinutos: novoETA,
      etaCalculadoEm: new Date(),
      trackingData: {
        ...(typeof pedido.trackingData === "object" && pedido.trackingData
          ? pedido.trackingData
          : {}),
        ultimoETA: novoETA,
        trafegoAtual: etaResult.trafegoAtual,
        motoboyLat,
        motoboyLng,
      },
      updatedAt: new Date(),
    })
    .where(eq(pedidos.id, pedido.id));

  if (diferencaETA >= ETA_THRESHOLD_MINUTES) {
    console.log(
      `[ETA Cron] ETA alterado significativamente para pedido ${pedido.id}: ${etaAnterior} -> ${novoETA} min`
    );
    await notificarMudancaETA(pedido, novoETA, etaAnterior);
  }

  if (pedido.rotaPolyline) {
    const posicaoMotoboy: Coordenadas = { lat: motoboyLat, lng: motoboyLng };
    const foraRota = verificarForaDeRota(posicaoMotoboy, pedido.rotaPolyline, 200);

    if (foraRota) {
      console.log(`[ETA Cron] Motoboy fora da rota para pedido ${pedido.id}`);
      await registrarAlertaForaRota(
        pedido.tenantId,
        pedido.motoboyId,
        pedido.id,
        200
      );
    }
  }
}

async function notificarMudancaETA(
  pedido: PedidoEmTransito,
  novoETA: number,
  etaAnterior: number
): Promise<void> {
  try {
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, pedido.tenantId))
      .limit(1);

    if (!tenant[0]?.n8nApiKey) {
      console.log(`[ETA Cron] Tenant ${pedido.tenantId} não possui chave N8N`);
      return;
    }

    const payload = {
      tipo: "eta_atualizado",
      pedidoId: pedido.id,
      etaAnterior,
      novoETA,
      diferencaMinutos: novoETA - etaAnterior,
      enderecoEntrega: pedido.enderecoEntrega,
      timestamp: new Date().toISOString(),
    };

    const resultado = await sendToN8n({
      tenantId: pedido.tenantId,
      endpoint: "eta_atualizado",
      payload,
    });

    await db.insert(logsN8n).values({
      tenantId: pedido.tenantId,
      tipo: "webhook_saida",
      endpoint: "eta_atualizado",
      payload,
      resposta: resultado.data || null,
      status: resultado.success ? "enviado" : "erro",
      erro: resultado.success ? null : resultado.error || null,
    });
  } catch (error) {
    console.error(`[ETA Cron] Erro ao notificar mudança de ETA:`, error);
  }
}

let cronInterval: NodeJS.Timeout | null = null;

export function iniciarCronETA(): void {
  if (cronInterval) {
    console.log("[ETA Cron] Cron já está em execução");
    return;
  }

  console.log(`[ETA Cron] Iniciando cron de ETA (intervalo: ${CRON_INTERVAL_MS / 1000}s)`);

  recalcularETAPedidosEmTransito();

  cronInterval = setInterval(async () => {
    try {
      await recalcularETAPedidosEmTransito();
    } catch (error) {
      console.error("[ETA Cron] Erro no cron de ETA:", error);
    }
  }, CRON_INTERVAL_MS);
}

export function pararCronETA(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log("[ETA Cron] Cron de ETA parado");
  }
}

export { recalcularETAPedidosEmTransito };
