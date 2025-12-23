import { Request, Response, NextFunction } from "express";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";

const scryptAsync = promisify(scrypt);

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      nome: string;
      tenantId: string | null;
      role: string;
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(
  supplied: string,
  stored: string
): Promise<boolean> {
  const [hashedPassword, salt] = stored.split(".");
  const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
  const suppliedPasswordBuf = (await scryptAsync(
    supplied,
    salt,
    64
  )) as Buffer;
  return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  next();
}

export async function loadUser(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) {
    try {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          nome: user.nome,
          tenantId: user.tenantId,
          role: user.role,
        };
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
  }
  next();
}

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  // Super admin can access any tenant by providing tenantId in query or header
  if (req.user?.role === "super_admin") {
    const tenantIdFromQuery = req.query.tenantId as string | undefined;
    const tenantIdFromHeader = req.headers["x-tenant-id"] as string | undefined;
    const effectiveTenantId = tenantIdFromQuery || tenantIdFromHeader;
    
    if (effectiveTenantId) {
      // Override tenantId for super admin
      (req.user as any).effectiveTenantId = effectiveTenantId;
      return next();
    }
    // If super admin doesn't provide tenantId, return error
    return res.status(403).json({ error: "Super admin deve selecionar uma franquia" });
  }
  
  if (!req.user?.tenantId) {
    return res.status(403).json({ error: "Nenhum tenant associado ao usuário" });
  }
  
  // For regular users, set effectiveTenantId to their own tenantId
  (req.user as any).effectiveTenantId = req.user.tenantId;
  next();
}

// Helper to get effective tenant ID (works for both super admin and regular users)
export function getEffectiveTenantId(req: Request): string {
  return (req.user as any)?.effectiveTenantId || req.user?.tenantId || "";
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  if (req.user.role !== "super_admin") {
    return res.status(403).json({ error: "Acesso restrito a Super Admin" });
  }
  next();
}

export function requireTenantAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  if (req.user.role !== "tenant_admin" && req.user.role !== "super_admin") {
    return res.status(403).json({ error: "Acesso restrito a administradores" });
  }
  next();
}

export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    const userId = req.session.userId;
    req.session.regenerate((err) => {
      if (err) {
        reject(err);
      } else {
        if (userId) {
          req.session.userId = userId;
        }
        resolve();
      }
    });
  });
}

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}
