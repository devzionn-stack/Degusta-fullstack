import { db } from "./db";
import { pedidos, motoboys, tenants, logsN8n } from "@shared/schema";
import { eq, and, sql, isNull, or } from "drizzle-orm";
import {
  calcularDistanciaHaversine,
  calcularRota,
  calcularETA,
  geocodificarEndereco,
  Coordenadas,
} from "./geo_service";

interface MotoboyComDistancia {
  id: string;
  nome: string;
  lat: number;
  lng: number;
  status: string;
  pedidosAtivos: number;
  distanciaMetros: number;
  score: number;
}

async function obterCoordenadasPizzaria(tenantId: string): Promise<Coordenadas> {
  const tenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (tenant[0]?.endereco) {
    const coords = await geocodificarEndereco(tenant[0].endereco);
    if (coords) return coords;
  }

  return { lat: -23.5505, lng: -46.6333 };
}

export async function selecionarMotoboyIdeal(
  tenantId: string,
  destinoCoordenadas?: Coordenadas
): Promise<MotoboyComDistancia | null> {
  const motoboysDisponiveis = await db
    .select()
    .from(motoboys)
    .where(
      and(
        eq(motoboys.tenantId, tenantId),
        or(eq(motoboys.status, "disponivel"), eq(motoboys.status, "ativo"))
      )
    );

  if (motoboysDisponiveis.length === 0) {
    console.log("Nenhum motoboy disponível para o tenant:", tenantId);
    return null;
  }

  const pizzaria = destinoCoordenadas || (await obterCoordenadasPizzaria(tenantId));

  const motoboysComScore: MotoboyComDistancia[] = motoboysDisponiveis
    .filter((m) => m.lat && m.lng)
    .map((m) => {
      const lat = parseFloat(m.lat?.toString() || "0");
      const lng = parseFloat(m.lng?.toString() || "0");
      const distanciaMetros = calcularDistanciaHaversine(
        { lat, lng },
        pizzaria
      );
      const pedidosAtivos = m.pedidosAtivos || 0;
      const score = distanciaMetros * (1 + pedidosAtivos * 0.3);

      return {
        id: m.id,
        nome: m.nome,
        lat,
        lng,
        status: m.status,
        pedidosAtivos,
        distanciaMetros,
        score,
      };
    });

  if (motoboysComScore.length === 0) {
    const primeiroMotoboy = motoboysDisponiveis[0];
    return {
      id: primeiroMotoboy.id,
      nome: primeiroMotoboy.nome,
      lat: 0,
      lng: 0,
      status: primeiroMotoboy.status,
      pedidosAtivos: primeiroMotoboy.pedidosAtivos || 0,
      distanciaMetros: 0,
      score: 0,
    };
  }

  motoboysComScore.sort((a, b) => a.score - b.score);

  return motoboysComScore[0];
}

export async function atribuirPedidoAMotoboy(
  pedidoId: string,
  motoboyId: string,
  tenantId: string
): Promise<{ sucesso: boolean; mensagem: string; rota?: any }> {
  try {
    const pedido = await db
      .select()
      .from(pedidos)
      .where(and(eq(pedidos.id, pedidoId), eq(pedidos.tenantId, tenantId)))
      .limit(1);

    if (!pedido[0]) {
      return { sucesso: false, mensagem: "Pedido não encontrado" };
    }

    const motoboy = await db
      .select()
      .from(motoboys)
      .where(and(eq(motoboys.id, motoboyId), eq(motoboys.tenantId, tenantId)))
      .limit(1);

    if (!motoboy[0]) {
      return { sucesso: false, mensagem: "Motoboy não encontrado" };
    }

    let rotaResult: Awaited<ReturnType<typeof calcularRota>> = null;
    let etaMinutos: number | null = null;
    let destinoCoords: Coordenadas | null = null;

    if (pedido[0].enderecoEntrega) {
      destinoCoords = await geocodificarEndereco(pedido[0].enderecoEntrega);

      if (destinoCoords && motoboy[0].lat && motoboy[0].lng) {
        const motoboyLat = parseFloat(motoboy[0].lat.toString());
        const motoboyLng = parseFloat(motoboy[0].lng.toString());

        rotaResult = await calcularRota(
          { lat: motoboyLat, lng: motoboyLng },
          destinoCoords
        );

        const etaResult = await calcularETA(
          motoboyLat,
          motoboyLng,
          destinoCoords.lat,
          destinoCoords.lng
        );
        etaMinutos = etaResult.etaMinutos;
      }
    }

    await db
      .update(pedidos)
      .set({
        motoboyId,
        status: "saiu_entrega",
        saiuEntregaAt: new Date(),
        etaMinutos,
        etaCalculadoEm: new Date(),
        rotaPolyline: rotaResult?.polyline || null,
        destinoLat: destinoCoords?.lat?.toString() || null,
        destinoLng: destinoCoords?.lng?.toString() || null,
        trackingData: {
          ...(typeof pedido[0].trackingData === "object" && pedido[0].trackingData
            ? pedido[0].trackingData
            : {}),
          rota: rotaResult,
          motoboyNome: motoboy[0].nome,
          motoboyTelefone: motoboy[0].telefone,
        },
        updatedAt: new Date(),
      })
      .where(eq(pedidos.id, pedidoId));

    await db
      .update(motoboys)
      .set({
        status: "em_entrega",
        pedidosAtivos: sql`COALESCE(${motoboys.pedidosAtivos}, 0) + 1`,
      })
      .where(eq(motoboys.id, motoboyId));

    return {
      sucesso: true,
      mensagem: `Pedido atribuído a ${motoboy[0].nome}`,
      rota: rotaResult,
    };
  } catch (error) {
    console.error("Erro ao atribuir pedido:", error);
    return {
      sucesso: false,
      mensagem: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

export async function despacharPedido(
  pedidoId: string,
  tenantId: string
): Promise<{ sucesso: boolean; mensagem: string; motoboyId?: string }> {
  try {
    const pedido = await db
      .select()
      .from(pedidos)
      .where(and(eq(pedidos.id, pedidoId), eq(pedidos.tenantId, tenantId)))
      .limit(1);

    if (!pedido[0]) {
      return { sucesso: false, mensagem: "Pedido não encontrado" };
    }

    let destinoCoords: Coordenadas | undefined;
    if (pedido[0].enderecoEntrega) {
      const coords = await geocodificarEndereco(pedido[0].enderecoEntrega);
      if (coords) destinoCoords = coords;
    }

    const motoboyIdeal = await selecionarMotoboyIdeal(tenantId, destinoCoords);

    if (!motoboyIdeal) {
      return {
        sucesso: false,
        mensagem: "Nenhum motoboy disponível no momento",
      };
    }

    const resultado = await atribuirPedidoAMotoboy(
      pedidoId,
      motoboyIdeal.id,
      tenantId
    );

    if (resultado.sucesso) {
      return {
        sucesso: true,
        mensagem: resultado.mensagem,
        motoboyId: motoboyIdeal.id,
      };
    }

    return resultado;
  } catch (error) {
    console.error("Erro no despacho:", error);
    return {
      sucesso: false,
      mensagem: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

export async function finalizarEntrega(
  pedidoId: string,
  tenantId: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  try {
    const pedido = await db
      .select()
      .from(pedidos)
      .where(and(eq(pedidos.id, pedidoId), eq(pedidos.tenantId, tenantId)))
      .limit(1);

    if (!pedido[0]) {
      return { sucesso: false, mensagem: "Pedido não encontrado" };
    }

    if (pedido[0].motoboyId) {
      await db
        .update(motoboys)
        .set({
          status: "disponivel",
          pedidosAtivos: sql`GREATEST(COALESCE(${motoboys.pedidosAtivos}, 0) - 1, 0)`,
        })
        .where(eq(motoboys.id, pedido[0].motoboyId));
    }

    await db
      .update(pedidos)
      .set({
        status: "entregue",
        updatedAt: new Date(),
      })
      .where(eq(pedidos.id, pedidoId));

    return { sucesso: true, mensagem: "Entrega finalizada com sucesso" };
  } catch (error) {
    console.error("Erro ao finalizar entrega:", error);
    return {
      sucesso: false,
      mensagem: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}
