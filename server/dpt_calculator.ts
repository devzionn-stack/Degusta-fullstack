import { db } from "./db";
import { historicoPreparo, pedidos, produtos } from "@shared/schema";
import { eq, and, desc, sql, gte, isNotNull } from "drizzle-orm";

export interface DPTResult {
  tempoPreparoEstimado: number;
  tempoEntregaEstimado: number;
  fatorFila: number;
  confianca: number;
  detalhes: {
    tempoBaseProdutos: number;
    ajusteFila: number;
    pedidosNaFila: number;
  };
}

export interface DPTRealtimeInfo {
  pedidoId: string;
  status: string;
  tempoPreparoEstimado: number;
  tempoRestante: number;
  progresso: number;
  atrasado: boolean;
  prioridadeOrdenacao: number;
}

const TEMPO_ENTREGA_BASE = 15;
const TEMPO_PREPARO_PADRAO = 15;
const MAX_FATOR_FILA = 2.0;
const PESO_HISTORICO = 0.7;
const PESO_ESTIMATIVA = 0.3;

export async function calcularDPT(
  tenantId: string,
  itens: Array<{ produtoId?: string; nome: string; quantidade: number }>
): Promise<DPTResult> {
  let tempoBaseProdutos = 0;
  const agora = new Date();
  const umaSemanaAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const item of itens) {
    let tempoProduto = TEMPO_PREPARO_PADRAO;

    if (item.produtoId) {
      const produto = await db
        .select()
        .from(produtos)
        .where(and(eq(produtos.id, item.produtoId), eq(produtos.tenantId, tenantId)))
        .limit(1);

      if (produto.length > 0 && produto[0].tempoPreparoEstimado) {
        tempoProduto = produto[0].tempoPreparoEstimado;
      }

      const historico = await db
        .select({
          avgReal: sql<number>`AVG(${historicoPreparo.tempoReal})`.as("avgReal"),
          count: sql<number>`COUNT(*)`.as("count"),
        })
        .from(historicoPreparo)
        .where(
          and(
            eq(historicoPreparo.tenantId, tenantId),
            eq(historicoPreparo.produtoId, item.produtoId),
            gte(historicoPreparo.createdAt, umaSemanaAtras),
            isNotNull(historicoPreparo.tempoReal)
          )
        );

      if (historico.length > 0 && historico[0].count > 0 && historico[0].avgReal) {
        tempoProduto = Math.round(
          PESO_HISTORICO * historico[0].avgReal + PESO_ESTIMATIVA * tempoProduto
        );
      }
    }

    tempoBaseProdutos += tempoProduto * item.quantidade;
  }

  tempoBaseProdutos = Math.max(tempoBaseProdutos, TEMPO_PREPARO_PADRAO);

  const pedidosNaFila = await db
    .select({ count: sql<number>`COUNT(*)`.as("count") })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        sql`${pedidos.status} IN ('pendente', 'em_preparo', 'confirmado')`
      )
    );

  const numPedidosFila = pedidosNaFila[0]?.count || 0;

  const fatorFila = Math.min(1 + numPedidosFila * 0.1, MAX_FATOR_FILA);

  const ajusteFila = Math.round(tempoBaseProdutos * (fatorFila - 1));
  const tempoPreparoEstimado = tempoBaseProdutos + ajusteFila;

  const tempoEntregaEstimado = tempoPreparoEstimado + TEMPO_ENTREGA_BASE;

  let confianca = 85;
  if (numPedidosFila > 10) confianca -= 10;
  if (numPedidosFila > 20) confianca -= 10;
  if (tempoBaseProdutos > 60) confianca -= 5;

  return {
    tempoPreparoEstimado,
    tempoEntregaEstimado,
    fatorFila,
    confianca: Math.max(confianca, 50),
    detalhes: {
      tempoBaseProdutos,
      ajusteFila,
      pedidosNaFila: numPedidosFila,
    },
  };
}

export async function obterDPTRealtime(tenantId: string): Promise<DPTRealtimeInfo[]> {
  const agora = new Date();

  const pedidosAtivos = await db
    .select()
    .from(pedidos)
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        sql`${pedidos.status} IN ('pendente', 'em_preparo', 'confirmado')`
      )
    )
    .orderBy(desc(pedidos.createdAt));

  const resultado: DPTRealtimeInfo[] = [];

  for (const pedido of pedidosAtivos) {
    const tempoEstimado = pedido.tempoPreparoEstimado || TEMPO_PREPARO_PADRAO;
    const inicioRef = pedido.inicioPreparoAt || pedido.createdAt;
    const tempoDecorrido = Math.round(
      (agora.getTime() - new Date(inicioRef).getTime()) / 60000
    );

    const tempoRestante = Math.max(0, tempoEstimado - tempoDecorrido);
    const progresso = Math.min(100, Math.round((tempoDecorrido / tempoEstimado) * 100));
    const atrasado = tempoDecorrido > tempoEstimado;

    let prioridadeOrdenacao = tempoRestante;
    if (atrasado) prioridadeOrdenacao = -tempoDecorrido;
    if (pedido.status === "em_preparo") prioridadeOrdenacao -= 1000;

    resultado.push({
      pedidoId: pedido.id,
      status: pedido.status,
      tempoPreparoEstimado: tempoEstimado,
      tempoRestante,
      progresso,
      atrasado,
      prioridadeOrdenacao,
    });
  }

  resultado.sort((a, b) => a.prioridadeOrdenacao - b.prioridadeOrdenacao);

  return resultado;
}

export async function registrarInicioPreparoPedido(
  tenantId: string,
  pedidoId: string
): Promise<void> {
  const agora = new Date();

  await db
    .update(pedidos)
    .set({
      status: "em_preparo",
      inicioPreparoAt: agora,
      updatedAt: agora,
    })
    .where(and(eq(pedidos.id, pedidoId), eq(pedidos.tenantId, tenantId)));

  const pedido = await db
    .select()
    .from(pedidos)
    .where(and(eq(pedidos.id, pedidoId), eq(pedidos.tenantId, tenantId)))
    .limit(1);

  if (pedido.length > 0 && pedido[0].itens) {
    const itens = pedido[0].itens as Array<{
      produtoId?: string;
      nome: string;
      quantidade: number;
    }>;

    for (const item of itens) {
      const tempoProduto = TEMPO_PREPARO_PADRAO;

      if (item.produtoId) {
        const produto = await db
          .select()
          .from(produtos)
          .where(and(eq(produtos.id, item.produtoId), eq(produtos.tenantId, tenantId)))
          .limit(1);

        const tempoEst = produto.length > 0 && produto[0].tempoPreparoEstimado
          ? produto[0].tempoPreparoEstimado
          : TEMPO_PREPARO_PADRAO;

        await db.insert(historicoPreparo).values({
          tenantId,
          pedidoId,
          produtoId: item.produtoId,
          produtoNome: item.nome,
          tempoEstimado: tempoEst,
          inicioAt: agora,
        });
      } else {
        await db.insert(historicoPreparo).values({
          tenantId,
          pedidoId,
          produtoNome: item.nome,
          tempoEstimado: tempoProduto,
          inicioAt: agora,
        });
      }
    }
  }
}

export async function registrarFimPreparoPedido(
  tenantId: string,
  pedidoId: string
): Promise<void> {
  const agora = new Date();

  await db
    .update(pedidos)
    .set({
      status: "pronto",
      prontoEntregaAt: agora,
      updatedAt: agora,
    })
    .where(and(eq(pedidos.id, pedidoId), eq(pedidos.tenantId, tenantId)));

  const registros = await db
    .select()
    .from(historicoPreparo)
    .where(
      and(
        eq(historicoPreparo.pedidoId, pedidoId),
        eq(historicoPreparo.tenantId, tenantId)
      )
    );

  for (const registro of registros) {
    const tempoReal = Math.round(
      (agora.getTime() - new Date(registro.inicioAt).getTime()) / 60000
    );

    await db
      .update(historicoPreparo)
      .set({
        fimAt: agora,
        tempoReal,
      })
      .where(eq(historicoPreparo.id, registro.id));

    if (registro.produtoId) {
      await atualizarTempoEstimadoProduto(tenantId, registro.produtoId);
    }
  }
}

async function atualizarTempoEstimadoProduto(
  tenantId: string,
  produtoId: string
): Promise<void> {
  const umaSemanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const historico = await db
    .select({
      avgReal: sql<number>`AVG(${historicoPreparo.tempoReal})`.as("avgReal"),
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(historicoPreparo)
    .where(
      and(
        eq(historicoPreparo.tenantId, tenantId),
        eq(historicoPreparo.produtoId, produtoId),
        gte(historicoPreparo.createdAt, umaSemanaAtras),
        isNotNull(historicoPreparo.tempoReal)
      )
    );

  if (historico.length > 0 && historico[0].count >= 5 && historico[0].avgReal) {
    const produto = await db
      .select()
      .from(produtos)
      .where(and(eq(produtos.id, produtoId), eq(produtos.tenantId, tenantId)))
      .limit(1);

    if (produto.length > 0) {
      const tempoAtual = produto[0].tempoPreparoEstimado || TEMPO_PREPARO_PADRAO;
      const novoTempo = Math.round(
        PESO_HISTORICO * historico[0].avgReal + PESO_ESTIMATIVA * tempoAtual
      );

      await db
        .update(produtos)
        .set({ tempoPreparoEstimado: novoTempo })
        .where(eq(produtos.id, produtoId));
    }
  }
}
