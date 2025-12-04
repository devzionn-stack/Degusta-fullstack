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
  users,
  tenants,
  clientes,
  produtos,
  estoque,
  pedidos,
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  
  getTenants(): Promise<Tenant[]>;
  getTenant(id: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, tenant: Partial<InsertTenant>): Promise<Tenant | undefined>;
  
  getClientes(tenantId: string): Promise<Cliente[]>;
  getCliente(id: string, tenantId: string): Promise<Cliente | undefined>;
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
  updateEstoque(id: string, tenantId: string, estoque: Partial<InsertEstoque>): Promise<Estoque | undefined>;
  
  getPedidos(tenantId: string): Promise<Pedido[]>;
  getPedido(id: string, tenantId: string): Promise<Pedido | undefined>;
  createPedido(pedido: InsertPedido): Promise<Pedido>;
  updatePedido(id: string, tenantId: string, pedido: Partial<InsertPedido>): Promise<Pedido | undefined>;
  deletePedido(id: string, tenantId: string): Promise<boolean>;
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

  async getPedidos(tenantId: string): Promise<Pedido[]> {
    return await db.select().from(pedidos).where(eq(pedidos.tenantId, tenantId));
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
}

export const storage = new DatabaseStorage();
