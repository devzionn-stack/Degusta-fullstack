# Documentação de Integração - Degusta Pizzas

## Sumário
1. [Visão Geral](#visão-geral)
2. [Autenticação](#autenticação)
3. [Estrutura do Backend](#estrutura-do-backend)
4. [Endpoints da API](#endpoints-da-api)
5. [Webhooks N8N](#webhooks-n8n)
6. [Agente de IA](#agente-de-ia)
7. [Exemplos de Integração](#exemplos-de-integração)

---

## Visão Geral

O sistema Degusta Pizzas é uma plataforma multi-tenant para gestão de franquias de pizzaria. Cada franquia (tenant) opera de forma isolada com seus próprios dados.

### URL Base
```
https://[seu-dominio].replit.app
```

### Formato de Dados
- Todas as requisições e respostas usam **JSON**
- Encoding: **UTF-8**
- Datas no formato: **ISO 8601** (ex: `2025-12-23T10:30:00.000Z`)

---

## Autenticação

### Autenticação por Sessão (Dashboard)
O sistema usa autenticação baseada em sessão com cookies HTTP-only.

**Login:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@exemplo.com",
  "password": "suaSenha123"
}
```

**Resposta de Sucesso:**
```json
{
  "id": "uuid-do-usuario",
  "email": "usuario@exemplo.com",
  "nome": "Nome do Usuário",
  "tenantId": "uuid-da-franquia",
  "role": "tenant_admin"
}
```

### Autenticação por API Key (Webhooks N8N)
Para integrações externas via N8N, use a chave API configurada por franquia.

**Header obrigatório:**
```http
X-API-Key: sua-api-key-aqui
```

### Autenticação por Token (Motoboys)
Para o app de motoboys, use Bearer Token.

**Header:**
```http
Authorization: Bearer token-do-motoboy
```

---

## Estrutura do Backend

### Arquitetura de Arquivos

```
server/
├── index.ts          # Ponto de entrada do servidor Express
├── routes.ts         # Definição de todas as rotas da API
├── auth.ts           # Middlewares de autenticação
├── storage.ts        # Interface de acesso ao banco de dados
├── db.ts             # Conexão com PostgreSQL
├── agente-ia.ts      # Agente conversacional de IA
├── dpt_calculator.ts # Cálculo de tempo dinâmico de preparo
├── geo_service.ts    # Serviços de geolocalização
├── despacho.ts       # Lógica de despacho de entregas
├── custo_lucro.ts    # Cálculos de custos e lucros
├── alerta_chegada.ts # Alertas de proximidade
├── n8n-requester.ts  # Envio de webhooks para N8N
└── websocket.ts      # Comunicação em tempo real

shared/
└── schema.ts         # Definição do esquema do banco de dados (Drizzle ORM)
```

### Tabelas do Banco de Dados

| Tabela | Descrição |
|--------|-----------|
| `tenants` | Franquias/empresas cadastradas |
| `users` | Usuários do sistema |
| `clientes` | Clientes das pizzarias |
| `produtos` | Cardápio de produtos |
| `pedidos` | Pedidos realizados |
| `estoque` | Controle de estoque |
| `ingredientes` | Ingredientes utilizados |
| `motoboys` | Entregadores cadastrados |
| `transacoes` | Transações financeiras |
| `feedbacks` | Avaliações de clientes |
| `alertas_frota` | Alertas do sistema |
| `previsao_estoque` | Previsões de compra (IA) |

---

## Endpoints da API

### Clientes

#### Listar Clientes
```http
GET /api/clientes
```

**Resposta:**
```json
[
  {
    "id": "uuid",
    "nome": "João Silva",
    "email": "joao@email.com",
    "telefone": "(11) 99999-9999",
    "endereco": "Rua das Flores, 123",
    "createdAt": "2025-12-23T10:00:00.000Z"
  }
]
```

#### Buscar Cliente por ID
```http
GET /api/clientes/:id
```

#### Criar Cliente
```http
POST /api/clientes
Content-Type: application/json

{
  "nome": "Maria Santos",
  "email": "maria@email.com",
  "telefone": "(11) 88888-8888",
  "endereco": "Av. Brasil, 456"
}
```

#### Atualizar Cliente
```http
PATCH /api/clientes/:id
Content-Type: application/json

{
  "telefone": "(11) 77777-7777"
}
```

#### Excluir Cliente
```http
DELETE /api/clientes/:id
```

---

### Produtos

#### Listar Produtos
```http
GET /api/produtos
```

**Resposta:**
```json
[
  {
    "id": "uuid",
    "nome": "Pizza Margherita",
    "descricao": "Molho de tomate, mussarela e manjericão",
    "preco": "45.90",
    "categoria": "Pizzas Tradicionais",
    "imagem": "https://exemplo.com/imagem.jpg",
    "tempoPreparoEstimado": 20,
    "createdAt": "2025-12-23T10:00:00.000Z"
  }
]
```

#### Criar Produto
```http
POST /api/produtos
Content-Type: application/json

{
  "nome": "Pizza Calabresa",
  "descricao": "Molho, mussarela e calabresa",
  "preco": 42.90,
  "categoria": "Pizzas Tradicionais",
  "tempoPreparoEstimado": 18
}
```

#### Atualizar Produto
```http
PATCH /api/produtos/:id
Content-Type: application/json

{
  "preco": 49.90
}
```

#### Excluir Produto
```http
DELETE /api/produtos/:id
```

---

### Pedidos

#### Listar Pedidos
```http
GET /api/pedidos
```

**Resposta:**
```json
[
  {
    "id": "uuid",
    "clienteId": "uuid-cliente",
    "status": "em_preparo",
    "total": "89.80",
    "itens": [
      {"produtoId": "uuid", "nome": "Pizza Margherita", "quantidade": 2, "preco": 44.90}
    ],
    "observacoes": "Sem cebola",
    "enderecoEntrega": "Rua das Flores, 123",
    "createdAt": "2025-12-23T10:00:00.000Z"
  }
]
```

#### Status de Pedido
Os status possíveis são:
- `pendente` - Aguardando confirmação
- `confirmado` - Pedido confirmado
- `recebido` - Recebido na cozinha
- `em_preparo` - Em preparação
- `pronto` - Pronto para entrega
- `saiu_entrega` - Saiu para entrega
- `entregue` - Entregue ao cliente
- `cancelado` - Cancelado

#### Criar Pedido
```http
POST /api/pedidos
Content-Type: application/json

{
  "clienteId": "uuid-cliente",
  "itens": [
    {"produtoId": "uuid-produto", "quantidade": 2}
  ],
  "observacoes": "Sem cebola",
  "enderecoEntrega": "Rua das Flores, 123",
  "total": 89.80
}
```

#### Atualizar Status do Pedido
```http
PATCH /api/pedidos/:id/status
Content-Type: application/json

{
  "status": "em_preparo"
}
```

#### Excluir Pedido
```http
DELETE /api/pedidos/:id
```

---

### Estoque

#### Listar Estoque
```http
GET /api/estoque
```

#### Atualizar Quantidade
```http
PATCH /api/estoque/:id
Content-Type: application/json

{
  "quantidade": 50
}
```

---

### Motoboys

#### Listar Motoboys
```http
GET /api/motoboys
```

#### Motoboys Disponíveis
```http
GET /api/motoboys/disponiveis
```

#### Criar Motoboy
```http
POST /api/motoboys
Content-Type: application/json

{
  "nome": "Carlos Souza",
  "telefone": "(11) 99999-0000",
  "placa": "ABC-1234",
  "veiculoTipo": "moto"
}
```

#### Gerar Token de Acesso
```http
POST /api/motoboys/:id/gerar-token
```

**Resposta:**
```json
{
  "token": "token-gerado-aqui",
  "message": "Token gerado com sucesso"
}
```

---

### Despacho de Entregas

#### Selecionar Motoboy Ideal
```http
POST /api/despacho/selecionar-motoboy
Content-Type: application/json

{
  "destinoLat": -23.5505,
  "destinoLng": -46.6333
}
```

#### Enviar Pedido para Entrega
```http
POST /api/despacho/enviar/:pedidoId
Content-Type: application/json

{
  "motoboyId": "uuid-motoboy"
}
```

#### Finalizar Entrega
```http
POST /api/despacho/finalizar/:pedidoId
```

---

### Geolocalização

#### Geocodificar Endereço
```http
POST /api/geo/geocodificar
Content-Type: application/json

{
  "endereco": "Rua das Flores, 123, São Paulo, SP"
}
```

**Resposta:**
```json
{
  "lat": -23.5505,
  "lng": -46.6333
}
```

#### Calcular Rota
```http
POST /api/geo/rota
Content-Type: application/json

{
  "origemLat": -23.5505,
  "origemLng": -46.6333,
  "destinoLat": -23.5489,
  "destinoLng": -46.6388
}
```

#### Calcular ETA
```http
POST /api/geo/eta
Content-Type: application/json

{
  "motoboyId": "uuid",
  "destinoLat": -23.5505,
  "destinoLng": -46.6333
}
```

---

### Atualizar Localização do Motoboy
**Endpoint público com autenticação por token**

```http
POST /api/motoboy/localizacao
Authorization: Bearer token-do-motoboy
Content-Type: application/json

{
  "lat": -23.5505,
  "lng": -46.6333
}
```

---

## Webhooks N8N

### Autenticação de Webhooks

Todos os webhooks requerem a chave API no header:
```http
X-API-Key: chave-api-da-franquia
```

A chave é configurada em `tenants.apiKeyN8n` no banco de dados.

### Webhook: Novo Pedido (Receber do N8N)

```http
POST /api/webhook/n8n/pedido
X-API-Key: sua-api-key
Content-Type: application/json

{
  "cliente": {
    "nome": "João Silva",
    "telefone": "(11) 99999-9999",
    "endereco": "Rua das Flores, 123"
  },
  "itens": [
    {"nome": "Pizza Margherita", "quantidade": 1, "preco": 45.90}
  ],
  "observacoes": "Apartamento 201",
  "total": 45.90,
  "origem": "whatsapp"
}
```

### Webhook: Atualização de Preço de Mercado

```http
POST /api/custo/mercado
X-API-Key: sua-api-key
Content-Type: application/json

{
  "idExternoEstoque": "queijo-mussarela",
  "novoPreco": 42.50,
  "fornecedor": "Laticínios Brasil"
}
```

### Webhook: Previsão de Estoque (IA)

```http
POST /api/webhook/n8n/previsao_estoque
X-API-Key: sua-api-key
Content-Type: application/json

{
  "ingrediente": "Farinha de Trigo",
  "unidade": "kg",
  "quantidadeAtual": 20,
  "quantidadeSugerida": 100,
  "horizonteDias": 7,
  "confianca": 0.85
}
```

### Webhook: Feedback Analisado (Sentiment Analysis)

```http
POST /api/webhook/n8n/feedback_analisado
X-API-Key: sua-api-key
Content-Type: application/json

{
  "pedidoId": "uuid-pedido",
  "sentimento": 4.5,
  "topicos": ["entrega_rapida", "pizza_quente"],
  "comentario": "Pizza chegou muito rápida e quentinha!"
}
```

---

## Agente de IA

O sistema possui um agente conversacional de IA integrado que pode executar ações no sistema.

### Endpoint do Agente

```http
POST /api/agente-ia/chat
Content-Type: application/json

{
  "mensagem": "Qual foi o faturamento desta semana?",
  "historico": []
}
```

**Resposta:**
```json
{
  "resposta": "O faturamento desta semana foi de R$ 12.450,00 com 156 pedidos entregues.",
  "historico": [
    {"role": "user", "content": "Qual foi o faturamento desta semana?"},
    {"role": "assistant", "content": "O faturamento desta semana foi de R$ 12.450,00..."}
  ]
}
```

### Capacidades do Agente

O agente pode:
- Consultar faturamento e vendas
- Verificar níveis de estoque
- Listar pedidos em andamento
- Verificar status de motoboys
- Atualizar estoque de ingredientes
- Fornecer análises e métricas

### Exemplos de Prompts

| Intenção | Exemplo de Prompt |
|----------|-------------------|
| Faturamento | "Qual foi o faturamento da semana?" |
| Estoque | "Quanto de mussarela temos em estoque?" |
| Estoque Baixo | "Quais ingredientes estão com estoque baixo?" |
| Motoboys | "Quais motoboys estão disponíveis?" |
| Tempo de Entrega | "Qual é o tempo médio de entrega?" |
| Pedidos | "Quantos pedidos temos em preparo?" |
| Atualizar Estoque | "Atualize o estoque de farinha para 50kg" |

---

## Exemplos de Integração

### Exemplo 1: Criar Pedido via cURL

```bash
# Login para obter sessão
curl -X POST https://seu-dominio.replit.app/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"usuario@exemplo.com","password":"senha123"}'

# Criar pedido
curl -X POST https://seu-dominio.replit.app/api/pedidos \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "clienteId": "uuid-cliente",
    "itens": [{"produtoId": "uuid-produto", "quantidade": 2}],
    "total": 89.80,
    "enderecoEntrega": "Rua das Flores, 123"
  }'
```

### Exemplo 2: Integração N8N - Receber Pedido WhatsApp

```javascript
// No N8N, configure um HTTP Request node:
{
  "method": "POST",
  "url": "https://seu-dominio.replit.app/api/webhook/n8n/pedido",
  "headers": {
    "Content-Type": "application/json",
    "X-API-Key": "{{$node.Credentials.apiKey}}"
  },
  "body": {
    "cliente": {
      "nome": "{{$node.WhatsApp.nome}}",
      "telefone": "{{$node.WhatsApp.telefone}}",
      "endereco": "{{$node.WhatsApp.endereco}}"
    },
    "itens": "{{$node.Parser.itens}}",
    "total": "{{$node.Calculadora.total}}",
    "origem": "whatsapp"
  }
}
```

### Exemplo 3: JavaScript/Node.js - Listar Produtos

```javascript
const API_URL = 'https://seu-dominio.replit.app';

async function listarProdutos(sessionCookie) {
  const response = await fetch(`${API_URL}/api/produtos`, {
    method: 'GET',
    headers: {
      'Cookie': sessionCookie
    }
  });
  
  if (!response.ok) {
    throw new Error(`Erro: ${response.status}`);
  }
  
  return response.json();
}
```

### Exemplo 4: Python - Atualizar Status do Pedido

```python
import requests

API_URL = 'https://seu-dominio.replit.app'
API_KEY = 'sua-api-key'

def atualizar_status_pedido(pedido_id, novo_status, session_cookie):
    response = requests.patch(
        f'{API_URL}/api/pedidos/{pedido_id}/status',
        json={'status': novo_status},
        cookies={'connect.sid': session_cookie}
    )
    
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f'Erro: {response.text}')

# Uso
atualizar_status_pedido('uuid-pedido', 'em_preparo', 'cookie-sessao')
```

### Exemplo 5: N8N - Workflow de Alerta de Estoque Baixo

```json
{
  "name": "Alerta Estoque Baixo",
  "nodes": [
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Buscar Estoque",
      "parameters": {
        "url": "https://seu-dominio.replit.app/api/estoque",
        "method": "GET",
        "headers": {
          "X-API-Key": "{{$credentials.apiKey}}"
        }
      }
    },
    {
      "type": "n8n-nodes-base.filter",
      "name": "Filtrar Baixo",
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{$json.quantidade}}",
              "operation": "smaller",
              "value2": 10
            }
          ]
        }
      }
    },
    {
      "type": "n8n-nodes-base.telegram",
      "name": "Enviar Alerta",
      "parameters": {
        "chatId": "{{$credentials.telegramChatId}}",
        "text": "Alerta: {{$json.nome}} está com apenas {{$json.quantidade}} unidades!"
      }
    }
  ]
}
```

---

## Agentes de IA Necessários

Para uma operação completa com automação via N8N, recomenda-se criar os seguintes agentes:

### 1. Agente de Atendimento WhatsApp
**Função:** Receber pedidos via WhatsApp e criar no sistema
**Ferramentas necessárias:**
- Parsing de mensagens
- Busca de produtos por nome
- Criação de pedidos
- Envio de confirmação

**Prompt de Sistema:**
```
Você é o assistente virtual da pizzaria Degusta. Sua função é:
1. Receber pedidos dos clientes via WhatsApp
2. Identificar os produtos solicitados
3. Confirmar endereço de entrega
4. Calcular valor total
5. Criar pedido no sistema

Seja sempre cordial e confirme os detalhes antes de finalizar.
```

### 2. Agente de Monitoramento de Estoque
**Função:** Monitorar níveis de estoque e criar alertas
**Ferramentas:**
- Consulta de estoque
- Criação de previsões
- Envio de alertas

**Prompt de Sistema:**
```
Você monitora o estoque da pizzaria. Quando um ingrediente atingir
nível crítico (abaixo de 20% do normal), crie um alerta e uma
previsão de compra. Considere o histórico de consumo para
calcular a quantidade sugerida.
```

### 3. Agente de Despacho Inteligente
**Função:** Otimizar entregas e escolher motoboys
**Ferramentas:**
- Cálculo de rotas
- Seleção de motoboy ideal
- Despacho de pedidos

**Prompt de Sistema:**
```
Você gerencia o despacho de entregas. Ao receber um pedido pronto:
1. Calcule a distância até o destino
2. Verifique motoboys disponíveis
3. Selecione o mais adequado (proximidade + carga de trabalho)
4. Despache o pedido automaticamente
```

### 4. Agente de Análise de Feedback
**Função:** Analisar feedbacks e identificar problemas
**Ferramentas:**
- Análise de sentimento
- Extração de tópicos
- Geração de relatórios

**Prompt de Sistema:**
```
Analise os feedbacks recebidos identificando:
1. Sentimento geral (1-5)
2. Tópicos mencionados (pizza, entrega, atendimento, preço)
3. Problemas recorrentes
4. Sugestões de melhoria

Responda sempre com o JSON estruturado.
```

---

## Códigos de Erro

| Código | Significado |
|--------|-------------|
| 400 | Requisição inválida (dados incorretos) |
| 401 | Não autenticado |
| 403 | Sem permissão (tenant diferente) |
| 404 | Recurso não encontrado |
| 500 | Erro interno do servidor |

---

## Suporte

Para dúvidas sobre integrações, entre em contato com a equipe de desenvolvimento.

---

*Documentação atualizada em 23 de Dezembro de 2025*
