import { storage } from "./storage";
import { eventBus } from "./event_bus";
import type { Tenant } from "../shared/schema";

export interface AdapterConfiguracao {
  webhookUrl: string | null;
  apiKey: string | null;
  ativo: boolean;
}

export interface ExternalAdapter {
  enviarMensagem(telefone: string, mensagem: string): Promise<boolean>;
  verificarStatus(): boolean;
  obterConfiguracao(): AdapterConfiguracao;
}

export interface WhatsAppConfig {
  webhookUrl: string | null;
  apiKey: string | null;
  tenantId: string;
}

export class WhatsAppAdapter implements ExternalAdapter {
  private config: WhatsAppConfig;
  private ativo: boolean;

  constructor(config: WhatsAppConfig) {
    this.config = config;
    this.ativo = !!config.webhookUrl;
  }

  async enviarMensagem(telefone: string, mensagem: string): Promise<boolean> {
    if (!this.ativo || !this.config.webhookUrl) {
      console.log(`[WhatsAppAdapter] Adapter não configurado para tenant ${this.config.tenantId}`);
      return false;
    }

    try {
      const payload = {
        telefone: this.formatarTelefone(telefone),
        mensagem,
        tenantId: this.config.tenantId,
        timestamp: new Date().toISOString(),
      };

      console.log(`[WhatsAppAdapter] Enviando mensagem para ${telefone}:`, mensagem.substring(0, 50));

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.config.apiKey) {
        headers["X-API-Key"] = this.config.apiKey;
      }

      const response = await fetch(this.config.webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[WhatsAppAdapter] Erro ao enviar mensagem: ${response.status} - ${errorText}`);
        return false;
      }

      console.log(`[WhatsAppAdapter] Mensagem enviada com sucesso para ${telefone}`);
      return true;
    } catch (error) {
      console.error("[WhatsAppAdapter] Erro ao enviar mensagem:", error);
      return false;
    }
  }

  verificarStatus(): boolean {
    return this.ativo;
  }

  obterConfiguracao(): AdapterConfiguracao {
    return {
      webhookUrl: this.config.webhookUrl,
      apiKey: this.config.apiKey ? "***" : null,
      ativo: this.ativo,
    };
  }

  private formatarTelefone(telefone: string): string {
    let cleaned = telefone.replace(/\D/g, "");
    if (cleaned.length === 11 && !cleaned.startsWith("55")) {
      cleaned = "55" + cleaned;
    }
    return cleaned;
  }
}

type TipoAdapter = "whatsapp";

interface CacheEntry {
  adapter: ExternalAdapter;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

class AdapterManager {
  private cache: Map<string, CacheEntry> = new Map();

  private getCacheKey(tipo: TipoAdapter, tenantId: string): string {
    return `${tipo}:${tenantId}`;
  }

  async getAdapter(tipo: TipoAdapter, tenantId: string): Promise<ExternalAdapter | null> {
    const cacheKey = this.getCacheKey(tipo, tenantId);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.adapter;
    }

    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      console.log(`[AdapterManager] Tenant ${tenantId} não encontrado`);
      return null;
    }

    const adapter = this.criarAdapter(tipo, tenant);
    if (adapter) {
      this.cache.set(cacheKey, {
        adapter,
        timestamp: Date.now(),
      });
    }

    return adapter;
  }

  private criarAdapter(tipo: TipoAdapter, tenant: Tenant): ExternalAdapter | null {
    switch (tipo) {
      case "whatsapp":
        return new WhatsAppAdapter({
          webhookUrl: tenant.n8nWebhookUrl || tenant.webhookUrl || null,
          apiKey: tenant.apiKeyN8n || null,
          tenantId: tenant.id,
        });
      default:
        console.log(`[AdapterManager] Tipo de adapter desconhecido: ${tipo}`);
        return null;
    }
  }

  async isAdapterAtivo(tipo: TipoAdapter, tenantId: string): Promise<boolean> {
    const adapter = await this.getAdapter(tipo, tenantId);
    return adapter?.verificarStatus() ?? false;
  }

  async enviarNotificacao(
    tipo: TipoAdapter,
    tenantId: string,
    telefone: string,
    mensagem: string
  ): Promise<boolean> {
    const adapter = await this.getAdapter(tipo, tenantId);
    if (!adapter) {
      console.log(`[AdapterManager] Adapter ${tipo} não disponível para tenant ${tenantId}`);
      return false;
    }

    if (!adapter.verificarStatus()) {
      console.log(`[AdapterManager] Adapter ${tipo} não está ativo para tenant ${tenantId}`);
      return false;
    }

    return adapter.enviarMensagem(telefone, mensagem);
  }

  invalidarCache(tenantId: string): void {
    for (const key of this.cache.keys()) {
      if (key.endsWith(`:${tenantId}`)) {
        this.cache.delete(key);
      }
    }
    console.log(`[AdapterManager] Cache invalidado para tenant ${tenantId}`);
  }
}

export const adapterManager = new AdapterManager();

export async function notificarClientePedidoPronto(
  tenantId: string,
  clienteId: string,
  pedidoId: string
): Promise<boolean> {
  try {
    const cliente = await storage.getCliente(clienteId, tenantId);
    if (!cliente || !cliente.telefone) {
      console.log(`[Notificacao] Cliente ${clienteId} sem telefone cadastrado`);
      return false;
    }

    const mensagem = `🍕 Seu pedido #${pedidoId.substring(0, 8)} está pronto! Em breve sairá para entrega.`;

    console.log(`[Notificacao] Notificando cliente ${cliente.nome} sobre pedido pronto`);
    return adapterManager.enviarNotificacao("whatsapp", tenantId, cliente.telefone, mensagem);
  } catch (error) {
    console.error("[Notificacao] Erro ao notificar pedido pronto:", error);
    return false;
  }
}

export async function notificarClienteEntregaSaiu(
  tenantId: string,
  clienteId: string,
  pedidoId: string
): Promise<boolean> {
  try {
    const cliente = await storage.getCliente(clienteId, tenantId);
    if (!cliente || !cliente.telefone) {
      console.log(`[Notificacao] Cliente ${clienteId} sem telefone cadastrado`);
      return false;
    }

    const pedido = await storage.getPedido(pedidoId, tenantId);
    const etaInfo = pedido?.etaMinutos ? ` Previsão: ${pedido.etaMinutos} minutos.` : "";

    const mensagem = `🏍️ Seu pedido #${pedidoId.substring(0, 8)} saiu para entrega!${etaInfo}`;

    console.log(`[Notificacao] Notificando cliente ${cliente.nome} sobre saída para entrega`);
    return adapterManager.enviarNotificacao("whatsapp", tenantId, cliente.telefone, mensagem);
  } catch (error) {
    console.error("[Notificacao] Erro ao notificar saída entrega:", error);
    return false;
  }
}

export async function notificarClienteEntregaRealizada(
  tenantId: string,
  clienteId: string,
  pedidoId: string
): Promise<boolean> {
  try {
    const cliente = await storage.getCliente(clienteId, tenantId);
    if (!cliente || !cliente.telefone) {
      console.log(`[Notificacao] Cliente ${clienteId} sem telefone cadastrado`);
      return false;
    }

    const mensagem = `✅ Pedido #${pedidoId.substring(0, 8)} entregue! Obrigado pela preferência. Esperamos que aproveite!`;

    console.log(`[Notificacao] Notificando cliente ${cliente.nome} sobre entrega realizada`);
    return adapterManager.enviarNotificacao("whatsapp", tenantId, cliente.telefone, mensagem);
  } catch (error) {
    console.error("[Notificacao] Erro ao notificar entrega realizada:", error);
    return false;
  }
}

export function registrarHandlersEventBus(): void {
  eventBus.on("pedido:pronto", async (data) => {
    try {
      const isAtivo = await adapterManager.isAdapterAtivo("whatsapp", data.tenantId);
      if (!isAtivo) {
        return;
      }

      const pedido = data.pedido;
      if (pedido.clienteId) {
        await notificarClientePedidoPronto(data.tenantId, pedido.clienteId, data.pedidoId);
      }
    } catch (error) {
      console.error("[ExternalAdapter] Erro ao processar evento pedido:pronto:", error);
    }
  });

  eventBus.on("pedido:status_alterado", async (data) => {
    try {
      if (data.statusNovo !== "em_entrega" && data.statusNovo !== "saiu_entrega") {
        return;
      }

      const isAtivo = await adapterManager.isAdapterAtivo("whatsapp", data.tenantId);
      if (!isAtivo) {
        return;
      }

      const pedido = data.pedido;
      if (pedido.clienteId) {
        await notificarClienteEntregaSaiu(data.tenantId, pedido.clienteId, pedido.id);
      }
    } catch (error) {
      console.error("[ExternalAdapter] Erro ao processar evento pedido:status_alterado:", error);
    }
  });

  console.log("[ExternalAdapter] Handlers de eventos registrados com sucesso");
}

registrarHandlersEventBus();
