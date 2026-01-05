import { db } from "./db";
import { tenants, webhookLogs } from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import crypto from "crypto";

const MAX_TENTATIVAS = 3;
const INTERVALO_BASE_MS = 5000;

export interface WebhookEvent {
  evento: string;
  tenantId: string;
  dados: any;
  timestamp: Date;
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  ativo: boolean;
}

export function gerarAssinaturaHMAC(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function enviarWebhook(event: WebhookEvent): Promise<boolean> {
  try {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, event.tenantId))
      .limit(1);

    if (!tenant || !tenant.webhookUrl) {
      console.log(`[Webhook] Tenant ${event.tenantId} não tem webhook configurado`);
      return false;
    }

    const payload = JSON.stringify({
      evento: event.evento,
      tenantId: event.tenantId,
      dados: event.dados,
      timestamp: event.timestamp.toISOString(),
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (tenant.webhookSecret) {
      headers["X-Webhook-Signature"] = gerarAssinaturaHMAC(payload, tenant.webhookSecret);
    }

    const response = await fetch(tenant.webhookUrl, {
      method: "POST",
      headers,
      body: payload,
    });

    await db.insert(webhookLogs).values({
      tenantId: event.tenantId,
      evento: event.evento,
      payload,
      status: response.ok ? "sucesso" : "falha",
      statusCode: response.status,
      resposta: await response.text().catch(() => ""),
      tentativas: 1,
    });

    return response.ok;
  } catch (error: any) {
    console.error(`[Webhook] Erro ao enviar:`, error);
    
    await db.insert(webhookLogs).values({
      tenantId: event.tenantId,
      evento: event.evento,
      payload: JSON.stringify(event),
      status: "erro",
      statusCode: 0,
      resposta: error.message,
      tentativas: 1,
    });

    return false;
  }
}

export async function emitirPedidoCriado(tenantId: string, pedido: any) {
  return enviarWebhook({
    evento: "pedido_criado",
    tenantId,
    dados: { pedidoId: pedido.id, cliente: pedido.clienteNome, itens: pedido.itens, total: pedido.total },
    timestamp: new Date(),
  });
}

export async function emitirStatusAtualizado(tenantId: string, pedidoId: string, novoStatus: string) {
  return enviarWebhook({
    evento: "status_atualizado",
    tenantId,
    dados: { pedidoId, status: novoStatus },
    timestamp: new Date(),
  });
}

export async function emitirEstoqueBaixo(tenantId: string, ingrediente: { id: string; nome: string; quantidade: number; minimo: number }) {
  return enviarWebhook({
    evento: "estoque_baixo",
    tenantId,
    dados: ingrediente,
    timestamp: new Date(),
  });
}

// Eventos KDS
export async function emitirPizzaIniciada(tenantId: string, dados: { pedidoId: string; produtoId: string; produtoNome: string }) {
  return enviarWebhook({
    evento: "pizza_iniciada",
    tenantId,
    dados,
    timestamp: new Date(),
  });
}

export async function emitirEtapaConcluida(tenantId: string, dados: { 
  pedidoId: string; 
  produtoId: string; 
  produtoNome: string;
  etapaNome: string;
  etapaNumero: number;
  totalEtapas: number;
  tempoReal: number;
  tempoEstimado: number;
}) {
  return enviarWebhook({
    evento: "etapa_concluida",
    tenantId,
    dados,
    timestamp: new Date(),
  });
}

export async function emitirPizzaConcluida(tenantId: string, dados: { pedidoId: string; produtoId: string; produtoNome: string; tempoTotal: number }) {
  return enviarWebhook({
    evento: "pizza_concluida",
    tenantId,
    dados,
    timestamp: new Date(),
  });
}

export async function reenviarWebhooksFalhados(tenantId?: string): Promise<number> {
  const whereClause = tenantId 
    ? and(
        eq(webhookLogs.tenantId, tenantId),
        inArray(webhookLogs.status, ["falha", "erro"]),
        sql`${webhookLogs.tentativas} < ${MAX_TENTATIVAS}`
      )
    : and(
        inArray(webhookLogs.status, ["falha", "erro"]),
        sql`${webhookLogs.tentativas} < ${MAX_TENTATIVAS}`
      );

  const webhooksPendentes = await db
    .select()
    .from(webhookLogs)
    .where(whereClause)
    .limit(100);

  let reenviados = 0;

  for (const log of webhooksPendentes) {
    try {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, log.tenantId))
        .limit(1);

      if (!tenant || !tenant.webhookUrl) {
        continue;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Retry-Attempt": String(log.tentativas + 1),
      };

      if (tenant.webhookSecret) {
        headers["X-Webhook-Signature"] = gerarAssinaturaHMAC(log.payload, tenant.webhookSecret);
      }

      const response = await fetch(tenant.webhookUrl, {
        method: "POST",
        headers,
        body: log.payload,
      });

      await db
        .update(webhookLogs)
        .set({
          status: response.ok ? "sucesso" : "falha",
          statusCode: response.status,
          resposta: await response.text().catch(() => ""),
          tentativas: log.tentativas + 1,
        })
        .where(eq(webhookLogs.id, log.id));

      if (response.ok) reenviados++;
    } catch (error: any) {
      await db
        .update(webhookLogs)
        .set({
          status: "erro",
          resposta: error.message,
          tentativas: log.tentativas + 1,
        })
        .where(eq(webhookLogs.id, log.id));
    }
  }

  return reenviados;
}

export function iniciarCronReenvioWebhooks() {
  console.log("[Webhook] Iniciando cron de reenvio (intervalo: 5 min)");
  
  setInterval(async () => {
    try {
      const reenviados = await reenviarWebhooksFalhados();
      if (reenviados > 0) {
        console.log(`[Webhook] Reenviados ${reenviados} webhooks`);
      }
    } catch (error) {
      console.error("[Webhook] Erro no cron de reenvio:", error);
    }
  }, 5 * 60 * 1000);
}
