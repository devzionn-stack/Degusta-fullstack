import { 
  type User, 
  type InsertUser,
  type Tenant,
  type InsertTenant,
  type Cliente,
  type InsertCliente,
  type Produto,
  type InsertProduto,
  type Estoque,
  type InsertEstoque,
  type Motoboy,
  type InsertMotoboy,
  type Pedido,
  type InsertPedido,
  type LogN8n,
  type InsertLogN8n,
  type Transacao,
  type InsertTransacao,
  type Feedback,
  type InsertFeedback,
  type PrevisaoEstoque,
  type InsertPrevisaoEstoque,
  type AlertaFrota,
  type InsertAlertaFrota,
  users,
  tenants,
  clientes,
  produtos,
  estoque,
  motoboys,
  pedidos,
  logsN8n,
  transacoes,
  feedbacks,
  previsaoEstoque,
  alertasFrota,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, inArray, sql } from "drizzle-orm";

export interface DailySales {
  date: string;
  total: number;
  count: number;
}

export interface TopSellingItem {
  name: string;
  quantity: number;
  revenue: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  
  getTenants(): Promise<Tenant[]>;
  getAllTenants(): Promise<Tenant[]>;
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantByApiKey(apiKey: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, tenant: Partial<InsertTenant>): Promise<Tenant | undefined>;
  
  getClientes(tenantId: string): Promise<Cliente[]>;
  getCliente(id: string, tenantId: string): Promise<Cliente | undefined>;
  getClienteByTelefone(telefone: string, tenantId: string): Promise<Cliente | undefined>;
  createCliente(cliente: InsertCliente): Promise<Cliente>;
  updateCliente(id: string, tenantId: string, cliente: Partial<InsertCliente>): Promise<Cliente | undefined>;
  deleteCliente(id: string, tenantId: string): Promise<boolean>;
  
  getProdutos(tenantId: string): Promise<Produto[]>;
  getProduto(id: string, tenantId: string): Promise<Produto | undefined>;
  createProduto(produto: InsertProduto): Promise<Produto>;
  updateProduto(id: string, tenantId: string, produto: Partial<InsertProduto>): Promise<Produto | undefined>;
  deleteProduto(id: string, tenantId: string): Promise<boolean>;
  
  getEstoque(tenantId: string): Promise<Estoque[]>;
  getEstoqueByProduto(produtoId: string, tenantId: string): Promise<Estoque | undefined>;
  createEstoque(estoque: InsertEstoque): Promise<Estoque>;
  updateEstoque(id: string, tenantId: string, estoque: Partial<InsertEstoque>): Promise<Estoque | undefined>;
  decrementEstoque(produtoId: string, tenantId: string, quantidade: number): Promise<boolean>;
  
  getProdutoByNome(nome: string, tenantId: string): Promise<Produto | undefined>;
  getProdutosByIds(ids: string[], tenantId: string): Promise<Produto[]>;

  getMotoboys(tenantId: string): Promise<Motoboy[]>;
  getMotoboy(id: string, tenantId: string): Promise<Motoboy | undefined>;
  getMotoboysByStatus(tenantId: string, status: string): Promise<Motoboy[]>;
  createMotoboy(motoboy: InsertMotoboy): Promise<Motoboy>;
  updateMotoboy(id: string, tenantId: string, motoboy: Partial<InsertMotoboy>): Promise<Motoboy | undefined>;
  deleteMotoboy(id: string, tenantId: string): Promise<boolean>;
  
  getPedidos(tenantId: string): Promise<Pedido[]>;
  getPedidosByStatus(tenantId: string, statuses: string[]): Promise<Pedido[]>;
  getPedidosFiltered(tenantId: string, filters: { status?: string; startDate?: Date; endDate?: Date }): Promise<Pedido[]>;
  getPedido(id: string, tenantId: string): Promise<Pedido | undefined>;
  createPedido(pedido: InsertPedido): Promise<Pedido>;
  updatePedido(id: string, tenantId: string, pedido: Partial<InsertPedido>): Promise<Pedido | undefined>;
  deletePedido(id: string, tenantId: string): Promise<boolean>;

  getDailySales(tenantId: string, days: number): Promise<DailySales[]>;
  getTopSellingItems(tenantId: string, limit: number): Promise<TopSellingItem[]>;

  getPedidoPublicTracking(pedidoId: string): Promise<Pedido[]>;
  getPedidoByTrackingToken(token: string): Promise<Pedido | undefined>;

  getLogsN8n(tenantId: string): Promise<LogN8n[]>;
  createLogN8n(log: InsertLogN8n): Promise<LogN8n>;

  updateMotoboyLocation(tenantId: string, motoboyId: string, lat: number, lng: number): Promise<Motoboy | undefined>;

  getTransacoes(tenantId: string, filters: { tipo?: string; status?: string }): Promise<Transacao[]>;
  createTransacao(transacao: InsertTransacao): Promise<Transacao>;
  updateTransacaoStatus(tenantId: string, transacaoId: string, status: string): Promise<Transacao | undefined>;

  getFeedbacks(tenantId: string): Promise<Feedback[]>;
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;
  getFeedbackSentimentSummary(tenantId: string): Promise<{ sentimentoMedio: number; totalFeedbacks: number }>;
  getTopicosCriticos(tenantId: string, limit: number): Promise<{ topico: string; ocorrencias: number }[]>;

  getPrevisoes(tenantId: string): Promise<PrevisaoEstoque[]>;
  createPrevisao(previsao: InsertPrevisaoEstoque): Promise<PrevisaoEstoque>;
  updatePrevisaoStatus(id: string, tenantId: string, status: string): Promise<PrevisaoEstoque | undefined>;

  getAlertas(tenantId: string, limit: number): Promise<AlertaFrota[]>;
  getAlertasNaoLidos(tenantId: string): Promise<number>;
  createAlerta(alerta: InsertAlertaFrota): Promise<AlertaFrota>;
  markAlertaLido(id: string, tenantId: string): Promise<AlertaFrota | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  async getTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants);
  }

  async getAllTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants);
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || undefined;
  }

  async getTenantByApiKey(apiKey: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.apiKeyN8n, apiKey));
    return tenant || undefined;
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const [tenant] = await db
      .insert(tenants)
      .values(insertTenant)
      .returning();
    return tenant;
  }

  async updateTenant(id: string, tenant: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [updated] = await db
      .update(tenants)
      .set(tenant)
      .where(eq(tenants.id, id))
      .returning();
    return updated || undefined;
  }

  async getClientes(tenantId: string): Promise<Cliente[]> {
    return await db.select().from(clientes).where(eq(clientes.tenantId, tenantId));
  }

  async getCliente(id: string, tenantId: string): Promise<Cliente | undefined> {
    const [cliente] = await db
      .select()
      .from(clientes)
      .where(and(eq(clientes.id, id), eq(clientes.tenantId, tenantId)));
    return cliente || undefined;
  }

  async getClienteByTelefone(telefone: string, tenantId: string): Promise<Cliente | undefined> {
    const [cliente] = await db
      .select()
      .from(clientes)
      .where(and(eq(clientes.telefone, telefone), eq(clientes.tenantId, tenantId)));
    return cliente || undefined;
  }

  async createCliente(insertCliente: InsertCliente): Promise<Cliente> {
    const [cliente] = await db
      .insert(clientes)
      .values(insertCliente)
      .returning();
    return cliente;
  }

  async updateCliente(id: string, tenantId: string, cliente: Partial<InsertCliente>): Promise<Cliente | undefined> {
    const [updated] = await db
      .update(clientes)
      .set(cliente)
      .where(and(eq(clientes.id, id), eq(clientes.tenantId, tenantId)))
      .returning();
    return updated || undefined;
  }

  async deleteCliente(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(clientes)
      .where(and(eq(clientes.id, id), eq(clientes.tenantId, tenantId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getProdutos(tenantId: string): Promise<Produto[]> {
    return await db.select().from(produtos).where(eq(produtos.tenantId, tenantId));
  }

  async getProduto(id: string, tenantId: string): Promise<Produto | undefined> {
    const [produto] = await db
      .select()
      .from(produtos)
      .where(and(eq(produtos.id, id), eq(produtos.tenantId, tenantId)));
    return produto || undefined;
  }

  async createProduto(insertProduto: InsertProduto): Promise<Produto> {
    const [produto] = await db
      .insert(produtos)
      .values(insertProduto)
      .returning();
    return produto;
  }

  async updateProduto(id: string, tenantId: string, produto: Partial<InsertProduto>): Promise<Produto | undefined> {
    const [updated] = await db
      .update(produtos)
      .set(produto)
      .where(and(eq(produtos.id, id), eq(produtos.tenantId, tenantId)))
      .returning();
    return updated || undefined;
  }

  async deleteProduto(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(produtos)
      .where(and(eq(produtos.id, id), eq(produtos.tenantId, tenantId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getEstoque(tenantId: string): Promise<Estoque[]> {
    return await db.select().from(estoque).where(eq(estoque.tenantId, tenantId));
  }

  async getEstoqueByProduto(produtoId: string, tenantId: string): Promise<Estoque | undefined> {
    const [estoqueItem] = await db
      .select()
      .from(estoque)
      .where(and(eq(estoque.produtoId, produtoId), eq(estoque.tenantId, tenantId)));
    return estoqueItem || undefined;
  }

  async updateEstoque(id: string, tenantId: string, estoqueData: Partial<InsertEstoque>): Promise<Estoque | undefined> {
    const [updated] = await db
      .update(estoque)
      .set({ ...estoqueData, updatedAt: new Date() })
      .where(and(eq(estoque.id, id), eq(estoque.tenantId, tenantId)))
      .returning();
    return updated || undefined;
  }

  async createEstoque(insertEstoque: InsertEstoque): Promise<Estoque> {
    const [estoqueItem] = await db
      .insert(estoque)
      .values(insertEstoque)
      .returning();
    return estoqueItem;
  }

  async decrementEstoque(produtoId: string, tenantId: string, quantidade: number): Promise<boolean> {
    const [updated] = await db
      .update(estoque)
      .set({ 
        quantidade: sql`quantidade - ${quantidade}`,
        updatedAt: new Date() 
      })
      .where(and(
        eq(estoque.produtoId, produtoId), 
        eq(estoque.tenantId, tenantId)
      ))
      .returning();
    return !!updated;
  }

  async getProdutoByNome(nome: string, tenantId: string): Promise<Produto | undefined> {
    const [produto] = await db
      .select()
      .from(produtos)
      .where(and(
        sql`LOWER(${produtos.nome}) = LOWER(${nome})`,
        eq(produtos.tenantId, tenantId)
      ));
    return produto || undefined;
  }

  async getProdutosByIds(ids: string[], tenantId: string): Promise<Produto[]> {
    if (ids.length === 0) return [];
    return await db
      .select()
      .from(produtos)
      .where(and(
        inArray(produtos.id, ids),
        eq(produtos.tenantId, tenantId)
      ));
  }

  async getMotoboys(tenantId: string): Promise<Motoboy[]> {
    return await db.select().from(motoboys).where(eq(motoboys.tenantId, tenantId));
  }

  async getMotoboy(id: string, tenantId: string): Promise<Motoboy | undefined> {
    const [motoboy] = await db
      .select()
      .from(motoboys)
      .where(and(eq(motoboys.id, id), eq(motoboys.tenantId, tenantId)));
    return motoboy || undefined;
  }

  async getMotoboysByStatus(tenantId: string, status: string): Promise<Motoboy[]> {
    return await db
      .select()
      .from(motoboys)
      .where(and(eq(motoboys.tenantId, tenantId), eq(motoboys.status, status)));
  }

  async createMotoboy(insertMotoboy: InsertMotoboy): Promise<Motoboy> {
    const [motoboy] = await db
      .insert(motoboys)
      .values(insertMotoboy)
      .returning();
    return motoboy;
  }

  async updateMotoboy(id: string, tenantId: string, motoboyData: Partial<InsertMotoboy>): Promise<Motoboy | undefined> {
    const [updated] = await db
      .update(motoboys)
      .set(motoboyData)
      .where(and(eq(motoboys.id, id), eq(motoboys.tenantId, tenantId)))
      .returning();
    return updated || undefined;
  }

  async deleteMotoboy(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(motoboys)
      .where(and(eq(motoboys.id, id), eq(motoboys.tenantId, tenantId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getPedidos(tenantId: string): Promise<Pedido[]> {
    return await db
      .select()
      .from(pedidos)
      .where(eq(pedidos.tenantId, tenantId))
      .orderBy(desc(pedidos.createdAt));
  }

  async getPedidosByStatus(tenantId: string, statuses: string[]): Promise<Pedido[]> {
    if (statuses.length === 0) return [];
    return await db
      .select()
      .from(pedidos)
      .where(and(
        eq(pedidos.tenantId, tenantId),
        inArray(pedidos.status, statuses)
      ))
      .orderBy(desc(pedidos.createdAt));
  }

  async getPedidosFiltered(tenantId: string, filters: { status?: string; startDate?: Date; endDate?: Date }): Promise<Pedido[]> {
    const conditions = [eq(pedidos.tenantId, tenantId)];
    
    if (filters.status && filters.status !== 'todos') {
      conditions.push(eq(pedidos.status, filters.status));
    }
    
    if (filters.startDate) {
      conditions.push(sql`${pedidos.createdAt} >= ${filters.startDate}`);
    }
    
    if (filters.endDate) {
      conditions.push(sql`${pedidos.createdAt} <= ${filters.endDate}`);
    }
    
    return await db
      .select()
      .from(pedidos)
      .where(and(...conditions))
      .orderBy(desc(pedidos.createdAt));
  }

  async getPedido(id: string, tenantId: string): Promise<Pedido | undefined> {
    const [pedido] = await db
      .select()
      .from(pedidos)
      .where(and(eq(pedidos.id, id), eq(pedidos.tenantId, tenantId)));
    return pedido || undefined;
  }

  async createPedido(insertPedido: InsertPedido): Promise<Pedido> {
    const [pedido] = await db
      .insert(pedidos)
      .values(insertPedido)
      .returning();
    return pedido;
  }

  async updatePedido(id: string, tenantId: string, pedido: Partial<InsertPedido>): Promise<Pedido | undefined> {
    const [updated] = await db
      .update(pedidos)
      .set({ ...pedido, updatedAt: new Date() })
      .where(and(eq(pedidos.id, id), eq(pedidos.tenantId, tenantId)))
      .returning();
    return updated || undefined;
  }

  async deletePedido(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(pedidos)
      .where(and(eq(pedidos.id, id), eq(pedidos.tenantId, tenantId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getPedidoPublicTracking(pedidoId: string): Promise<Pedido[]> {
    return await db
      .select()
      .from(pedidos)
      .where(eq(pedidos.id, pedidoId));
  }

  async getPedidoByTrackingToken(token: string): Promise<Pedido | undefined> {
    const [pedido] = await db
      .select()
      .from(pedidos)
      .where(eq(pedidos.trackingToken, token));
    return pedido || undefined;
  }

  async getLogsN8n(tenantId: string): Promise<LogN8n[]> {
    return await db
      .select()
      .from(logsN8n)
      .where(eq(logsN8n.tenantId, tenantId))
      .orderBy(desc(logsN8n.createdAt))
      .limit(100);
  }

  async createLogN8n(insertLog: InsertLogN8n): Promise<LogN8n> {
    const [log] = await db
      .insert(logsN8n)
      .values(insertLog)
      .returning();
    return log;
  }

  async getDailySales(tenantId: string, days: number): Promise<DailySales[]> {
    const result = await db.execute(sql`
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(CAST(total AS DECIMAL)), 0) as total,
        COUNT(*) as count
      FROM pedidos 
      WHERE tenant_id = ${tenantId}
        AND created_at >= NOW() - INTERVAL '${sql.raw(String(days))} days'
        AND status != 'cancelado'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    return (result.rows as any[]).map(row => ({
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
      total: parseFloat(row.total) || 0,
      count: parseInt(row.count) || 0,
    }));
  }

  async getTopSellingItems(tenantId: string, limit: number): Promise<TopSellingItem[]> {
    const allPedidos = await db
      .select()
      .from(pedidos)
      .where(and(
        eq(pedidos.tenantId, tenantId),
        sql`${pedidos.status} != 'cancelado'`
      ));

    const itemStats: Record<string, { quantity: number; revenue: number }> = {};

    for (const pedido of allPedidos) {
      const itens = pedido.itens as any[];
      if (!Array.isArray(itens)) continue;
      
      for (const item of itens) {
        const nome = item.nome || 'Item desconhecido';
        if (!itemStats[nome]) {
          itemStats[nome] = { quantity: 0, revenue: 0 };
        }
        itemStats[nome].quantity += item.quantidade || 0;
        itemStats[nome].revenue += (item.quantidade || 0) * (item.precoUnitario || 0);
      }
    }

    return Object.entries(itemStats)
      .map(([name, stats]) => ({
        name,
        quantity: stats.quantity,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  }

  async updateMotoboyLocation(tenantId: string, motoboyId: string, lat: number, lng: number): Promise<Motoboy | undefined> {
    const [updated] = await db
      .update(motoboys)
      .set({ 
        lat: lat.toString(),
        lng: lng.toString(),
        lastLocationUpdate: new Date(),
      })
      .where(and(eq(motoboys.id, motoboyId), eq(motoboys.tenantId, tenantId)))
      .returning();
    return updated || undefined;
  }

  async getTransacoes(tenantId: string, filters: { tipo?: string; status?: string }): Promise<Transacao[]> {
    const conditions = [eq(transacoes.tenantId, tenantId)];
    
    if (filters.tipo) {
      conditions.push(eq(transacoes.tipo, filters.tipo));
    }
    if (filters.status) {
      conditions.push(eq(transacoes.status, filters.status));
    }
    
    return await db
      .select()
      .from(transacoes)
      .where(and(...conditions))
      .orderBy(desc(transacoes.data));
  }

  async createTransacao(insertTransacao: InsertTransacao): Promise<Transacao> {
    const [transacao] = await db
      .insert(transacoes)
      .values(insertTransacao)
      .returning();
    return transacao;
  }

  async updateTransacaoStatus(tenantId: string, transacaoId: string, status: string): Promise<Transacao | undefined> {
    const [updated] = await db
      .update(transacoes)
      .set({ status })
      .where(and(eq(transacoes.id, transacaoId), eq(transacoes.tenantId, tenantId)))
      .returning();
    return updated || undefined;
  }

  async getFeedbacks(tenantId: string): Promise<Feedback[]> {
    return await db
      .select()
      .from(feedbacks)
      .where(eq(feedbacks.tenantId, tenantId))
      .orderBy(desc(feedbacks.createdAt));
  }

  async createFeedback(insertFeedback: InsertFeedback): Promise<Feedback> {
    const [feedback] = await db
      .insert(feedbacks)
      .values(insertFeedback)
      .returning();
    return feedback;
  }

  async getFeedbackSentimentSummary(tenantId: string): Promise<{ sentimentoMedio: number; totalFeedbacks: number }> {
    const result = await db
      .select({
        avg: sql<number>`COALESCE(AVG(${feedbacks.sentimento}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(feedbacks)
      .where(eq(feedbacks.tenantId, tenantId));
    
    return {
      sentimentoMedio: Number(result[0]?.avg || 0),
      totalFeedbacks: Number(result[0]?.count || 0),
    };
  }

  async getTopicosCriticos(tenantId: string, limit: number): Promise<{ topico: string; ocorrencias: number }[]> {
    const allFeedbacks = await this.getFeedbacks(tenantId);
    const topicCount: Record<string, number> = {};
    
    for (const fb of allFeedbacks) {
      const topicos = fb.topicos as string[] | null;
      if (topicos && Array.isArray(topicos)) {
        for (const topico of topicos) {
          topicCount[topico] = (topicCount[topico] || 0) + 1;
        }
      }
    }
    
    return Object.entries(topicCount)
      .map(([topico, ocorrencias]) => ({ topico, ocorrencias }))
      .sort((a, b) => b.ocorrencias - a.ocorrencias)
      .slice(0, limit);
  }

  async getPrevisoes(tenantId: string): Promise<PrevisaoEstoque[]> {
    return await db
      .select()
      .from(previsaoEstoque)
      .where(eq(previsaoEstoque.tenantId, tenantId))
      .orderBy(desc(previsaoEstoque.createdAt));
  }

  async createPrevisao(insertPrevisao: InsertPrevisaoEstoque): Promise<PrevisaoEstoque> {
    const [previsao] = await db
      .insert(previsaoEstoque)
      .values(insertPrevisao)
      .returning();
    return previsao;
  }

  async updatePrevisaoStatus(id: string, tenantId: string, status: string): Promise<PrevisaoEstoque | undefined> {
    const [updated] = await db
      .update(previsaoEstoque)
      .set({ status })
      .where(and(eq(previsaoEstoque.id, id), eq(previsaoEstoque.tenantId, tenantId)))
      .returning();
    return updated || undefined;
  }

  async getAlertas(tenantId: string, limit: number): Promise<AlertaFrota[]> {
    return await db
      .select()
      .from(alertasFrota)
      .where(eq(alertasFrota.tenantId, tenantId))
      .orderBy(desc(alertasFrota.createdAt))
      .limit(limit);
  }

  async getAlertasNaoLidos(tenantId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(alertasFrota)
      .where(and(eq(alertasFrota.tenantId, tenantId), eq(alertasFrota.lida, false)));
    return Number(result[0]?.count || 0);
  }

  async createAlerta(insertAlerta: InsertAlertaFrota): Promise<AlertaFrota> {
    const [alerta] = await db
      .insert(alertasFrota)
      .values(insertAlerta)
      .returning();
    return alerta;
  }

  async markAlertaLido(id: string, tenantId: string): Promise<AlertaFrota | undefined> {
    const [updated] = await db
      .update(alertasFrota)
      .set({ lida: true })
      .where(and(eq(alertasFrota.id, id), eq(alertasFrota.tenantId, tenantId)))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
