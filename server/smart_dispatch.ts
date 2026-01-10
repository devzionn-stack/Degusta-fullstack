import { db } from "./db";
import { pedidos, motoboys, tenants, systemLogs } from "@shared/schema";
import { eq, and, sql, or, desc, ne } from "drizzle-orm";
import {
  calcularDistanciaHaversine,
  geocodificarEndereco,
  Coordenadas,
} from "./geo_service";
import { broadcastOrderStatusChange } from "./websocket";

interface MotoboyScore {
  id: string;
  nome: string;
  telefone: string | null;
  lat: number;
  lng: number;
  status: string;
  pedidosAtivos: number;
  distanciaMetros: number;
  tempoDesdeUltimaEntrega: number;
  scoreProximidade: number;
  scoreCarga: number;
  scoreTempoOcioso: number;
  scorePerformance: number;
  scoreFinal: number;
}

interface ResultadoDespacho {
  sucesso: boolean;
  mensagem: string;
  motoboyId?: string;
  motoboyNome?: string;
  score?: number;
}

interface LogDespachoDecisao {
  tipo: "selecao" | "atribuicao" | "redistribuicao";
  pedidoId?: string;
  motoboyId?: string;
  candidatos?: Array<{ id: string; nome: string; score: number }>;
  motivo: string;
  detalhes?: Record<string, any>;
}

const PESOS = {
  PROXIMIDADE: 0.40,
  CARGA: 0.30,
  TEMPO_OCIOSO: 0.20,
  PERFORMANCE: 0.10,
};

async function obterCoordenadasRestaurante(tenantId: string): Promise<Coordenadas> {
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

async function logarDecisaoDespacho(
  tenantId: string,
  decisao: LogDespachoDecisao
): Promise<void> {
  try {
    await db.insert(systemLogs).values({
      tenantId,
      tipo: "smart_dispatch",
      acao: decisao.tipo,
      entidade: "motoboy",
      entidadeId: decisao.motoboyId || null,
      detalhes: {
        ...decisao,
        timestamp: new Date().toISOString(),
      },
    });
    console.log(`[SmartDispatch] ${decisao.tipo}: ${decisao.motivo}`);
  } catch (error) {
    console.error("[SmartDispatch] Erro ao logar decisão:", error);
  }
}

async function calcularScoreMotoboy(
  motoboy: typeof motoboys.$inferSelect,
  restauranteCoords: Coordenadas
): Promise<MotoboyScore | null> {
  const lat = parseFloat(motoboy.lat?.toString() || "0");
  const lng = parseFloat(motoboy.lng?.toString() || "0");

  if (!lat && !lng) {
    return null;
  }

  const distanciaMetros = calcularDistanciaHaversine(
    { lat, lng },
    restauranteCoords
  );

  const pedidosAtivos = motoboy.pedidosAtivos || 0;

  const tempoDesdeUltimaEntrega = motoboy.lastLocationUpdate
    ? (Date.now() - new Date(motoboy.lastLocationUpdate).getTime()) / (1000 * 60)
    : 0;

  const distanciaMax = 10000;
  const scoreProximidade = Math.max(0, 100 - (distanciaMetros / distanciaMax) * 100);

  const cargaMax = 5;
  const scoreCarga = Math.max(0, 100 - (pedidosAtivos / cargaMax) * 100);

  const tempoOciosoIdeal = 30;
  const scoreTempoOcioso = Math.min(100, (tempoDesdeUltimaEntrega / tempoOciosoIdeal) * 100);

  const scorePerformance = 80;

  const scoreFinal =
    scoreProximidade * PESOS.PROXIMIDADE +
    scoreCarga * PESOS.CARGA +
    scoreTempoOcioso * PESOS.TEMPO_OCIOSO +
    scorePerformance * PESOS.PERFORMANCE;

  return {
    id: motoboy.id,
    nome: motoboy.nome,
    telefone: motoboy.telefone,
    lat,
    lng,
    status: motoboy.status,
    pedidosAtivos,
    distanciaMetros,
    tempoDesdeUltimaEntrega,
    scoreProximidade,
    scoreCarga,
    scoreTempoOcioso,
    scorePerformance,
    scoreFinal,
  };
}

export async function selecionarMelhorMotoboy(
  tenantId: string,
  pedido?: typeof pedidos.$inferSelect
): Promise<MotoboyScore | null> {
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
    await logarDecisaoDespacho(tenantId, {
      tipo: "selecao",
      pedidoId: pedido?.id,
      motivo: "Nenhum motoboy disponível encontrado",
    });
    return null;
  }

  const restauranteCoords = await obterCoordenadasRestaurante(tenantId);

  const motoboysComScore: MotoboyScore[] = [];

  for (const mb of motoboysDisponiveis) {
    const score = await calcularScoreMotoboy(mb, restauranteCoords);
    if (score) {
      motoboysComScore.push(score);
    }
  }

  if (motoboysComScore.length === 0) {
    const primeiroMotoboy = motoboysDisponiveis[0];
    
    await logarDecisaoDespacho(tenantId, {
      tipo: "selecao",
      pedidoId: pedido?.id,
      motoboyId: primeiroMotoboy.id,
      motivo: "Nenhum motoboy com localização válida, selecionando primeiro disponível",
    });

    return {
      id: primeiroMotoboy.id,
      nome: primeiroMotoboy.nome,
      telefone: primeiroMotoboy.telefone,
      lat: 0,
      lng: 0,
      status: primeiroMotoboy.status,
      pedidosAtivos: primeiroMotoboy.pedidosAtivos || 0,
      distanciaMetros: 0,
      tempoDesdeUltimaEntrega: 0,
      scoreProximidade: 0,
      scoreCarga: 100,
      scoreTempoOcioso: 0,
      scorePerformance: 80,
      scoreFinal: 50,
    };
  }

  motoboysComScore.sort((a, b) => b.scoreFinal - a.scoreFinal);

  const melhorMotoboy = motoboysComScore[0];
  const candidatos = motoboysComScore.slice(0, 5).map((m) => ({
    id: m.id,
    nome: m.nome,
    score: Math.round(m.scoreFinal * 100) / 100,
  }));

  await logarDecisaoDespacho(tenantId, {
    tipo: "selecao",
    pedidoId: pedido?.id,
    motoboyId: melhorMotoboy.id,
    candidatos,
    motivo: `Motoboy ${melhorMotoboy.nome} selecionado com score ${melhorMotoboy.scoreFinal.toFixed(2)}`,
    detalhes: {
      scoreProximidade: melhorMotoboy.scoreProximidade.toFixed(2),
      scoreCarga: melhorMotoboy.scoreCarga.toFixed(2),
      scoreTempoOcioso: melhorMotoboy.scoreTempoOcioso.toFixed(2),
      scorePerformance: melhorMotoboy.scorePerformance.toFixed(2),
      distanciaMetros: Math.round(melhorMotoboy.distanciaMetros),
      pedidosAtivos: melhorMotoboy.pedidosAtivos,
    },
  });

  return melhorMotoboy;
}

export async function atribuirPedidoAutomaticamente(
  tenantId: string,
  pedidoId: string
): Promise<ResultadoDespacho> {
  try {
    const [pedido] = await db
      .select()
      .from(pedidos)
      .where(and(eq(pedidos.id, pedidoId), eq(pedidos.tenantId, tenantId)))
      .limit(1);

    if (!pedido) {
      return { sucesso: false, mensagem: "Pedido não encontrado" };
    }

    const statusPronto = ["pronto", "pronto_entrega"];
    if (!statusPronto.includes(pedido.status)) {
      return {
        sucesso: false,
        mensagem: `Pedido não está pronto para entrega (status: ${pedido.status})`,
      };
    }

    if (pedido.motoboyId) {
      return {
        sucesso: false,
        mensagem: "Pedido já possui motoboy atribuído",
        motoboyId: pedido.motoboyId,
      };
    }

    const melhorMotoboy = await selecionarMelhorMotoboy(tenantId, pedido);

    if (!melhorMotoboy) {
      return {
        sucesso: false,
        mensagem: "Nenhum motoboy disponível no momento",
      };
    }

    await db
      .update(pedidos)
      .set({
        motoboyId: melhorMotoboy.id,
        status: "saiu_entrega",
        saiuEntregaAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pedidos.id, pedidoId));

    await db
      .update(motoboys)
      .set({
        status: "em_entrega",
        pedidosAtivos: sql`COALESCE(${motoboys.pedidosAtivos}, 0) + 1`,
      })
      .where(eq(motoboys.id, melhorMotoboy.id));

    await logarDecisaoDespacho(tenantId, {
      tipo: "atribuicao",
      pedidoId,
      motoboyId: melhorMotoboy.id,
      motivo: `Pedido ${pedidoId} atribuído automaticamente ao motoboy ${melhorMotoboy.nome}`,
      detalhes: {
        score: melhorMotoboy.scoreFinal,
        distanciaMetros: melhorMotoboy.distanciaMetros,
        pedidosAtivos: melhorMotoboy.pedidosAtivos,
      },
    });

    const [pedidoAtualizado] = await db
      .select()
      .from(pedidos)
      .where(eq(pedidos.id, pedidoId))
      .limit(1);

    if (pedidoAtualizado) {
      broadcastOrderStatusChange(tenantId, pedidoAtualizado as any);
    }

    console.log(`[SmartDispatch] Despacho realizado: Pedido ${pedidoId} -> Motoboy ${melhorMotoboy.nome} (score: ${melhorMotoboy.scoreFinal.toFixed(2)})`);

    return {
      sucesso: true,
      mensagem: `Pedido atribuído ao motoboy ${melhorMotoboy.nome}`,
      motoboyId: melhorMotoboy.id,
      motoboyNome: melhorMotoboy.nome,
      score: melhorMotoboy.scoreFinal,
    };
  } catch (error) {
    console.error("[SmartDispatch] Erro ao atribuir pedido:", error);
    return {
      sucesso: false,
      mensagem: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

export async function redistribuirPedidosMotoboy(
  tenantId: string,
  motoboyId: string
): Promise<{ sucesso: boolean; pedidosRedistribuidos: number; erros: string[] }> {
  const erros: string[] = [];
  let pedidosRedistribuidos = 0;

  try {
    const pedidosPendentes = await db
      .select()
      .from(pedidos)
      .where(
        and(
          eq(pedidos.tenantId, tenantId),
          eq(pedidos.motoboyId, motoboyId),
          or(
            eq(pedidos.status, "saiu_entrega"),
            eq(pedidos.status, "em_transito")
          )
        )
      );

    if (pedidosPendentes.length === 0) {
      await logarDecisaoDespacho(tenantId, {
        tipo: "redistribuicao",
        motoboyId,
        motivo: "Nenhum pedido pendente para redistribuir",
      });

      return { sucesso: true, pedidosRedistribuidos: 0, erros: [] };
    }

    await db
      .update(motoboys)
      .set({
        status: "indisponivel",
        pedidosAtivos: 0,
      })
      .where(eq(motoboys.id, motoboyId));

    for (const pedido of pedidosPendentes) {
      await db
        .update(pedidos)
        .set({
          motoboyId: null,
          status: "pronto_entrega",
          saiuEntregaAt: null,
          updatedAt: new Date(),
        })
        .where(eq(pedidos.id, pedido.id));

      const outrosMotoboys = await db
        .select()
        .from(motoboys)
        .where(
          and(
            eq(motoboys.tenantId, tenantId),
            ne(motoboys.id, motoboyId),
            or(eq(motoboys.status, "disponivel"), eq(motoboys.status, "ativo"))
          )
        );

      if (outrosMotoboys.length > 0) {
        const resultado = await atribuirPedidoAutomaticamente(tenantId, pedido.id);

        if (resultado.sucesso) {
          pedidosRedistribuidos++;
        } else {
          erros.push(`Pedido ${pedido.id}: ${resultado.mensagem}`);
        }
      } else {
        erros.push(`Pedido ${pedido.id}: Nenhum outro motoboy disponível`);
      }
    }

    await logarDecisaoDespacho(tenantId, {
      tipo: "redistribuicao",
      motoboyId,
      motivo: `Redistribuição de ${pedidosPendentes.length} pedidos do motoboy ${motoboyId}`,
      detalhes: {
        totalPedidos: pedidosPendentes.length,
        redistribuidos: pedidosRedistribuidos,
        erros: erros.length,
      },
    });

    return {
      sucesso: erros.length === 0,
      pedidosRedistribuidos,
      erros,
    };
  } catch (error) {
    console.error("[SmartDispatch] Erro na redistribuição:", error);
    return {
      sucesso: false,
      pedidosRedistribuidos,
      erros: [error instanceof Error ? error.message : "Erro desconhecido"],
    };
  }
}

export async function handlePedidoPronto(tenantId: string, pedidoId: string): Promise<void> {
  try {
    console.log(`[SmartDispatch] Processando pedido pronto: ${pedidoId}`);

    const [pedido] = await db
      .select()
      .from(pedidos)
      .where(eq(pedidos.id, pedidoId))
      .limit(1);

    if (pedido && !pedido.motoboyId) {
      const resultado = await atribuirPedidoAutomaticamente(tenantId, pedidoId);

      if (resultado.sucesso) {
        console.log(`[SmartDispatch] Despacho automático: ${resultado.mensagem}`);
      } else {
        console.log(`[SmartDispatch] Despacho automático falhou: ${resultado.mensagem}`);
      }
    } else if (pedido?.motoboyId) {
      console.log(`[SmartDispatch] Pedido ${pedidoId} já possui motoboy atribuído`);
    }
  } catch (error) {
    console.error("[SmartDispatch] Erro no handler pedido:pronto:", error);
  }
}

export function inicializarSmartDispatch(): void {
  console.log("[SmartDispatch] Sistema de despacho inteligente inicializado");
}

export async function getMetricasDespacho(
  tenantId: string
): Promise<{
  totalDespachos: number;
  tempoMedioAlocacao: number;
  taxaSucesso: number;
  motoboysMaisUtilizados: Array<{ id: string; nome: string; entregas: number }>;
}> {
  const logs = await db
    .select()
    .from(systemLogs)
    .where(
      and(
        eq(systemLogs.tenantId, tenantId),
        eq(systemLogs.tipo, "smart_dispatch"),
        eq(systemLogs.acao, "atribuicao")
      )
    )
    .orderBy(desc(systemLogs.createdAt))
    .limit(100);

  const totalDespachos = logs.length;
  const tempoMedioAlocacao = 0;
  const taxaSucesso = totalDespachos > 0 ? 100 : 0;

  const contadorMotoboys: Record<string, { nome: string; entregas: number }> = {};
  
  for (const log of logs) {
    const detalhes = log.detalhes as any;
    if (log.entidadeId && detalhes?.motoboyNome) {
      if (!contadorMotoboys[log.entidadeId]) {
        contadorMotoboys[log.entidadeId] = {
          nome: detalhes.motoboyNome || "Desconhecido",
          entregas: 0,
        };
      }
      contadorMotoboys[log.entidadeId].entregas++;
    }
  }

  const motoboysMaisUtilizados = Object.entries(contadorMotoboys)
    .map(([id, dados]) => ({ id, ...dados }))
    .sort((a, b) => b.entregas - a.entregas)
    .slice(0, 5);

  return {
    totalDespachos,
    tempoMedioAlocacao,
    taxaSucesso,
    motoboysMaisUtilizados,
  };
}
