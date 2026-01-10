import { db } from "./db";
import { 
  produtos, 
  ingredientes, 
  receitasIngredientes, 
  pizzasPersonalizadas,
  itensPedidoDetalhados,
  extratoConsumo,
  estoque,
  pedidos
} from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";

interface SaborInput {
  pizza_id: string;
  fracao: number;
}

interface IngredienteDiagrama {
  ingredienteId: string;
  nome: string;
  quantidade: number;
  unidade: string;
  custo: number;
}

interface SaborDiagrama {
  produtoId: string;
  produtoNome: string;
  fracao: number;
  setorInicio: number;
  setorFim: number;
  cor: string;
  ingredientes: IngredienteDiagrama[];
}

interface DiagramaPizza {
  itemPedidoId: string;
  pedidoId: string;
  nome: string;
  sabores: SaborDiagrama[];
  ingredientesTotal: IngredienteDiagrama[];
  custoTotal: number;
  precoVenda: number;
  margemLucro: number;
}

const CORES_SETORES = [
  "#ef4444", // red-500
  "#f97316", // orange-500
  "#eab308", // yellow-500
  "#22c55e", // green-500
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
];

export function gerarHashSabores(sabores: SaborInput[]): string {
  const ordenado = [...sabores].sort((a, b) => a.pizza_id.localeCompare(b.pizza_id));
  const str = ordenado.map(s => `${s.pizza_id}:${s.fracao}`).join("|");
  return crypto.createHash("md5").update(str).digest("hex");
}

export async function buscarIngredientesProduto(tenantId: string, produtoId: string): Promise<IngredienteDiagrama[]> {
  const receita = await db
    .select({
      ingredienteId: receitasIngredientes.ingredienteId,
      nome: ingredientes.nome,
      quantidade: receitasIngredientes.quantidade,
      unidade: ingredientes.unidade,
      custoUnitario: ingredientes.custoUnitario,
    })
    .from(receitasIngredientes)
    .leftJoin(ingredientes, eq(receitasIngredientes.ingredienteId, ingredientes.id))
    .where(and(
      eq(receitasIngredientes.tenantId, tenantId),
      eq(receitasIngredientes.produtoId, produtoId)
    ));

  return receita.map(item => ({
    ingredienteId: item.ingredienteId,
    nome: item.nome || "Desconhecido",
    quantidade: parseFloat(item.quantidade || "0"),
    unidade: item.unidade || "g",
    custo: parseFloat(item.custoUnitario || "0") * parseFloat(item.quantidade || "0"),
  }));
}

export async function gerarDiagramaPizza(
  tenantId: string, 
  sabores: SaborInput[]
): Promise<{ saboresDiagrama: SaborDiagrama[]; ingredientesTotal: IngredienteDiagrama[]; custoTotal: number; nome: string }> {
  let anguloAtual = 0;
  const saboresDiagrama: SaborDiagrama[] = [];
  const ingredientesMap = new Map<string, IngredienteDiagrama>();
  let custoTotal = 0;
  const nomes: string[] = [];

  for (let i = 0; i < sabores.length; i++) {
    const sabor = sabores[i];
    const angulo = 360 * sabor.fracao;

    const [produto] = await db
      .select()
      .from(produtos)
      .where(and(eq(produtos.id, sabor.pizza_id), eq(produtos.tenantId, tenantId)))
      .limit(1);

    if (!produto) continue;

    nomes.push(produto.nome);

    const ingredientesProduto = await buscarIngredientesProduto(tenantId, sabor.pizza_id);
    const ingredientesAjustados = ingredientesProduto.map(ing => ({
      ...ing,
      quantidade: ing.quantidade * sabor.fracao,
      custo: ing.custo * sabor.fracao,
    }));

    for (const ing of ingredientesAjustados) {
      const existente = ingredientesMap.get(ing.ingredienteId);
      if (existente) {
        existente.quantidade += ing.quantidade;
        existente.custo += ing.custo;
      } else {
        ingredientesMap.set(ing.ingredienteId, { ...ing });
      }
      custoTotal += ing.custo;
    }

    saboresDiagrama.push({
      produtoId: produto.id,
      produtoNome: produto.nome,
      fracao: sabor.fracao,
      setorInicio: anguloAtual,
      setorFim: anguloAtual + angulo,
      cor: CORES_SETORES[i % CORES_SETORES.length],
      ingredientes: ingredientesAjustados,
    });

    anguloAtual += angulo;
  }

  const nome = sabores.length === 1 
    ? nomes[0] 
    : `${nomes.length} Sabores: ${nomes.join(" / ")}`;

  return {
    saboresDiagrama,
    ingredientesTotal: Array.from(ingredientesMap.values()),
    custoTotal: Math.round(custoTotal * 100) / 100,
    nome,
  };
}

export async function criarOuBuscarPizzaPersonalizada(
  tenantId: string,
  sabores: SaborInput[]
): Promise<string> {
  const hash = gerarHashSabores(sabores);

  const existente = await db
    .select()
    .from(pizzasPersonalizadas)
    .where(and(
      eq(pizzasPersonalizadas.tenantId, tenantId),
      eq(pizzasPersonalizadas.hashSabores, hash)
    ))
    .limit(1);

  if (existente.length > 0) {
    await db
      .update(pizzasPersonalizadas)
      .set({ 
        totalPedidos: sql`${pizzasPersonalizadas.totalPedidos} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(pizzasPersonalizadas.id, existente[0].id));
    return existente[0].id;
  }

  const diagrama = await gerarDiagramaPizza(tenantId, sabores);

  const saboresCompletos = diagrama.saboresDiagrama.map(s => ({
    produtoId: s.produtoId,
    produtoNome: s.produtoNome,
    fracao: s.fracao,
    ingredientes: s.ingredientes.map(ing => ({
      ingredienteId: ing.ingredienteId,
      nome: ing.nome,
      quantidade: ing.quantidade,
      unidade: ing.unidade,
      custoUnitario: ing.custo / (ing.quantidade || 1),
    })),
  }));

  const [novaPizza] = await db
    .insert(pizzasPersonalizadas)
    .values({
      tenantId,
      hashSabores: hash,
      nome: diagrama.nome,
      sabores: saboresCompletos,
      custoTotal: diagrama.custoTotal.toString(),
      totalPedidos: 1,
    })
    .returning();

  return novaPizza.id;
}

export async function criarItemPedidoComDiagrama(
  tenantId: string,
  pedidoId: string,
  sabores: SaborInput[],
  preco: number
): Promise<DiagramaPizza> {
  const pizzaPersonalizadaId = await criarOuBuscarPizzaPersonalizada(tenantId, sabores);
  const diagrama = await gerarDiagramaPizza(tenantId, sabores);

  const [itemPedido] = await db
    .insert(itensPedidoDetalhados)
    .values({
      tenantId,
      pedidoId,
      pizzaPersonalizadaId,
      tipoItem: "pizza",
      nome: diagrama.nome,
      quantidade: 1,
      preco: preco.toString(),
      sabores: diagrama.saboresDiagrama,
      custoReal: diagrama.custoTotal.toString(),
      statusProducao: "aguardando",
      diagramaGerado: true,
    })
    .returning();

  const margemLucro = preco > 0 
    ? Math.round(((preco - diagrama.custoTotal) / preco) * 100) 
    : 0;

  return {
    itemPedidoId: itemPedido.id,
    pedidoId,
    nome: diagrama.nome,
    sabores: diagrama.saboresDiagrama,
    ingredientesTotal: diagrama.ingredientesTotal,
    custoTotal: diagrama.custoTotal,
    precoVenda: preco,
    margemLucro,
  };
}

export async function buscarDiagramaItemPedido(
  tenantId: string,
  itemPedidoId: string
): Promise<DiagramaPizza | null> {
  const [item] = await db
    .select()
    .from(itensPedidoDetalhados)
    .where(and(
      eq(itensPedidoDetalhados.tenantId, tenantId),
      eq(itensPedidoDetalhados.id, itemPedidoId)
    ))
    .limit(1);

  if (!item) return null;

  const preco = parseFloat(item.preco || "0");
  const custoTotal = parseFloat(item.custoReal || "0");
  const sabores = (item.sabores as SaborDiagrama[]) || [];

  const ingredientesMap = new Map<string, IngredienteDiagrama>();
  for (const sabor of sabores) {
    for (const ing of sabor.ingredientes) {
      const existente = ingredientesMap.get(ing.ingredienteId);
      if (existente) {
        existente.quantidade += ing.quantidade;
        existente.custo += ing.custo;
      } else {
        ingredientesMap.set(ing.ingredienteId, { ...ing });
      }
    }
  }

  return {
    itemPedidoId: item.id,
    pedidoId: item.pedidoId,
    nome: item.nome,
    sabores,
    ingredientesTotal: Array.from(ingredientesMap.values()),
    custoTotal,
    precoVenda: preco,
    margemLucro: preco > 0 ? Math.round(((preco - custoTotal) / preco) * 100) : 0,
  };
}

export async function buscarProximaPizzaProducao(tenantId: string): Promise<DiagramaPizza | null> {
  const [proximoItem] = await db
    .select()
    .from(itensPedidoDetalhados)
    .where(and(
      eq(itensPedidoDetalhados.tenantId, tenantId),
      eq(itensPedidoDetalhados.statusProducao, "aguardando"),
      eq(itensPedidoDetalhados.tipoItem, "pizza")
    ))
    .orderBy(itensPedidoDetalhados.createdAt)
    .limit(1);

  if (!proximoItem) return null;

  return buscarDiagramaItemPedido(tenantId, proximoItem.id);
}

export async function buscarPizzaEmProducao(tenantId: string): Promise<DiagramaPizza | null> {
  const [itemEmProducao] = await db
    .select()
    .from(itensPedidoDetalhados)
    .where(and(
      eq(itensPedidoDetalhados.tenantId, tenantId),
      eq(itensPedidoDetalhados.statusProducao, "producao"),
      eq(itensPedidoDetalhados.tipoItem, "pizza")
    ))
    .limit(1);

  if (!itemEmProducao) return null;

  return buscarDiagramaItemPedido(tenantId, itemEmProducao.id);
}

export async function iniciarProducaoItem(tenantId: string, itemPedidoId: string): Promise<DiagramaPizza | null> {
  await db
    .update(itensPedidoDetalhados)
    .set({ statusProducao: "producao" })
    .where(and(
      eq(itensPedidoDetalhados.tenantId, tenantId),
      eq(itensPedidoDetalhados.id, itemPedidoId)
    ));

  return buscarDiagramaItemPedido(tenantId, itemPedidoId);
}

export async function finalizarProducaoItem(tenantId: string, itemPedidoId: string): Promise<void> {
  const [item] = await db
    .select()
    .from(itensPedidoDetalhados)
    .where(and(
      eq(itensPedidoDetalhados.tenantId, tenantId),
      eq(itensPedidoDetalhados.id, itemPedidoId)
    ))
    .limit(1);

  if (!item) return;

  const sabores = (item.sabores as SaborDiagrama[]) || [];
  
  for (const sabor of sabores) {
    for (const ing of sabor.ingredientes) {
      await db.insert(extratoConsumo).values({
        tenantId,
        pedidoId: item.pedidoId,
        itemPedidoId,
        ingredienteId: ing.ingredienteId,
        ingredienteNome: ing.nome,
        quantidadeUsada: ing.quantidade.toString(),
        unidade: ing.unidade,
        custoUnitario: (ing.custo / (ing.quantidade || 1)).toString(),
        custoTotal: ing.custo.toString(),
      });

      const [estoqueItem] = await db
        .select()
        .from(estoque)
        .where(and(
          eq(estoque.tenantId, tenantId),
          eq(estoque.ingredienteId, ing.ingredienteId)
        ))
        .limit(1);

      if (estoqueItem) {
        const novaQtd = Math.max(0, estoqueItem.quantidade - Math.ceil(ing.quantidade));
        await db
          .update(estoque)
          .set({ quantidade: novaQtd, updatedAt: new Date() })
          .where(eq(estoque.id, estoqueItem.id));
      }
    }
  }

  await db
    .update(itensPedidoDetalhados)
    .set({ statusProducao: "concluido" })
    .where(eq(itensPedidoDetalhados.id, itemPedidoId));
}

export async function buscarFilaProducao(tenantId: string): Promise<{
  emProducao: DiagramaPizza | null;
  fila: DiagramaPizza[];
}> {
  const emProducao = await buscarPizzaEmProducao(tenantId);

  const itensNaFila = await db
    .select()
    .from(itensPedidoDetalhados)
    .where(and(
      eq(itensPedidoDetalhados.tenantId, tenantId),
      eq(itensPedidoDetalhados.statusProducao, "aguardando"),
      eq(itensPedidoDetalhados.tipoItem, "pizza")
    ))
    .orderBy(itensPedidoDetalhados.createdAt)
    .limit(10);

  const fila: DiagramaPizza[] = [];
  for (const item of itensNaFila) {
    const diagrama = await buscarDiagramaItemPedido(tenantId, item.id);
    if (diagrama) fila.push(diagrama);
  }

  return { emProducao, fila };
}
