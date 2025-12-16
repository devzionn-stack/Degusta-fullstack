import { db } from "./db";
import { pedidos, produtos, etapasProducao } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

interface ItemPedido {
  produtoId?: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
}

interface TempoLoopResult {
  tempoTotalPreparo: number;
  numeroEtapas: number;
  tempoLoop: number;
  tempoMetaMontagem: number;
  etapas: Array<{
    nome: string;
    tempoMeta: number;
    momentoAcao: number;
  }>;
}

export async function calcularTempoLoop(
  tenantId: string,
  itens: ItemPedido[]
): Promise<TempoLoopResult> {
  const produtoIds = itens
    .filter((item) => item.produtoId)
    .map((item) => item.produtoId as string);

  let tempoTotalPreparo = 0;

  if (produtoIds.length > 0) {
    const produtosData = await db
      .select({
        id: produtos.id,
        tempoPreparoEstimado: produtos.tempoPreparoEstimado,
        tempoExtraPreparo: produtos.tempoExtraPreparo,
      })
      .from(produtos)
      .where(
        and(eq(produtos.tenantId, tenantId), inArray(produtos.id, produtoIds))
      );

    const produtosMap = new Map(produtosData.map((p) => [p.id, p]));

    for (const item of itens) {
      if (item.produtoId && produtosMap.has(item.produtoId)) {
        const produto = produtosMap.get(item.produtoId)!;
        const tempoPreparo = (produto.tempoPreparoEstimado || 15) * 60;
        const tempoExtra = (produto.tempoExtraPreparo || 0) * 60;
        tempoTotalPreparo += (tempoPreparo + tempoExtra) * item.quantidade;
      } else {
        tempoTotalPreparo += 15 * 60 * item.quantidade;
      }
    }
  } else {
    tempoTotalPreparo = itens.reduce(
      (acc, item) => acc + 15 * 60 * item.quantidade,
      0
    );
  }

  const etapasData = await db
    .select()
    .from(etapasProducao)
    .where(eq(etapasProducao.tenantId, tenantId))
    .orderBy(etapasProducao.ordem);

  const numeroEtapas = etapasData.length || 4;
  const tempoLoopSegundos = Math.ceil(tempoTotalPreparo / numeroEtapas);
  const tempoLoopMinutos = Math.ceil(tempoLoopSegundos / 60);

  const tempoMetaMontagemMinutos = Math.ceil(tempoTotalPreparo / 60);

  const etapasComMomento = etapasData.map((etapa, index) => {
    const momentoAcao = tempoTotalPreparo - etapa.tempoMetaSegundos * (index + 1);
    return {
      nome: etapa.nome,
      tempoMeta: etapa.tempoMetaSegundos,
      momentoAcao: Math.max(0, momentoAcao),
    };
  });

  if (etapasData.length === 0) {
    const etapasPadrao = [
      { nome: "Abrir Disco", tempoMeta: 60 },
      { nome: "Montagem", tempoMeta: 120 },
      { nome: "Forno", tempoMeta: 300 },
      { nome: "Finalização", tempoMeta: 60 },
    ];

    let tempoAcumulado = 0;
    for (const etapa of etapasPadrao) {
      etapasComMomento.push({
        nome: etapa.nome,
        tempoMeta: etapa.tempoMeta,
        momentoAcao: tempoTotalPreparo - tempoAcumulado - etapa.tempoMeta,
      });
      tempoAcumulado += etapa.tempoMeta;
    }
  }

  return {
    tempoTotalPreparo,
    numeroEtapas,
    tempoLoop: tempoLoopMinutos,
    tempoMetaMontagem: tempoMetaMontagemMinutos,
    etapas: etapasComMomento,
  };
}

export async function atualizarTimingPedido(
  pedidoId: string,
  tenantId: string
): Promise<void> {
  const pedido = await db
    .select()
    .from(pedidos)
    .where(and(eq(pedidos.id, pedidoId), eq(pedidos.tenantId, tenantId)))
    .limit(1);

  if (pedido.length === 0) {
    throw new Error("Pedido não encontrado");
  }

  const itens = (pedido[0].itens as ItemPedido[]) || [];
  const timing = await calcularTempoLoop(tenantId, itens);

  await db
    .update(pedidos)
    .set({
      tempoMetaMontagem: timing.tempoMetaMontagem,
      numeroLoop: timing.tempoLoop,
      tempoPreparoEstimado: Math.ceil(timing.tempoTotalPreparo / 60),
      updatedAt: new Date(),
    })
    .where(eq(pedidos.id, pedidoId));
}

export interface StatusProducao {
  pedidoId: string;
  status: string;
  inicioPreparoAt: Date | null;
  tempoDecorrido: number;
  tempoMetaMontagem: number;
  numeroLoop: number;
  progresso: number;
  urgencia: "verde" | "amarelo" | "vermelho";
  etapaAtual: string;
  proximaEtapa: string | null;
  tempoRestante: number;
}

export async function getStatusProducaoPedido(
  pedidoId: string,
  tenantId: string
): Promise<StatusProducao | null> {
  const pedido = await db
    .select()
    .from(pedidos)
    .where(and(eq(pedidos.id, pedidoId), eq(pedidos.tenantId, tenantId)))
    .limit(1);

  if (pedido.length === 0) {
    return null;
  }

  const p = pedido[0];
  const agora = new Date();
  const inicioPreparoAt = p.inicioPreparoAt;
  const tempoMetaMontagem = (p.tempoMetaMontagem || 15) * 60;
  const numeroLoop = p.numeroLoop || 5;

  let tempoDecorrido = 0;
  if (inicioPreparoAt) {
    tempoDecorrido = Math.floor(
      (agora.getTime() - inicioPreparoAt.getTime()) / 1000
    );
  }

  const progressoReal = (tempoDecorrido / tempoMetaMontagem) * 100;
  const progresso = Math.round(progressoReal);
  const tempoRestante = tempoMetaMontagem - tempoDecorrido;

  let urgencia: "verde" | "amarelo" | "vermelho" = "verde";
  if (progressoReal >= 100) {
    urgencia = "vermelho";
  } else if (progressoReal >= 80) {
    urgencia = "amarelo";
  }

  const etapasData = await db
    .select()
    .from(etapasProducao)
    .where(eq(etapasProducao.tenantId, tenantId))
    .orderBy(etapasProducao.ordem);

  let etapaAtual = "Preparação";
  let proximaEtapa: string | null = null;

  if (etapasData.length > 0) {
    let tempoAcumulado = 0;
    let encontrouEtapa = false;
    for (let i = 0; i < etapasData.length; i++) {
      tempoAcumulado += etapasData[i].tempoMetaSegundos;
      if (tempoDecorrido < tempoAcumulado) {
        etapaAtual = etapasData[i].nome;
        proximaEtapa = i < etapasData.length - 1 ? etapasData[i + 1].nome : null;
        encontrouEtapa = true;
        break;
      }
    }
    if (!encontrouEtapa && etapasData.length > 0) {
      etapaAtual = etapasData[etapasData.length - 1].nome + " (atrasado)";
      proximaEtapa = null;
    }
  }

  return {
    pedidoId: p.id,
    status: p.status,
    inicioPreparoAt,
    tempoDecorrido,
    tempoMetaMontagem,
    numeroLoop,
    progresso,
    urgencia,
    etapaAtual,
    proximaEtapa,
    tempoRestante,
  };
}

export async function listarPedidosProducao(
  tenantId: string
): Promise<StatusProducao[]> {
  const pedidosAtivos = await db
    .select()
    .from(pedidos)
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        inArray(pedidos.status, [
          "recebido",
          "em_preparo",
          "pendente",
          "confirmado",
        ])
      )
    );

  const resultados: StatusProducao[] = [];

  for (const pedido of pedidosAtivos) {
    const status = await getStatusProducaoPedido(pedido.id, tenantId);
    if (status) {
      resultados.push(status);
    }
  }

  resultados.sort((a, b) => {
    if (a.urgencia === "vermelho" && b.urgencia !== "vermelho") return -1;
    if (a.urgencia !== "vermelho" && b.urgencia === "vermelho") return 1;
    if (a.urgencia === "amarelo" && b.urgencia === "verde") return -1;
    if (a.urgencia === "verde" && b.urgencia === "amarelo") return 1;
    return b.progresso - a.progresso;
  });

  return resultados;
}
