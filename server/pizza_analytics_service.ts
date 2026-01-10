import { db } from "./db";
import { 
  pizzasPersonalizadas, 
  itensPedidoDetalhados, 
  pedidos, 
  produtos,
  extratoConsumo,
  ingredientes 
} from "../shared/schema";
import { eq, and, sql, desc, count, sum, avg, gte } from "drizzle-orm";

export interface PizzaPopular {
  pizzaId: string;
  nome: string;
  hashSabores: string;
  quantidadeVendida: number;
  receitaTotal: number;
  saboresNomes: string[];
}

export interface TendenciaDiaria {
  data: string;
  totalPedidos: number;
  totalPizzas: number;
  receitaTotal: number;
  ticketMedio: number;
}

export interface TendenciaSabor {
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  tendencia: "subindo" | "estavel" | "descendo";
  variacao: number;
}

export interface AnalyticsSummary {
  pizzasPersonalizadasTotal: number;
  pedidosUltimos30Dias: number;
  pizzasUltimos30Dias: number;
  receitaUltimos30Dias: number;
  crescimentoMensal: number;
  horarioPico: string;
  diaSemanaPopular: string;
}

export async function buscarPizzasPopulares(
  tenantId: string, 
  limite: number = 10,
  diasAtras: number = 30
): Promise<PizzaPopular[]> {
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - diasAtras);

  const pizzas = await db
    .select({
      pizzaId: pizzasPersonalizadas.id,
      nome: pizzasPersonalizadas.nome,
      hashSabores: pizzasPersonalizadas.hashSabores,
      saboresJson: pizzasPersonalizadas.sabores,
      quantidade: count(),
      receita: sum(itensPedidoDetalhados.preco),
    })
    .from(itensPedidoDetalhados)
    .innerJoin(pizzasPersonalizadas, eq(itensPedidoDetalhados.pizzaPersonalizadaId, pizzasPersonalizadas.id))
    .innerJoin(pedidos, eq(itensPedidoDetalhados.pedidoId, pedidos.id))
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        gte(pedidos.createdAt, dataInicio)
      )
    )
    .groupBy(
      pizzasPersonalizadas.id,
      pizzasPersonalizadas.nome,
      pizzasPersonalizadas.hashSabores,
      pizzasPersonalizadas.sabores
    )
    .orderBy(desc(count()))
    .limit(limite);

  return pizzas.map((p) => {
    const receita = Number(p.receita || 0);
    const sabores = (p.saboresJson as any[]) || [];
    
    return {
      pizzaId: p.pizzaId,
      nome: p.nome || "Pizza Personalizada",
      hashSabores: p.hashSabores,
      quantidadeVendida: Number(p.quantidade),
      receitaTotal: receita,
      saboresNomes: sabores.map((s: any) => s.produtoNome || s.nome || ""),
    };
  });
}

export async function buscarTendenciaDiaria(
  tenantId: string,
  diasAtras: number = 30
): Promise<TendenciaDiaria[]> {
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - diasAtras);

  const tendencia = await db
    .select({
      data: sql<string>`DATE(${pedidos.createdAt})`,
      totalPedidos: count(sql`DISTINCT ${pedidos.id}`),
      totalPizzas: count(itensPedidoDetalhados.id),
      receitaTotal: sum(pedidos.total),
    })
    .from(pedidos)
    .leftJoin(itensPedidoDetalhados, eq(itensPedidoDetalhados.pedidoId, pedidos.id))
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        gte(pedidos.createdAt, dataInicio)
      )
    )
    .groupBy(sql`DATE(${pedidos.createdAt})`)
    .orderBy(sql`DATE(${pedidos.createdAt})`);

  return tendencia.map((t) => ({
    data: String(t.data),
    totalPedidos: Number(t.totalPedidos),
    totalPizzas: Number(t.totalPizzas),
    receitaTotal: Number(t.receitaTotal || 0),
    ticketMedio: Number(t.totalPedidos) > 0 
      ? Number(t.receitaTotal || 0) / Number(t.totalPedidos)
      : 0,
  }));
}

export async function buscarTendenciaSabores(
  tenantId: string,
  diasAtras: number = 30
): Promise<TendenciaSabor[]> {
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - diasAtras);
  
  const dataMetade = new Date();
  dataMetade.setDate(dataMetade.getDate() - Math.floor(diasAtras / 2));

  const primeiraMetade = await db
    .select({
      produtoId: produtos.id,
      produtoNome: produtos.nome,
      quantidade: count(),
    })
    .from(itensPedidoDetalhados)
    .innerJoin(pedidos, eq(itensPedidoDetalhados.pedidoId, pedidos.id))
    .innerJoin(produtos, eq(itensPedidoDetalhados.produtoId, produtos.id))
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        gte(pedidos.createdAt, dataInicio),
        sql`${pedidos.createdAt} < ${dataMetade}`
      )
    )
    .groupBy(produtos.id, produtos.nome);

  const segundaMetade = await db
    .select({
      produtoId: produtos.id,
      produtoNome: produtos.nome,
      quantidade: count(),
    })
    .from(itensPedidoDetalhados)
    .innerJoin(pedidos, eq(itensPedidoDetalhados.pedidoId, pedidos.id))
    .innerJoin(produtos, eq(itensPedidoDetalhados.produtoId, produtos.id))
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        gte(pedidos.createdAt, dataMetade)
      )
    )
    .groupBy(produtos.id, produtos.nome);

  const mapaSegundaMetade = new Map(segundaMetade.map(s => [s.produtoId, s]));
  
  const tendencias: TendenciaSabor[] = [];
  
  for (const primeiro of primeiraMetade) {
    const segundo = mapaSegundaMetade.get(primeiro.produtoId);
    const qtd1 = Number(primeiro.quantidade);
    const qtd2 = segundo ? Number(segundo.quantidade) : 0;
    const variacao = qtd1 > 0 ? ((qtd2 - qtd1) / qtd1) * 100 : qtd2 > 0 ? 100 : 0;
    
    tendencias.push({
      produtoId: primeiro.produtoId,
      produtoNome: primeiro.produtoNome,
      quantidade: qtd1 + qtd2,
      tendencia: variacao > 10 ? "subindo" : variacao < -10 ? "descendo" : "estavel",
      variacao,
    });
  }

  for (const [id, segundo] of mapaSegundaMetade) {
    if (!primeiraMetade.find(p => p.produtoId === id)) {
      tendencias.push({
        produtoId: segundo.produtoId,
        produtoNome: segundo.produtoNome,
        quantidade: Number(segundo.quantidade),
        tendencia: "subindo",
        variacao: 100,
      });
    }
  }

  return tendencias.sort((a, b) => b.quantidade - a.quantidade).slice(0, 20);
}

export async function buscarAnalyticsSummary(tenantId: string): Promise<AnalyticsSummary> {
  const agora = new Date();
  const trinta_dias = new Date(agora);
  trinta_dias.setDate(trinta_dias.getDate() - 30);
  
  const sessenta_dias = new Date(agora);
  sessenta_dias.setDate(sessenta_dias.getDate() - 60);

  const totalPizzas = await db
    .select({ count: count() })
    .from(pizzasPersonalizadas)
    .where(eq(pizzasPersonalizadas.tenantId, tenantId));

  const metricas30d = await db
    .select({
      pedidos: count(sql`DISTINCT ${pedidos.id}`),
      pizzas: count(itensPedidoDetalhados.id),
      receita: sum(pedidos.total),
    })
    .from(pedidos)
    .leftJoin(itensPedidoDetalhados, eq(itensPedidoDetalhados.pedidoId, pedidos.id))
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        gte(pedidos.createdAt, trinta_dias)
      )
    );

  const metricasMesAnterior = await db
    .select({
      receita: sum(pedidos.total),
    })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        gte(pedidos.createdAt, sessenta_dias),
        sql`${pedidos.createdAt} < ${trinta_dias}`
      )
    );

  const horarioPico = await db
    .select({
      hora: sql<number>`EXTRACT(HOUR FROM ${pedidos.createdAt})`,
      quantidade: count(),
    })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        gte(pedidos.createdAt, trinta_dias)
      )
    )
    .groupBy(sql`EXTRACT(HOUR FROM ${pedidos.createdAt})`)
    .orderBy(desc(count()))
    .limit(1);

  const diaPico = await db
    .select({
      dia: sql<number>`EXTRACT(DOW FROM ${pedidos.createdAt})`,
      quantidade: count(),
    })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        gte(pedidos.createdAt, trinta_dias)
      )
    )
    .groupBy(sql`EXTRACT(DOW FROM ${pedidos.createdAt})`)
    .orderBy(desc(count()))
    .limit(1);

  const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  const receitaAtual = Number(metricas30d[0]?.receita || 0);
  const receitaAnterior = Number(metricasMesAnterior[0]?.receita || 0);
  const crescimento = receitaAnterior > 0 
    ? ((receitaAtual - receitaAnterior) / receitaAnterior) * 100 
    : receitaAtual > 0 ? 100 : 0;

  return {
    pizzasPersonalizadasTotal: Number(totalPizzas[0]?.count || 0),
    pedidosUltimos30Dias: Number(metricas30d[0]?.pedidos || 0),
    pizzasUltimos30Dias: Number(metricas30d[0]?.pizzas || 0),
    receitaUltimos30Dias: receitaAtual,
    crescimentoMensal: crescimento,
    horarioPico: horarioPico[0] ? `${horarioPico[0].hora}:00 - ${horarioPico[0].hora}:59` : "N/A",
    diaSemanaPopular: diaPico[0] ? diasSemana[Number(diaPico[0].dia)] : "N/A",
  };
}

export interface IngredienteConsumo {
  ingredienteId: string;
  nome: string;
  quantidadeConsumida: number;
  unidade: string;
  custoTotal: number;
}

export async function buscarConsumoIngredientes(
  tenantId: string,
  diasAtras: number = 30
): Promise<IngredienteConsumo[]> {
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - diasAtras);

  const consumo = await db
    .select({
      ingredienteId: extratoConsumo.ingredienteId,
      nome: extratoConsumo.ingredienteNome,
      quantidade: sum(extratoConsumo.quantidadeUsada),
      unidade: extratoConsumo.unidade,
      custo: sum(extratoConsumo.custoTotal),
    })
    .from(extratoConsumo)
    .innerJoin(pedidos, eq(extratoConsumo.pedidoId, pedidos.id))
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        gte(pedidos.createdAt, dataInicio)
      )
    )
    .groupBy(
      extratoConsumo.ingredienteId,
      extratoConsumo.ingredienteNome,
      extratoConsumo.unidade
    )
    .orderBy(desc(sum(extratoConsumo.custoTotal)))
    .limit(20);

  return consumo.map((c) => ({
    ingredienteId: c.ingredienteId || "",
    nome: c.nome || "Desconhecido",
    quantidadeConsumida: Number(c.quantidade || 0),
    unidade: c.unidade || "un",
    custoTotal: Number(c.custo || 0),
  }));
}
