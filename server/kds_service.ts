import { db } from "./db";
import { progressoKDS, historicoTimingKDS, pedidos, produtos } from "@shared/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { ProgressoKDS } from "@shared/schema";
import { broadcastNovoPedidoKDS, broadcastEtapaAvancadaKDS, broadcastPizzaProntaKDS } from "./websocket";

export interface EtapaKDS {
  nome: string;
  tempoSegundos: number;
  instrucoes: string;
  iniciadoEm?: string;
  concluidoEm?: string;
  tempoReal?: number;
}

export interface PedidoKDSDetalhes {
  pedidoId: string;
  numeroPedido: number;
  clienteNome: string;
  horarioPedido: Date;
  pizzas: Array<{
    progressoId: string;
    produtoNome: string;
    etapaAtual: number;
    totalEtapas: number;
    statusKDS: string;
    tempoDecorrido: number | null;
    tempoEstimadoTotal: number;
    etapas: EtapaKDS[];
    iniciadoEm?: Date;
  }>;
}

export async function listarPedidosAtivosKDS(tenantId: string): Promise<PedidoKDSDetalhes[]> {
  // Buscar pedidos com status que aparecem no KDS
  const pedidosAtivos = await db
    .select()
    .from(pedidos)
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        inArray(pedidos.status, ["recebido", "em_preparo", "pendente", "confirmado"])
      )
    )
    .orderBy(sql`${pedidos.createdAt} ASC`);

  const resultado: PedidoKDSDetalhes[] = [];

  for (const pedido of pedidosAtivos) {
    // Buscar progresso KDS para cada pizza do pedido
    const progressos = await db
      .select()
      .from(progressoKDS)
      .where(eq(progressoKDS.pedidoId, pedido.id));

    if (progressos.length === 0) {
      // Se não tem progresso ainda, criar para cada item do pedido
      const itens = (pedido.itens as any[]) || [];
      for (const item of itens) {
        await criarProgressoKDS(tenantId, pedido.id, item.produtoId, item.nome);
      }
      // Re-buscar progressos criados
      const novosProgressos = await db
        .select()
        .from(progressoKDS)
        .where(eq(progressoKDS.pedidoId, pedido.id));
      
      if (novosProgressos.length > 0) {
        resultado.push(montarPedidoKDS(pedido, novosProgressos));
      }
    } else {
      resultado.push(montarPedidoKDS(pedido, progressos));
    }
  }

  return resultado;
}

function montarPedidoKDS(pedido: any, progressos: any[]): PedidoKDSDetalhes {
  return {
    pedidoId: pedido.id,
    numeroPedido: pedido.numero || 0,
    clienteNome: pedido.clienteNome || "Cliente",
    horarioPedido: pedido.createdAt,
    pizzas: progressos.map((prog) => {
      const etapas = (prog.etapas as EtapaKDS[]) || [];
      const tempoEstimadoTotal = etapas.reduce((sum, e) => sum + e.tempoSegundos, 0);
      
      let tempoDecorrido: number | null = null;
      if (prog.iniciadoEm) {
        const agora = new Date();
        const inicio = new Date(prog.iniciadoEm);
        tempoDecorrido = Math.floor((agora.getTime() - inicio.getTime()) / 1000);
      }

      return {
        progressoId: prog.id,
        produtoNome: prog.produtoNome,
        etapaAtual: prog.etapaAtual,
        totalEtapas: prog.totalEtapas,
        statusKDS: prog.statusKDS,
        tempoDecorrido,
        tempoEstimadoTotal,
        etapas,
        iniciadoEm: prog.iniciadoEm,
      };
    }),
  };
}

async function criarProgressoKDS(
  tenantId: string,
  pedidoId: string,
  produtoId: string,
  produtoNome: string
): Promise<string> {
  // Buscar etapas do produto
  const produto = await db
    .select()
    .from(produtos)
    .where(and(eq(produtos.id, produtoId), eq(produtos.tenantId, tenantId)))
    .limit(1);

  let etapas: EtapaKDS[] = [];
  if (produto.length > 0 && produto[0].etapasKDS) {
    etapas = produto[0].etapasKDS as EtapaKDS[];
  }

  // Se não tem etapas definidas, usar padrão
  if (etapas.length === 0) {
    etapas = gerarEtapasPadrao(produtoNome);
  }

  const [novoProgresso] = await db
    .insert(progressoKDS)
    .values({
      tenantId,
      pedidoId,
      produtoId,
      produtoNome,
      etapaAtual: 0,
      totalEtapas: etapas.length,
      etapas: etapas as any,
      statusKDS: "aguardando",
    })
    .returning();

  return novoProgresso.id;
}

function gerarEtapasPadrao(nomePizza: string): EtapaKDS[] {
  return [
    {
      nome: "Abrir massa",
      tempoSegundos: 180,
      instrucoes: `Esticar a massa uniformemente até 35cm de diâmetro`,
    },
    {
      nome: "Molho",
      tempoSegundos: 60,
      instrucoes: "Espalhar 120ml de molho de tomate uniformemente",
    },
    {
      nome: "Ingredientes",
      tempoSegundos: 120,
      instrucoes: `Adicionar ingredientes da ${nomePizza}`,
    },
    {
      nome: "Forno",
      tempoSegundos: 480,
      instrucoes: "Assar a 280°C por aproximadamente 8 minutos",
    },
    {
      nome: "Finalização",
      tempoSegundos: 60,
      instrucoes: "Cortar em 8 fatias e embalar",
    },
  ];
}

export async function iniciarPreparoKDS(progressoId: string, tenantId: string): Promise<any> {
  const [progresso] = await db
    .select()
    .from(progressoKDS)
    .where(and(eq(progressoKDS.id, progressoId), eq(progressoKDS.tenantId, tenantId)))
    .limit(1);

  if (!progresso) {
    throw new Error("Progresso não encontrado");
  }

  const agora = new Date();
  const etapas = (progresso.etapas as EtapaKDS[]) || [];
  
  // Marcar início da primeira etapa
  if (etapas.length > 0) {
    etapas[0].iniciadoEm = agora.toISOString();
  }

  const [atualizado] = await db
    .update(progressoKDS)
    .set({
      statusKDS: "preparando",
      iniciadoEm: agora,
      etapas: etapas as any,
    })
    .where(eq(progressoKDS.id, progressoId))
    .returning();

  // Notificar via WebSocket
  broadcastEtapaAvancadaKDS(tenantId, progressoId, 0);

  return atualizado;
}

export async function avancarEtapaKDS(progressoId: string, tenantId: string): Promise<any> {
  const [progresso] = await db
    .select()
    .from(progressoKDS)
    .where(and(eq(progressoKDS.id, progressoId), eq(progressoKDS.tenantId, tenantId)))
    .limit(1);

  if (!progresso) {
    throw new Error("Progresso não encontrado");
  }

  const etapas = (progresso.etapas as EtapaKDS[]) || [];
  const etapaAtualIndex = progresso.etapaAtual;
  
  if (etapaAtualIndex >= etapas.length) {
    throw new Error("Todas as etapas já foram concluídas");
  }

  const agora = new Date();
  const etapaAtual = etapas[etapaAtualIndex];
  
  // Marcar conclusão da etapa atual
  etapaAtual.concluidoEm = agora.toISOString();
  
  // Calcular tempo real se tem início
  if (etapaAtual.iniciadoEm) {
    const inicio = new Date(etapaAtual.iniciadoEm);
    etapaAtual.tempoReal = Math.floor((agora.getTime() - inicio.getTime()) / 1000);
    
    // Salvar no histórico
    await db.insert(historicoTimingKDS).values({
      tenantId,
      pedidoId: progresso.pedidoId,
      produtoId: progresso.produtoId || "",
      produtoNome: progresso.produtoNome,
      etapaNome: etapaAtual.nome,
      tempoEstimado: etapaAtual.tempoSegundos,
      tempoReal: etapaAtual.tempoReal,
      desvio: etapaAtual.tempoReal - etapaAtual.tempoSegundos,
      iniciadoEm: new Date(etapaAtual.iniciadoEm),
      concluidoEm: agora,
    });
  }

  const proximaEtapaIndex = etapaAtualIndex + 1;
  let novoStatus = progresso.statusKDS;
  let concluidoEm: Date | null = null;

  // Se ainda tem próxima etapa, marcar início dela
  if (proximaEtapaIndex < etapas.length) {
    etapas[proximaEtapaIndex].iniciadoEm = agora.toISOString();
  } else {
    // Todas etapas concluídas
    novoStatus = "concluido";
    concluidoEm = agora;
  }

  const [atualizado] = await db
    .update(progressoKDS)
    .set({
      etapaAtual: proximaEtapaIndex,
      statusKDS: novoStatus,
      etapas: etapas as any,
      concluidoEm,
    })
    .where(eq(progressoKDS.id, progressoId))
    .returning();

  // Notificar via WebSocket
  if (novoStatus === "concluido") {
    broadcastPizzaProntaKDS(tenantId, progressoId, progresso.produtoNome);
  } else {
    broadcastEtapaAvancadaKDS(tenantId, progressoId, proximaEtapaIndex);
  }

  return {
    progresso: atualizado,
    etapaAnterior: etapaAtualIndex,
    etapaAtual: proximaEtapaIndex,
    tempoReal: etapaAtual.tempoReal,
    tempoEstimado: etapaAtual.tempoSegundos,
    desvio: etapaAtual.tempoReal ? etapaAtual.tempoReal - etapaAtual.tempoSegundos : 0,
    proximaEtapa: proximaEtapaIndex < etapas.length ? etapas[proximaEtapaIndex] : null,
  };
}

export async function finalizarPizzaKDS(progressoId: string, tenantId: string): Promise<any> {
  const [progresso] = await db
    .select()
    .from(progressoKDS)
    .where(and(eq(progressoKDS.id, progressoId), eq(progressoKDS.tenantId, tenantId)))
    .limit(1);

  if (!progresso) {
    throw new Error("Progresso não encontrado");
  }

  const agora = new Date();
  const [atualizado] = await db
    .update(progressoKDS)
    .set({
      statusKDS: "concluido",
      concluidoEm: agora,
    })
    .where(eq(progressoKDS.id, progressoId))
    .returning();

  return atualizado;
}
