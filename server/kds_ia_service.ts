import OpenAI from "openai";

const MODEL = "gpt-4o-mini";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface IngredientePreparo {
  nome: string;
  quantidade: number;
  unidade: string;
}

interface SaborPreparo {
  produtoNome: string;
  fracao: number;
  ingredientes: IngredientePreparo[];
}

interface PassoPreparo {
  numero: number;
  instrucao: string;
  tempo?: number;
  dica?: string;
  ingredientes?: string[];
}

interface InstrucoesPreparo {
  titulo: string;
  passos: PassoPreparo[];
  tempoEstimado: number;
  dicasGerais: string[];
}

const cacheInstrucoes = new Map<string, InstrucoesPreparo>();

export async function gerarInstrucoesPreparo(
  nomePizza: string,
  sabores: SaborPreparo[]
): Promise<InstrucoesPreparo> {
  const cacheKey = `${nomePizza}-${sabores.map(s => s.produtoNome).join("-")}`;
  
  const cached = cacheInstrucoes.get(cacheKey);
  if (cached) {
    return cached;
  }

  const ingredientesFormatados = sabores.map(s => {
    const ings = s.ingredientes.map(i => `${i.nome} (${i.quantidade.toFixed(0)}${i.unidade})`).join(", ");
    const fracaoTexto = s.fracao === 1 ? "inteira" : 
                        s.fracao === 0.5 ? "metade" : 
                        s.fracao === 0.33 || s.fracao === 0.34 ? "um terço" : 
                        s.fracao === 0.25 ? "um quarto" : `${(s.fracao * 100).toFixed(0)}%`;
    return `• ${s.produtoNome} (${fracaoTexto}): ${ings}`;
  }).join("\n");

  const prompt = `Você é um pizzaiolo experiente. Gere instruções claras e objetivas para preparar a pizza "${nomePizza}" com os seguintes sabores e ingredientes:

${ingredientesFormatados}

Responda APENAS em JSON válido no formato:
{
  "titulo": "Nome da pizza",
  "passos": [
    {
      "numero": 1,
      "instrucao": "Instrução curta e clara",
      "tempo": 30,
      "dica": "Dica opcional",
      "ingredientes": ["ingrediente1", "ingrediente2"]
    }
  ],
  "tempoEstimado": 180,
  "dicasGerais": ["dica1", "dica2"]
}

REGRAS:
- Máximo 6 passos
- Instruções diretas e práticas para cozinha profissional
- Tempos em segundos
- Considere que é pizza multi-sabor se houver mais de um sabor
- Inclua ordem correta: massa, molho, ingredientes, forno
- Dicas devem ser sobre técnica e qualidade`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "Você é um assistente de cozinha profissional. Responda sempre em JSON válido."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "";
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Resposta não contém JSON válido");
    }

    const instrucoes: InstrucoesPreparo = JSON.parse(jsonMatch[0]);
    
    if (!instrucoes.titulo) instrucoes.titulo = nomePizza;
    if (!instrucoes.passos || instrucoes.passos.length === 0) {
      instrucoes.passos = gerarPassosPadrao(nomePizza, sabores);
    }
    if (!instrucoes.tempoEstimado) instrucoes.tempoEstimado = 180;
    if (!instrucoes.dicasGerais) instrucoes.dicasGerais = [];

    cacheInstrucoes.set(cacheKey, instrucoes);
    
    return instrucoes;
  } catch (error) {
    console.error("Erro ao gerar instruções via IA:", error);
    return gerarInstrucoesFallback(nomePizza, sabores);
  }
}

function gerarPassosPadrao(nome: string, sabores: SaborPreparo[]): PassoPreparo[] {
  const ingredientesUnicos = new Set<string>();
  sabores.forEach(s => s.ingredientes.forEach(i => ingredientesUnicos.add(i.nome)));

  const passos: PassoPreparo[] = [
    {
      numero: 1,
      instrucao: "Abra a massa na forma, garantindo bordas uniformes",
      tempo: 30,
      dica: "Massa deve estar em temperatura ambiente"
    },
    {
      numero: 2,
      instrucao: "Espalhe o molho de tomate em movimentos circulares",
      tempo: 20,
      ingredientes: ["Molho de tomate"]
    }
  ];

  if (sabores.length > 1) {
    sabores.forEach((sabor, idx) => {
      const fracaoTexto = sabor.fracao === 0.5 ? "metade" : 
                          sabor.fracao === 0.33 || sabor.fracao === 0.34 ? "um terço" : 
                          sabor.fracao === 0.25 ? "um quarto" : `${(sabor.fracao * 100).toFixed(0)}%`;
      passos.push({
        numero: passos.length + 1,
        instrucao: `Distribua os ingredientes de ${sabor.produtoNome} em ${fracaoTexto} da pizza`,
        tempo: 45,
        ingredientes: sabor.ingredientes.map(i => i.nome),
        dica: idx === 0 ? "Comece pela porção maior" : undefined
      });
    });
  } else {
    passos.push({
      numero: 3,
      instrucao: "Distribua os ingredientes uniformemente sobre a pizza",
      tempo: 45,
      ingredientes: Array.from(ingredientesUnicos)
    });
  }

  passos.push({
    numero: passos.length + 1,
    instrucao: "Leve ao forno a 300°C por 3-4 minutos",
    tempo: 210,
    dica: "Observe a cor das bordas para ponto ideal"
  });

  passos.push({
    numero: passos.length + 1,
    instrucao: "Retire, finalize com azeite e orégano, corte e sirva",
    tempo: 20
  });

  return passos;
}

function gerarInstrucoesFallback(nome: string, sabores: SaborPreparo[]): InstrucoesPreparo {
  return {
    titulo: nome,
    passos: gerarPassosPadrao(nome, sabores),
    tempoEstimado: 180,
    dicasGerais: [
      "Mantenha ingredientes sempre frescos e organizados",
      "Verifique temperatura do forno antes de cada pizza",
      "Pizzas multi-sabor: separe bem os ingredientes de cada sabor"
    ]
  };
}

export function limparCacheInstrucoes(): void {
  cacheInstrucoes.clear();
}
