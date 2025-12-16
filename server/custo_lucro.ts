import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  produtos,
  ingredientes,
  receitasIngredientes,
  custoMercado,
  pedidos,
  tenants,
} from "@shared/schema";

export interface CustoProduto {
  produtoId: string;
  produtoNome: string;
  precoVenda: number;
  custoReal: number;
  lucroBruto: number;
  margemLucro: number;
  ingredientes: {
    ingredienteId: string;
    nome: string;
    quantidade: number;
    unidade: string;
    custoUnitario: number;
    custoTotal: number;
  }[];
}

export interface LucroFranquia {
  tenantId: string;
  tenantNome: string;
  totalVendas: number;
  custoTotalIngredientes: number;
  lucroBrutoTotal: number;
  margemLucroMedia: number;
  produtosVendidos: number;
}

export interface LucroIngrediente {
  ingredienteId: string;
  ingredienteNome: string;
  unidade: string;
  custoAtual: number;
  quantidadeUsada: number;
  custoTotalPeriodo: number;
  produtosQueUsam: number;
}

export async function atualizarPrecoMercado(
  ingredienteId: string,
  precoMercado: number,
  tenantId: string,
  fornecedor?: string
): Promise<{ sucesso: boolean; erro?: string }> {
  const ingrediente = await db
    .select()
    .from(ingredientes)
    .where(
      and(
        eq(ingredientes.id, ingredienteId),
        eq(ingredientes.tenantId, tenantId)
      )
    )
    .limit(1);

  if (ingrediente.length === 0) {
    return { sucesso: false, erro: "Ingrediente não encontrado ou não pertence ao tenant" };
  }

  await db.insert(custoMercado).values({
    ingredienteId,
    precoMercado: precoMercado.toFixed(4),
    fornecedor,
    dataAtualizacao: new Date(),
  });

  await db
    .update(ingredientes)
    .set({ custoUnitario: precoMercado.toFixed(4) })
    .where(
      and(
        eq(ingredientes.id, ingredienteId),
        eq(ingredientes.tenantId, tenantId)
      )
    );

  return { sucesso: true };
}

export async function getCustoIngredienteAtual(
  ingredienteId: string
): Promise<number> {
  const historico = await db
    .select()
    .from(custoMercado)
    .where(eq(custoMercado.ingredienteId, ingredienteId))
    .orderBy(desc(custoMercado.dataAtualizacao))
    .limit(1);

  if (historico.length > 0) {
    return parseFloat(historico[0].precoMercado);
  }

  const ingrediente = await db
    .select()
    .from(ingredientes)
    .where(eq(ingredientes.id, ingredienteId))
    .limit(1);

  return ingrediente[0]?.custoUnitario
    ? parseFloat(ingrediente[0].custoUnitario)
    : 0;
}

export async function getCustoIngredienteNaData(
  ingredienteId: string,
  data: Date
): Promise<number> {
  const historico = await db
    .select()
    .from(custoMercado)
    .where(
      and(
        eq(custoMercado.ingredienteId, ingredienteId),
        sql`${custoMercado.dataAtualizacao} <= ${data}`
      )
    )
    .orderBy(desc(custoMercado.dataAtualizacao))
    .limit(1);

  if (historico.length > 0) {
    return parseFloat(historico[0].precoMercado);
  }

  const ingrediente = await db
    .select()
    .from(ingredientes)
    .where(eq(ingredientes.id, ingredienteId))
    .limit(1);

  return ingrediente[0]?.custoUnitario
    ? parseFloat(ingrediente[0].custoUnitario)
    : 0;
}

export async function calcularCustoProduto(
  produtoId: string,
  tenantId: string
): Promise<CustoProduto | null> {
  const produto = await db
    .select()
    .from(produtos)
    .where(and(eq(produtos.id, produtoId), eq(produtos.tenantId, tenantId)))
    .limit(1);

  if (produto.length === 0) return null;

  const receitaIngredientes = await db
    .select({
      ingredienteId: ingredientes.id,
      nome: ingredientes.nome,
      quantidade: receitasIngredientes.quantidade,
      unidade: ingredientes.unidade,
      custoUnitario: ingredientes.custoUnitario,
    })
    .from(receitasIngredientes)
    .innerJoin(
      ingredientes,
      eq(receitasIngredientes.ingredienteId, ingredientes.id)
    )
    .where(
      and(
        eq(receitasIngredientes.produtoId, produtoId),
        eq(receitasIngredientes.tenantId, tenantId)
      )
    );

  let custoReal = 0;
  const ingredientesCalc: {
    ingredienteId: string;
    nome: string;
    quantidade: number;
    unidade: string;
    custoUnitario: number;
    custoTotal: number;
  }[] = [];

  for (const ing of receitaIngredientes) {
    const custoUnitarioAtual = await getCustoIngredienteAtual(ing.ingredienteId);
    const quantidade = parseFloat(ing.quantidade);
    const custoTotal = custoUnitarioAtual * quantidade;
    custoReal += custoTotal;

    ingredientesCalc.push({
      ingredienteId: ing.ingredienteId,
      nome: ing.nome,
      quantidade,
      unidade: ing.unidade || "g",
      custoUnitario: custoUnitarioAtual,
      custoTotal,
    });
  }

  const precoVenda = parseFloat(produto[0].preco);
  const lucroBruto = precoVenda - custoReal;
  const margemLucro = precoVenda > 0 ? (lucroBruto / precoVenda) * 100 : 0;

  return {
    produtoId: produto[0].id,
    produtoNome: produto[0].nome,
    precoVenda,
    custoReal,
    lucroBruto,
    margemLucro,
    ingredientes: ingredientesCalc,
  };
}

async function calcularCustoProdutoNaData(
  produtoId: string,
  tenantId: string,
  data: Date
): Promise<number> {
  const receitaIngredientes = await db
    .select({
      ingredienteId: ingredientes.id,
      quantidade: receitasIngredientes.quantidade,
    })
    .from(receitasIngredientes)
    .innerJoin(
      ingredientes,
      eq(receitasIngredientes.ingredienteId, ingredientes.id)
    )
    .where(
      and(
        eq(receitasIngredientes.produtoId, produtoId),
        eq(receitasIngredientes.tenantId, tenantId)
      )
    );

  let custoReal = 0;
  for (const ing of receitaIngredientes) {
    const custoUnitario = await getCustoIngredienteNaData(ing.ingredienteId, data);
    const quantidade = parseFloat(ing.quantidade);
    custoReal += custoUnitario * quantidade;
  }

  return custoReal;
}

export async function listarCustosProdutos(
  tenantId: string
): Promise<CustoProduto[]> {
  const produtosTenant = await db
    .select()
    .from(produtos)
    .where(eq(produtos.tenantId, tenantId));

  const resultados: CustoProduto[] = [];

  for (const produto of produtosTenant) {
    const custo = await calcularCustoProduto(produto.id, tenantId);
    if (custo) {
      resultados.push(custo);
    }
  }

  return resultados.sort((a, b) => b.margemLucro - a.margemLucro);
}

export async function calcularLucroFranquia(
  tenantId: string,
  dataInicio?: Date,
  dataFim?: Date
): Promise<LucroFranquia | null> {
  const tenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (tenant.length === 0) return null;

  let query = db
    .select()
    .from(pedidos)
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        eq(pedidos.status, "entregue")
      )
    );

  const pedidosFranquia = await query;

  let totalVendas = 0;
  let custoTotalIngredientes = 0;
  let produtosVendidos = 0;

  for (const pedido of pedidosFranquia) {
    const createdAt = new Date(pedido.createdAt);
    if (dataInicio && createdAt < dataInicio) continue;
    if (dataFim && createdAt > dataFim) continue;

    totalVendas += parseFloat(pedido.total);

    const itens = (pedido.itens as any[]) || [];
    for (const item of itens) {
      produtosVendidos += item.quantidade || 1;

      if (item.produtoId) {
        const custoPedido = await calcularCustoProdutoNaData(item.produtoId, tenantId, createdAt);
        if (custoPedido > 0) {
          custoTotalIngredientes += custoPedido * (item.quantidade || 1);
        }
      }
    }
  }

  const lucroBrutoTotal = totalVendas - custoTotalIngredientes;
  const margemLucroMedia =
    totalVendas > 0 ? (lucroBrutoTotal / totalVendas) * 100 : 0;

  return {
    tenantId,
    tenantNome: tenant[0].nome,
    totalVendas,
    custoTotalIngredientes,
    lucroBrutoTotal,
    margemLucroMedia,
    produtosVendidos,
  };
}

export async function listarLucrosFranquias(): Promise<LucroFranquia[]> {
  const allTenants = await db.select().from(tenants);
  const resultados: LucroFranquia[] = [];

  for (const tenant of allTenants) {
    const lucro = await calcularLucroFranquia(tenant.id);
    if (lucro) {
      resultados.push(lucro);
    }
  }

  return resultados.sort((a, b) => b.lucroBrutoTotal - a.lucroBrutoTotal);
}

export async function calcularLucroPorIngrediente(
  tenantId: string,
  dataInicio?: Date,
  dataFim?: Date
): Promise<LucroIngrediente[]> {
  const ingredientesTenant = await db
    .select()
    .from(ingredientes)
    .where(eq(ingredientes.tenantId, tenantId));

  const resultados: LucroIngrediente[] = [];

  for (const ingrediente of ingredientesTenant) {
    const receitas = await db
      .select()
      .from(receitasIngredientes)
      .where(
        and(
          eq(receitasIngredientes.ingredienteId, ingrediente.id),
          eq(receitasIngredientes.tenantId, tenantId)
        )
      );

    const custoAtual = await getCustoIngredienteAtual(ingrediente.id);

    let quantidadeUsada = 0;
    const produtosQueUsam = receitas.length;

    const pedidosFranquia = await db
      .select()
      .from(pedidos)
      .where(
        and(eq(pedidos.tenantId, tenantId), eq(pedidos.status, "entregue"))
      );

    let custoTotalPeriodo = 0;
    
    for (const pedido of pedidosFranquia) {
      const createdAt = new Date(pedido.createdAt);
      if (dataInicio && createdAt < dataInicio) continue;
      if (dataFim && createdAt > dataFim) continue;

      const custoNaData = await getCustoIngredienteNaData(ingrediente.id, createdAt);

      const itens = (pedido.itens as any[]) || [];
      for (const item of itens) {
        if (item.produtoId) {
          const receitaItem = receitas.find(
            (r) => r.produtoId === item.produtoId
          );
          if (receitaItem) {
            const qtd = parseFloat(receitaItem.quantidade) * (item.quantidade || 1);
            quantidadeUsada += qtd;
            custoTotalPeriodo += qtd * custoNaData;
          }
        }
      }
    }

    resultados.push({
      ingredienteId: ingrediente.id,
      ingredienteNome: ingrediente.nome,
      unidade: ingrediente.unidade || "g",
      custoAtual,
      quantidadeUsada,
      custoTotalPeriodo,
      produtosQueUsam,
    });
  }

  return resultados.sort((a, b) => b.custoTotalPeriodo - a.custoTotalPeriodo);
}

export async function getHistoricoPrecosMercado(
  ingredienteId: string,
  limite: number = 30
): Promise<{ data: Date; preco: number; fornecedor: string | null }[]> {
  const historico = await db
    .select()
    .from(custoMercado)
    .where(eq(custoMercado.ingredienteId, ingredienteId))
    .orderBy(desc(custoMercado.dataAtualizacao))
    .limit(limite);

  return historico.map((h) => ({
    data: h.dataAtualizacao,
    preco: parseFloat(h.precoMercado),
    fornecedor: h.fornecedor,
  }));
}
