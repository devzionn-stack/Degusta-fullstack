import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  apiKeyN8n: text("api_key_n8n"),
  n8nWebhookUrl: text("n8n_webhook_url"),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
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
  tempoExtraPreparo: integer("tempo_extra_preparo").default(0),
  etapasKDS: jsonb("etapas_kds").$type<Array<{nome: string; tempoSegundos: number; instrucoes: string}>>(),
  ingredientesTexto: text("ingredientes_texto"),
  tipoPizza: text("tipo_pizza"),
  disponibilidade: text("disponibilidade").default("ativo"),
  precoPromocional: decimal("preco_promocional", { precision: 10, scale: 2 }),
  promocaoInicio: timestamp("promocao_inicio"),
  promocaoFim: timestamp("promocao_fim"),
  promocaoAtiva: boolean("promocao_ativa").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const produtoVariantes = pgTable("produto_variantes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  produtoId: varchar("produto_id").notNull().references(() => produtos.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(),
  nome: text("nome").notNull(),
  precoAdicional: decimal("preco_adicional", { precision: 10, scale: 2 }).default("0"),
  ativo: boolean("ativo").default(true),
  ordem: integer("ordem").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const estoque = pgTable("estoque", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  produtoId: varchar("produto_id").references(() => produtos.id, { onDelete: "cascade" }),
  ingredienteId: varchar("ingrediente_id"),
  quantidade: integer("quantidade").notNull().default(0),
  quantidadeMinima: integer("quantidade_minima").default(0),
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
  alertaEta10MinEnviado: boolean("alerta_eta_10min_enviado").default(false),
  alertaChegandoEnviado: boolean("alerta_chegando_enviado").default(false),
  inicioPreparoAt: timestamp("inicio_preparo_at"),
  prontoEntregaAt: timestamp("pronto_entrega_at"),
  saiuEntregaAt: timestamp("saiu_entrega_at"),
  tempoMetaMontagem: integer("tempo_meta_montagem"),
  numeroLoop: integer("numero_loop"),
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

export const systemLogs = pgTable("system_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  tipo: text("tipo").notNull(),
  acao: text("acao").notNull(),
  entidade: text("entidade"),
  entidadeId: varchar("entidade_id"),
  detalhes: jsonb("detalhes").$type<Record<string, any>>(),
  ip: text("ip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const etapasProducao = pgTable("etapas_producao", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  tempoMetaSegundos: integer("tempo_meta_segundos").notNull().default(300),
  ordem: integer("ordem").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ingredientes = pgTable("ingredientes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  categoria: text("categoria").default('outros'), // queijos, carnes, vegetais, ovos, molhos, doces, base
  unidade: text("unidade").default('g'), // g, ml, unidade
  custoUnitario: decimal("custo_unitario", { precision: 10, scale: 4 }),
  gramaturaInteira: decimal("gramatura_inteira", { precision: 10, scale: 2 }), // gramatura padrão por pizza inteira
  gramaturaMeia: decimal("gramatura_meia", { precision: 10, scale: 2 }), // gramatura por meia pizza
  corVisual: text("cor_visual"), // cor para diagrama visual (hex)
  estoqueAtual: decimal("estoque_atual", { precision: 12, scale: 3 }).default("0"), // estoque em unidade base
  estoqueMinimo: decimal("estoque_minimo", { precision: 12, scale: 3 }).default("0"),
  ativo: boolean("ativo").default(true),
  idExternoEstoque: text("id_externo_estoque"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Porções processadas (matéria-prima → porções padronizadas)
export const porcoes = pgTable("porcoes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  ingredienteId: varchar("ingrediente_id").notNull().references(() => ingredientes.id, { onDelete: "cascade" }),
  codigoPorcao: text("codigo_porcao").notNull(), // ex: "CAL-001", "MUS-002"
  gramatura: decimal("gramatura", { precision: 10, scale: 2 }).notNull(), // gramas ou unidades
  quantidadeDisponivel: integer("quantidade_disponivel").default(0),
  quantidadeReservada: integer("quantidade_reservada").default(0),
  dataProcessamento: timestamp("data_processamento").defaultNow().notNull(),
  dataValidade: timestamp("data_validade"),
  lote: text("lote"),
  status: text("status").default("disponivel"), // disponivel, reservado, consumido, descartado
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Processamentos de matéria-prima (entrada de estoque → porções)
export const processamentos = pgTable("processamentos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  ingredienteId: varchar("ingrediente_id").notNull().references(() => ingredientes.id, { onDelete: "cascade" }),
  usuarioId: varchar("usuario_id").references(() => users.id, { onDelete: "set null" }),
  quantidadeEntrada: decimal("quantidade_entrada", { precision: 12, scale: 3 }).notNull(), // quantidade bruta processada
  unidadeEntrada: text("unidade_entrada").default("kg"),
  porcoesGeradas: integer("porcoes_geradas").notNull(), // quantas porções foram criadas
  gramaturaPorcao: decimal("gramatura_porcao", { precision: 10, scale: 2 }).notNull(),
  perdaPercentual: decimal("perda_percentual", { precision: 5, scale: 2 }), // % de perda no processamento
  custoTotal: decimal("custo_total", { precision: 10, scale: 2 }),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reservas de porções (quando pizza entra em produção)
export const reservasPorcoes = pgTable("reservas_porcoes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  pedidoId: varchar("pedido_id").notNull().references(() => pedidos.id, { onDelete: "cascade" }),
  itemPedidoId: varchar("item_pedido_id"),
  ingredienteId: varchar("ingrediente_id").notNull().references(() => ingredientes.id, { onDelete: "cascade" }),
  quantidadeReservada: decimal("quantidade_reservada", { precision: 10, scale: 3 }).notNull(),
  status: text("status").default("reservado"), // reservado, consumido, liberado
  createdAt: timestamp("created_at").defaultNow().notNull(),
  consumidoEm: timestamp("consumido_em"),
});

// Sequência de montagem estruturada (substitui texto livre)
export const sequenciaMontagem = pgTable("sequencia_montagem", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  produtoId: varchar("produto_id").notNull().references(() => produtos.id, { onDelete: "cascade" }),
  ordem: integer("ordem").notNull(),
  ingredienteId: varchar("ingrediente_id").notNull().references(() => ingredientes.id, { onDelete: "cascade" }),
  instrucao: text("instrucao"), // instrução opcional
  tempoSegundos: integer("tempo_segundos").default(30),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Log de auditoria de alterações em ingredientes
export const auditLogIngredientes = pgTable("audit_log_ingredientes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  ingredienteId: varchar("ingrediente_id").notNull().references(() => ingredientes.id, { onDelete: "cascade" }),
  usuarioId: varchar("usuario_id").references(() => users.id, { onDelete: "set null" }),
  acao: text("acao").notNull(), // criacao, edicao, exclusao, ajuste_estoque
  camposAlterados: jsonb("campos_alterados").$type<Record<string, { antes: any; depois: any }>>(),
  motivo: text("motivo"),
  ip: text("ip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const receitasIngredientes = pgTable("receitas_ingredientes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  produtoId: varchar("produto_id").notNull().references(() => produtos.id, { onDelete: "cascade" }),
  ingredienteId: varchar("ingrediente_id").notNull().references(() => ingredientes.id, { onDelete: "cascade" }),
  quantidade: decimal("quantidade", { precision: 10, scale: 3 }).notNull(),
  etapaProducaoId: varchar("etapa_producao_id").references(() => etapasProducao.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const custoMercado = pgTable("custo_mercado", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ingredienteId: varchar("ingrediente_id").notNull().references(() => ingredientes.id, { onDelete: "cascade" }),
  precoMercado: decimal("preco_mercado", { precision: 10, scale: 4 }).notNull(),
  fornecedor: text("fornecedor"),
  dataAtualizacao: timestamp("data_atualizacao").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const progressoKDS = pgTable("progresso_kds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  pedidoId: varchar("pedido_id").notNull().references(() => pedidos.id, { onDelete: "cascade" }),
  produtoId: varchar("produto_id").references(() => produtos.id, { onDelete: "set null" }),
  produtoNome: text("produto_nome").notNull(),
  etapaAtual: integer("etapa_atual").notNull().default(0),
  totalEtapas: integer("total_etapas").notNull(),
  etapas: jsonb("etapas").$type<Array<{
    nome: string;
    tempoSegundos: number;
    instrucoes: string;
    iniciadoEm: string | null;
    concluidoEm: string | null;
    tempoReal: number | null;
  }>>().notNull(),
  statusKDS: text("status_kds").notNull().default('aguardando'),
  iniciadoEm: timestamp("iniciado_em"),
  concluidoEm: timestamp("concluido_em"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const historicoTimingKDS = pgTable("historico_timing_kds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  pedidoId: varchar("pedido_id").notNull().references(() => pedidos.id, { onDelete: "cascade" }),
  produtoId: varchar("produto_id").references(() => produtos.id, { onDelete: "set null" }),
  produtoNome: text("produto_nome").notNull(),
  etapaNome: text("etapa_nome").notNull(),
  tempoEstimado: integer("tempo_estimado").notNull(),
  tempoReal: integer("tempo_real").notNull(),
  desvio: integer("desvio").notNull(),
  iniciadoEm: timestamp("iniciado_em").notNull(),
  concluidoEm: timestamp("concluido_em").notNull(),
  numeroIngredientes: integer("numero_ingredientes"),
  horaPedido: integer("hora_pedido"),
  diaSemana: integer("dia_semana"),
  periodoRush: boolean("periodo_rush"),
  pizzasSimultaneas: integer("pizzas_simultaneas"),
  categoriaPizza: text("categoria_pizza"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const configAlertasKDS = pgTable("config_alertas_kds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  tipoEvento: text("tipo_evento").notNull(),
  webhookUrl: text("webhook_url"),
  templateMensagem: text("template_mensagem").notNull(),
  ativo: boolean("ativo").notNull().default(true),
  enviarWhatsApp: boolean("enviar_whatsapp").notNull().default(false),
  enviarWebhook: boolean("enviar_webhook").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const alertasKDSEnviados = pgTable("alertas_kds_enviados", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  configAlertaId: varchar("config_alerta_id").notNull().references(() => configAlertasKDS.id, { onDelete: "cascade" }),
  pedidoId: varchar("pedido_id").references(() => pedidos.id, { onDelete: "set null" }),
  tipoEvento: text("tipo_evento").notNull(),
  mensagem: text("mensagem").notNull(),
  destinatario: text("destinatario"),
  statusEnvio: text("status_envio").notNull().default('pendente'),
  respostaWebhook: jsonb("resposta_webhook"),
  erro: text("erro"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  evento: text("evento").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull(),
  statusCode: integer("status_code"),
  resposta: text("resposta"),
  tentativas: integer("tentativas").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const alertasEstoque = pgTable("alertas_estoque", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  ingredienteId: varchar("ingrediente_id"),
  tipo: text("tipo").notNull(),
  mensagem: text("mensagem").notNull(),
  lido: boolean("lido").default(false),
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
  nomeFranquia: z.string().min(2, "Nome da franquia deve ter pelo menos 2 caracteres"),
});

export const insertClienteSchema = createInsertSchema(clientes).omit({
  id: true,
  createdAt: true,
});

export const insertProdutoSchema = createInsertSchema(produtos).omit({
  id: true,
  createdAt: true,
});

export const insertProdutoVarianteSchema = createInsertSchema(produtoVariantes).omit({
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

export type ProdutoVariante = typeof produtoVariantes.$inferSelect;
export type InsertProdutoVariante = z.infer<typeof insertProdutoVarianteSchema>;

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

export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = {
  tenantId?: string | null;
  userId?: string | null;
  tipo: string;
  acao: string;
  entidade?: string | null;
  entidadeId?: string | null;
  detalhes?: Record<string, any> | null;
  ip?: string | null;
};

export const insertEtapaProducaoSchema = createInsertSchema(etapasProducao).omit({
  id: true,
  createdAt: true,
});

export const insertIngredienteSchema = createInsertSchema(ingredientes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPorcaoSchema = createInsertSchema(porcoes).omit({
  id: true,
  createdAt: true,
});

export const insertProcessamentoSchema = createInsertSchema(processamentos).omit({
  id: true,
  createdAt: true,
});

export const insertReservaPorcaoSchema = createInsertSchema(reservasPorcoes).omit({
  id: true,
  createdAt: true,
});

export const insertSequenciaMontagemSchema = createInsertSchema(sequenciaMontagem).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogIngredienteSchema = createInsertSchema(auditLogIngredientes).omit({
  id: true,
  createdAt: true,
});

export const insertReceitaIngredienteSchema = createInsertSchema(receitasIngredientes).omit({
  id: true,
  createdAt: true,
});

export type EtapaProducao = typeof etapasProducao.$inferSelect;
export type InsertEtapaProducao = z.infer<typeof insertEtapaProducaoSchema>;

export type Ingrediente = typeof ingredientes.$inferSelect;
export type InsertIngrediente = z.infer<typeof insertIngredienteSchema>;

export type Porcao = typeof porcoes.$inferSelect;
export type InsertPorcao = z.infer<typeof insertPorcaoSchema>;

export type Processamento = typeof processamentos.$inferSelect;
export type InsertProcessamento = z.infer<typeof insertProcessamentoSchema>;

export type ReservaPorcao = typeof reservasPorcoes.$inferSelect;
export type InsertReservaPorcao = z.infer<typeof insertReservaPorcaoSchema>;

export type SequenciaMontagem = typeof sequenciaMontagem.$inferSelect;
export type InsertSequenciaMontagem = z.infer<typeof insertSequenciaMontagemSchema>;

export type AuditLogIngrediente = typeof auditLogIngredientes.$inferSelect;
export type InsertAuditLogIngrediente = z.infer<typeof insertAuditLogIngredienteSchema>;

export type ReceitaIngrediente = typeof receitasIngredientes.$inferSelect;
export type InsertReceitaIngrediente = z.infer<typeof insertReceitaIngredienteSchema>;

export const insertProgressoKDSSchema = createInsertSchema(progressoKDS).omit({
  id: true,
  createdAt: true,
});

export const insertHistoricoTimingKDSSchema = createInsertSchema(historicoTimingKDS).omit({
  id: true,
  createdAt: true,
});

export const insertConfigAlertasKDSSchema = createInsertSchema(configAlertasKDS).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAlertasKDSEnviadosSchema = createInsertSchema(alertasKDSEnviados).omit({
  id: true,
  createdAt: true,
});

export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({
  id: true,
  createdAt: true,
});

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;

export type ProgressoKDS = typeof progressoKDS.$inferSelect;
export type InsertProgressoKDS = z.infer<typeof insertProgressoKDSSchema>;

export type HistoricoTimingKDS = typeof historicoTimingKDS.$inferSelect;
export type InsertHistoricoTimingKDS = z.infer<typeof insertHistoricoTimingKDSSchema>;

export type ConfigAlertasKDS = typeof configAlertasKDS.$inferSelect;
export type InsertConfigAlertasKDS = z.infer<typeof insertConfigAlertasKDSSchema>;

export type AlertasKDSEnviados = typeof alertasKDSEnviados.$inferSelect;
export type InsertAlertasKDSEnviados = z.infer<typeof insertAlertasKDSEnviadosSchema>;

export const insertCustoMercadoSchema = createInsertSchema(custoMercado).omit({
  id: true,
  createdAt: true,
});

export type CustoMercado = typeof custoMercado.$inferSelect;
export type InsertCustoMercado = z.infer<typeof insertCustoMercadoSchema>;

export const webhookCustoMercadoSchema = z.object({
  ingredienteId: z.string(),
  precoMercado: z.number().positive(),
  fornecedor: z.string().optional(),
});

export const templatesEtapasKDS = pgTable("templates_etapas_kds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  categoria: text("categoria").notNull(),
  etapas: jsonb("etapas").$type<Array<{
    nome: string;
    tempoSegundos: number;
    instrucoes: string;
  }>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTemplateEtapasKDSSchema = createInsertSchema(templatesEtapasKDS).omit({
  id: true,
  createdAt: true,
});

export type TemplateEtapasKDS = typeof templatesEtapasKDS.$inferSelect;
export type InsertTemplateEtapasKDS = z.infer<typeof insertTemplateEtapasKDSSchema>;

export const combos = pgTable("combos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  preco: decimal("preco", { precision: 10, scale: 2 }).notNull(),
  imagemUrl: text("imagem_url"),
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const comboItens = pgTable("combo_itens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  comboId: varchar("combo_id").notNull().references(() => combos.id, { onDelete: "cascade" }),
  produtoId: varchar("produto_id").notNull().references(() => produtos.id, { onDelete: "cascade" }),
  quantidade: integer("quantidade").default(1),
});

export const insertComboSchema = createInsertSchema(combos).omit({
  id: true,
  createdAt: true,
});
export type InsertCombo = z.infer<typeof insertComboSchema>;
export type Combo = typeof combos.$inferSelect;

export const insertComboItemSchema = createInsertSchema(comboItens).omit({
  id: true,
});
export type InsertComboItem = z.infer<typeof insertComboItemSchema>;
export type ComboItem = typeof comboItens.$inferSelect;

// Pizzas Personalizadas (multi-sabores)
export const pizzasPersonalizadas = pgTable("pizzas_personalizadas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  hashSabores: text("hash_sabores").notNull(), // Hash único da combinação de sabores
  nome: text("nome"), // Nome gerado automaticamente
  sabores: jsonb("sabores").$type<Array<{
    produtoId: string;
    produtoNome: string;
    fracao: number; // 0.5, 0.33, 0.25, 1
    ingredientes: Array<{
      ingredienteId: string;
      nome: string;
      quantidade: number;
      unidade: string;
      custoUnitario: number;
    }>;
  }>>().notNull(),
  custoTotal: decimal("custo_total", { precision: 10, scale: 2 }),
  precoSugerido: decimal("preco_sugerido", { precision: 10, scale: 2 }),
  totalPedidos: integer("total_pedidos").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Itens de pedido detalhados (para diagrama)
export const itensPedidoDetalhados = pgTable("itens_pedido_detalhados", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  pedidoId: varchar("pedido_id").notNull().references(() => pedidos.id, { onDelete: "cascade" }),
  pizzaPersonalizadaId: varchar("pizza_personalizada_id").references(() => pizzasPersonalizadas.id, { onDelete: "set null" }),
  produtoId: varchar("produto_id").references(() => produtos.id, { onDelete: "set null" }),
  tipoItem: text("tipo_item").notNull().default("pizza"), // pizza, combo, bebida
  nome: text("nome").notNull(),
  quantidade: integer("quantidade").default(1),
  preco: decimal("preco", { precision: 10, scale: 2 }).notNull(),
  sabores: jsonb("sabores").$type<Array<{
    produtoId: string;
    produtoNome: string;
    fracao: number;
    setorInicio: number; // Posição no círculo (graus)
    setorFim: number;
    cor: string;
    ingredientes: Array<{
      ingredienteId: string;
      nome: string;
      quantidade: number;
      unidade: string;
      custo: number;
    }>;
  }>>(),
  custoReal: decimal("custo_real", { precision: 10, scale: 2 }),
  statusProducao: text("status_producao").default("aguardando"), // aguardando, producao, concluido
  diagramaGerado: boolean("diagrama_gerado").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Extrato de consumo de ingredientes
export const extratoConsumo = pgTable("extrato_consumo", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  pedidoId: varchar("pedido_id").references(() => pedidos.id, { onDelete: "set null" }),
  itemPedidoId: varchar("item_pedido_id").references(() => itensPedidoDetalhados.id, { onDelete: "set null" }),
  ingredienteId: varchar("ingrediente_id").references(() => ingredientes.id, { onDelete: "set null" }),
  ingredienteNome: text("ingrediente_nome").notNull(),
  quantidadeUsada: decimal("quantidade_usada", { precision: 10, scale: 3 }).notNull(),
  unidade: text("unidade").default("g"),
  custoUnitario: decimal("custo_unitario", { precision: 10, scale: 4 }),
  custoTotal: decimal("custo_total", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPizzaPersonalizadaSchema = createInsertSchema(pizzasPersonalizadas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PizzaPersonalizada = typeof pizzasPersonalizadas.$inferSelect;
export type InsertPizzaPersonalizada = z.infer<typeof insertPizzaPersonalizadaSchema>;

export const insertItemPedidoDetalhadoSchema = createInsertSchema(itensPedidoDetalhados).omit({
  id: true,
  createdAt: true,
});
export type ItemPedidoDetalhado = typeof itensPedidoDetalhados.$inferSelect;
export type InsertItemPedidoDetalhado = z.infer<typeof insertItemPedidoDetalhadoSchema>;

export const insertExtratoConsumoSchema = createInsertSchema(extratoConsumo).omit({
  id: true,
  createdAt: true,
});
export type ExtratoConsumo = typeof extratoConsumo.$inferSelect;
export type InsertExtratoConsumo = z.infer<typeof insertExtratoConsumoSchema>;

// Configuração Fiscal (SEFAZ)
export const configuracaoFiscal = pgTable("configuracao_fiscal", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }).unique(),
  cnpj: text("cnpj"),
  inscricaoEstadual: text("inscricao_estadual"),
  inscricaoMunicipal: text("inscricao_municipal"),
  razaoSocial: text("razao_social"),
  nomeFantasia: text("nome_fantasia"),
  certificadoDigital: text("certificado_digital"), // Base64 do certificado
  senhaCertificado: text("senha_certificado"), // Senha do certificado (encriptada)
  ambienteSefaz: text("ambiente_sefaz").default("homologacao"), // homologacao | producao
  serieNfe: integer("serie_nfe").default(1),
  serieNfce: integer("serie_nfce").default(1),
  ultimoNumeroNfe: integer("ultimo_numero_nfe").default(0),
  ultimoNumeroNfce: integer("ultimo_numero_nfce").default(0),
  cscNfce: text("csc_nfce"), // Código de Segurança do Contribuinte
  idTokenNfce: text("id_token_nfce"),
  regimeTributario: text("regime_tributario").default("simples_nacional"), // simples_nacional | lucro_presumido | lucro_real
  crt: integer("crt").default(1), // Código de Regime Tributário
  enderecoUf: text("endereco_uf"),
  enderecoMunicipio: text("endereco_municipio"),
  enderecoCep: text("endereco_cep"),
  enderecoLogradouro: text("endereco_logradouro"),
  enderecoNumero: text("endereco_numero"),
  enderecoBairro: text("endereco_bairro"),
  codigoMunicipio: text("codigo_municipio"), // Código IBGE
  ativo: boolean("ativo").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConfiguracaoFiscalSchema = createInsertSchema(configuracaoFiscal).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ConfiguracaoFiscal = typeof configuracaoFiscal.$inferSelect;
export type InsertConfiguracaoFiscal = z.infer<typeof insertConfiguracaoFiscalSchema>;

// Regras de automação por tenant
export const regrasAutomacao = pgTable("regras_automacao", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull(), // estoque_baixo | pedido_pronto | follow_up_crm | despacho_automatico
  condicao: jsonb("condicao").$type<{
    campo?: string;
    operador?: string;
    valor?: string | number;
  }>(),
  acao: jsonb("acao").$type<{
    tipo: string;
    parametros?: Record<string, any>;
  }>(),
  ativo: boolean("ativo").default(true),
  prioridade: integer("prioridade").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRegraAutomacaoSchema = createInsertSchema(regrasAutomacao).omit({
  id: true,
  createdAt: true,
});
export type RegraAutomacao = typeof regrasAutomacao.$inferSelect;
export type InsertRegraAutomacao = z.infer<typeof insertRegraAutomacaoSchema>;

// API externa para receber pedidos (WhatsApp, n8n, CrewAI)
export const pedidoExternoSchema = z.object({
  cliente_nome: z.string().min(1, "Nome do cliente é obrigatório"),
  cliente_telefone: z.string().min(8, "Telefone é obrigatório"),
  cliente_endereco: z.string().optional(),
  sabores: z.array(z.object({
    pizza_id: z.string(),
    fracao: z.number().min(0.25).max(1),
  })).min(1, "Pelo menos um sabor é obrigatório"),
  observacoes: z.string().optional(),
});
