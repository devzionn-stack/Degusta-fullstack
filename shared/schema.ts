import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  apiKeyN8n: text("api_key_n8n"),
  n8nWebhookUrl: text("n8n_webhook_url"),
  status: text("status").notNull().default('active'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  nome: text("nome").notNull(),
  role: text("role").notNull().default('user'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clientes = pgTable("clientes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  email: text("email"),
  telefone: text("telefone"),
  endereco: text("endereco"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const produtos = pgTable("produtos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  preco: decimal("preco", { precision: 10, scale: 2 }).notNull(),
  categoria: text("categoria"),
  imagem: text("imagem"),
  tempoPreparoEstimado: integer("tempo_preparo_estimado").default(15),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const estoque = pgTable("estoque", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  produtoId: varchar("produto_id").notNull().references(() => produtos.id, { onDelete: "cascade" }),
  quantidade: integer("quantidade").notNull().default(0),
  unidade: text("unidade").default('un'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const motoboys = pgTable("motoboys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  telefone: text("telefone"),
  placa: text("placa"),
  veiculoTipo: text("veiculo_tipo").default('moto'),
  status: text("status").notNull().default('disponivel'),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  lastLocationUpdate: timestamp("last_location_update"),
  accessToken: text("access_token"),
  pedidosAtivos: integer("pedidos_ativos").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pedidos = pgTable("pedidos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  clienteId: varchar("cliente_id").references(() => clientes.id, { onDelete: "set null" }),
  motoboyId: varchar("motoboy_id").references(() => motoboys.id, { onDelete: "set null" }),
  status: text("status").notNull().default('pendente'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  itens: jsonb("itens").notNull(),
  observacoes: text("observacoes"),
  enderecoEntrega: text("endereco_entrega"),
  origem: text("origem").default('sistema'),
  trackingLink: text("tracking_link"),
  trackingToken: text("tracking_token"),
  trackingStatus: text("tracking_status"),
  trackingData: jsonb("tracking_data"),
  trackingStartedAt: timestamp("tracking_started_at"),
  tempoPreparoEstimado: integer("tempo_preparo_estimado"),
  tempoEntregaEstimado: integer("tempo_entrega_estimado"),
  etaMinutos: integer("eta_minutos"),
  etaCalculadoEm: timestamp("eta_calculado_em"),
  rotaPolyline: text("rota_polyline"),
  destinoLat: decimal("destino_lat", { precision: 10, scale: 7 }),
  destinoLng: decimal("destino_lng", { precision: 10, scale: 7 }),
  inicioPreparoAt: timestamp("inicio_preparo_at"),
  prontoEntregaAt: timestamp("pronto_entrega_at"),
  saiuEntregaAt: timestamp("saiu_entrega_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const logsN8n = pgTable("logs_n8n", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(),
  endpoint: text("endpoint").notNull(),
  payload: jsonb("payload"),
  resposta: jsonb("resposta"),
  status: text("status").notNull().default('recebido'),
  erro: text("erro"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transacoes = pgTable("transacoes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  pedidoId: varchar("pedido_id").references(() => pedidos.id, { onDelete: "set null" }),
  tipo: text("tipo").notNull(),
  valor: decimal("valor", { precision: 10, scale: 2 }).notNull(),
  data: timestamp("data").defaultNow().notNull(),
  status: text("status").notNull().default('pendente'),
  descricao: text("descricao"),
  metodoPagamento: text("metodo_pagamento"),
  referenciaPagamento: text("referencia_pagamento"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const feedbacks = pgTable("feedbacks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  pedidoId: varchar("pedido_id").references(() => pedidos.id, { onDelete: "set null" }),
  clienteId: varchar("cliente_id").references(() => clientes.id, { onDelete: "set null" }),
  sentimento: decimal("sentimento", { precision: 5, scale: 2 }).notNull(),
  topicos: jsonb("topicos").$type<string[]>().default([]),
  comentario: text("comentario"),
  nota: integer("nota"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const previsaoEstoque = pgTable("previsao_estoque", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  ingrediente: text("ingrediente").notNull(),
  unidade: text("unidade").notNull().default('un'),
  quantidadeAtual: integer("quantidade_atual").notNull().default(0),
  quantidadeSugerida: integer("quantidade_sugerida").notNull().default(0),
  horizonteDias: integer("horizonte_dias").notNull().default(7),
  confianca: decimal("confianca", { precision: 5, scale: 2 }),
  status: text("status").notNull().default('pendente'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const alertasFrota = pgTable("alertas_frota", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(),
  severidade: text("severidade").notNull().default('info'),
  mensagem: text("mensagem").notNull(),
  meta: jsonb("meta").$type<Record<string, any>>(),
  lida: boolean("lida").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const historicoPreparo = pgTable("historico_preparo", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  pedidoId: varchar("pedido_id").notNull().references(() => pedidos.id, { onDelete: "cascade" }),
  produtoId: varchar("produto_id").references(() => produtos.id, { onDelete: "set null" }),
  produtoNome: text("produto_nome").notNull(),
  tempoEstimado: integer("tempo_estimado").notNull(),
  tempoReal: integer("tempo_real"),
  inicioAt: timestamp("inicio_at").notNull(),
  fimAt: timestamp("fim_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  tenantId: z.string().optional(),
});

export const insertClienteSchema = createInsertSchema(clientes).omit({
  id: true,
  createdAt: true,
});

export const insertProdutoSchema = createInsertSchema(produtos).omit({
  id: true,
  createdAt: true,
});

export const insertEstoqueSchema = createInsertSchema(estoque).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMotoboySchema = createInsertSchema(motoboys).omit({
  id: true,
  createdAt: true,
});

export const insertPedidoSchema = createInsertSchema(pedidos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLogN8nSchema = createInsertSchema(logsN8n).omit({
  id: true,
  createdAt: true,
});

export const insertTransacaoSchema = createInsertSchema(transacoes).omit({
  id: true,
  createdAt: true,
});

export const insertFeedbackSchema = createInsertSchema(feedbacks).omit({
  id: true,
  createdAt: true,
});

export const insertPrevisaoEstoqueSchema = createInsertSchema(previsaoEstoque).omit({
  id: true,
  createdAt: true,
});

export const insertAlertaFrotaSchema = createInsertSchema(alertasFrota).omit({
  id: true,
  createdAt: true,
});

export const insertHistoricoPreparoSchema = createInsertSchema(historicoPreparo).omit({
  id: true,
  createdAt: true,
});

export const tipoTransacaoEnum = z.enum(["receita", "despesa"]);
export const statusTransacaoEnum = z.enum(["pendente", "confirmado", "cancelado"]);
export const severidadeAlertaEnum = z.enum(["info", "warn", "critical"]);
export const tipoAlertaEnum = z.enum(["motoboy_fora_rota", "estoque_critico", "atraso_entrega", "sistema"]);

export const webhookPagamentoSchema = z.object({
  pedidoId: z.string(),
  status: z.enum(["aprovado", "recusado", "pendente"]),
  metodoPagamento: z.enum(["pix", "boleto", "cartao", "dinheiro"]),
  referenciaPagamento: z.string().optional(),
  valor: z.number().min(0),
});

export const webhookPedidoSchema = z.object({
  cliente: z.object({
    nome: z.string(),
    telefone: z.string().optional(),
    email: z.string().email().optional(),
    endereco: z.string().optional(),
  }),
  itens: z.array(z.object({
    produtoId: z.string().optional(),
    nome: z.string(),
    quantidade: z.number().min(1),
    precoUnitario: z.number().min(0),
  })),
  total: z.number().min(0),
  observacoes: z.string().optional(),
  enderecoEntrega: z.string().optional(),
});

export const webhookIndicadorSchema = z.object({
  tipo: z.string(),
  dados: z.record(z.any()),
  mensagem: z.string().optional(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = z.infer<typeof insertClienteSchema>;

export type Produto = typeof produtos.$inferSelect;
export type InsertProduto = z.infer<typeof insertProdutoSchema>;

export type Estoque = typeof estoque.$inferSelect;
export type InsertEstoque = z.infer<typeof insertEstoqueSchema>;

export type Motoboy = typeof motoboys.$inferSelect;
export type InsertMotoboy = z.infer<typeof insertMotoboySchema>;

export type Pedido = typeof pedidos.$inferSelect;
export type InsertPedido = z.infer<typeof insertPedidoSchema>;

export type LogN8n = typeof logsN8n.$inferSelect;
export type InsertLogN8n = z.infer<typeof insertLogN8nSchema>;

export type Transacao = typeof transacoes.$inferSelect;
export type InsertTransacao = z.infer<typeof insertTransacaoSchema>;

export type Feedback = typeof feedbacks.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;

export type PrevisaoEstoque = typeof previsaoEstoque.$inferSelect;
export type InsertPrevisaoEstoque = z.infer<typeof insertPrevisaoEstoqueSchema>;

export type AlertaFrota = typeof alertasFrota.$inferSelect;
export type InsertAlertaFrota = z.infer<typeof insertAlertaFrotaSchema>;

export type HistoricoPreparo = typeof historicoPreparo.$inferSelect;
export type InsertHistoricoPreparo = z.infer<typeof insertHistoricoPreparoSchema>;
