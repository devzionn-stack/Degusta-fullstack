import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { hashPassword, comparePasswords, requireAuth, requireTenant, regenerateSession } from "./auth";
import { validateN8nWebhook, generateApiKey } from "./webhook-security";
import { sendToN8n, notifyN8nNewOrder } from "./n8n-requester";
import { broadcastNewOrder, broadcastOrderStatusChange } from "./websocket";
import {
  insertTenantSchema,
  insertClienteSchema,
  insertProdutoSchema,
  insertPedidoSchema,
  loginSchema,
  registerSchema,
  webhookPedidoSchema,
  webhookIndicadorSchema,
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

  // ============================================
  // TENANTS ROUTES (Admin only in production)
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

      const pedido = await storage.createPedido({
        tenantId,
        clienteId: cliente?.id || null,
        status: "recebido",
        total: calculatedTotal.toFixed(2),
        itens: processedItems,
        observacoes: observacoes || (estoqueErrors.length > 0 ? `ALERTAS: ${estoqueErrors.join("; ")}` : null),
        enderecoEntrega: enderecoEntrega || clienteData.endereco || null,
        origem: "n8n",
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

  app.get("/api/logs/n8n", requireAuth, requireTenant, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const logs = await storage.getLogsN8n(tenantId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch logs" });
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

  return httpServer;
}
