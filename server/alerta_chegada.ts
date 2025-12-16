import { db } from "./db";
import { pedidos, tenants, logsN8n, clientes } from "../shared/schema";
import { eq, and, isNotNull, lte, isNull } from "drizzle-orm";
import { calcularDistanciaHaversine, Coordenadas } from "./geo_service";
import { sendToN8n } from "./n8n-requester";

const ALERTA_ANTECEDENCIA_MINUTOS = 10;
const GEOFENCE_CHEGADA_METROS = 50;
const CRON_INTERVAL_MS = 60 * 1000;

interface PedidoParaAlerta {
  id: string;
  tenantId: string;
  clienteId: string | null;
  motoboyId: string | null;
  etaMinutos: number | null;
  etaCalculadoEm: Date | null;
  destinoLat: string | null;
  destinoLng: string | null;
  enderecoEntrega: string | null;
  alertaEta10MinEnviado: boolean | null;
  alertaChegandoEnviado: boolean | null;
  trackingData: any;
}

export function calcularMomentoAlertaETA(
  etaMinutos: number,
  etaCalculadoEm: Date
): Date {
  const etaTotal = new Date(etaCalculadoEm.getTime() + etaMinutos * 60 * 1000);
  const momentoAlerta = new Date(
    etaTotal.getTime() - ALERTA_ANTECEDENCIA_MINUTOS * 60 * 1000
  );
  return momentoAlerta;
}

export function verificarMomentoAlerta(
  etaMinutos: number,
  etaCalculadoEm: Date
): boolean {
  const momentoAlerta = calcularMomentoAlertaETA(etaMinutos, etaCalculadoEm);
  const agora = new Date();
  return agora >= momentoAlerta;
}

export function verificarProximidadeDestino(
  motoboyLat: number,
  motoboyLng: number,
  destinoLat: number,
  destinoLng: number
): { dentroGeofence: boolean; distanciaMetros: number } {
  const origem: Coordenadas = { lat: motoboyLat, lng: motoboyLng };
  const destino: Coordenadas = { lat: destinoLat, lng: destinoLng };
  const distanciaMetros = calcularDistanciaHaversine(origem, destino);
  return {
    dentroGeofence: distanciaMetros <= GEOFENCE_CHEGADA_METROS,
    distanciaMetros: Math.round(distanciaMetros),
  };
}

async function obterDadosCliente(
  clienteId: string
): Promise<{ nome: string; telefone: string } | null> {
  const cliente = await db
    .select({ nome: clientes.nome, telefone: clientes.telefone })
    .from(clientes)
    .where(eq(clientes.id, clienteId))
    .limit(1);
  return cliente[0] || null;
}

async function enviarAlertaETA10Min(
  pedido: PedidoParaAlerta
): Promise<boolean> {
  try {
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, pedido.tenantId))
      .limit(1);

    if (!tenant[0]?.apiKeyN8n) {
      console.log(
        `[Alerta Chegada] Tenant ${pedido.tenantId} não possui chave N8N`
      );
      return false;
    }

    let dadosCliente: { nome: string; telefone: string } | null = null;
    if (pedido.clienteId) {
      dadosCliente = await obterDadosCliente(pedido.clienteId);
    }

    const payload = {
      tipo: "alerta_eta_10_min",
      pedidoId: pedido.id,
      tenantId: pedido.tenantId,
      clienteNome: dadosCliente?.nome || "Cliente",
      clienteTelefone: dadosCliente?.telefone || null,
      etaMinutos: pedido.etaMinutos,
      enderecoEntrega: pedido.enderecoEntrega,
      mensagem: `Sua pizza está a caminho! Previsão de chegada em aproximadamente ${pedido.etaMinutos} minutos.`,
      timestamp: new Date().toISOString(),
    };

    const resultado = await sendToN8n({
      tenantId: pedido.tenantId,
      endpoint: "alerta_whatsapp",
      payload,
    });

    await db.insert(logsN8n).values({
      tenantId: pedido.tenantId,
      tipo: "webhook_saida",
      endpoint: "alerta_eta_10_min",
      payload,
      resposta: resultado.data || null,
      status: resultado.success ? "enviado" : "erro",
      erro: resultado.success ? null : resultado.error || null,
    });

    if (resultado.success) {
      await db
        .update(pedidos)
        .set({ alertaEta10MinEnviado: true, updatedAt: new Date() })
        .where(eq(pedidos.id, pedido.id));
    }

    return resultado.success;
  } catch (error) {
    console.error("[Alerta Chegada] Erro ao enviar alerta ETA 10min:", error);
    return false;
  }
}

export async function enviarAlertaPizzaChegando(
  pedidoId: string,
  distanciaMetros: number,
  tenantId: string,
  motoboyId: string
): Promise<boolean> {
  try {
    const pedidoData = await db
      .select({
        id: pedidos.id,
        tenantId: pedidos.tenantId,
        motoboyId: pedidos.motoboyId,
        clienteId: pedidos.clienteId,
        enderecoEntrega: pedidos.enderecoEntrega,
        alertaChegandoEnviado: pedidos.alertaChegandoEnviado,
      })
      .from(pedidos)
      .where(
        and(
          eq(pedidos.id, pedidoId),
          eq(pedidos.tenantId, tenantId),
          eq(pedidos.motoboyId, motoboyId)
        )
      )
      .limit(1);

    if (!pedidoData[0]) {
      console.error(
        `[Alerta Chegada] Pedido ${pedidoId} não encontrado ou não pertence ao tenant/motoboy`
      );
      return false;
    }

    const pedido = pedidoData[0];

    if (pedido.alertaChegandoEnviado) {
      console.log(
        `[Alerta Chegada] Alerta 'chegando' já enviado para pedido ${pedidoId}`
      );
      return true;
    }

    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, pedido.tenantId))
      .limit(1);

    if (!tenant[0]?.apiKeyN8n) {
      console.log(
        `[Alerta Chegada] Tenant ${pedido.tenantId} não possui chave N8N`
      );
      return false;
    }

    let dadosCliente: { nome: string; telefone: string } | null = null;
    if (pedido.clienteId) {
      dadosCliente = await obterDadosCliente(pedido.clienteId);
    }

    const payload = {
      tipo: "pizza_chegando",
      pedidoId: pedido.id,
      tenantId: pedido.tenantId,
      clienteNome: dadosCliente?.nome || "Cliente",
      clienteTelefone: dadosCliente?.telefone || null,
      distanciaMetros,
      enderecoEntrega: pedido.enderecoEntrega,
      mensagem: `Sua pizza está chegando! O entregador está a apenas ${distanciaMetros} metros do seu endereço.`,
      timestamp: new Date().toISOString(),
    };

    const resultado = await sendToN8n({
      tenantId: pedido.tenantId,
      endpoint: "alerta_whatsapp",
      payload,
    });

    await db.insert(logsN8n).values({
      tenantId: pedido.tenantId,
      tipo: "webhook_saida",
      endpoint: "pizza_chegando",
      payload,
      resposta: resultado.data || null,
      status: resultado.success ? "enviado" : "erro",
      erro: resultado.success ? null : resultado.error || null,
    });

    if (resultado.success) {
      await db
        .update(pedidos)
        .set({ alertaChegandoEnviado: true, updatedAt: new Date() })
        .where(eq(pedidos.id, pedido.id));
    }

    return resultado.success;
  } catch (error) {
    console.error(
      "[Alerta Chegada] Erro ao enviar alerta pizza chegando:",
      error
    );
    return false;
  }
}

async function verificarEEnviarAlertasETA(): Promise<void> {
  const allTenants = await db.select({ id: tenants.id }).from(tenants);

  console.log(`[Alerta Chegada] Verificando alertas para ${allTenants.length} tenants`);

  for (const tenant of allTenants) {
    const pedidosEmTransito = await db
      .select({
        id: pedidos.id,
        tenantId: pedidos.tenantId,
        clienteId: pedidos.clienteId,
        motoboyId: pedidos.motoboyId,
        etaMinutos: pedidos.etaMinutos,
        etaCalculadoEm: pedidos.etaCalculadoEm,
        destinoLat: pedidos.destinoLat,
        destinoLng: pedidos.destinoLng,
        enderecoEntrega: pedidos.enderecoEntrega,
        alertaEta10MinEnviado: pedidos.alertaEta10MinEnviado,
        alertaChegandoEnviado: pedidos.alertaChegandoEnviado,
        trackingData: pedidos.trackingData,
      })
      .from(pedidos)
      .where(
        and(
          eq(pedidos.tenantId, tenant.id),
          eq(pedidos.status, "saiu_entrega"),
          isNotNull(pedidos.motoboyId),
          isNotNull(pedidos.etaMinutos),
          isNotNull(pedidos.etaCalculadoEm)
        )
      );

    for (const pedido of pedidosEmTransito) {
      if (pedido.tenantId !== tenant.id) {
        console.error(`[Alerta Chegada] SECURITY: Tenant mismatch detected for pedido ${pedido.id}`);
        continue;
      }

      if (!pedido.alertaEta10MinEnviado && pedido.etaMinutos && pedido.etaCalculadoEm) {
        const deveEnviarAlerta = verificarMomentoAlerta(
          pedido.etaMinutos,
          pedido.etaCalculadoEm
        );

        if (deveEnviarAlerta) {
          console.log(
            `[Alerta Chegada] Enviando alerta ETA-10min para pedido ${pedido.id} (tenant: ${tenant.id})`
          );
          await enviarAlertaETA10Min(pedido as PedidoParaAlerta);
        }
      }
    }
  }
}

let cronInterval: NodeJS.Timeout | null = null;

export function iniciarCronAlertaChegada(): void {
  if (cronInterval) {
    console.log("[Alerta Chegada] Cron já está em execução");
    return;
  }

  console.log(
    `[Alerta Chegada] Iniciando cron de alertas (intervalo: ${CRON_INTERVAL_MS / 1000}s)`
  );

  verificarEEnviarAlertasETA();

  cronInterval = setInterval(async () => {
    try {
      await verificarEEnviarAlertasETA();
    } catch (error) {
      console.error("[Alerta Chegada] Erro no cron:", error);
    }
  }, CRON_INTERVAL_MS);
}

export function pararCronAlertaChegada(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log("[Alerta Chegada] Cron parado");
  }
}

export { verificarEEnviarAlertasETA };
