import { db } from "./db";
import { historicoTimingKDS, produtos, progressoKDS } from "@shared/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";

export interface DadosConsolidadosML {
  produtoId: string;
  produtoNome: string;
  categoria: string;
  totalPrepros: number;
  tempoMedioReal: number;
  tempoMedioEstimado: number;
  desvioMedio: number;
  horarioPico: string;
  diaSemana: number;
  taxaAtraso: number;
  mediaIngredientes: number;
  mediaPizzasSimultaneas: number;
  percentualRush: number;
}

export async function consolidarDadosML(tenantId: string): Promise<DadosConsolidadosML[]> {
  const agora = new Date();
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

  const historico = await db
    .select()
    .from(historicoTimingKDS)
    .where(and(
      eq(historicoTimingKDS.tenantId, tenantId),
      gte(historicoTimingKDS.createdAt, ontem)
    ));

  const porProduto = new Map<string, any[]>();
  for (const item of historico) {
    const produtoId = item.produtoId || 'unknown';
    if (!porProduto.has(produtoId)) {
      porProduto.set(produtoId, []);
    }
    porProduto.get(produtoId)!.push(item);
  }

  const resultado: DadosConsolidadosML[] = [];

  for (const [produtoId, items] of porProduto) {
    if (items.length === 0) continue;

    const temposMedios = items.reduce((sum, i) => sum + i.tempoReal, 0) / items.length;
    const temposEstimados = items.reduce((sum, i) => sum + i.tempoEstimado, 0) / items.length;
    const desvioMedio = items.reduce((sum, i) => sum + Math.abs(i.desvio), 0) / items.length;
    const atrasados = items.filter(i => i.desvio > 0).length;

    const mediaIngredientes = items.reduce((sum, i) => sum + (i.numeroIngredientes || 0), 0) / items.length;
    const mediaPizzasSimultaneas = items.reduce((sum, i) => sum + (i.pizzasSimultaneas || 0), 0) / items.length;
    const itensRush = items.filter(i => i.periodoRush === true).length;
    const percentualRush = (itensRush / items.length) * 100;

    resultado.push({
      produtoId,
      produtoNome: items[0].produtoNome,
      categoria: items[0].categoriaPizza || '',
      totalPrepros: items.length,
      tempoMedioReal: Math.round(temposMedios),
      tempoMedioEstimado: Math.round(temposEstimados),
      desvioMedio: Math.round(desvioMedio),
      horarioPico: getHorarioPico(items),
      diaSemana: agora.getDay(),
      taxaAtraso: Math.round((atrasados / items.length) * 100),
      mediaIngredientes: Math.round(mediaIngredientes),
      mediaPizzasSimultaneas: Math.round(mediaPizzasSimultaneas * 10) / 10,
      percentualRush: Math.round(percentualRush),
    });
  }

  return resultado;
}

function getHorarioPico(items: any[]): string {
  const horas = items.map(i => new Date(i.iniciadoEm).getHours());
  const manha = horas.filter(h => h >= 6 && h < 12).length;
  const tarde = horas.filter(h => h >= 12 && h < 18).length;
  const noite = horas.filter(h => h >= 18 || h < 6).length;
  
  if (manha >= tarde && manha >= noite) return 'manha';
  if (tarde >= manha && tarde >= noite) return 'tarde';
  return 'noite';
}

export function iniciarCronML() {
  console.log("[ML Pipeline] Iniciando consolidação de dados a cada hora");
  
  setInterval(async () => {
    try {
      const tenants = await db
        .selectDistinct({ tenantId: historicoTimingKDS.tenantId })
        .from(historicoTimingKDS);
      
      for (const { tenantId } of tenants) {
        if (tenantId) {
          await consolidarDadosML(tenantId);
          console.log(`[ML Pipeline] Dados consolidados para tenant ${tenantId}`);
        }
      }
    } catch (error) {
      console.error("[ML Pipeline] Erro ao consolidar:", error);
    }
  }, 60 * 60 * 1000);
}

export interface PrevisaoETA {
  produtoId: string;
  produtoNome: string;
  tempoEstimadoSegundos: number;
  confianca: number;
  baseadoEm: string;
  historicoAmostras: number;
  ajusteRush: number;
  ajusteCarga: number;
}

export async function preverTempoPreparoPizza(
  tenantId: string, 
  produtoId: string,
  horario: Date = new Date(),
  pizzasSimultaneasAtual: number = 0
): Promise<PrevisaoETA> {
  const historico = await db
    .select()
    .from(historicoTimingKDS)
    .where(and(
      eq(historicoTimingKDS.tenantId, tenantId),
      eq(historicoTimingKDS.produtoId, produtoId)
    ))
    .limit(100);

  const [produto] = await db
    .select()
    .from(produtos)
    .where(and(eq(produtos.id, produtoId), eq(produtos.tenantId, tenantId)))
    .limit(1);

  const produtoNome = produto?.nome || "Produto";
  const horaAtual = horario.getHours();
  const periodoRushAtual = (horaAtual >= 11 && horaAtual <= 14) || (horaAtual >= 18 && horaAtual <= 22);
  
  if (historico.length < 5) {
    const tempoPadrao = produto?.tempoPreparoEstimado || 900;
    const ajusteRush = periodoRushAtual ? Math.round(tempoPadrao * 0.1) : 0;
    const ajusteCarga = pizzasSimultaneasAtual > 3 ? Math.round(tempoPadrao * 0.05 * (pizzasSimultaneasAtual - 3)) : 0;
    return {
      produtoId,
      produtoNome,
      tempoEstimadoSegundos: tempoPadrao + ajusteRush + ajusteCarga,
      confianca: 30,
      baseadoEm: "padrao",
      historicoAmostras: historico.length,
      ajusteRush,
      ajusteCarga,
    };
  }

  const periodoAtual = horaAtual >= 18 || horaAtual < 6 ? 'noite' : horaAtual >= 12 ? 'tarde' : 'manha';
  
  const historicoRelevante = historico.filter(h => {
    if (h.horaPedido !== null) {
      const hora = h.horaPedido;
      const periodo = hora >= 18 || hora < 6 ? 'noite' : hora >= 12 ? 'tarde' : 'manha';
      return periodo === periodoAtual;
    }
    const hora = new Date(h.iniciadoEm).getHours();
    const periodo = hora >= 18 || hora < 6 ? 'noite' : hora >= 12 ? 'tarde' : 'manha';
    return periodo === periodoAtual;
  });

  const dadosParaCalculo = historicoRelevante.length >= 3 ? historicoRelevante : historico;
  
  const somaTempos = dadosParaCalculo.reduce((sum, h) => sum + h.tempoReal, 0);
  const tempoMedio = Math.round(somaTempos / dadosParaCalculo.length);
  
  const mediaPizzasSimultaneas = dadosParaCalculo.reduce((sum, h) => sum + (h.pizzasSimultaneas || 0), 0) / dadosParaCalculo.length;
  const ajusteCarga = pizzasSimultaneasAtual > mediaPizzasSimultaneas 
    ? Math.round(tempoMedio * 0.03 * (pizzasSimultaneasAtual - mediaPizzasSimultaneas))
    : 0;
  
  const rushHistorico = dadosParaCalculo.filter(h => h.periodoRush === true);
  const naoRushHistorico = dadosParaCalculo.filter(h => h.periodoRush === false);
  let ajusteRush = 0;
  if (periodoRushAtual && rushHistorico.length >= 3 && naoRushHistorico.length >= 3) {
    const mediaRush = rushHistorico.reduce((sum, h) => sum + h.tempoReal, 0) / rushHistorico.length;
    const mediaNaoRush = naoRushHistorico.reduce((sum, h) => sum + h.tempoReal, 0) / naoRushHistorico.length;
    ajusteRush = Math.round(mediaRush - mediaNaoRush);
  } else if (periodoRushAtual) {
    ajusteRush = Math.round(tempoMedio * 0.1);
  }
  
  const variancia = dadosParaCalculo.reduce((sum, h) => {
    return sum + Math.pow(h.tempoReal - tempoMedio, 2);
  }, 0) / dadosParaCalculo.length;
  const desvioPadrao = Math.sqrt(variancia);
  
  const coeficienteVariacao = tempoMedio > 0 ? (desvioPadrao / tempoMedio) * 100 : 100;
  const confianca = Math.max(20, Math.min(95, 100 - coeficienteVariacao));

  return {
    produtoId,
    produtoNome,
    tempoEstimadoSegundos: tempoMedio + ajusteRush + ajusteCarga,
    confianca: Math.round(confianca),
    baseadoEm: "historico",
    historicoAmostras: dadosParaCalculo.length,
    ajusteRush,
    ajusteCarga,
  };
}

export async function preverTempoTotalPedido(
  tenantId: string,
  produtoIds: string[]
): Promise<{ tempoTotal: number; previsoes: PrevisaoETA[] }> {
  const previsoes: PrevisaoETA[] = [];
  
  for (const produtoId of produtoIds) {
    const previsao = await preverTempoPreparoPizza(tenantId, produtoId);
    previsoes.push(previsao);
  }
  
  const tempoMaior = Math.max(...previsoes.map(p => p.tempoEstimadoSegundos));
  const tempoTotal = tempoMaior + 300;
  
  return { tempoTotal, previsoes };
}
