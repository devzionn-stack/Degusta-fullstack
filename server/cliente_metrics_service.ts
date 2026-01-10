import { db } from "./db";
import { clientes, pedidos, itensPedidoDetalhados, extratoConsumo } from "../shared/schema";
import { eq, and, sql, desc, count, sum, avg } from "drizzle-orm";

export interface ClienteMetricas {
  clienteId: string;
  totalPedidos: number;
  totalGasto: number;
  ticketMedio: number;
  custoGerado: number;
  lucroGerado: number;
  margemMedia: number;
  ultimoPedido: string | null;
  frequenciaMensal: number;
  pizzasMaisCompradas: { nome: string; quantidade: number }[];
}

export async function buscarMetricasCliente(tenantId: string, clienteId: string): Promise<ClienteMetricas | null> {
  const cliente = await db.query.clientes.findFirst({
    where: and(eq(clientes.id, clienteId), eq(clientes.tenantId, tenantId)),
  });

  if (!cliente) return null;

  const pedidosCliente = await db
    .select({
      totalPedidos: count(),
      totalGasto: sum(pedidos.total),
      ticketMedio: avg(pedidos.total),
      ultimoPedido: sql<string>`MAX(${pedidos.createdAt})`,
    })
    .from(pedidos)
    .where(and(eq(pedidos.clienteId, clienteId), eq(pedidos.tenantId, tenantId)));

  const custoInfo = await db
    .select({
      custoTotal: sum(extratoConsumo.custoTotal),
    })
    .from(extratoConsumo)
    .innerJoin(itensPedidoDetalhados, eq(extratoConsumo.itemPedidoId, itensPedidoDetalhados.id))
    .innerJoin(pedidos, eq(itensPedidoDetalhados.pedidoId, pedidos.id))
    .where(and(eq(pedidos.clienteId, clienteId), eq(pedidos.tenantId, tenantId)));

  const pizzasPopulares = await db
    .select({
      nome: itensPedidoDetalhados.nome,
      quantidade: count(),
    })
    .from(itensPedidoDetalhados)
    .innerJoin(pedidos, eq(itensPedidoDetalhados.pedidoId, pedidos.id))
    .where(and(eq(pedidos.clienteId, clienteId), eq(pedidos.tenantId, tenantId)))
    .groupBy(itensPedidoDetalhados.nome)
    .orderBy(desc(count()))
    .limit(5);

  const frequenciaResult = await db
    .select({
      meses: sql<number>`COUNT(DISTINCT TO_CHAR(${pedidos.createdAt}, 'YYYY-MM'))`,
      total: count(),
    })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.clienteId, clienteId),
        eq(pedidos.tenantId, tenantId),
        sql`${pedidos.createdAt} > NOW() - INTERVAL '12 months'`
      )
    );

  const stats = pedidosCliente[0];
  const custos = custoInfo[0];
  const freq = frequenciaResult[0];

  const totalGasto = Number(stats?.totalGasto || 0);
  const custoGerado = Number(custos?.custoTotal || 0);
  const lucroGerado = totalGasto - custoGerado;
  const meses = Number(freq?.meses || 1);
  const totalPedidos = Number(stats?.totalPedidos || 0);

  return {
    clienteId,
    totalPedidos,
    totalGasto,
    ticketMedio: Number(stats?.ticketMedio || 0),
    custoGerado,
    lucroGerado,
    margemMedia: totalGasto > 0 ? (lucroGerado / totalGasto) * 100 : 0,
    ultimoPedido: stats?.ultimoPedido || null,
    frequenciaMensal: meses > 0 ? totalPedidos / meses : 0,
    pizzasMaisCompradas: pizzasPopulares.map((p) => ({
      nome: p.nome,
      quantidade: Number(p.quantidade),
    })),
  };
}

export interface RankingCliente {
  id: string;
  nome: string;
  totalPedidos: number;
  totalGasto: number;
  ticketMedio: number;
  ultimoPedido: string | null;
}

export async function buscarRankingClientes(
  tenantId: string,
  limite: number = 20,
  ordenarPor: "gasto" | "pedidos" | "ticket" = "gasto"
): Promise<RankingCliente[]> {
  const orderColumn =
    ordenarPor === "gasto"
      ? sql`SUM(${pedidos.total})`
      : ordenarPor === "pedidos"
        ? sql`COUNT(*)`
        : sql`AVG(${pedidos.total})`;

  const ranking = await db
    .select({
      id: clientes.id,
      nome: clientes.nome,
      totalPedidos: count(),
      totalGasto: sum(pedidos.total),
      ticketMedio: avg(pedidos.total),
      ultimoPedido: sql<string>`MAX(${pedidos.createdAt})`,
    })
    .from(clientes)
    .leftJoin(pedidos, and(eq(pedidos.clienteId, clientes.id), eq(pedidos.tenantId, tenantId)))
    .where(eq(clientes.tenantId, tenantId))
    .groupBy(clientes.id, clientes.nome)
    .orderBy(desc(orderColumn))
    .limit(limite);

  return ranking.map((r) => ({
    id: r.id,
    nome: r.nome,
    totalPedidos: Number(r.totalPedidos || 0),
    totalGasto: Number(r.totalGasto || 0),
    ticketMedio: Number(r.ticketMedio || 0),
    ultimoPedido: r.ultimoPedido || null,
  }));
}

export interface ResumoClientes {
  totalClientes: number;
  clientesAtivos30d: number;
  ticketMedioGeral: number;
  receitaTotal: number;
  pedidosTotal: number;
}

export async function buscarResumoClientes(tenantId: string): Promise<ResumoClientes> {
  const totalClientes = await db
    .select({ count: count() })
    .from(clientes)
    .where(eq(clientes.tenantId, tenantId));

  const clientesAtivos = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${pedidos.clienteId})` })
    .from(pedidos)
    .where(
      and(eq(pedidos.tenantId, tenantId), sql`${pedidos.createdAt} > NOW() - INTERVAL '30 days'`)
    );

  const metricas = await db
    .select({
      total: count(),
      receita: sum(pedidos.total),
      ticket: avg(pedidos.total),
    })
    .from(pedidos)
    .where(eq(pedidos.tenantId, tenantId));

  return {
    totalClientes: Number(totalClientes[0]?.count || 0),
    clientesAtivos30d: Number(clientesAtivos[0]?.count || 0),
    ticketMedioGeral: Number(metricas[0]?.ticket || 0),
    receitaTotal: Number(metricas[0]?.receita || 0),
    pedidosTotal: Number(metricas[0]?.total || 0),
  };
}
