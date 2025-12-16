import OpenAI from "openai";
import { db } from "./db";
import { 
  pedidos, 
  produtos, 
  clientes, 
  motoboys, 
  estoque, 
  ingredientes,
  transacoes,
  tenants 
} from "../shared/schema";
import { eq, and, sql, gte, lte, desc, count, sum } from "drizzle-orm";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const MODEL = "gpt-5";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ToolResult {
  name: string;
  result: any;
}

const SYSTEM_PROMPT = `Você é o assistente de IA da Bella Napoli Pizzeria, um sistema de gestão de pizzaria.
Você pode ajudar com:
- Consultar dados financeiros (faturamento, lucro, vendas)
- Verificar níveis de estoque de ingredientes
- Consultar status de pedidos e entregas
- Verificar status de motoboys e frota
- Atualizar estoque de ingredientes
- Cancelar ou atualizar dados de motoboys

Sempre responda em português brasileiro de forma clara e concisa.
Quando precisar de dados, use as ferramentas disponíveis para consultar o banco de dados.
Para ações de modificação (atualizar estoque, cancelar motoboy), confirme a ação antes de executar.`;

async function getFaturamentoSemana(tenantId: string): Promise<{ total: number; quantidade: number }> {
  const umaSemanaAtras = new Date();
  umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);

  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${pedidos.total} AS DECIMAL)), 0)`,
      quantidade: count(),
    })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        eq(pedidos.status, "entregue"),
        gte(pedidos.createdAt, umaSemanaAtras)
      )
    );

  return {
    total: parseFloat(result[0]?.total?.toString() || "0"),
    quantidade: Number(result[0]?.quantidade || 0),
  };
}

async function getEstoqueIngrediente(
  tenantId: string,
  nomeIngrediente: string
): Promise<{ nome: string; quantidade: number; unidade: string } | null> {
  const ingrediente = await db
    .select()
    .from(ingredientes)
    .where(
      and(
        eq(ingredientes.tenantId, tenantId),
        sql`LOWER(${ingredientes.nome}) LIKE LOWER(${`%${nomeIngrediente}%`})`
      )
    )
    .limit(1);

  if (!ingrediente[0]) return null;

  const estoqueItem = await db
    .select()
    .from(estoque)
    .where(
      and(
        eq(estoque.tenantId, tenantId),
        eq(estoque.ingredienteId, ingrediente[0].id)
      )
    )
    .limit(1);

  return {
    nome: ingrediente[0].nome,
    quantidade: parseFloat(estoqueItem[0]?.quantidade?.toString() || "0"),
    unidade: ingrediente[0].unidade || "kg",
  };
}

async function listarEstoqueBaixo(
  tenantId: string,
  limiteMinimo: number = 10
): Promise<Array<{ nome: string; quantidade: number; unidade: string }>> {
  const ingredientesTenant = await db
    .select()
    .from(ingredientes)
    .where(eq(ingredientes.tenantId, tenantId));

  const resultado: Array<{ nome: string; quantidade: number; unidade: string }> = [];

  for (const ing of ingredientesTenant) {
    const estoqueItem = await db
      .select()
      .from(estoque)
      .where(
        and(
          eq(estoque.tenantId, tenantId),
          eq(estoque.ingredienteId, ing.id)
        )
      )
      .limit(1);

    const qtd = estoqueItem[0]?.quantidade || 0;
    if (qtd < limiteMinimo) {
      resultado.push({
        nome: ing.nome,
        quantidade: qtd,
        unidade: ing.unidade || "kg",
      });
    }
  }

  return resultado;
}

async function getMotoboysAtivos(tenantId: string): Promise<Array<{ id: string; nome: string; status: string }>> {
  const motoboysList = await db
    .select({
      id: motoboys.id,
      nome: motoboys.nome,
      status: motoboys.status,
    })
    .from(motoboys)
    .where(eq(motoboys.tenantId, tenantId));

  return motoboysList;
}

async function getTempoMedioEntrega(tenantId: string): Promise<number> {
  const umaSemanaAtras = new Date();
  umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);

  const pedidosEntregues = await db
    .select({
      createdAt: pedidos.createdAt,
      updatedAt: pedidos.updatedAt,
    })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        eq(pedidos.status, "entregue"),
        gte(pedidos.createdAt, umaSemanaAtras)
      )
    );

  let totalMinutos = 0;
  let countPedidos = 0;

  for (const pedido of pedidosEntregues) {
    if (pedido.createdAt && pedido.updatedAt) {
      const diff = new Date(pedido.updatedAt).getTime() - new Date(pedido.createdAt).getTime();
      totalMinutos += diff / (1000 * 60);
      countPedidos++;
    }
  }

  return countPedidos > 0 ? Math.round(totalMinutos / countPedidos) : 0;
}

async function getPedidosHoje(tenantId: string): Promise<{ total: number; pendentes: number; entregues: number }> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const pedidosHoje = await db
    .select({
      status: pedidos.status,
    })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.tenantId, tenantId),
        gte(pedidos.createdAt, hoje)
      )
    );

  return {
    total: pedidosHoje.length,
    pendentes: pedidosHoje.filter((p) => ["pendente", "confirmado", "em_preparo"].includes(p.status)).length,
    entregues: pedidosHoje.filter((p) => p.status === "entregue").length,
  };
}

export async function atualizarEstoqueIngrediente(
  tenantId: string,
  nomeIngrediente: string,
  novaQuantidade: number
): Promise<{ sucesso: boolean; mensagem: string }> {
  const ingrediente = await db
    .select()
    .from(ingredientes)
    .where(
      and(
        eq(ingredientes.tenantId, tenantId),
        sql`LOWER(${ingredientes.nome}) LIKE LOWER(${`%${nomeIngrediente}%`})`
      )
    )
    .limit(1);

  if (!ingrediente[0]) {
    return { sucesso: false, mensagem: `Ingrediente "${nomeIngrediente}" não encontrado` };
  }

  const estoqueExistente = await db
    .select()
    .from(estoque)
    .where(
      and(
        eq(estoque.tenantId, tenantId),
        eq(estoque.ingredienteId, ingrediente[0].id)
      )
    )
    .limit(1);

  if (estoqueExistente[0]) {
    await db
      .update(estoque)
      .set({ quantidade: novaQuantidade, updatedAt: new Date() })
      .where(eq(estoque.id, estoqueExistente[0].id));
  } else {
    await db.insert(estoque).values({
      tenantId,
      ingredienteId: ingrediente[0].id,
      quantidade: novaQuantidade,
    });
  }

  return {
    sucesso: true,
    mensagem: `Estoque de ${ingrediente[0].nome} atualizado para ${novaQuantidade} ${ingrediente[0].unidade || "kg"}`,
  };
}

export async function cancelarMotoboy(
  tenantId: string,
  motoboyIdOrNome: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  let motoboyRecord = await db
    .select()
    .from(motoboys)
    .where(
      and(
        eq(motoboys.tenantId, tenantId),
        eq(motoboys.id, motoboyIdOrNome)
      )
    )
    .limit(1);

  if (!motoboyRecord[0]) {
    motoboyRecord = await db
      .select()
      .from(motoboys)
      .where(
        and(
          eq(motoboys.tenantId, tenantId),
          sql`LOWER(${motoboys.nome}) LIKE LOWER(${`%${motoboyIdOrNome}%`})`
        )
      )
      .limit(1);
  }

  if (!motoboyRecord[0]) {
    return { sucesso: false, mensagem: `Motoboy "${motoboyIdOrNome}" não encontrado` };
  }

  await db
    .update(motoboys)
    .set({ status: "inativo" })
    .where(eq(motoboys.id, motoboyRecord[0].id));

  return {
    sucesso: true,
    mensagem: `Motoboy ${motoboyRecord[0].nome} foi desativado com sucesso`,
  };
}

async function executeToolCall(
  toolName: string,
  args: any,
  tenantId: string
): Promise<any> {
  switch (toolName) {
    case "getFaturamentoSemana":
      return await getFaturamentoSemana(tenantId);
    case "getEstoqueIngrediente":
      return await getEstoqueIngrediente(tenantId, args.nomeIngrediente);
    case "listarEstoqueBaixo":
      return await listarEstoqueBaixo(tenantId, args.limiteMinimo || 10);
    case "getMotoboysAtivos":
      return await getMotoboysAtivos(tenantId);
    case "getTempoMedioEntrega":
      return await getTempoMedioEntrega(tenantId);
    case "getPedidosHoje":
      return await getPedidosHoje(tenantId);
    case "atualizarEstoqueIngrediente":
      return await atualizarEstoqueIngrediente(tenantId, args.nomeIngrediente, args.novaQuantidade);
    case "cancelarMotoboy":
      return await cancelarMotoboy(tenantId, args.motoboyIdOrNome);
    default:
      return { erro: `Ferramenta desconhecida: ${toolName}` };
  }
}

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "getFaturamentoSemana",
      description: "Obtém o faturamento total e quantidade de pedidos da última semana",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "getEstoqueIngrediente",
      description: "Consulta o nível de estoque de um ingrediente específico",
      parameters: {
        type: "object",
        properties: {
          nomeIngrediente: {
            type: "string",
            description: "Nome do ingrediente (ex: muçarela, farinha, tomate)",
          },
        },
        required: ["nomeIngrediente"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listarEstoqueBaixo",
      description: "Lista todos os ingredientes com estoque abaixo de um limite mínimo",
      parameters: {
        type: "object",
        properties: {
          limiteMinimo: {
            type: "number",
            description: "Quantidade mínima para considerar estoque baixo (padrão: 10)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getMotoboysAtivos",
      description: "Lista todos os motoboys e seu status atual",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "getTempoMedioEntrega",
      description: "Calcula o tempo médio de entrega em minutos da última semana",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "getPedidosHoje",
      description: "Obtém estatísticas dos pedidos de hoje (total, pendentes, entregues)",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizarEstoqueIngrediente",
      description: "Atualiza a quantidade em estoque de um ingrediente",
      parameters: {
        type: "object",
        properties: {
          nomeIngrediente: {
            type: "string",
            description: "Nome do ingrediente a ser atualizado",
          },
          novaQuantidade: {
            type: "number",
            description: "Nova quantidade em estoque",
          },
        },
        required: ["nomeIngrediente", "novaQuantidade"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelarMotoboy",
      description: "Desativa um motoboy pelo ID ou nome",
      parameters: {
        type: "object",
        properties: {
          motoboyIdOrNome: {
            type: "string",
            description: "ID ou nome do motoboy a ser desativado",
          },
        },
        required: ["motoboyIdOrNome"],
      },
    },
  },
];

export async function processarMensagemIA(
  tenantId: string,
  mensagem: string,
  historico: ChatMessage[] = []
): Promise<{ resposta: string; toolsUsed: ToolResult[] }> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...historico.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: mensagem },
  ];

  const toolsUsed: ToolResult[] = [];

  try {
    let response = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto",
      max_completion_tokens: 2048,
    });

    let message = response.choices[0].message;

    while (message.tool_calls && message.tool_calls.length > 0) {
      const toolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== "function") continue;
        const funcCall = toolCall as { type: "function"; id: string; function: { name: string; arguments: string } };
        const args = JSON.parse(funcCall.function.arguments || "{}");
        const result = await executeToolCall(funcCall.function.name, args, tenantId);

        toolsUsed.push({
          name: funcCall.function.name,
          result,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: funcCall.id,
          content: JSON.stringify(result),
        });
      }

      messages.push(message as OpenAI.Chat.Completions.ChatCompletionMessageParam);
      messages.push(...toolMessages);

      response = await openai.chat.completions.create({
        model: MODEL,
        messages,
        tools,
        tool_choice: "auto",
        max_completion_tokens: 2048,
      });

      message = response.choices[0].message;
    }

    return {
      resposta: message.content || "Desculpe, não consegui processar sua solicitação.",
      toolsUsed,
    };
  } catch (error: any) {
    console.error("[Agente IA] Erro ao processar mensagem:", error);
    
    if (error.message?.includes("FREE_CLOUD_BUDGET_EXCEEDED")) {
      throw new Error("FREE_CLOUD_BUDGET_EXCEEDED");
    }
    
    throw error;
  }
}
