# 🔐 Guia de Multi-Tenancy com Row Level Security (RLS)

## 📋 Visão Geral

Este projeto implementa uma arquitetura **multi-tenant** completa para um sistema de pizzaria, onde cada franquia (tenant) tem seus dados completamente isolados através de **Row Level Security (RLS)** no PostgreSQL.

---

## 🏗️ Arquitetura de Dados

### Tabelas Principais

#### 1. **`tenants`** (Franquias)
```sql
id          VARCHAR (UUID)    PRIMARY KEY
nome        TEXT              NOT NULL
api_key_n8n TEXT              (chave para integração N8N)
status      TEXT              DEFAULT 'active'
created_at  TIMESTAMP         DEFAULT now()
```

#### 2. **`pedidos`** (Pedidos Multi-Tenant)
```sql
id                VARCHAR (UUID)    PRIMARY KEY
tenant_id         VARCHAR (UUID)    FOREIGN KEY → tenants.id
cliente_id        VARCHAR (UUID)    FOREIGN KEY → clientes.id
status            TEXT              DEFAULT 'pendente'
total             DECIMAL(10,2)     NOT NULL
itens             JSONB             NOT NULL
observacoes       TEXT
endereco_entrega  TEXT
created_at        TIMESTAMP         DEFAULT now()
updated_at        TIMESTAMP         DEFAULT now()
```

#### 3. **`clientes`** (Clientes Multi-Tenant)
```sql
id          VARCHAR (UUID)    PRIMARY KEY
tenant_id   VARCHAR (UUID)    FOREIGN KEY → tenants.id
nome        TEXT              NOT NULL
email       TEXT
telefone    TEXT
endereco    TEXT
created_at  TIMESTAMP         DEFAULT now()
```

#### 4. **`produtos`** (Produtos Multi-Tenant)
```sql
id          VARCHAR (UUID)    PRIMARY KEY
tenant_id   VARCHAR (UUID)    FOREIGN KEY → tenants.id
nome        TEXT              NOT NULL
descricao   TEXT
preco       DECIMAL(10,2)     NOT NULL
categoria   TEXT
imagem      TEXT
created_at  TIMESTAMP         DEFAULT now()
```

#### 5. **`estoque`** (Estoque Multi-Tenant)
```sql
id          VARCHAR (UUID)    PRIMARY KEY
tenant_id   VARCHAR (UUID)    FOREIGN KEY → tenants.id
produto_id  VARCHAR (UUID)    FOREIGN KEY → produtos.id
quantidade  INTEGER           DEFAULT 0
unidade     TEXT              DEFAULT 'un'
created_at  TIMESTAMP         DEFAULT now()
updated_at  TIMESTAMP         DEFAULT now()
```

---

## 🔒 Row Level Security (RLS)

### O que é RLS?

**Row Level Security** é uma funcionalidade do PostgreSQL que permite controlar quais linhas um usuário pode ver ou modificar **diretamente no banco de dados**, sem precisar adicionar filtros `WHERE` manualmente em todas as queries.

### Como Funciona?

1. **Função Helper**: `get_current_tenant_id()`
   - Extrai o `tenant_id` do contexto da sessão (JWT em produção)
   - Em desenvolvimento, usa `SET SESSION "app.current_tenant_id" = '<uuid>'`

2. **Políticas de Segurança**: Aplicadas automaticamente em cada operação (SELECT, INSERT, UPDATE, DELETE)
   - Garantem que apenas dados do tenant correto sejam acessados
   - Impossível ver/modificar dados de outros tenants

---

## 🚀 Como Aplicar o RLS

### Passo 1: Execute o Script SQL

O arquivo `server/rls-setup.sql` contém todas as políticas de segurança prontas para uso.

**Opção A - Via Interface Replit:**
1. Abra o painel de **Database** no Replit
2. Copie o conteúdo de `server/rls-setup.sql`
3. Cole e execute no console SQL

**Opção B - Via Linha de Comando:**
```bash
# Conectar ao banco e executar o script
psql $DATABASE_URL < server/rls-setup.sql
```

### Passo 2: Testar o Isolamento

```sql
-- 1. Criar um segundo tenant para teste
INSERT INTO tenants (nome, status)
VALUES ('Pizzaria Bella Napoli - Bairro Norte', 'active')
RETURNING id;

-- 2. Definir o contexto do primeiro tenant
SET SESSION "app.current_tenant_id" = '<UUID-DO-TENANT-1>';

-- 3. Criar um pedido (será automaticamente vinculado ao tenant 1)
INSERT INTO pedidos (tenant_id, status, total, itens)
VALUES (
  '<UUID-DO-TENANT-1>',
  'pendente',
  85.50,
  '[{"produto": "Pizza Margherita", "quantidade": 2}]'::jsonb
);

-- 4. Mudar para o contexto do segundo tenant
SET SESSION "app.current_tenant_id" = '<UUID-DO-TENANT-2>';

-- 5. Tentar ver pedidos (NÃO verá o pedido do tenant 1)
SELECT * FROM pedidos;
-- Resultado: 0 linhas (isolamento total!)
```

---

## 🔧 Integração com JWT (Produção)

Em produção (usando Supabase ou autenticação JWT), o `tenant_id` seria extraído automaticamente do token:

```sql
-- Atualizar a função para usar JWT
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS VARCHAR AS $$
BEGIN
  -- Extrai tenant_id do JWT
  RETURN NULLIF(
    current_setting('request.jwt.claims', true)::json->>'tenant_id',
    ''
  )::VARCHAR;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

No backend (Node.js/Express), você validaria o JWT e definiria o contexto:

```typescript
// Middleware de autenticação
app.use(async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const decoded = verifyJWT(token);
  
  // Define o tenant_id na sessão do banco
  await db.execute(sql`
    SET LOCAL app.current_tenant_id = ${decoded.tenant_id}
  `);
  
  next();
});
```

---

## 📡 API Endpoints Disponíveis

### Tenants
- `GET /api/tenants` - Listar todos os tenants
- `GET /api/tenants/:id` - Buscar tenant específico
- `POST /api/tenants` - Criar novo tenant
- `PATCH /api/tenants/:id` - Atualizar tenant

### Pedidos (Multi-tenant)
- `GET /api/pedidos?tenantId=<uuid>` - Listar pedidos do tenant
- `GET /api/pedidos/:id?tenantId=<uuid>` - Buscar pedido específico
- `POST /api/pedidos` - Criar pedido (requer `tenantId` no body)
- `PATCH /api/pedidos/:id?tenantId=<uuid>` - Atualizar pedido
- `DELETE /api/pedidos/:id?tenantId=<uuid>` - Deletar pedido

### Clientes, Produtos, Estoque
Seguem o mesmo padrão dos pedidos (requerem `tenantId` como query param).

---

## ✅ Dados de Exemplo Inseridos

Já foi criado um tenant de exemplo:

```json
{
  "id": "255f3b3a-4e2f-44de-a287-bad921bb15c1",
  "nome": "Pizzaria Bella Napoli - Centro",
  "api_key_n8n": "n8n_key_example_123",
  "status": "active"
}
```

Você pode testar as APIs usando este `tenantId`!

---

## 🧪 Testando as APIs

```bash
# 1. Criar um produto
curl -X POST http://localhost:5000/api/produtos \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "255f3b3a-4e2f-44de-a287-bad921bb15c1",
    "nome": "Pizza Margherita",
    "preco": "42.90",
    "categoria": "Tradicional"
  }'

# 2. Listar produtos do tenant
curl "http://localhost:5000/api/produtos?tenantId=255f3b3a-4e2f-44de-a287-bad921bb15c1"

# 3. Criar um pedido
curl -X POST http://localhost:5000/api/pedidos \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "255f3b3a-4e2f-44de-a287-bad921bb15c1",
    "status": "pendente",
    "total": "85.80",
    "itens": [
      {"produto": "Pizza Margherita", "quantidade": 2, "preco": 42.90}
    ]
  }'
```

---

## 🔐 Benefícios do RLS

1. **Segurança em Camadas**: Mesmo que haja um bug no código da aplicação, o banco garante o isolamento
2. **Simplicidade**: Não precisa adicionar `WHERE tenant_id = ?` em todas as queries
3. **Performance**: PostgreSQL otimiza as políticas automaticamente
4. **Compliance**: Facilita auditoria e conformidade com LGPD/GDPR

---

## 📚 Próximos Passos

1. ✅ **Aplicar o RLS**: Execute `server/rls-setup.sql`
2. 🔑 **Implementar Autenticação JWT**: Para produção
3. 🎨 **Criar Interface Admin**: Para gerenciar tenants
4. 📊 **Dashboard Multi-Tenant**: Mostrar métricas isoladas por franquia
5. 🔗 **Integração N8N**: Usar `api_key_n8n` para automações

---

**Dúvidas?** Consulte a documentação oficial do PostgreSQL sobre RLS:
https://www.postgresql.org/docs/current/ddl-rowsecurity.html
