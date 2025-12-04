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
  type Pedido,
  type InsertPedido,
  type LogN8n,
  type InsertLogN8n,
  users,
  tenants,
  clientes,
  produtos,
  estoque,
  pedidos,
  logsN8n,
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
  
  getTenants(): Promise<Tenant[]>;
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
  
  getPedidos(tenantId: string): Promise<Pedido[]>;
  getPedidosByStatus(tenantId: string, statuses: string[]): Promise<Pedido[]>;
  getPedidosFiltered(tenantId: string, filters: { status?: string; startDate?: Date; endDate?: Date }): Promise<Pedido[]>;
  getPedido(id: string, tenantId: string): Promise<Pedido | undefined>;
  createPedido(pedido: InsertPedido): Promise<Pedido>;
  updatePedido(id: string, tenantId: string, pedido: Partial<InsertPedido>): Promise<Pedido | undefined>;
  deletePedido(id: string, tenantId: string): Promise<boolean>;

  getDailySales(tenantId: string, days: number): Promise<DailySales[]>;
  getTopSellingItems(tenantId: string, limit: number): Promise<TopSellingItem[]>;

  getLogsN8n(tenantId: string): Promise<LogN8n[]>;
  createLogN8n(log: InsertLogN8n): Promise<LogN8n>;
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
}

export const storage = new DatabaseStorage();
