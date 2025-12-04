import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

declare global {
  namespace Express {
    interface Request {
      webhookTenant?: {
        id: string;
        nome: string;
        apiKeyN8n: string | null;
        n8nWebhookUrl: string | null;
      };
    }
  }
}

export async function validateN8nWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    
    if (!tenantId) {
      return res.status(400).json({ 
        error: "Header X-Tenant-ID é obrigatório" 
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        error: "Header Authorization com Bearer token é obrigatório" 
      });
    }

    const providedApiKey = authHeader.substring(7);

    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ 
        error: "Tenant não encontrado" 
      });
    }

    if (!tenant.apiKeyN8n) {
      return res.status(403).json({ 
        error: "Tenant não possui API Key N8N configurada" 
      });
    }

    if (tenant.apiKeyN8n !== providedApiKey) {
      return res.status(403).json({ 
        error: "API Key inválida" 
      });
    }

    req.webhookTenant = {
      id: tenant.id,
      nome: tenant.nome,
      apiKeyN8n: tenant.apiKeyN8n,
      n8nWebhookUrl: tenant.n8nWebhookUrl,
    };

    next();
  } catch (error) {
    console.error("Webhook security error:", error);
    res.status(500).json({ error: "Erro interno de autenticação" });
  }
}

export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'n8n_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
