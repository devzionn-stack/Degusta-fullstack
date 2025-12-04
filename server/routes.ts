import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { hashPassword, comparePasswords, requireAuth, requireTenant } from "./auth";
import {
  insertTenantSchema,
  insertClienteSchema,
  insertProdutoSchema,
  insertPedidoSchema,
  loginSchema,
  registerSchema,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ============================================
  // AUTH ROUTES
  // ============================================
  
  app.post("/api/auth/register", async (req, res) => {
    try {
      const validation = registerSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: fromZodError(validation.error).toString() 
        });
      }

      const { email, password, nome, tenantId } = validation.data;
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email já cadastrado" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        nome,
        tenantId: tenantId || null,
        role: "user",
      });

      req.session.userId = user.id;
      
      res.status(201).json({
        id: user.id,
        email: user.email,
        nome: user.nome,
        tenantId: user.tenantId,
        role: user.role,
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: "Erro ao criar conta" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const validation = loginSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: fromZodError(validation.error).toString() 
        });
      }

      const { email, password } = validation.data;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Email ou senha inválidos" });
      }

      const isValid = await comparePasswords(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Email ou senha inválidos" });
      }

      req.session.userId = user.id;
      
      res.json({
        id: user.id,
        email: user.email,
        nome: user.nome,
        tenantId: user.tenantId,
        role: user.role,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao fazer logout" });
      }
      res.json({ message: "Logout realizado com sucesso" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "Usuário não encontrado" });
      }

      res.json({
        id: user.id,
        email: user.email,
        nome: user.nome,
        tenantId: user.tenantId,
        role: user.role,
      });
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar usuário" });
    }
  });

  // ============================================
  // TENANTS ROUTES
  // ============================================
  
  app.get("/api/tenants", async (req, res) => {
    try {
      const tenants = await storage.getTenants();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tenants" });
    }
  });

  app.get("/api/tenants/:id", async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tenant" });
    }
  });

  app.post("/api/tenants", requireAuth, async (req, res) => {
    try {
      const validation = insertTenantSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: fromZodError(validation.error).toString() 
        });
      }
      const tenant = await storage.createTenant(validation.data);
      res.status(201).json(tenant);
    } catch (error) {
      res.status(500).json({ error: "Failed to create tenant" });
    }
  });

  app.patch("/api/tenants/:id", requireAuth, async (req, res) => {
    try {
      const tenant = await storage.updateTenant(req.params.id, req.body);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ error: "Failed to update tenant" });
    }
  });

  // ============================================
  // CLIENTES ROUTES (Multi-tenant)
  // ============================================
  
  app.get("/api/clientes", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const clientes = await storage.getClientes(tenantId);
      res.json(clientes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clientes" });
    }
  });

  app.get("/api/clientes/:id", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const cliente = await storage.getCliente(req.params.id, tenantId);
      if (!cliente) {
        return res.status(404).json({ error: "Cliente not found" });
      }
      res.json(cliente);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cliente" });
    }
  });

  app.post("/api/clientes", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.body.tenantId;
      const validation = insertClienteSchema.safeParse({ ...req.body, tenantId });
      if (!validation.success) {
        return res.status(400).json({ 
          error: fromZodError(validation.error).toString() 
        });
      }
      const cliente = await storage.createCliente(validation.data);
      res.status(201).json(cliente);
    } catch (error) {
      res.status(500).json({ error: "Failed to create cliente" });
    }
  });

  app.patch("/api/clientes/:id", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const cliente = await storage.updateCliente(req.params.id, tenantId, req.body);
      if (!cliente) {
        return res.status(404).json({ error: "Cliente not found" });
      }
      res.json(cliente);
    } catch (error) {
      res.status(500).json({ error: "Failed to update cliente" });
    }
  });

  app.delete("/api/clientes/:id", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const success = await storage.deleteCliente(req.params.id, tenantId);
      if (!success) {
        return res.status(404).json({ error: "Cliente not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete cliente" });
    }
  });

  // ============================================
  // PRODUTOS ROUTES (Multi-tenant)
  // ============================================
  
  app.get("/api/produtos", async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const produtos = await storage.getProdutos(tenantId);
      res.json(produtos);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch produtos" });
    }
  });

  app.get("/api/produtos/:id", async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const produto = await storage.getProduto(req.params.id, tenantId);
      if (!produto) {
        return res.status(404).json({ error: "Produto not found" });
      }
      res.json(produto);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch produto" });
    }
  });

  app.post("/api/produtos", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.body.tenantId;
      const validation = insertProdutoSchema.safeParse({ ...req.body, tenantId });
      if (!validation.success) {
        return res.status(400).json({ 
          error: fromZodError(validation.error).toString() 
        });
      }
      const produto = await storage.createProduto(validation.data);
      res.status(201).json(produto);
    } catch (error) {
      res.status(500).json({ error: "Failed to create produto" });
    }
  });

  app.patch("/api/produtos/:id", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const produto = await storage.updateProduto(req.params.id, tenantId, req.body);
      if (!produto) {
        return res.status(404).json({ error: "Produto not found" });
      }
      res.json(produto);
    } catch (error) {
      res.status(500).json({ error: "Failed to update produto" });
    }
  });

  app.delete("/api/produtos/:id", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const success = await storage.deleteProduto(req.params.id, tenantId);
      if (!success) {
        return res.status(404).json({ error: "Produto not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete produto" });
    }
  });

  // ============================================
  // PEDIDOS ROUTES (Multi-tenant)
  // ============================================
  
  app.get("/api/pedidos", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const pedidos = await storage.getPedidos(tenantId);
      res.json(pedidos);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pedidos" });
    }
  });

  app.get("/api/pedidos/:id", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const pedido = await storage.getPedido(req.params.id, tenantId);
      if (!pedido) {
        return res.status(404).json({ error: "Pedido not found" });
      }
      res.json(pedido);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pedido" });
    }
  });

  app.post("/api/pedidos", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.body.tenantId;
      const validation = insertPedidoSchema.safeParse({ ...req.body, tenantId });
      if (!validation.success) {
        return res.status(400).json({ 
          error: fromZodError(validation.error).toString() 
        });
      }
      const pedido = await storage.createPedido(validation.data);
      res.status(201).json(pedido);
    } catch (error) {
      res.status(500).json({ error: "Failed to create pedido" });
    }
  });

  app.patch("/api/pedidos/:id", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const pedido = await storage.updatePedido(req.params.id, tenantId, req.body);
      if (!pedido) {
        return res.status(404).json({ error: "Pedido not found" });
      }
      res.json(pedido);
    } catch (error) {
      res.status(500).json({ error: "Failed to update pedido" });
    }
  });

  app.delete("/api/pedidos/:id", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const success = await storage.deletePedido(req.params.id, tenantId);
      if (!success) {
        return res.status(404).json({ error: "Pedido not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete pedido" });
    }
  });

  // ============================================
  // ESTOQUE ROUTES (Multi-tenant)
  // ============================================
  
  app.get("/api/estoque", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const estoque = await storage.getEstoque(tenantId);
      res.json(estoque);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch estoque" });
    }
  });

  app.get("/api/estoque/produto/:produtoId", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const estoqueItem = await storage.getEstoqueByProduto(req.params.produtoId, tenantId);
      if (!estoqueItem) {
        return res.status(404).json({ error: "Estoque not found" });
      }
      res.json(estoqueItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch estoque" });
    }
  });

  app.patch("/api/estoque/:id", requireAuth, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId || req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: "tenantId is required" });
      }
      const estoqueItem = await storage.updateEstoque(req.params.id, tenantId, req.body);
      if (!estoqueItem) {
        return res.status(404).json({ error: "Estoque not found" });
      }
      res.json(estoqueItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to update estoque" });
    }
  });

  return httpServer;
}
