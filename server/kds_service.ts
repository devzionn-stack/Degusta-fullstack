import { db } from "./db";
import { progressoKDS, historicoTimingKDS, pedidos, produtos, templatesEtapasKDS, estoque, receitasIngredientes } from "@shared/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { ProgressoKDS } from "@shared/schema";
import { broadcastNovoPedidoKDS, broadcastEtapaAvancadaKDS, broadcastPizzaProntaKDS, broadcastPedidoCancelado, broadcastPedidoSaiuEntrega } from "./websocket";

export interface EtapaKDS {
  nome: string;
  tempoSegundos: number;
  instrucoes: string;
  iniciadoEm?: string;
  concluidoEm?: string;
  tempoReal?: number;
  pausadoEm?: string;
  tempoPausado?: number;
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
        inArray(pedidos.status, ["recebido", "em_preparo", "pendente", "confirmado", "preparando"])
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
  
  if (produto.length > 0) {
    if (produto[0].etapasKDS) {
      etapas = produto[0].etapasKDS as EtapaKDS[];
    } else if (produto[0].categoria) {
      const template = await db
        .select()
        .from(templatesEtapasKDS)
        .where(and(
          eq(templatesEtapasKDS.tenantId, tenantId),
          eq(templatesEtapasKDS.categoria, produto[0].categoria)
        ))
        .limit(1);
      
      if (template.length > 0) {
        etapas = template[0].etapas as EtapaKDS[];
      }
    }
  }

  // Se ainda não tem etapas, usar padrão
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

async function darBaixaEstoquePizza(tenantId: string, produtoId: string): Promise<void> {
  const ingredientesReceita = await db
    .select()
    .from(receitasIngredientes)
    .where(and(
      eq(receitasIngredientes.tenantId, tenantId),
      eq(receitasIngredientes.produtoId, produtoId)
    ));

  for (const item of ingredientesReceita) {
    const [estoqueItem] = await db
      .select()
      .from(estoque)
      .where(and(
        eq(estoque.tenantId, tenantId),
        eq(estoque.ingredienteId, item.ingredienteId)
      ))
      .limit(1);

    if (estoqueItem) {
      const quantidadeAtual = estoqueItem.quantidade || 0;
      const quantidadeUsada = parseFloat(item.quantidade || '0');
      const novaQuantidade = Math.max(0, Math.round(quantidadeAtual - quantidadeUsada));

      await db
        .update(estoque)
        .set({ 
          quantidade: novaQuantidade,
          updatedAt: new Date()
        })
        .where(eq(estoque.id, estoqueItem.id));
    }
  }
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
    
    // Coletar features ML
    const horaPedido = agora.getHours();
    const diaSemana = agora.getDay();
    const periodoRush = (horaPedido >= 11 && horaPedido <= 14) || (horaPedido >= 18 && horaPedido <= 22);

    // Contar pizzas simultâneas em preparo
    const pizzasSimultaneasResult = await db
      .select({ count: sql`count(*)` })
      .from(progressoKDS)
      .where(and(
        eq(progressoKDS.tenantId, tenantId),
        eq(progressoKDS.statusKDS, "preparando")
      ));

    // Buscar categoria do produto
    const [produtoInfo] = await db
      .select({ categoria: produtos.categoria })
      .from(produtos)
      .where(eq(produtos.id, progresso.produtoId || ''))
      .limit(1);

    // Contar ingredientes da receita
    let numeroIngredientes = 0;
    if (progresso.produtoId) {
      const [countResult] = await db
        .select({ count: sql`count(*)` })
        .from(receitasIngredientes)
        .where(eq(receitasIngredientes.produtoId, progresso.produtoId));
      numeroIngredientes = Number(countResult?.count) || 0;
    }

    // Salvar no histórico com features ML
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
      numeroIngredientes,
      horaPedido,
      diaSemana,
      periodoRush,
      pizzasSimultaneas: Number(pizzasSimultaneasResult[0]?.count) || 0,
      categoriaPizza: produtoInfo?.categoria || null,
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

  // Dar baixa no estoque quando pizza for concluída
  if (novoStatus === "concluido" && progresso.produtoId) {
    await darBaixaEstoquePizza(tenantId, progresso.produtoId);
  }

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

  // Dar baixa no estoque quando pizza for finalizada
  if (progresso.produtoId) {
    await darBaixaEstoquePizza(tenantId, progresso.produtoId);
  }

  return atualizado;
}

export async function marcarPedidoSaiuEntregaKDS(pedidoId: string, tenantId: string): Promise<void> {
  await db
    .update(progressoKDS)
    .set({ statusKDS: "entregue" })
    .where(and(eq(progressoKDS.pedidoId, pedidoId), eq(progressoKDS.tenantId, tenantId)));
  
  broadcastPedidoSaiuEntrega(tenantId, pedidoId);
}

export async function cancelarPedidoKDS(pedidoId: string, tenantId: string): Promise<void> {
  await db
    .delete(progressoKDS)
    .where(and(eq(progressoKDS.pedidoId, pedidoId), eq(progressoKDS.tenantId, tenantId)));
  
  broadcastPedidoCancelado(tenantId, pedidoId);
}

export async function pausarPreparoKDS(progressoId: string, tenantId: string): Promise<any> {
  const [progresso] = await db
    .select()
    .from(progressoKDS)
    .where(and(eq(progressoKDS.id, progressoId), eq(progressoKDS.tenantId, tenantId)))
    .limit(1);

  if (!progresso) {
    throw new Error("Progresso não encontrado");
  }

  const etapas = (progresso.etapas as EtapaKDS[]) || [];
  const etapaAtual = etapas[progresso.etapaAtual];
  
  if (etapaAtual && etapaAtual.iniciadoEm && !etapaAtual.pausadoEm) {
    const agora = new Date();
    etapaAtual.pausadoEm = agora.toISOString();
  }

  const [atualizado] = await db
    .update(progressoKDS)
    .set({
      statusKDS: "pausado",
      etapas: etapas as any,
    })
    .where(eq(progressoKDS.id, progressoId))
    .returning();

  return atualizado;
}

export async function retomarPreparoKDS(progressoId: string, tenantId: string): Promise<any> {
  const [progresso] = await db
    .select()
    .from(progressoKDS)
    .where(and(eq(progressoKDS.id, progressoId), eq(progressoKDS.tenantId, tenantId)))
    .limit(1);

  if (!progresso) {
    throw new Error("Progresso não encontrado");
  }

  const etapas = (progresso.etapas as EtapaKDS[]) || [];
  const etapaAtual = etapas[progresso.etapaAtual];
  
  if (etapaAtual && etapaAtual.pausadoEm) {
    const pausadoEm = new Date(etapaAtual.pausadoEm);
    const agora = new Date();
    const tempoPausa = Math.floor((agora.getTime() - pausadoEm.getTime()) / 1000);
    etapaAtual.tempoPausado = (etapaAtual.tempoPausado || 0) + tempoPausa;
    delete etapaAtual.pausadoEm;
  }

  const [atualizado] = await db
    .update(progressoKDS)
    .set({
      statusKDS: "preparando",
      etapas: etapas as any,
    })
    .where(eq(progressoKDS.id, progressoId))
    .returning();

  broadcastEtapaAvancadaKDS(tenantId, progressoId, progresso.etapaAtual);

  return atualizado;
}

export interface MetricasKDS {
  pizzasHora: number;
  tempoMedio: number;
  pizzasAtrasadas: number;
  totalAguardando: number;
  totalPreparando: number;
  totalConcluidas: number;
}

export async function obterMetricasKDS(tenantId: string): Promise<MetricasKDS> {
  const agora = new Date();
  const umaHoraAtras = new Date(agora.getTime() - 60 * 60 * 1000);

  const pizzasConcluidas = await db
    .select()
    .from(progressoKDS)
    .where(
      and(
        eq(progressoKDS.tenantId, tenantId),
        eq(progressoKDS.statusKDS, "concluido"),
        sql`${progressoKDS.concluidoEm} >= ${umaHoraAtras}`
      )
    );

  const pizzasAtivas = await db
    .select()
    .from(progressoKDS)
    .where(
      and(
        eq(progressoKDS.tenantId, tenantId),
        inArray(progressoKDS.statusKDS, ["aguardando", "preparando", "pausado"])
      )
    );

  let pizzasAtrasadas = 0;
  for (const pizza of pizzasAtivas) {
    if (pizza.iniciadoEm) {
      const inicio = new Date(pizza.iniciadoEm);
      const decorrido = Math.floor((agora.getTime() - inicio.getTime()) / 1000);
      const etapas = (pizza.etapas as any[]) || [];
      const tempoEstimado = etapas.reduce((sum, e) => sum + e.tempoSegundos, 0);
      if (decorrido > tempoEstimado) {
        pizzasAtrasadas++;
      }
    }
  }

  let tempoTotal = 0;
  for (const pizza of pizzasConcluidas) {
    if (pizza.iniciadoEm && pizza.concluidoEm) {
      const inicio = new Date(pizza.iniciadoEm);
      const fim = new Date(pizza.concluidoEm);
      tempoTotal += Math.floor((fim.getTime() - inicio.getTime()) / 1000);
    }
  }
  const tempoMedio = pizzasConcluidas.length > 0 ? Math.floor(tempoTotal / pizzasConcluidas.length) : 0;

  return {
    pizzasHora: pizzasConcluidas.length,
    tempoMedio,
    pizzasAtrasadas,
    totalAguardando: pizzasAtivas.filter(p => p.statusKDS === "aguardando").length,
    totalPreparando: pizzasAtivas.filter(p => p.statusKDS === "preparando" || p.statusKDS === "pausado").length,
    totalConcluidas: pizzasConcluidas.length,
  };
}
