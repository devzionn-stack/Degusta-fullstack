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
  if (!req.user?.tenantId) {
    return res.status(403).json({ error: "Nenhum tenant associado ao usuário" });
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
