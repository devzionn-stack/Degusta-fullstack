import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { pedidos } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { hashPassword, comparePasswords, requireAuth, requireTenant, requireSuperAdmin, regenerateSession } from "./auth";
import { validateN8nWebhook, generateApiKey } from "./webhook-security";
import { sendToN8n, notifyN8nNewOrder } from "./n8n-requester";
import { broadcastNewOrder, broadcastOrderStatusChange } from "./websocket";
import {
  insertTenantSchema,
  insertClienteSchema,
  insertProdutoSchema,
  insertPedidoSchema,
  insertMotoboySchema,
  loginSchema,
  registerSchema,
  webhookPedidoSchema,
  webhookIndicadorSchema,
} from "@shared/schema";
import { iniciarRastreamento, generateSimulatedTrackingData } from "./n2n-service";
import { fromZodError } from "zod-validation-error";
import { calcularDPT, obterDPTRealtime, registrarInicioPreparoPedido, registrarFimPreparoPedido } from "./dpt_calculator";
import {
  geocodificarEndereco,
  calcularRota,
  calcularETA,
  obterMotoboyPorToken,
  atualizarLocalizacaoMotoboy,
  gerarTokenMotoboy,
} from "./geo_service";
import { despacharPedido, finalizarEntrega, selecionarMotoboyIdeal } from "./despacho";
import { calcularTempoLoop, atualizarTimingPedido, listarPedidosProducao, getStatusProducaoPedido } from "./producao_timing";
import { verificarProximidadeDestino, enviarAlertaPizzaChegando } from "./alerta_chegada";
import {
  atualizarPrecoMercado,
  calcularCustoProduto,
  listarCustosProdutos,
  calcularLucroFranquia,
  listarLucrosFranquias,
  calcularLucroPorIngrediente,
  getHistoricoPrecosMercado,
} from "./custo_lucro";
import { webhookCustoMercadoSchema } from "@shared/schema";
import { 
  processarMensagemIA, 
  atualizarEstoqueIngrediente as atualizarEstoqueIngredienteAPI, 
  cancelarMotoboy as cancelarMotoboyAPI 
} from "./agente-ia";

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

      if (tenantId) {
        const tenant = await storage.getTenant(tenantId);
        if (!tenant) {
          return res.status(400).json({ error: "Franquia não encontrada" });
        }
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        nome,
        tenantId: tenantId || null,
        role: "user",
      });

      await regenerateSession(req);
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

      await regenerateSession(req);
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

  app.post("/api/auth/switch-tenant", requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: "Apenas administradores podem trocar de franquia" });
      }

      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: "ID da franquia é obrigatório" });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Franquia não encontrada" });
      }

      await storage.updateUser(req.user!.id, { tenantId });
      
      const updatedUser = await storage.getUser(req.user!.id);

      res.json({
        id: updatedUser!.id,
        email: updatedUser!.email,
        nome: updatedUser!.nome,
        tenantId: updatedUser!.tenantId,
        role: updatedUser!.role,
        message: `Franquia alterada para ${tenant.nome}`,
      });
    } catch (error) {
      console.error("Switch tenant error:", error);
      res.status(500).json({ error: "Erro ao trocar de franquia" });
    }
  });

  // ============================================
  // TENANTS ROUTES (Protected - Tenant Scoped)
  // ============================================
  
  app.get("/api/tenants/me", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tenant" });
    }
  });

  app.get("/api/tenants", requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }
      const tenants = await storage.getTenants();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tenants" });
    }
  });

  app.get("/api/tenants/:id", requireAuth, async (req, res) => {
    try {
      if (req.user?.tenantId !== req.params.id && req.user?.role !== 'admin') {
        return res.status(403).json({ error: "Access denied" });
      }
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
  // CLIENTES ROUTES (Multi-tenant - uses req.user.tenantId ONLY)
  // ============================================
  
  app.get("/api/clientes", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const clientes = await storage.getClientes(tenantId);
      res.json(clientes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clientes" });
    }
  });

  app.get("/api/clientes/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const cliente = await storage.getCliente(req.params.id, tenantId);
      if (!cliente) {
        return res.status(404).json({ error: "Cliente not found" });
      }
      res.json(cliente);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cliente" });
    }
  });

  app.post("/api/clientes", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
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

  app.patch("/api/clientes/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const cliente = await storage.updateCliente(req.params.id, tenantId, req.body);
      if (!cliente) {
        return res.status(404).json({ error: "Cliente not found" });
      }
      res.json(cliente);
    } catch (error) {
      res.status(500).json({ error: "Failed to update cliente" });
    }
  });

  app.delete("/api/clientes/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
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
  // PRODUTOS ROUTES (Multi-tenant - uses req.user.tenantId ONLY)
  // ============================================
  
  app.get("/api/produtos", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const produtos = await storage.getProdutos(tenantId);
      res.json(produtos);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch produtos" });
    }
  });

  app.get("/api/produtos/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const produto = await storage.getProduto(req.params.id, tenantId);
      if (!produto) {
        return res.status(404).json({ error: "Produto not found" });
      }
      res.json(produto);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch produto" });
    }
  });

  app.post("/api/produtos", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
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

  app.patch("/api/produtos/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const produto = await storage.updateProduto(req.params.id, tenantId, req.body);
      if (!produto) {
        return res.status(404).json({ error: "Produto not found" });
      }
      res.json(produto);
    } catch (error) {
      res.status(500).json({ error: "Failed to update produto" });
    }
  });

  app.delete("/api/produtos/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
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
  // PEDIDOS ROUTES (Multi-tenant - uses req.user.tenantId ONLY)
  // ============================================
  
  app.get("/api/pedidos", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const pedidos = await storage.getPedidos(tenantId);
      res.json(pedidos);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pedidos" });
    }
  });

  app.get("/api/pedidos/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const pedido = await storage.getPedido(req.params.id, tenantId);
      if (!pedido) {
        return res.status(404).json({ error: "Pedido not found" });
      }
      res.json(pedido);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pedido" });
    }
  });

  app.post("/api/pedidos", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
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

  app.patch("/api/pedidos/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const pedido = await storage.updatePedido(req.params.id, tenantId, req.body);
      if (!pedido) {
        return res.status(404).json({ error: "Pedido not found" });
      }
      
      broadcastOrderStatusChange(tenantId, pedido);
      
      res.json(pedido);
    } catch (error) {
      res.status(500).json({ error: "Failed to update pedido" });
    }
  });

  app.get("/api/pedidos/cozinha", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const pedidos = await storage.getPedidosByStatus(tenantId, [
        "recebido",
        "em_preparo",
        "pronto"
      ]);
      res.json(pedidos);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pedidos cozinha" });
    }
  });

  app.patch("/api/pedidos/:id/status", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { status } = req.body;
      
      const validStatuses = ["recebido", "em_preparo", "pronto", "saiu_entrega", "entregue", "cancelado"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status inválido. Use: ${validStatuses.join(", ")}` });
      }
      
      const pedido = await storage.updatePedido(req.params.id, tenantId, { status });
      if (!pedido) {
        return res.status(404).json({ error: "Pedido not found" });
      }
      
      broadcastOrderStatusChange(tenantId, pedido);
      
      res.json(pedido);
    } catch (error) {
      res.status(500).json({ error: "Failed to update pedido status" });
    }
  });

  app.delete("/api/pedidos/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
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
  // ESTOQUE ROUTES (Multi-tenant - uses req.user.tenantId ONLY)
  // ============================================
  
  app.get("/api/estoque", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const estoque = await storage.getEstoque(tenantId);
      res.json(estoque);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch estoque" });
    }
  });

  app.get("/api/estoque/produto/:produtoId", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const estoqueItem = await storage.getEstoqueByProduto(req.params.produtoId, tenantId);
      if (!estoqueItem) {
        return res.status(404).json({ error: "Estoque not found" });
      }
      res.json(estoqueItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch estoque" });
    }
  });

  app.patch("/api/estoque/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const estoqueItem = await storage.updateEstoque(req.params.id, tenantId, req.body);
      if (!estoqueItem) {
        return res.status(404).json({ error: "Estoque not found" });
      }
      res.json(estoqueItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to update estoque" });
    }
  });

  // ============================================
  // MOTOBOYS ROUTES (Multi-tenant)
  // ============================================

  app.get("/api/motoboys", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const motoboysList = await storage.getMotoboys(tenantId);
      res.json(motoboysList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch motoboys" });
    }
  });

  app.get("/api/motoboys/disponiveis", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const motoboysList = await storage.getMotoboysByStatus(tenantId, "disponivel");
      res.json(motoboysList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch motoboys disponíveis" });
    }
  });

  app.get("/api/motoboys/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const motoboy = await storage.getMotoboy(req.params.id, tenantId);
      if (!motoboy) {
        return res.status(404).json({ error: "Motoboy not found" });
      }
      res.json(motoboy);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch motoboy" });
    }
  });

  app.post("/api/motoboys", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const validation = insertMotoboySchema.safeParse({ ...req.body, tenantId });
      if (!validation.success) {
        return res.status(400).json({ 
          error: fromZodError(validation.error).toString() 
        });
      }
      const motoboy = await storage.createMotoboy(validation.data);
      res.status(201).json(motoboy);
    } catch (error) {
      res.status(500).json({ error: "Failed to create motoboy" });
    }
  });

  app.patch("/api/motoboys/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const motoboy = await storage.updateMotoboy(req.params.id, tenantId, req.body);
      if (!motoboy) {
        return res.status(404).json({ error: "Motoboy not found" });
      }
      res.json(motoboy);
    } catch (error) {
      res.status(500).json({ error: "Failed to update motoboy" });
    }
  });

  app.delete("/api/motoboys/:id", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const success = await storage.deleteMotoboy(req.params.id, tenantId);
      if (!success) {
        return res.status(404).json({ error: "Motoboy not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete motoboy" });
    }
  });

  // ============================================
  // TRACKING / DELIVERY ROUTES
  // ============================================

  app.post("/api/pedidos/:id/iniciar-entrega", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { motoboyId } = req.body;

      if (!motoboyId) {
        return res.status(400).json({ error: "motoboyId é obrigatório" });
      }

      const pedido = await storage.getPedido(req.params.id, tenantId);
      if (!pedido) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }

      const motoboy = await storage.getMotoboy(motoboyId, tenantId);
      if (!motoboy) {
        return res.status(404).json({ error: "Motoboy não encontrado" });
      }

      const trackingResult = await iniciarRastreamento(req.params.id, motoboyId, tenantId);
      
      if (!trackingResult.success) {
        return res.status(500).json({ error: trackingResult.error || "Erro ao iniciar rastreamento" });
      }

      const updatedPedido = await storage.updatePedido(req.params.id, tenantId, {
        motoboyId,
        status: "saiu_entrega",
        trackingLink: trackingResult.trackingLink,
        trackingToken: trackingResult.trackingToken,
        trackingStatus: "ativo",
        trackingStartedAt: new Date(),
      });

      await storage.updateMotoboy(motoboyId, tenantId, { status: "em_entrega" });

      broadcastOrderStatusChange(tenantId, updatedPedido!);

      res.json({
        success: true,
        pedido: updatedPedido,
        trackingLink: trackingResult.trackingLink,
        message: "Entrega iniciada com sucesso",
      });
    } catch (error) {
      console.error("Erro ao iniciar entrega:", error);
      res.status(500).json({ error: "Erro ao iniciar entrega" });
    }
  });

  app.post("/api/pedidos/:id/finalizar-entrega", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;

      const pedido = await storage.getPedido(req.params.id, tenantId);
      if (!pedido) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }

      const updatedPedido = await storage.updatePedido(req.params.id, tenantId, {
        status: "entregue",
        trackingStatus: "finalizado",
      });

      if (pedido.motoboyId) {
        await storage.updateMotoboy(pedido.motoboyId, tenantId, { status: "disponivel" });
      }

      broadcastOrderStatusChange(tenantId, updatedPedido!);

      res.json({
        success: true,
        pedido: updatedPedido,
        message: "Entrega finalizada com sucesso",
      });
    } catch (error) {
      console.error("Erro ao finalizar entrega:", error);
      res.status(500).json({ error: "Erro ao finalizar entrega" });
    }
  });

  // ============================================
  // PUBLIC TRACKING ROUTE (Secure token-based access)
  // ============================================

  app.get("/api/public/rastreio/:trackingToken", async (req, res) => {
    try {
      const { trackingToken } = req.params;

      if (!trackingToken || !trackingToken.startsWith("TRK-")) {
        return res.status(400).json({ error: "Token de rastreamento inválido" });
      }

      const pedido = await storage.getPedidoByTrackingToken(trackingToken);
      if (!pedido) {
        return res.status(404).json({ error: "Rastreamento não encontrado" });
      }

      if (!pedido.trackingLink || pedido.trackingStatus === "finalizado") {
        const isFinished = pedido.trackingStatus === "finalizado" || pedido.status === "entregue";
        if (!isFinished) {
          return res.status(404).json({ error: "Rastreamento não disponível" });
        }
      }

      const trackingData = generateSimulatedTrackingData(pedido.id);

      res.json({
        pedidoId: pedido.id.slice(0, 8),
        status: pedido.status,
        trackingStatus: pedido.trackingStatus,
        trackingData,
        enderecoEntrega: pedido.enderecoEntrega ? pedido.enderecoEntrega.split(',')[0] + "..." : null,
        createdAt: pedido.createdAt,
      });
    } catch (error) {
      console.error("Erro ao buscar rastreamento:", error);
      res.status(500).json({ error: "Erro ao buscar rastreamento" });
    }
  });

  // ============================================
  // N8N WEBHOOK ROUTES
  // ============================================

  app.post("/api/webhook/n8n/pedido", validateN8nWebhook, async (req, res) => {
    try {
      const tenantId = req.webhookTenant!.id;
      
      const validation = webhookPedidoSchema.safeParse(req.body);
      if (!validation.success) {
        await storage.createLogN8n({
          tenantId,
          tipo: "pedido_recebido",
          endpoint: "/api/webhook/n8n/pedido",
          payload: req.body,
          resposta: null,
          status: "erro",
          erro: fromZodError(validation.error).toString(),
        });
        return res.status(400).json({ 
          error: fromZodError(validation.error).toString() 
        });
      }

      const { cliente: clienteData, itens, observacoes, enderecoEntrega } = validation.data;

      let cliente = await storage.getClienteByTelefone(clienteData.telefone || "", tenantId);
      
      if (!cliente && clienteData.telefone) {
        cliente = await storage.createCliente({
          tenantId,
          nome: clienteData.nome,
          telefone: clienteData.telefone,
          email: clienteData.email || null,
          endereco: clienteData.endereco || null,
        });
      }

      const processedItems: Array<{
        produtoId: string | null;
        nome: string;
        quantidade: number;
        precoUnitario: number;
        subtotal: number;
        validado: boolean;
      }> = [];

      let calculatedTotal = 0;
      const estoqueErrors: string[] = [];

      for (const item of itens) {
        let produto = null;
        
        if (item.produtoId) {
          produto = await storage.getProduto(item.produtoId, tenantId);
        }
        
        if (!produto && item.nome) {
          produto = await storage.getProdutoByNome(item.nome, tenantId);
        }

        const precoUnitario = produto ? parseFloat(produto.preco) : item.precoUnitario;
        const subtotal = item.quantidade * precoUnitario;
        calculatedTotal += subtotal;

        processedItems.push({
          produtoId: produto?.id || null,
          nome: produto?.nome || item.nome,
          quantidade: item.quantidade,
          precoUnitario,
          subtotal,
          validado: !!produto,
        });

        if (produto) {
          const estoqueItem = await storage.getEstoqueByProduto(produto.id, tenantId);
          if (estoqueItem) {
            if (estoqueItem.quantidade >= item.quantidade) {
              await storage.decrementEstoque(produto.id, tenantId, item.quantidade);
            } else {
              estoqueErrors.push(`Estoque insuficiente para ${produto.nome}: disponível ${estoqueItem.quantidade}, solicitado ${item.quantidade}`);
            }
          }
        }
      }

      const dptResult = await calcularDPT(tenantId, processedItems.map(i => ({
        produtoId: i.produtoId || undefined,
        nome: i.nome,
        quantidade: i.quantidade,
      })));

      const loopResult = await calcularTempoLoop(tenantId, processedItems.map(i => ({
        produtoId: i.produtoId || undefined,
        nome: i.nome,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
      })));

      const pedido = await storage.createPedido({
        tenantId,
        clienteId: cliente?.id || null,
        status: "recebido",
        total: calculatedTotal.toFixed(2),
        itens: processedItems,
        observacoes: observacoes || (estoqueErrors.length > 0 ? `ALERTAS: ${estoqueErrors.join("; ")}` : null),
        enderecoEntrega: enderecoEntrega || clienteData.endereco || null,
        origem: "n8n",
        tempoPreparoEstimado: dptResult.tempoPreparoEstimado,
        tempoEntregaEstimado: dptResult.tempoEntregaEstimado,
        tempoMetaMontagem: loopResult.tempoMetaMontagem,
        numeroLoop: loopResult.tempoLoop,
      });

      broadcastNewOrder(tenantId, pedido);

      await storage.createLogN8n({
        tenantId,
        tipo: "pedido_recebido",
        endpoint: "/api/webhook/n8n/pedido",
        payload: req.body,
        resposta: { 
          pedidoId: pedido.id,
          totalCalculado: calculatedTotal,
          itensValidados: processedItems.filter(i => i.validado).length,
          itensTotal: processedItems.length,
          alertasEstoque: estoqueErrors,
        },
        status: "sucesso",
        erro: estoqueErrors.length > 0 ? estoqueErrors.join("; ") : null,
      });

      res.status(201).json({
        success: true,
        message: "Pedido criado com sucesso",
        pedidoId: pedido.id,
        clienteId: cliente?.id || null,
        totalCalculado: calculatedTotal,
        itensValidados: processedItems.filter(i => i.validado).length,
        alertasEstoque: estoqueErrors,
        dpt: {
          tempoPreparoEstimado: dptResult.tempoPreparoEstimado,
          tempoEntregaEstimado: dptResult.tempoEntregaEstimado,
          fatorFila: dptResult.fatorFila,
          confianca: dptResult.confianca,
        },
      });
    } catch (error) {
      console.error("Webhook pedido error:", error);
      res.status(500).json({ error: "Erro ao processar pedido" });
    }
  });

  app.post("/api/webhook/n8n/indicador", validateN8nWebhook, async (req, res) => {
    try {
      const tenantId = req.webhookTenant!.id;
      
      const validation = webhookIndicadorSchema.safeParse(req.body);
      if (!validation.success) {
        await storage.createLogN8n({
          tenantId,
          tipo: "indicador_recebido",
          endpoint: "/api/webhook/n8n/indicador",
          payload: req.body,
          resposta: null,
          status: "erro",
          erro: fromZodError(validation.error).toString(),
        });
        return res.status(400).json({ 
          error: fromZodError(validation.error).toString() 
        });
      }

      const { tipo, dados, mensagem } = validation.data;

      const log = await storage.createLogN8n({
        tenantId,
        tipo: `indicador_${tipo}`,
        endpoint: "/api/webhook/n8n/indicador",
        payload: { tipo, dados, mensagem },
        resposta: { processed: true },
        status: "sucesso",
        erro: null,
      });

      res.status(200).json({
        success: true,
        message: mensagem || "Indicador registrado com sucesso",
        logId: log.id,
      });
    } catch (error) {
      console.error("Webhook indicador error:", error);
      res.status(500).json({ error: "Erro ao processar indicador" });
    }
  });

  app.get("/api/data/vendas_historico", validateN8nWebhook, async (req, res) => {
    try {
      const tenantId = req.webhookTenant!.id;
      const { dataInicio, dataFim, limite } = req.query;

      const pedidos = await storage.getPedidos(tenantId);
      
      let filteredPedidos = pedidos.filter(p => 
        p.status === "entregue" || p.status === "finalizado"
      );

      if (dataInicio) {
        const inicio = new Date(dataInicio as string);
        filteredPedidos = filteredPedidos.filter(p => new Date(p.createdAt) >= inicio);
      }

      if (dataFim) {
        const fim = new Date(dataFim as string);
        filteredPedidos = filteredPedidos.filter(p => new Date(p.createdAt) <= fim);
      }

      if (limite) {
        filteredPedidos = filteredPedidos.slice(0, parseInt(limite as string));
      }

      const vendasHistorico = filteredPedidos.map(pedido => {
        const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
        return itens.map((item: any) => ({
          pedidoId: pedido.id,
          data: pedido.createdAt,
          produtoId: item.produtoId || null,
          produtoNome: item.nome || item.produtoNome,
          quantidade: item.quantidade,
          precoUnitario: item.precoUnitario,
          subtotal: item.subtotal || (item.quantidade * item.precoUnitario),
        }));
      }).flat();

      await storage.createLogN8n({
        tenantId,
        tipo: "vendas_historico_extraido",
        endpoint: "/api/data/vendas_historico",
        payload: { dataInicio, dataFim, limite },
        resposta: { totalRegistros: vendasHistorico.length },
        status: "sucesso",
        erro: null,
      });

      res.json({
        success: true,
        totalRegistros: vendasHistorico.length,
        dados: vendasHistorico,
      });
    } catch (error) {
      console.error("Error fetching vendas historico:", error);
      res.status(500).json({ error: "Erro ao buscar histórico de vendas" });
    }
  });

  app.post("/api/webhook/n8n/previsao_estoque", validateN8nWebhook, async (req, res) => {
    try {
      const tenantId = req.webhookTenant!.id;
      const { previsoes } = req.body;

      if (!Array.isArray(previsoes)) {
        return res.status(400).json({ error: "previsoes deve ser um array" });
      }

      const criadas = [];
      for (const p of previsoes) {
        const previsao = await storage.createPrevisao({
          tenantId,
          ingrediente: p.ingrediente || p.produtoNome,
          unidade: p.unidade || "un",
          quantidadeAtual: p.quantidadeAtual || 0,
          quantidadeSugerida: p.quantidadeSugerida || 0,
          horizonteDias: p.horizonteDias || 7,
          confianca: p.confianca?.toString() || "0.8",
          status: "pendente",
        });
        criadas.push(previsao);
      }

      await storage.createLogN8n({
        tenantId,
        tipo: "previsao_estoque_recebida",
        endpoint: "/api/webhook/n8n/previsao_estoque",
        payload: req.body,
        resposta: { totalCriadas: criadas.length },
        status: "sucesso",
        erro: null,
      });

      res.status(201).json({
        success: true,
        message: `${criadas.length} previsões de estoque registradas`,
        previsoes: criadas,
      });
    } catch (error) {
      console.error("Webhook previsao_estoque error:", error);
      res.status(500).json({ error: "Erro ao processar previsão de estoque" });
    }
  });

  app.post("/api/webhook/n8n/feedback_analisado", validateN8nWebhook, async (req, res) => {
    try {
      const tenantId = req.webhookTenant!.id;
      const { pedidoId, clienteId, texto, sentimento, topicos, nota, comentario } = req.body;

      if (sentimento === undefined) {
        return res.status(400).json({ error: "sentimento é obrigatório" });
      }

      let sentimentoNumerico: number;
      if (typeof sentimento === "string") {
        switch (sentimento.toLowerCase()) {
          case "positivo": sentimentoNumerico = 5; break;
          case "neutro": sentimentoNumerico = 3; break;
          case "negativo": sentimentoNumerico = 1; break;
          default: sentimentoNumerico = parseFloat(sentimento) || 3;
        }
      } else {
        sentimentoNumerico = sentimento;
      }

      const topicosArray = Array.isArray(topicos) ? topicos : 
        (topicos ? [topicos] : []);

      const feedback = await storage.createFeedback({
        tenantId,
        pedidoId: pedidoId || null,
        clienteId: clienteId || null,
        sentimento: sentimentoNumerico.toString(),
        topicos: topicosArray,
        comentario: comentario || texto || null,
        nota: nota || null,
      });

      await storage.createLogN8n({
        tenantId,
        tipo: "feedback_analisado_recebido",
        endpoint: "/api/webhook/n8n/feedback_analisado",
        payload: req.body,
        resposta: { feedbackId: feedback.id },
        status: "sucesso",
        erro: null,
      });

      res.status(201).json({
        success: true,
        message: "Feedback analisado registrado com sucesso",
        feedbackId: feedback.id,
      });
    } catch (error) {
      console.error("Webhook feedback_analisado error:", error);
      res.status(500).json({ error: "Erro ao processar feedback analisado" });
    }
  });

  app.get("/api/logs/n8n", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const logs = await storage.getLogsN8n(tenantId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  // ============================================
  // ANALYTICS ROUTES
  // ============================================

  app.get("/api/analytics/dashboard-stats", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      
      const pedidos = await storage.getPedidos(tenantId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const pedidosHoje = pedidos.filter(p => {
        const pedidoDate = new Date(p.createdAt);
        pedidoDate.setHours(0, 0, 0, 0);
        return pedidoDate.getTime() === today.getTime();
      });
      
      const vendasDiarias = pedidosHoje.reduce((acc, p) => acc + parseFloat(p.total || "0"), 0);
      
      const pedidosEntregues = pedidos.filter(p => p.status === "entregue");
      const ticketMedio = pedidosEntregues.length > 0
        ? pedidosEntregues.reduce((acc, p) => acc + parseFloat(p.total || "0"), 0) / pedidosEntregues.length
        : 0;
      
      const pedidosAbertos = pedidos.filter(p => 
        ["pendente", "recebido", "em_preparo", "pronto", "saiu_entrega"].includes(p.status)
      ).length;
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const pedidosOntem = pedidos.filter(p => {
        const pedidoDate = new Date(p.createdAt);
        pedidoDate.setHours(0, 0, 0, 0);
        return pedidoDate.getTime() === yesterday.getTime();
      });
      
      const vendasOntem = pedidosOntem.reduce((acc, p) => acc + parseFloat(p.total || "0"), 0);
      const variacaoVendas = vendasOntem > 0 
        ? ((vendasDiarias - vendasOntem) / vendasOntem) * 100 
        : (vendasDiarias > 0 ? 100 : 0);
      
      res.json({
        vendasDiarias,
        ticketMedio,
        pedidosAbertos,
        totalPedidosHoje: pedidosHoje.length,
        variacaoVendas: Math.round(variacaoVendas * 10) / 10,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/analytics/daily-sales", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const days = parseInt(req.query.days as string) || 7;
      const dailySales = await storage.getDailySales(tenantId, days);
      res.json(dailySales);
    } catch (error) {
      console.error("Error fetching daily sales:", error);
      res.status(500).json({ error: "Failed to fetch daily sales" });
    }
  });

  app.get("/api/analytics/top-items", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const limit = parseInt(req.query.limit as string) || 5;
      const topItems = await storage.getTopSellingItems(tenantId, limit);
      res.json(topItems);
    } catch (error) {
      console.error("Error fetching top items:", error);
      res.status(500).json({ error: "Failed to fetch top items" });
    }
  });

  app.get("/api/pedidos/filtered", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { status, startDate, endDate } = req.query;
      
      const filters: { status?: string; startDate?: Date; endDate?: Date } = {};
      
      if (status && typeof status === 'string') {
        filters.status = status;
      }
      
      if (startDate && typeof startDate === 'string') {
        filters.startDate = new Date(startDate);
      }
      
      if (endDate && typeof endDate === 'string') {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filters.endDate = end;
      }
      
      const pedidos = await storage.getPedidosFiltered(tenantId, filters);
      res.json(pedidos);
    } catch (error) {
      console.error("Error fetching filtered pedidos:", error);
      res.status(500).json({ error: "Failed to fetch pedidos" });
    }
  });

  app.post("/api/n8n/generate-api-key", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const apiKey = generateApiKey();
      
      const tenant = await storage.updateTenant(tenantId, { apiKeyN8n: apiKey });
      if (!tenant) {
        return res.status(404).json({ error: "Tenant não encontrado" });
      }

      res.json({ 
        success: true,
        apiKey,
        message: "Nova API Key gerada. Guarde-a em local seguro." 
      });
    } catch (error) {
      res.status(500).json({ error: "Erro ao gerar API Key" });
    }
  });

  app.post("/api/n8n/send", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { endpoint, payload } = req.body;

      if (!endpoint || !payload) {
        return res.status(400).json({ error: "endpoint e payload são obrigatórios" });
      }

      const result = await sendToN8n({ tenantId, endpoint, payload });
      
      if (!result.success) {
        return res.status(400).json({ 
          error: result.error,
          statusCode: result.statusCode,
        });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Erro ao enviar para N8N" });
    }
  });

  // ============================================
  // SUPER ADMIN ROUTES
  // ============================================

  app.get("/api/superadmin/tenants", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const tenants = await storage.getAllTenants();
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching all tenants:", error);
      res.status(500).json({ error: "Erro ao buscar franquias" });
    }
  });

  app.get("/api/superadmin/stats", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const tenants = await storage.getAllTenants();
      const allUsers = await storage.getAllUsers();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let totalPedidosHoje = 0;
      let faturamentoTotal = 0;
      
      for (const tenant of tenants) {
        const pedidos = await storage.getPedidos(tenant.id);
        const pedidosHoje = pedidos.filter(p => {
          const pedidoDate = new Date(p.createdAt);
          pedidoDate.setHours(0, 0, 0, 0);
          return pedidoDate.getTime() === today.getTime();
        });
        totalPedidosHoje += pedidosHoje.length;
        faturamentoTotal += pedidosHoje.reduce((sum, p) => sum + parseFloat(p.total || "0"), 0);
      }
      
      res.json({
        totalTenants: tenants.length,
        totalUsers: allUsers.length,
        totalPedidosHoje,
        faturamentoTotal,
      });
    } catch (error) {
      console.error("Error fetching super admin stats:", error);
      res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  app.get("/api/superadmin/users", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(u => ({
        id: u.id,
        email: u.email,
        nome: u.nome,
        role: u.role,
        tenantId: u.tenantId,
        createdAt: u.createdAt,
      })));
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  app.get("/api/superadmin/dashboard", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const tenants = await storage.getAllTenants();
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      let faturamentoTotal = 0;
      let totalPedidos = 0;
      let totalTempoEntrega = 0;
      let pedidosEntregues = 0;
      
      for (const tenant of tenants) {
        const pedidos = await storage.getPedidos(tenant.id);
        const pedidos30dias = pedidos.filter(p => new Date(p.createdAt) >= thirtyDaysAgo);
        
        totalPedidos += pedidos30dias.length;
        faturamentoTotal += pedidos30dias.reduce((sum, p) => sum + parseFloat(p.total || "0"), 0);
        
        const entregues = pedidos30dias.filter(p => 
          p.status === "entregue" && p.trackingStartedAt && p.updatedAt
        );
        entregues.forEach(p => {
          const inicio = new Date(p.trackingStartedAt!).getTime();
          const fim = new Date(p.updatedAt).getTime();
          totalTempoEntrega += (fim - inicio) / 60000;
          pedidosEntregues++;
        });
      }
      
      const ticketMedio = totalPedidos > 0 ? faturamentoTotal / totalPedidos : 0;
      const tempoMedioEntrega = pedidosEntregues > 0 ? Math.round(totalTempoEntrega / pedidosEntregues) : 0;
      
      res.json({
        faturamentoTotal,
        totalPedidos,
        ticketMedio,
        tempoMedioEntrega,
        totalFranquias: tenants.length,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ error: "Erro ao buscar dados do dashboard" });
    }
  });

  app.get("/api/superadmin/revenue-comparison", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const tenants = await storage.getAllTenants();
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const dateLabels: string[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        dateLabels.push(date.toISOString().split('T')[0]);
      }
      
      const franchiseData: { tenantId: string; nome: string; data: number[] }[] = [];
      
      for (const tenant of tenants) {
        const pedidos = await storage.getPedidos(tenant.id);
        const dailyRevenue: Record<string, number> = {};
        
        dateLabels.forEach(date => { dailyRevenue[date] = 0; });
        
        pedidos.forEach(p => {
          const pedidoDate = new Date(p.createdAt).toISOString().split('T')[0];
          if (dailyRevenue[pedidoDate] !== undefined) {
            dailyRevenue[pedidoDate] += parseFloat(p.total || "0");
          }
        });
        
        franchiseData.push({
          tenantId: tenant.id,
          nome: tenant.nome,
          data: dateLabels.map(date => dailyRevenue[date]),
        });
      }
      
      res.json({ labels: dateLabels, franchises: franchiseData });
    } catch (error) {
      console.error("Error fetching revenue comparison:", error);
      res.status(500).json({ error: "Erro ao buscar comparativo de faturamento" });
    }
  });

  app.get("/api/superadmin/financial-kpis", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const tenants = await storage.getAllTenants();
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const financialData = await Promise.all(tenants.map(async (tenant) => {
        const pedidos = await storage.getPedidos(tenant.id);
        const pedidos30dias = pedidos.filter(p => new Date(p.createdAt) >= thirtyDaysAgo);
        
        const faturamento = pedidos30dias.reduce((sum, p) => sum + parseFloat(p.total || "0"), 0);
        const totalPedidos = pedidos30dias.length;
        const ticketMedio = totalPedidos > 0 ? faturamento / totalPedidos : 0;
        
        const cmvEstimado = faturamento * 0.35;
        const margemBruta = faturamento > 0 ? ((faturamento - cmvEstimado) / faturamento) * 100 : 0;
        
        return {
          tenantId: tenant.id,
          nome: tenant.nome,
          faturamento,
          totalPedidos,
          ticketMedio,
          cmv: cmvEstimado,
          margemBruta,
        };
      }));
      
      res.json(financialData);
    } catch (error) {
      console.error("Error fetching financial KPIs:", error);
      res.status(500).json({ error: "Erro ao buscar KPIs financeiros" });
    }
  });

  app.get("/api/superadmin/logistics", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const tenants = await storage.getAllTenants();
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      let totalPedidos = 0;
      let pedidosAtrasados = 0;
      let totalTempoEntrega = 0;
      let pedidosEntregues = 0;
      let motoboysAtivos = 0;
      const heatmapData: { lat: number; lng: number; intensity: number }[] = [];
      
      for (const tenant of tenants) {
        const pedidos = await storage.getPedidos(tenant.id);
        const motoboys = await storage.getMotoboys(tenant.id);
        
        motoboysAtivos += motoboys.filter(m => m.status === "disponivel" || m.status === "em_entrega").length;
        
        const pedidos30dias = pedidos.filter(p => new Date(p.createdAt) >= thirtyDaysAgo);
        totalPedidos += pedidos30dias.length;
        
        pedidos30dias.forEach(p => {
          if (p.status === "entregue" && p.trackingStartedAt && p.updatedAt) {
            const inicio = new Date(p.trackingStartedAt).getTime();
            const fim = new Date(p.updatedAt).getTime();
            const tempoMin = (fim - inicio) / 60000;
            totalTempoEntrega += tempoMin;
            pedidosEntregues++;
            
            if (tempoMin > 45) pedidosAtrasados++;
          }
          
          if (p.enderecoLat && p.enderecoLng) {
            const existing = heatmapData.find(h => 
              Math.abs(h.lat - parseFloat(p.enderecoLat!)) < 0.01 && 
              Math.abs(h.lng - parseFloat(p.enderecoLng!)) < 0.01
            );
            if (existing) {
              existing.intensity++;
            } else {
              heatmapData.push({
                lat: parseFloat(p.enderecoLat),
                lng: parseFloat(p.enderecoLng),
                intensity: 1,
              });
            }
          }
        });
      }
      
      const taxaAtraso = pedidosEntregues > 0 ? (pedidosAtrasados / pedidosEntregues) * 100 : 0;
      const tempoMedioEntrega = pedidosEntregues > 0 ? Math.round(totalTempoEntrega / pedidosEntregues) : 0;
      
      res.json({
        taxaAtrasoGlobal: taxaAtraso,
        tempoMedioEntrega,
        motoboysAtivos,
        totalPedidos,
        heatmapData,
      });
    } catch (error) {
      console.error("Error fetching logistics data:", error);
      res.status(500).json({ error: "Erro ao buscar dados logísticos" });
    }
  });

  app.post("/api/superadmin/tenants", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { nome, cnpj, endereco, telefone, adminEmail, adminPassword, adminNome } = req.body;
      
      if (!nome) {
        return res.status(400).json({ error: "Nome da franquia é obrigatório" });
      }
      if (!adminEmail || !adminPassword || !adminNome) {
        return res.status(400).json({ error: "Dados do administrador são obrigatórios" });
      }

      const existingUser = await storage.getUserByEmail(adminEmail);
      if (existingUser) {
        return res.status(400).json({ error: "Email do administrador já está em uso" });
      }

      const tenant = await storage.createTenant({ nome, status: "active" });

      const hashedPassword = await hashPassword(adminPassword);
      await storage.createUser({
        email: adminEmail,
        password: hashedPassword,
        nome: adminNome,
        role: "tenant_admin",
        tenantId: tenant.id,
      });

      await storage.createSystemLog({
        userId: req.user?.id,
        tipo: "admin",
        acao: "criar_franquia",
        entidade: "tenant",
        entidadeId: tenant.id,
        detalhes: { nome, adminEmail },
        ip: req.ip,
      });

      res.status(201).json(tenant);
    } catch (error) {
      console.error("Error creating tenant:", error);
      res.status(500).json({ error: "Erro ao criar franquia" });
    }
  });

  app.put("/api/superadmin/tenants/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, status, n8nWebhookUrl, apiKeyN8n } = req.body;

      const tenant = await storage.updateTenant(id, { nome, status, n8nWebhookUrl, apiKeyN8n });
      if (!tenant) {
        return res.status(404).json({ error: "Franquia não encontrada" });
      }

      await storage.createSystemLog({
        userId: req.user?.id,
        tipo: "admin",
        acao: "atualizar_franquia",
        entidade: "tenant",
        entidadeId: id,
        detalhes: { nome, status },
        ip: req.ip,
      });

      res.json(tenant);
    } catch (error) {
      console.error("Error updating tenant:", error);
      res.status(500).json({ error: "Erro ao atualizar franquia" });
    }
  });

  app.delete("/api/superadmin/tenants/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const deleted = await storage.deleteTenant(id);
      if (!deleted) {
        return res.status(404).json({ error: "Franquia não encontrada" });
      }

      await storage.createSystemLog({
        userId: req.user?.id,
        tipo: "admin",
        acao: "excluir_franquia",
        entidade: "tenant",
        entidadeId: id,
        detalhes: {},
        ip: req.ip,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tenant:", error);
      res.status(500).json({ error: "Erro ao excluir franquia" });
    }
  });

  app.get("/api/superadmin/users/filtered", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { tenantId, role } = req.query;
      const users = await storage.getUsersFiltered({
        tenantId: tenantId as string | undefined,
        role: role as string | undefined,
      });
      res.json(users.map(u => ({
        id: u.id,
        email: u.email,
        nome: u.nome,
        role: u.role,
        tenantId: u.tenantId,
        createdAt: u.createdAt,
      })));
    } catch (error) {
      console.error("Error fetching filtered users:", error);
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  app.put("/api/superadmin/users/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, email, role, tenantId } = req.body;

      const user = await storage.updateUser(id, { nome, email, role, tenantId });
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      await storage.createSystemLog({
        userId: req.user?.id,
        tipo: "admin",
        acao: "atualizar_usuario",
        entidade: "user",
        entidadeId: id,
        detalhes: { nome, email, role },
        ip: req.ip,
      });

      res.json({
        id: user.id,
        email: user.email,
        nome: user.nome,
        role: user.role,
        tenantId: user.tenantId,
        createdAt: user.createdAt,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Erro ao atualizar usuário" });
    }
  });

  app.delete("/api/superadmin/users/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      if (id === req.user?.id) {
        return res.status(400).json({ error: "Não é possível excluir a própria conta" });
      }

      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      await storage.createSystemLog({
        userId: req.user?.id,
        tipo: "admin",
        acao: "excluir_usuario",
        entidade: "user",
        entidadeId: id,
        detalhes: {},
        ip: req.ip,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Erro ao excluir usuário" });
    }
  });

  app.get("/api/superadmin/logs", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { tenantId, tipo, startDate, endDate, page = "1", limit = "20" } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const filters = {
        tenantId: tenantId as string | undefined,
        tipo: tipo as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      };

      const [webhookLogs, webhookCount, alertas, alertasCount] = await Promise.all([
        storage.getAllLogsN8n(filters, limitNum, offset),
        storage.getAllLogsN8nCount(filters),
        storage.getAllAlertas(filters, limitNum, offset),
        storage.getAllAlertasCount(filters),
      ]);

      res.json({
        webhookLogs,
        alertas,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalWebhooks: webhookCount,
          totalAlertas: alertasCount,
          totalPages: Math.ceil(Math.max(webhookCount, alertasCount) / limitNum),
        },
      });
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ error: "Erro ao buscar logs" });
    }
  });

  // ============================================
  // LOGISTICS ROUTES
  // ============================================

  app.get("/api/analytics/logistics", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      
      const pedidos = await storage.getPedidos(tenantId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const pedidosHoje = pedidos.filter(p => {
        const pedidoDate = new Date(p.createdAt);
        pedidoDate.setHours(0, 0, 0, 0);
        return pedidoDate.getTime() === today.getTime();
      });
      
      const pedidosOntem = pedidos.filter(p => {
        const pedidoDate = new Date(p.createdAt);
        pedidoDate.setHours(0, 0, 0, 0);
        return pedidoDate.getTime() === yesterday.getTime();
      });
      
      const entreguesHoje = pedidosHoje.filter(p => p.status === "entregue");
      const entreguesOntem = pedidosOntem.filter(p => p.status === "entregue");
      
      const calcTempoMedio = (pedidosList: typeof pedidos) => {
        const entregues = pedidosList.filter(p => 
          p.status === "entregue" && p.trackingStartedAt && p.updatedAt
        );
        if (entregues.length === 0) return 0;
        
        const tempos = entregues.map(p => {
          const inicio = new Date(p.trackingStartedAt!).getTime();
          const fim = new Date(p.updatedAt).getTime();
          return (fim - inicio) / 60000;
        });
        return Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length);
      };
      
      const tempoMedioHoje = calcTempoMedio(pedidosHoje);
      const tempoMedioOntem = calcTempoMedio(pedidosOntem);
      
      const atrasosHoje = pedidosHoje.filter(p => {
        if (p.status === "entregue" && p.trackingStartedAt && p.updatedAt) {
          const inicio = new Date(p.trackingStartedAt).getTime();
          const fim = new Date(p.updatedAt).getTime();
          return (fim - inicio) / 60000 > 45;
        }
        return false;
      }).length;
      
      const atrasosOntem = pedidosOntem.filter(p => {
        if (p.status === "entregue" && p.trackingStartedAt && p.updatedAt) {
          const inicio = new Date(p.trackingStartedAt).getTime();
          const fim = new Date(p.updatedAt).getTime();
          return (fim - inicio) / 60000 > 45;
        }
        return false;
      }).length;
      
      const motoboys = await storage.getMotoboys(tenantId);
      const motoboyAtivos = motoboys.filter(m => 
        m.status === "disponivel" || m.status === "em_entrega"
      ).length;
      
      const variacaoTempo = tempoMedioOntem > 0 
        ? Math.round(((tempoMedioHoje - tempoMedioOntem) / tempoMedioOntem) * 100)
        : 0;
      
      const variacaoAtrasos = atrasosOntem > 0
        ? Math.round(((atrasosHoje - atrasosOntem) / atrasosOntem) * 100)
        : (atrasosHoje > 0 ? 100 : 0);
      
      res.json({
        tempoMedioEntrega: tempoMedioHoje || 25,
        atrasosHoje,
        entregasHoje: entreguesHoje.length,
        motoboyAtivos,
        variacaoTempo,
        variacaoAtrasos,
      });
    } catch (error) {
      console.error("Error fetching logistics stats:", error);
      res.status(500).json({ error: "Failed to fetch logistics stats" });
    }
  });

  app.patch("/api/motoboys/:id/location", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const motoboyId = req.params.id;
      const { lat, lng } = req.body;

      if (lat === undefined || lng === undefined) {
        return res.status(400).json({ error: "lat e lng são obrigatórios" });
      }

      const motoboy = await storage.updateMotoboyLocation(tenantId, motoboyId, lat, lng);
      if (!motoboy) {
        return res.status(404).json({ error: "Motoboy não encontrado" });
      }

      res.json(motoboy);
    } catch (error) {
      console.error("Error updating motoboy location:", error);
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  // ============================================
  // FINANCIAL ROUTES
  // ============================================

  app.get("/api/transacoes", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { tipo, status } = req.query;
      
      const filters: { tipo?: string; status?: string } = {};
      if (tipo && typeof tipo === 'string') filters.tipo = tipo;
      if (status && typeof status === 'string') filters.status = status;
      
      const transacoes = await storage.getTransacoes(tenantId, filters);
      res.json(transacoes);
    } catch (error) {
      console.error("Error fetching transacoes:", error);
      res.status(500).json({ error: "Failed to fetch transacoes" });
    }
  });

  app.post("/api/transacoes", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { pedidoId, tipo, valor, descricao, metodoPagamento, status } = req.body;

      if (!tipo || valor === undefined) {
        return res.status(400).json({ error: "tipo e valor são obrigatórios" });
      }

      const transacao = await storage.createTransacao({
        tenantId,
        pedidoId: pedidoId || null,
        tipo,
        valor: valor.toString(),
        descricao: descricao || null,
        metodoPagamento: metodoPagamento || null,
        status: status || "pendente",
      });

      res.status(201).json(transacao);
    } catch (error) {
      console.error("Error creating transacao:", error);
      res.status(500).json({ error: "Failed to create transacao" });
    }
  });

  app.patch("/api/transacoes/:id/status", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const transacaoId = req.params.id;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: "status é obrigatório" });
      }

      const transacao = await storage.updateTransacaoStatus(tenantId, transacaoId, status);
      if (!transacao) {
        return res.status(404).json({ error: "Transação não encontrada" });
      }

      res.json(transacao);
    } catch (error) {
      console.error("Error updating transacao status:", error);
      res.status(500).json({ error: "Failed to update transacao" });
    }
  });

  app.get("/api/analytics/financial", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      
      const transacoes = await storage.getTransacoes(tenantId, {});
      
      const transacoesMesAtual = transacoes.filter(t => 
        new Date(t.data) >= startOfMonth && t.status === "confirmado"
      );
      
      const transacoesMesAnterior = transacoes.filter(t => {
        const data = new Date(t.data);
        return data >= startOfLastMonth && data <= endOfLastMonth && t.status === "confirmado";
      });
      
      const calcular = (lista: typeof transacoes) => {
        const receitas = lista
          .filter(t => t.tipo === "receita" || t.tipo === "venda")
          .reduce((acc, t) => acc + parseFloat(t.valor || "0"), 0);
        const despesas = lista
          .filter(t => t.tipo === "despesa" || t.tipo === "custo")
          .reduce((acc, t) => acc + parseFloat(t.valor || "0"), 0);
        return { receitas, despesas, lucro: receitas - despesas };
      };
      
      const atual = calcular(transacoesMesAtual);
      const anterior = calcular(transacoesMesAnterior);
      
      const variacaoReceitas = anterior.receitas > 0 
        ? Math.round(((atual.receitas - anterior.receitas) / anterior.receitas) * 100)
        : (atual.receitas > 0 ? 100 : 0);
      
      const variacaoDespesas = anterior.despesas > 0
        ? Math.round(((atual.despesas - anterior.despesas) / anterior.despesas) * 100)
        : (atual.despesas > 0 ? 100 : 0);
      
      const variacaoLucro = anterior.lucro > 0
        ? Math.round(((atual.lucro - anterior.lucro) / anterior.lucro) * 100)
        : (atual.lucro > 0 ? 100 : 0);
      
      res.json({
        receitas: atual.receitas,
        despesas: atual.despesas,
        lucroLiquido: atual.lucro,
        variacaoReceitas,
        variacaoDespesas,
        variacaoLucro,
        totalTransacoes: transacoesMesAtual.length,
      });
    } catch (error) {
      console.error("Error fetching financial stats:", error);
      res.status(500).json({ error: "Failed to fetch financial stats" });
    }
  });

  app.get("/api/transacoes/export-csv", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { startDate, endDate, tipo, status } = req.query;
      
      const filters: { tipo?: string; status?: string } = {};
      if (tipo && typeof tipo === 'string') filters.tipo = tipo;
      if (status && typeof status === 'string') filters.status = status;
      
      let transacoes = await storage.getTransacoes(tenantId, filters);
      
      if (startDate && typeof startDate === 'string') {
        const start = new Date(startDate);
        transacoes = transacoes.filter(t => new Date(t.data) >= start);
      }
      
      if (endDate && typeof endDate === 'string') {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        transacoes = transacoes.filter(t => new Date(t.data) <= end);
      }
      
      const headers = ["ID", "Data", "Tipo", "Valor", "Status", "Método Pagamento", "Descrição", "Pedido ID"];
      
      const rows = transacoes.map(t => [
        t.id,
        new Date(t.data).toLocaleDateString("pt-BR"),
        t.tipo,
        parseFloat(t.valor || "0").toFixed(2),
        t.status,
        t.metodoPagamento || "",
        (t.descricao || "").replace(/"/g, '""'),
        t.pedidoId || "",
      ]);
      
      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");
      
      const BOM = "\uFEFF";
      
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="transacoes_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(BOM + csvContent);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ error: "Failed to export CSV" });
    }
  });

  // ============================================
  // BUSINESS INTELLIGENCE ROUTES
  // ============================================

  app.get("/api/inteligencia/feedbacks", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const feedbacks = await storage.getFeedbacks(tenantId);
      res.json(feedbacks);
    } catch (error) {
      console.error("Error fetching feedbacks:", error);
      res.status(500).json({ error: "Failed to fetch feedbacks" });
    }
  });

  app.get("/api/inteligencia/sentiment-summary", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const summary = await storage.getFeedbackSentimentSummary(tenantId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching sentiment summary:", error);
      res.status(500).json({ error: "Failed to fetch sentiment summary" });
    }
  });

  app.get("/api/inteligencia/topicos-criticos", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const limit = parseInt(req.query.limit as string) || 5;
      const topicos = await storage.getTopicosCriticos(tenantId, limit);
      res.json(topicos);
    } catch (error) {
      console.error("Error fetching critical topics:", error);
      res.status(500).json({ error: "Failed to fetch critical topics" });
    }
  });

  app.post("/api/inteligencia/feedbacks", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { pedidoId, clienteId, texto, sentimento, topicos } = req.body;
      
      const feedback = await storage.createFeedback({
        tenantId,
        pedidoId: pedidoId || null,
        clienteId: clienteId || null,
        texto,
        sentimento: sentimento ?? 3,
        topicos: topicos || [],
      });
      
      res.status(201).json(feedback);
    } catch (error) {
      console.error("Error creating feedback:", error);
      res.status(500).json({ error: "Failed to create feedback" });
    }
  });

  // ============================================
  // STOCK PREDICTIONS ROUTES
  // ============================================

  app.get("/api/estoque/previsoes", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const previsoes = await storage.getPrevisoes(tenantId);
      res.json(previsoes);
    } catch (error) {
      console.error("Error fetching previsoes:", error);
      res.status(500).json({ error: "Failed to fetch previsoes" });
    }
  });

  app.post("/api/estoque/previsoes", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { produtoId, produtoNome, quantidadeAtual, quantidadeSugerida, confianca, motivo } = req.body;
      
      const previsao = await storage.createPrevisao({
        tenantId,
        produtoId,
        produtoNome,
        quantidadeAtual: quantidadeAtual ?? 0,
        quantidadeSugerida: quantidadeSugerida ?? 0,
        confianca: confianca ?? 0.8,
        motivo: motivo || null,
        status: "pendente",
      });
      
      res.status(201).json(previsao);
    } catch (error) {
      console.error("Error creating previsao:", error);
      res.status(500).json({ error: "Failed to create previsao" });
    }
  });

  app.patch("/api/estoque/previsoes/:id/status", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      const { status } = req.body;
      
      if (!["pendente", "aprovada", "rejeitada"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      const updated = await storage.updatePrevisaoStatus(id, tenantId, status);
      if (!updated) {
        return res.status(404).json({ error: "Previsao not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating previsao status:", error);
      res.status(500).json({ error: "Failed to update previsao status" });
    }
  });

  app.post("/api/estoque/gerar-previsoes", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      
      const estoqueItens = await storage.getEstoque(tenantId);
      const produtos = await storage.getProdutos(tenantId);
      
      const produtoMap = new Map(produtos.map(p => [p.id, p]));
      const novasPrevisoes = [];
      
      for (const item of estoqueItens) {
        const produto = produtoMap.get(item.produtoId);
        if (!produto) continue;
        
        const qtdAtual = item.quantidade;
        const minimo = item.quantidadeMinima ?? 10;
        
        if (qtdAtual < minimo * 2) {
          const sugerida = Math.max(minimo * 3 - qtdAtual, minimo);
          const confianca = qtdAtual < minimo ? 0.95 : 0.75;
          
          const previsao = await storage.createPrevisao({
            tenantId,
            produtoId: item.produtoId,
            produtoNome: produto.nome,
            quantidadeAtual: qtdAtual,
            quantidadeSugerida: sugerida,
            confianca,
            motivo: qtdAtual < minimo 
              ? "Estoque abaixo do mínimo" 
              : "Estoque próximo do mínimo",
            status: "pendente",
          });
          
          novasPrevisoes.push(previsao);
        }
      }
      
      res.json({ 
        message: `${novasPrevisoes.length} previsões geradas`,
        previsoes: novasPrevisoes 
      });
    } catch (error) {
      console.error("Error generating previsoes:", error);
      res.status(500).json({ error: "Failed to generate previsoes" });
    }
  });

  // ============================================
  // ALERTS ROUTES
  // ============================================

  app.get("/api/alertas", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const limit = parseInt(req.query.limit as string) || 20;
      const alertas = await storage.getAlertas(tenantId, limit);
      res.json(alertas);
    } catch (error) {
      console.error("Error fetching alertas:", error);
      res.status(500).json({ error: "Failed to fetch alertas" });
    }
  });

  app.get("/api/alertas/nao-lidos", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const count = await storage.getAlertasNaoLidos(tenantId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread alerts count:", error);
      res.status(500).json({ error: "Failed to fetch unread alerts count" });
    }
  });

  app.post("/api/alertas", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { tipo, titulo, mensagem, severidade, meta } = req.body;
      
      const alerta = await storage.createAlerta({
        tenantId,
        tipo,
        titulo,
        mensagem,
        severidade: severidade || "info",
        meta: meta || null,
        lida: false,
      });
      
      res.status(201).json(alerta);
    } catch (error) {
      console.error("Error creating alerta:", error);
      res.status(500).json({ error: "Failed to create alerta" });
    }
  });

  app.patch("/api/alertas/:id/lida", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      
      const updated = await storage.markAlertaLido(id, tenantId);
      if (!updated) {
        return res.status(404).json({ error: "Alerta not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error marking alerta as read:", error);
      res.status(500).json({ error: "Failed to mark alerta as read" });
    }
  });

  // ============================================
  // DPT (DYNAMIC PREP TIME) ROUTES
  // ============================================

  app.get("/api/dpt/realtime", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const dptInfo = await obterDPTRealtime(tenantId);
      res.json(dptInfo);
    } catch (error) {
      console.error("Error fetching DPT realtime:", error);
      res.status(500).json({ error: "Failed to fetch DPT realtime data" });
    }
  });

  app.post("/api/dpt/calcular", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { itens } = req.body;

      if (!itens || !Array.isArray(itens)) {
        return res.status(400).json({ error: "Itens array is required" });
      }

      const dptResult = await calcularDPT(tenantId, itens);
      res.json(dptResult);
    } catch (error) {
      console.error("Error calculating DPT:", error);
      res.status(500).json({ error: "Failed to calculate DPT" });
    }
  });

  app.post("/api/dpt/iniciar-preparo/:pedidoId", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { pedidoId } = req.params;

      await registrarInicioPreparoPedido(tenantId, pedidoId);
      
      const pedido = await storage.getPedido(pedidoId, tenantId);
      if (pedido) {
        broadcastOrderStatusChange(tenantId, pedido);
      }

      res.json({ success: true, message: "Preparo iniciado" });
    } catch (error) {
      console.error("Error starting prep:", error);
      res.status(500).json({ error: "Failed to start prep" });
    }
  });

  app.post("/api/dpt/finalizar-preparo/:pedidoId", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { pedidoId } = req.params;

      await registrarFimPreparoPedido(tenantId, pedidoId);
      
      const pedido = await storage.getPedido(pedidoId, tenantId);
      if (pedido) {
        broadcastOrderStatusChange(tenantId, pedido);
      }

      res.json({ success: true, message: "Preparo finalizado" });
    } catch (error) {
      console.error("Error finishing prep:", error);
      res.status(500).json({ error: "Failed to finish prep" });
    }
  });

  // ============================================
  // PRODUCAO TIMING ROUTES (KDS Advanced)
  // ============================================

  app.get("/api/producao/status", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const statusList = await listarPedidosProducao(tenantId);
      res.json(statusList);
    } catch (error) {
      console.error("Error fetching production status:", error);
      res.status(500).json({ error: "Failed to fetch production status" });
    }
  });

  app.get("/api/producao/pedido/:pedidoId", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { pedidoId } = req.params;
      const status = await getStatusProducaoPedido(pedidoId, tenantId);
      if (!status) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }
      res.json(status);
    } catch (error) {
      console.error("Error fetching order production status:", error);
      res.status(500).json({ error: "Failed to fetch order production status" });
    }
  });

  app.post("/api/producao/calcular-loop", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { itens } = req.body;

      if (!itens || !Array.isArray(itens)) {
        return res.status(400).json({ error: "Itens array is required" });
      }

      const loopResult = await calcularTempoLoop(tenantId, itens);
      res.json(loopResult);
    } catch (error) {
      console.error("Error calculating loop time:", error);
      res.status(500).json({ error: "Failed to calculate loop time" });
    }
  });

  app.post("/api/producao/atualizar-timing/:pedidoId", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { pedidoId } = req.params;

      await atualizarTimingPedido(pedidoId, tenantId);
      
      const pedido = await storage.getPedido(pedidoId, tenantId);
      if (pedido) {
        broadcastOrderStatusChange(tenantId, pedido);
      }

      res.json({ success: true, message: "Timing atualizado" });
    } catch (error) {
      console.error("Error updating order timing:", error);
      res.status(500).json({ error: "Failed to update order timing" });
    }
  });

  // ============================================
  // GEO FLEET MANAGEMENT ROUTES
  // ============================================

  app.post("/api/motoboy/localizacao", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token de acesso obrigatório" });
      }

      const token = authHeader.substring(7);
      const motoboy = await obterMotoboyPorToken(token);

      if (!motoboy) {
        return res.status(401).json({ error: "Token inválido" });
      }

      const { lat, lng } = req.body;
      if (lat === undefined || lng === undefined) {
        return res.status(400).json({ error: "lat e lng são obrigatórios" });
      }

      await atualizarLocalizacaoMotoboy(motoboy.id, motoboy.tenantId, lat, lng);

      const pedidosMotoboy = await db
        .select({
          id: pedidos.id,
          destinoLat: pedidos.destinoLat,
          destinoLng: pedidos.destinoLng,
          alertaChegandoEnviado: pedidos.alertaChegandoEnviado,
        })
        .from(pedidos)
        .where(
          and(
            eq(pedidos.motoboyId, motoboy.id),
            eq(pedidos.status, "saiu_entrega"),
            eq(pedidos.tenantId, motoboy.tenantId)
          )
        );

      for (const pedido of pedidosMotoboy) {
        if (pedido.destinoLat && pedido.destinoLng && !pedido.alertaChegandoEnviado) {
          const { dentroGeofence, distanciaMetros } = verificarProximidadeDestino(
            lat,
            lng,
            parseFloat(pedido.destinoLat),
            parseFloat(pedido.destinoLng)
          );

          if (dentroGeofence) {
            console.log(`[Geofence] Motoboy a ${distanciaMetros}m do destino - Pedido ${pedido.id}`);
            await enviarAlertaPizzaChegando(pedido.id, distanciaMetros, motoboy.tenantId, motoboy.id);
          }
        }
      }

      res.json({ success: true, message: "Localização atualizada" });
    } catch (error) {
      console.error("Error updating motoboy location:", error);
      res.status(500).json({ error: "Falha ao atualizar localização" });
    }
  });

  app.post("/api/motoboys/:id/gerar-token", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const motoboyId = req.params.id;

      const motoboy = await storage.getMotoboy(motoboyId, tenantId);
      if (!motoboy) {
        return res.status(404).json({ error: "Motoboy não encontrado" });
      }

      const token = await gerarTokenMotoboy(motoboyId);

      res.json({ success: true, token });
    } catch (error) {
      console.error("Error generating motoboy token:", error);
      res.status(500).json({ error: "Falha ao gerar token" });
    }
  });

  app.post("/api/geo/geocodificar", requireAuth, requireTenant, async (req, res) => {
    try {
      const { endereco } = req.body;
      if (!endereco) {
        return res.status(400).json({ error: "Endereço é obrigatório" });
      }

      const coordenadas = await geocodificarEndereco(endereco);
      if (!coordenadas) {
        return res.status(404).json({ error: "Endereço não encontrado" });
      }

      res.json(coordenadas);
    } catch (error) {
      console.error("Error geocoding address:", error);
      res.status(500).json({ error: "Falha ao geocodificar" });
    }
  });

  app.post("/api/geo/rota", requireAuth, requireTenant, async (req, res) => {
    try {
      const { origem, destino } = req.body;
      if (!origem || !destino || !origem.lat || !origem.lng || !destino.lat || !destino.lng) {
        return res.status(400).json({ error: "Origem e destino com lat/lng são obrigatórios" });
      }

      const rota = await calcularRota(origem, destino);
      if (!rota) {
        return res.status(404).json({ error: "Não foi possível calcular a rota" });
      }

      res.json(rota);
    } catch (error) {
      console.error("Error calculating route:", error);
      res.status(500).json({ error: "Falha ao calcular rota" });
    }
  });

  app.post("/api/geo/eta", requireAuth, requireTenant, async (req, res) => {
    try {
      const { motoboyLat, motoboyLng, destinoLat, destinoLng } = req.body;
      if (motoboyLat === undefined || motoboyLng === undefined || 
          destinoLat === undefined || destinoLng === undefined) {
        return res.status(400).json({ error: "Coordenadas do motoboy e destino são obrigatórias" });
      }

      const eta = await calcularETA(motoboyLat, motoboyLng, destinoLat, destinoLng);

      res.json(eta);
    } catch (error) {
      console.error("Error calculating ETA:", error);
      res.status(500).json({ error: "Falha ao calcular ETA" });
    }
  });

  app.post("/api/despacho/selecionar-motoboy", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { destinoLat, destinoLng } = req.body;

      const destino = destinoLat && destinoLng ? { lat: destinoLat, lng: destinoLng } : undefined;
      const motoboyIdeal = await selecionarMotoboyIdeal(tenantId, destino);

      if (!motoboyIdeal) {
        return res.status(404).json({ error: "Nenhum motoboy disponível" });
      }

      res.json(motoboyIdeal);
    } catch (error) {
      console.error("Error selecting motoboy:", error);
      res.status(500).json({ error: "Falha ao selecionar motoboy" });
    }
  });

  app.post("/api/despacho/enviar/:pedidoId", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { pedidoId } = req.params;

      const resultado = await despacharPedido(pedidoId, tenantId);

      if (!resultado.sucesso) {
        return res.status(400).json({ error: resultado.mensagem });
      }

      const pedido = await storage.getPedido(pedidoId, tenantId);
      if (pedido) {
        broadcastOrderStatusChange(tenantId, pedido);
      }

      res.json(resultado);
    } catch (error) {
      console.error("Error dispatching order:", error);
      res.status(500).json({ error: "Falha ao despachar pedido" });
    }
  });

  app.post("/api/despacho/finalizar/:pedidoId", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { pedidoId } = req.params;

      const resultado = await finalizarEntrega(pedidoId, tenantId);

      if (!resultado.sucesso) {
        return res.status(400).json({ error: resultado.mensagem });
      }

      const pedido = await storage.getPedido(pedidoId, tenantId);
      if (pedido) {
        broadcastOrderStatusChange(tenantId, pedido);
      }

      res.json(resultado);
    } catch (error) {
      console.error("Error completing delivery:", error);
      res.status(500).json({ error: "Falha ao finalizar entrega" });
    }
  });

  // ============================================
  // CUSTO E LUCRO ROUTES
  // ============================================

  app.post("/api/custo/mercado", validateN8nWebhook, async (req, res) => {
    try {
      const tenantId = req.webhookTenant!.id;

      const validation = webhookCustoMercadoSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: fromZodError(validation.error).toString(),
        });
      }

      const { ingredienteId, precoMercado, fornecedor } = validation.data;

      const resultado = await atualizarPrecoMercado(ingredienteId, precoMercado, tenantId, fornecedor);

      if (!resultado.sucesso) {
        return res.status(404).json({ error: resultado.erro });
      }

      res.json({
        sucesso: true,
        mensagem: "Preço de mercado atualizado com sucesso",
        ingredienteId,
        precoMercado,
        tenantId,
      });
    } catch (error) {
      console.error("Error updating market price:", error);
      res.status(500).json({ error: "Falha ao atualizar preço de mercado" });
    }
  });

  app.get("/api/custo/produto/:produtoId", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { produtoId } = req.params;

      const custo = await calcularCustoProduto(produtoId, tenantId);

      if (!custo) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      res.json(custo);
    } catch (error) {
      console.error("Error calculating product cost:", error);
      res.status(500).json({ error: "Falha ao calcular custo do produto" });
    }
  });

  app.get("/api/custo/produtos", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const custos = await listarCustosProdutos(tenantId);
      res.json(custos);
    } catch (error) {
      console.error("Error listing product costs:", error);
      res.status(500).json({ error: "Falha ao listar custos dos produtos" });
    }
  });

  app.get("/api/lucro/franquia", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { dataInicio, dataFim } = req.query;

      const lucro = await calcularLucroFranquia(
        tenantId,
        dataInicio ? new Date(dataInicio as string) : undefined,
        dataFim ? new Date(dataFim as string) : undefined
      );

      if (!lucro) {
        return res.status(404).json({ error: "Franquia não encontrada" });
      }

      res.json(lucro);
    } catch (error) {
      console.error("Error calculating franchise profit:", error);
      res.status(500).json({ error: "Falha ao calcular lucro da franquia" });
    }
  });

  app.get("/api/lucro/franquias", requireSuperAdmin, async (req, res) => {
    try {
      const lucros = await listarLucrosFranquias();
      res.json(lucros);
    } catch (error) {
      console.error("Error listing franchise profits:", error);
      res.status(500).json({ error: "Falha ao listar lucros das franquias" });
    }
  });

  app.get("/api/lucro/ingredientes", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { dataInicio, dataFim } = req.query;

      const lucros = await calcularLucroPorIngrediente(
        tenantId,
        dataInicio ? new Date(dataInicio as string) : undefined,
        dataFim ? new Date(dataFim as string) : undefined
      );

      res.json(lucros);
    } catch (error) {
      console.error("Error calculating ingredient profits:", error);
      res.status(500).json({ error: "Falha ao calcular lucro por ingrediente" });
    }
  });

  app.get("/api/custo/historico/:ingredienteId", requireAuth, requireTenant, async (req, res) => {
    try {
      const { ingredienteId } = req.params;
      const { limite } = req.query;

      const historico = await getHistoricoPrecosMercado(
        ingredienteId,
        limite ? parseInt(limite as string) : 30
      );

      res.json(historico);
    } catch (error) {
      console.error("Error getting price history:", error);
      res.status(500).json({ error: "Falha ao obter histórico de preços" });
    }
  });

  // ============================================
  // AI AGENT ROUTES
  // ============================================

  app.post("/api/agente-ia/chat", requireAuth, requireTenant, async (req, res) => {
    try {
      const user = req.user!;
      const tenantId = user.tenantId!;

      if (user.role !== "tenant_admin" && user.role !== "super_admin") {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores podem usar o Agente de IA." });
      }

      const { mensagem, historico } = req.body;

      if (!mensagem || typeof mensagem !== "string") {
        return res.status(400).json({ error: "Mensagem é obrigatória" });
      }

      const resultado = await processarMensagemIA(tenantId, mensagem, historico || []);

      res.json({
        resposta: resultado.resposta,
        toolsUsed: resultado.toolsUsed,
      });
    } catch (error: any) {
      console.error("Error processing AI chat:", error);

      if (error.message === "FREE_CLOUD_BUDGET_EXCEEDED") {
        return res.status(402).json({ error: "Limite de uso da IA excedido. Por favor, atualize seu plano." });
      }

      res.status(500).json({ error: "Falha ao processar mensagem do agente de IA" });
    }
  });

  app.post("/api/estoque/atualizar", requireAuth, requireTenant, async (req, res) => {
    try {
      const user = req.user!;
      const tenantId = user.tenantId!;

      if (user.role !== "tenant_admin" && user.role !== "super_admin") {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const { ingredienteId, novaQuantidade, nomeIngrediente } = req.body;

      if (novaQuantidade === undefined || (novaQuantidade < 0)) {
        return res.status(400).json({ error: "Nova quantidade é obrigatória e deve ser positiva" });
      }

      const resultado = await atualizarEstoqueIngredienteAPI(
        tenantId,
        ingredienteId || nomeIngrediente,
        novaQuantidade
      );

      if (!resultado.sucesso) {
        return res.status(404).json({ error: resultado.mensagem });
      }

      res.json(resultado);
    } catch (error) {
      console.error("Error updating stock:", error);
      res.status(500).json({ error: "Falha ao atualizar estoque" });
    }
  });

  app.post("/api/frota/cancelar", requireAuth, requireTenant, async (req, res) => {
    try {
      const user = req.user!;
      const tenantId = user.tenantId!;

      if (user.role !== "tenant_admin" && user.role !== "super_admin") {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const { motoboyId, motoboyNome } = req.body;

      if (!motoboyId && !motoboyNome) {
        return res.status(400).json({ error: "ID ou nome do motoboy é obrigatório" });
      }

      const resultado = await cancelarMotoboyAPI(tenantId, motoboyId || motoboyNome);

      if (!resultado.sucesso) {
        return res.status(404).json({ error: resultado.mensagem });
      }

      res.json(resultado);
    } catch (error) {
      console.error("Error canceling motoboy:", error);
      res.status(500).json({ error: "Falha ao cancelar motoboy" });
    }
  });

  return httpServer;
}
