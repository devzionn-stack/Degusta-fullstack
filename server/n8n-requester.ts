import { storage } from "./storage";

interface N8nRequestOptions {
  tenantId: string;
  endpoint: string;
  payload: Record<string, any>;
}

interface N8nResponse {
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
}

export async function sendToN8n(options: N8nRequestOptions): Promise<N8nResponse> {
  const { tenantId, endpoint, payload } = options;

  try {
    const tenant = await storage.getTenant(tenantId);
    
    if (!tenant) {
      return {
        success: false,
        error: "Tenant não encontrado",
      };
    }

    if (!tenant.n8nWebhookUrl) {
      return {
        success: false,
        error: "Tenant não possui URL do webhook N8N configurada",
      };
    }

    if (!tenant.apiKeyN8n) {
      return {
        success: false,
        error: "Tenant não possui API Key N8N configurada",
      };
    }

    const fullUrl = `${tenant.n8nWebhookUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tenant.apiKeyN8n}`,
        "X-Tenant-ID": tenantId,
      },
      body: JSON.stringify({
        tenantId,
        tenantNome: tenant.nome,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    });

    const responseData = await response.text();
    let parsedData: any;
    
    try {
      parsedData = JSON.parse(responseData);
    } catch {
      parsedData = { raw: responseData };
    }

    await storage.createLogN8n({
      tenantId,
      tipo: "request_enviado",
      endpoint: fullUrl,
      payload,
      resposta: parsedData,
      status: response.ok ? "sucesso" : "erro",
      erro: response.ok ? null : `HTTP ${response.status}`,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Erro HTTP: ${response.status}`,
        statusCode: response.status,
        data: parsedData,
      };
    }

    return {
      success: true,
      statusCode: response.status,
      data: parsedData,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    
    await storage.createLogN8n({
      tenantId,
      tipo: "request_erro",
      endpoint,
      payload,
      resposta: null,
      status: "erro",
      erro: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function notifyN8nNewOrder(tenantId: string, pedido: any): Promise<N8nResponse> {
  return sendToN8n({
    tenantId,
    endpoint: "novo-pedido",
    payload: {
      evento: "novo_pedido",
      pedido,
    },
  });
}

export async function notifyN8nOrderStatusChange(
  tenantId: string, 
  pedidoId: string, 
  novoStatus: string
): Promise<N8nResponse> {
  return sendToN8n({
    tenantId,
    endpoint: "status-pedido",
    payload: {
      evento: "status_atualizado",
      pedidoId,
      novoStatus,
    },
  });
}

export async function sendN8nMessage(
  tenantId: string, 
  destinatario: string, 
  mensagem: string,
  tipo: "whatsapp" | "email" | "sms" = "whatsapp"
): Promise<N8nResponse> {
  return sendToN8n({
    tenantId,
    endpoint: "enviar-mensagem",
    payload: {
      evento: "enviar_mensagem",
      tipo,
      destinatario,
      mensagem,
    },
  });
}
