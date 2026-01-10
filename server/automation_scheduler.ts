import { db } from "./db";
import { 
  estoque, 
  alertasEstoque, 
  clientes, 
  pedidos, 
  systemLogs, 
  logsN8n,
  tenants,
  previsaoEstoque
} from "@shared/schema";
import { eq, and, lt, gte, sql, isNull } from "drizzle-orm";

const ONE_HOUR_MS = 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface JobConfig {
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
  lastRun?: Date;
  scheduledHour?: number;
}

class AutomationScheduler {
  private jobs: Map<string, JobConfig> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private running: boolean = false;

  constructor() {
    this.registerJobs();
  }

  private registerJobs(): void {
    this.jobs.set("verificarEstoqueBaixo", {
      name: "verificarEstoqueBaixo",
      intervalMs: ONE_HOUR_MS,
      handler: this.verificarEstoqueBaixo.bind(this),
    });

    this.jobs.set("followUpCRM", {
      name: "followUpCRM",
      intervalMs: ONE_HOUR_MS,
      handler: this.followUpCRM.bind(this),
      scheduledHour: 10,
    });

    this.jobs.set("previsaoEstoque", {
      name: "previsaoEstoque",
      intervalMs: SIX_HOURS_MS,
      handler: this.calcularPrevisaoEstoque.bind(this),
    });

    this.jobs.set("limparLogsAntigos", {
      name: "limparLogsAntigos",
      intervalMs: TWENTY_FOUR_HOURS_MS,
      handler: this.limparLogsAntigos.bind(this),
    });
  }

  start(): void {
    if (this.running) {
      console.log("[AutomationScheduler] Scheduler já está em execução");
      return;
    }

    console.log("[AutomationScheduler] Iniciando scheduler de automações");
    this.running = true;

    for (const [name, job] of this.jobs) {
      this.runJob(name).catch((err) =>
        console.error(`[AutomationScheduler] Erro na execução inicial de ${name}:`, err)
      );

      const interval = setInterval(async () => {
        try {
          if (job.scheduledHour !== undefined) {
            const now = new Date();
            if (now.getHours() !== job.scheduledHour) {
              return;
            }
          }
          await this.runJob(name);
        } catch (error) {
          console.error(`[AutomationScheduler] Erro no job ${name}:`, error);
        }
      }, job.intervalMs);

      this.intervals.set(name, interval);
      console.log(`[AutomationScheduler] Job ${name} agendado (intervalo: ${job.intervalMs / 1000}s)`);
    }
  }

  stop(): void {
    if (!this.running) {
      console.log("[AutomationScheduler] Scheduler não está em execução");
      return;
    }

    console.log("[AutomationScheduler] Parando scheduler de automações");

    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      console.log(`[AutomationScheduler] Job ${name} parado`);
    }

    this.intervals.clear();
    this.running = false;
  }

  async runJob(jobName: string): Promise<void> {
    const job = this.jobs.get(jobName);
    if (!job) {
      console.error(`[AutomationScheduler] Job ${jobName} não encontrado`);
      return;
    }

    const startTime = new Date();
    console.log(`[AutomationScheduler] Iniciando job ${jobName} às ${startTime.toISOString()}`);

    try {
      await job.handler();
      job.lastRun = new Date();
      const duration = Date.now() - startTime.getTime();
      console.log(`[AutomationScheduler] Job ${jobName} finalizado em ${duration}ms`);
    } catch (error) {
      console.error(`[AutomationScheduler] Erro no job ${jobName}:`, error);
    }
  }

  private async verificarEstoqueBaixo(): Promise<void> {
    const allTenants = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.status, "active"));

    let totalAlertas = 0;

    for (const tenant of allTenants) {
      try {
        const itensBaixos = await db
          .select({
            id: estoque.id,
            tenantId: estoque.tenantId,
            ingredienteId: estoque.ingredienteId,
            produtoId: estoque.produtoId,
            quantidade: estoque.quantidade,
            quantidadeMinima: estoque.quantidadeMinima,
            unidade: estoque.unidade,
          })
          .from(estoque)
          .where(
            and(
              eq(estoque.tenantId, tenant.id),
              sql`${estoque.quantidade} <= ${estoque.quantidadeMinima}`,
              sql`${estoque.quantidadeMinima} > 0`
            )
          );

        for (const item of itensBaixos) {
          const alertaExistente = await db
            .select({ id: alertasEstoque.id })
            .from(alertasEstoque)
            .where(
              and(
                eq(alertasEstoque.tenantId, tenant.id),
                eq(alertasEstoque.tipo, "estoque_baixo"),
                eq(alertasEstoque.lido, false),
                item.ingredienteId
                  ? eq(alertasEstoque.ingredienteId, item.ingredienteId)
                  : isNull(alertasEstoque.ingredienteId)
              )
            )
            .limit(1);

          if (alertaExistente.length === 0) {
            const identificador = item.ingredienteId || item.produtoId || item.id;
            await db.insert(alertasEstoque).values({
              tenantId: tenant.id,
              ingredienteId: item.ingredienteId || item.produtoId,
              tipo: "estoque_baixo",
              mensagem: `Estoque baixo: ${identificador} está com ${item.quantidade} ${item.unidade || "un"} (mínimo: ${item.quantidadeMinima})`,
              lido: false,
            });
            totalAlertas++;
          }
        }
      } catch (error) {
        console.error(`[AutomationScheduler] Erro ao verificar estoque para tenant ${tenant.id}:`, error);
      }
    }

    console.log(`[AutomationScheduler] verificarEstoqueBaixo: ${totalAlertas} alertas criados`);
  }

  private async followUpCRM(): Promise<void> {
    const now = new Date();
    if (now.getHours() !== 10) {
      return;
    }

    const allTenants = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.status, "active"));
    const dataLimite = new Date(Date.now() - THIRTY_DAYS_MS);
    let totalAlertas = 0;

    for (const tenant of allTenants) {
      try {
        const clientesDoTenant = await db
          .select({
            id: clientes.id,
            nome: clientes.nome,
            telefone: clientes.telefone,
          })
          .from(clientes)
          .where(eq(clientes.tenantId, tenant.id));

        for (const cliente of clientesDoTenant) {
          const ultimoPedido = await db
            .select({ createdAt: pedidos.createdAt })
            .from(pedidos)
            .where(
              and(
                eq(pedidos.tenantId, tenant.id),
                eq(pedidos.clienteId, cliente.id)
              )
            )
            .orderBy(sql`${pedidos.createdAt} DESC`)
            .limit(1);

          const dataUltimoPedido = ultimoPedido[0]?.createdAt || null;

          if (!dataUltimoPedido || dataUltimoPedido < dataLimite) {
            const diasInativo = dataUltimoPedido
              ? Math.floor((Date.now() - new Date(dataUltimoPedido).getTime()) / (24 * 60 * 60 * 1000))
              : "nunca";

            await db.insert(alertasEstoque).values({
              tenantId: tenant.id,
              ingredienteId: cliente.id,
              tipo: "followup_crm",
              mensagem: `Cliente inativo: ${cliente.nome} (${cliente.telefone || "sem telefone"}) - Último pedido: ${diasInativo === "nunca" ? "nunca" : `há ${diasInativo} dias`}`,
              lido: false,
            });
            totalAlertas++;
          }
        }
      } catch (error) {
        console.error(`[AutomationScheduler] Erro no followUpCRM para tenant ${tenant.id}:`, error);
      }
    }

    console.log(`[AutomationScheduler] followUpCRM: ${totalAlertas} alertas de follow-up criados`);
  }

  private async calcularPrevisaoEstoque(): Promise<void> {
    const allTenants = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.status, "active"));
    let totalPrevisoes = 0;

    const dataInicio = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const tenant of allTenants) {
      try {
        const pedidosRecentes = await db
          .select({
            itens: pedidos.itens,
            createdAt: pedidos.createdAt,
          })
          .from(pedidos)
          .where(
            and(
              eq(pedidos.tenantId, tenant.id),
              gte(pedidos.createdAt, dataInicio)
            )
          );

        const consumoPorProduto = new Map<string, { total: number; count: number }>();

        for (const pedido of pedidosRecentes) {
          const itens = pedido.itens as Array<{ produtoId?: string; nome?: string; quantidade?: number }>;
          if (Array.isArray(itens)) {
            for (const item of itens) {
              const key = item.produtoId || item.nome || "unknown";
              const atual = consumoPorProduto.get(key) || { total: 0, count: 0 };
              atual.total += item.quantidade || 1;
              atual.count++;
              consumoPorProduto.set(key, atual);
            }
          }
        }

        for (const [produtoId, dados] of consumoPorProduto) {
          const mediaDiaria = dados.total / 30;
          const previsao7Dias = Math.ceil(mediaDiaria * 7);

          const estoqueAtual = await db
            .select({ quantidade: estoque.quantidade, unidade: estoque.unidade })
            .from(estoque)
            .where(
              and(
                eq(estoque.tenantId, tenant.id),
                eq(estoque.produtoId, produtoId)
              )
            )
            .limit(1);

          const qtdAtual = estoqueAtual[0]?.quantidade || 0;
          const unidade = estoqueAtual[0]?.unidade || "un";

          const previsaoExistente = await db
            .select({ id: previsaoEstoque.id })
            .from(previsaoEstoque)
            .where(
              and(
                eq(previsaoEstoque.tenantId, tenant.id),
                eq(previsaoEstoque.ingrediente, produtoId),
                eq(previsaoEstoque.status, "pendente")
              )
            )
            .limit(1);

          if (previsaoExistente.length === 0) {
            await db.insert(previsaoEstoque).values({
              tenantId: tenant.id,
              ingrediente: produtoId,
              unidade: unidade,
              quantidadeAtual: qtdAtual,
              quantidadeSugerida: previsao7Dias,
              horizonteDias: 7,
              confianca: String(Math.min(95, 50 + dados.count * 2)),
              status: "pendente",
            });
            totalPrevisoes++;
          }
        }
      } catch (error) {
        console.error(`[AutomationScheduler] Erro na previsão para tenant ${tenant.id}:`, error);
      }
    }

    console.log(`[AutomationScheduler] previsaoEstoque: ${totalPrevisoes} previsões criadas`);
  }

  private async limparLogsAntigos(): Promise<void> {
    const dataLimite = new Date(Date.now() - THIRTY_DAYS_MS);
    let totalRemovidos = 0;

    try {
      const resultSystemLogs = await db
        .delete(systemLogs)
        .where(lt(systemLogs.createdAt, dataLimite));
      const countSystemLogs = resultSystemLogs.rowCount || 0;
      totalRemovidos += countSystemLogs;
      console.log(`[AutomationScheduler] limparLogsAntigos: ${countSystemLogs} system_logs removidos`);
    } catch (error) {
      console.error("[AutomationScheduler] Erro ao limpar system_logs:", error);
    }

    try {
      const resultLogsN8n = await db
        .delete(logsN8n)
        .where(lt(logsN8n.createdAt, dataLimite));
      const countLogsN8n = resultLogsN8n.rowCount || 0;
      totalRemovidos += countLogsN8n;
      console.log(`[AutomationScheduler] limparLogsAntigos: ${countLogsN8n} logs_n8n removidos`);
    } catch (error) {
      console.error("[AutomationScheduler] Erro ao limpar logs_n8n:", error);
    }

    try {
      const resultAlertasLidos = await db
        .delete(alertasEstoque)
        .where(
          and(
            eq(alertasEstoque.lido, true),
            lt(alertasEstoque.createdAt, dataLimite)
          )
        );
      const countAlertas = resultAlertasLidos.rowCount || 0;
      totalRemovidos += countAlertas;
      console.log(`[AutomationScheduler] limparLogsAntigos: ${countAlertas} alertas_estoque lidos removidos`);
    } catch (error) {
      console.error("[AutomationScheduler] Erro ao limpar alertas_estoque:", error);
    }

    console.log(`[AutomationScheduler] limparLogsAntigos: Total de ${totalRemovidos} registros removidos`);
  }

  getStatus(): { running: boolean; jobs: { name: string; lastRun?: Date }[] } {
    return {
      running: this.running,
      jobs: Array.from(this.jobs.values()).map((job) => ({
        name: job.name,
        lastRun: job.lastRun,
      })),
    };
  }
}

const scheduler = new AutomationScheduler();

export function initScheduler(): void {
  scheduler.start();
}

export function stopScheduler(): void {
  scheduler.stop();
}

export function runSchedulerJob(jobName: string): Promise<void> {
  return scheduler.runJob(jobName);
}

export function getSchedulerStatus(): { running: boolean; jobs: { name: string; lastRun?: Date }[] } {
  return scheduler.getStatus();
}

export { AutomationScheduler };
