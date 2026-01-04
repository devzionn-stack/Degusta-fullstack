# Sistema KDS (Kitchen Display System) - Degusta Pizzas

## 📋 Visão Geral

Sistema completo de gerenciamento de cozinha com display para TV, guia de preparo com IA, alertas sonoros e integração WhatsApp via N8N.

---

## 🎯 Funcionalidades Principais

### 1. Tela KDS para TV/Monitor
- Layout em grid otimizado para leitura à distância
- 4 colunas de status: **Recebido → Em Preparo → No Forno → Pronto**
- Cards grandes com cores por estado
- Atualização em tempo real via WebSocket
- Modo kiosk/fullscreen automático

### 2. IA Guiando Preparo
- Instruções passo a passo geradas por OpenAI
- Etapas cronometradas com timing preciso
- Progresso visual em tempo real
- Botões para avançar etapas

### 3. Sistema de Alertas
- Alerta sonoro ao receber pedido
- Alerta ao concluir etapa
- Alerta de pizza pronta
- Alerta de atraso (timing acima do esperado)

### 4. Webhooks Automáticos
- Gatilhos configuráveis por tipo de evento
- Integração N8N para WhatsApp
- Templates de mensagem com variáveis dinâmicas
- Histórico completo de envios

### 5. Machine Learning Ready
- Registro de tempo estimado vs real
- Histórico detalhado por etapa
- Dados preparados para otimização futura
- Dashboard de performance

---

## 🗄️ Estrutura do Banco de Dados

### Tabelas KDS

#### `produtos` (expandida)
Campos adicionados:
- `etapasKDS` (JSONB) - Array de etapas padrão da pizza
- `ingredientesTexto` (TEXT) - Lista de ingredientes em texto
- `tipoPizza` (TEXT) - salgada, doce, especial

```typescript
{
  "etapasKDS": [
    {
      "nome": "Abrir massa",
      "tempoSegundos": 180,
      "instrucoes": "Esticar a massa uniformemente até 35cm"
    },
    {
      "nome": "Molho",
      "tempoSegundos": 60,
      "instrucoes": "Espalhar 120ml de molho de tomate"
    },
    {
      "nome": "Ingredientes",
      "tempoSegundos": 120,
      "instrucoes": "Adicionar mussarela, atum e cebola"
    },
    {
      "nome": "Forno",
      "tempoSegundos": 480,
      "instrucoes": "Assar a 280°C por 8 minutos"
    },
    {
      "nome": "Finalização",
      "tempoSegundos": 60,
      "instrucoes": "Cortar em 8 fatias e embalar"
    }
  ]
}
```

#### `progresso_kds`
Controla o progresso em tempo real de cada pizza no pedido.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | VARCHAR | UUID |
| tenantId | VARCHAR | FK para tenant |
| pedidoId | VARCHAR | FK para pedido |
| produtoId | VARCHAR | FK para produto (opcional) |
| produtoNome | TEXT | Nome da pizza |
| etapaAtual | INTEGER | Índice da etapa atual (0-based) |
| totalEtapas | INTEGER | Total de etapas |
| etapas | JSONB | Array completo de etapas com timing |
| statusKDS | TEXT | aguardando, preparando, concluido |
| iniciadoEm | TIMESTAMP | Quando começou o preparo |
| concluidoEm | TIMESTAMP | Quando terminou |

**Exemplo de `etapas` JSONB:**
```json
[
  {
    "nome": "Abrir massa",
    "tempoSegundos": 180,
    "instrucoes": "Esticar uniformemente",
    "iniciadoEm": "2025-12-23T10:00:00Z",
    "concluidoEm": "2025-12-23T10:03:15Z",
    "tempoReal": 195
  },
  {
    "nome": "Molho",
    "tempoSegundos": 60,
    "instrucoes": "Espalhar 120ml",
    "iniciadoEm": null,
    "concluidoEm": null,
    "tempoReal": null
  }
]
```

#### `historico_timing_kds`
Registro histórico para ML/Analytics.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | VARCHAR | UUID |
| tenantId | VARCHAR | FK para tenant |
| pedidoId | VARCHAR | FK para pedido |
| produtoId | VARCHAR | FK para produto |
| produtoNome | TEXT | Nome da pizza |
| etapaNome | TEXT | Nome da etapa |
| tempoEstimado | INTEGER | Tempo estimado (segundos) |
| tempoReal | INTEGER | Tempo real gasto |
| desvio | INTEGER | Diferença (real - estimado) |
| iniciadoEm | TIMESTAMP | Início da etapa |
| concluidoEm | TIMESTAMP | Fim da etapa |

#### `config_alertas_kds`
Configuração de gatilhos automáticos.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | VARCHAR | UUID |
| tenantId | VARCHAR | FK para tenant |
| tipoEvento | TEXT | pedido_recebido, etapa_concluida, pizza_pronta, atraso |
| webhookUrl | TEXT | URL do webhook N8N |
| templateMensagem | TEXT | Template com variáveis |
| ativo | BOOLEAN | Se está ativo |
| enviarWhatsApp | BOOLEAN | Enviar via WhatsApp |
| enviarWebhook | BOOLEAN | Enviar via webhook |

**Variáveis Disponíveis:**
- `{{cliente_nome}}`
- `{{cliente_telefone}}`
- `{{pizza_nome}}`
- `{{status}}`
- `{{etapa_atual}}`
- `{{tempo_estimado}}`
- `{{tempo_real}}`

**Exemplo de Template:**
```
🍕 Olá {{cliente_nome}}! Sua pizza {{pizza_nome}} acabou de sair do forno e está pronta para entrega!
```

#### `alertas_kds_enviados`
Log de todos os alertas enviados.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | VARCHAR | UUID |
| tenantId | VARCHAR | FK para tenant |
| configAlertaId | VARCHAR | FK para config |
| pedidoId | VARCHAR | FK para pedido |
| tipoEvento | TEXT | Tipo do evento |
| mensagem | TEXT | Mensagem enviada |
| destinatario | TEXT | Telefone/email |
| statusEnvio | TEXT | pendente, enviado, erro |
| respostaWebhook | JSONB | Resposta do webhook |
| erro | TEXT | Mensagem de erro se falhou |

---

## 🔄 Fluxo Completo do Sistema

### 1. Pedido Recebido
```
Pedido criado
  ↓
Sistema cria registros em progresso_kds para cada pizza
  ↓
IA gera etapas personalizadas baseadas no produto
  ↓
WebSocket notifica tela KDS
  ↓
Alerta sonoro disparado
  ↓
Webhook "pedido_recebido" enviado (opcional)
```

### 2. Cozinha Inicia Preparo
```
Pizzaiolo clica "Iniciar" no card
  ↓
Sistema registra timestamp de início
  ↓
Etapa 0 (Abrir massa) marcada como iniciada
  ↓
Timer em tempo real começa a contar
  ↓
Webhook "preparo_iniciado" disparado
```

### 3. Avançar Etapa
```
Pizzaiolo clica "Etapa Concluída"
  ↓
Sistema registra timestamp de conclusão
  ↓
Calcula tempo real vs estimado
  ↓
Salva em historico_timing_kds
  ↓
Avança para próxima etapa
  ↓
Alerta sonoro de etapa concluída
  ↓
WebSocket atualiza tela
```

### 4. Pizza Pronta
```
Última etapa concluída
  ↓
Status do progresso_kds vira "concluido"
  ↓
Status do pedido atualizado
  ↓
Alerta sonoro "Pizza Pronta"
  ↓
Webhook "pizza_pronta" disparado
  ↓
WhatsApp enviado ao cliente (se configurado)
```

---

## 🎨 Layout da Tela KDS

### Grid de 4 Colunas

```
┌────────────┬────────────┬────────────┬────────────┐
│  RECEBIDO  │ EM PREPARO │  NO FORNO  │   PRONTO   │
├────────────┼────────────┼────────────┼────────────┤
│            │            │            │            │
│  ┌──────┐  │  ┌──────┐  │  ┌──────┐  │  ┌──────┐  │
│  │Ped #1│  │  │Ped #3│  │  │Ped #5│  │  │Ped #8│  │
│  │      │  │  │░░░░░░│  │  │██████│  │  │✓✓✓✓✓✓│  │
│  │2 pizzas│  │3 pizzas│  │1 pizza │  │2 pizzas│  │
│  └──────┘  │  └──────┘  │  └──────┘  │  └──────┘  │
│            │            │            │            │
│  ┌──────┐  │  ┌──────┐  │            │  ┌──────┐  │
│  │Ped #2│  │  │Ped #4│  │            │  │Ped #9│  │
│  │1 pizza │  │2 pizzas│  │            │1 pizza │  │
│  └──────┘  │  └──────┘  │            │  └──────┘  │
│            │            │            │            │
└────────────┴────────────┴────────────┴────────────┘
```

### Card de Pedido

```
┌─────────────────────────────────┐
│ 🍕 PEDIDO #0042                 │
│ ────────────────────────────    │
│                                 │
│ 📦 2 pizzas                     │
│ 👤 João Silva                   │
│ 🕐 10:35                        │
│                                 │
│ ┌─ Pizza Margherita ──────────┐│
│ │ ███████░░░ 70% (3/5 etapas) ││
│ │                             ││
│ │ ▶ Etapa Atual: No Forno     ││
│ │ ⏱️ 3:45 / 8:00              ││
│ │                             ││
│ │ 💡 Assar a 280°C            ││
│ │                             ││
│ │ [✓ Concluir Etapa]          ││
│ └─────────────────────────────┘│
│                                 │
│ ┌─ Pizza Calabresa ───────────┐│
│ │ ░░░░░░░░░░ 0% (0/5 etapas)  ││
│ │ ⏸️ Aguardando...            ││
│ └─────────────────────────────┘│
│                                 │
└─────────────────────────────────┘
```

---

## 🔊 Sistema de Alertas Sonoros

### Eventos com Som

| Evento | Som | Frequência |
|--------|-----|------------|
| Pedido Novo | 3 bips curtos | Uma vez |
| Etapa Concluída | 1 bip | Cada etapa |
| Pizza Pronta | 2 bips longos | Ao finalizar |
| Atraso | Bip contínuo | A cada 30s até ação |

### Implementação

```javascript
const sounds = {
  novoPedido: new Audio('/sounds/novo-pedido.mp3'),
  etapaConcluida: new Audio('/sounds/etapa.mp3'),
  pizzaPronta: new Audio('/sounds/pronta.mp3'),
  atraso: new Audio('/sounds/atraso.mp3'),
};

function tocarAlerta(tipo) {
  sounds[tipo].play();
}
```

---

## 📡 APIs do KDS

### Listar Pedidos Ativos
```http
GET /api/kds/pedidos-ativos
```

**Resposta:**
```json
[
  {
    "pedidoId": "uuid",
    "numeroPedido": 42,
    "clienteNome": "João Silva",
    "horarioPedido": "2025-12-23T10:35:00Z",
    "pizzas": [
      {
        "progressoId": "uuid",
        "produtoNome": "Pizza Margherita",
        "etapaAtual": 3,
        "totalEtapas": 5,
        "statusKDS": "preparando",
        "tempoDecorrido": 225,
        "tempoEstimadoTotal": 900,
        "etapas": [...]
      }
    ]
  }
]
```

### Iniciar Preparo de Pizza
```http
POST /api/kds/iniciar-preparo/:progressoId
```

**Resposta:**
```json
{
  "progressoId": "uuid",
  "etapaAtual": 0,
  "statusKDS": "preparando",
  "iniciadoEm": "2025-12-23T10:40:00Z"
}
```

### Avançar Etapa
```http
POST /api/kds/avancar-etapa/:progressoId
```

**Resposta:**
```json
{
  "progressoId": "uuid",
  "etapaAnterior": 2,
  "etapaAtual": 3,
  "tempoReal": 125,
  "tempoEstimado": 120,
  "desvio": 5,
  "proximaEtapa": {
    "nome": "Forno",
    "tempoSegundos": 480,
    "instrucoes": "Assar a 280°C por 8 minutos"
  }
}
```

### Finalizar Pizza
```http
POST /api/kds/finalizar-pizza/:progressoId
```

**Resposta:**
```json
{
  "progressoId": "uuid",
  "statusKDS": "concluido",
  "concluidoEm": "2025-12-23T10:55:00Z",
  "tempoTotalReal": 900,
  "tempoTotalEstimado": 900,
  "eficiencia": 100
}
```

### Gerar Etapas com IA
```http
POST /api/kds/gerar-etapas
Content-Type: application/json

{
  "produtoId": "uuid",
  "produtoNome": "Pizza Margherita",
  "ingredientes": "molho, mussarela, manjericão"
}
```

**Resposta:**
```json
{
  "etapas": [
    {
      "nome": "Abrir massa",
      "tempoSegundos": 180,
      "instrucoes": "Esticar a massa até 35cm de diâmetro"
    },
    ...
  ]
}
```

---

## 🤖 Integração IA (OpenAI)

### Prompt para Gerar Etapas

```
Você é especialista em operações de pizzaria.

Gere as etapas detalhadas de preparo para a pizza: {nome}
Ingredientes: {ingredientes}

Retorne JSON com 5 etapas obrigatórias:
1. Abrir massa (tempo estimado em segundos)
2. Molho (tempo estimado)
3. Ingredientes (tempo estimado)
4. Forno (tempo estimado - considere tipo de forno e espessura)
5. Finalização (tempo estimado)

Cada etapa deve ter:
- nome (string)
- tempoSegundos (number)
- instrucoes (string clara e objetiva)

Formato JSON:
{
  "etapas": [
    {"nome": "...", "tempoSegundos": ..., "instrucoes": "..."}
  ]
}
```

---

## 🔗 Integração N8N/WhatsApp

### Configurar Webhook

1. No painel admin, ir em "Configurações KDS"
2. Adicionar novo alerta:
   - **Tipo:** pizza_pronta
   - **Webhook URL:** https://seu-n8n.app/webhook/pizza-pronta
   - **Template:** `🍕 Olá {{cliente_nome}}! Sua pizza {{pizza_nome}} está pronta!`
   - **Enviar WhatsApp:** ✅

### Exemplo de Workflow N8N

```json
{
  "nodes": [
    {
      "type": "n8n-nodes-base.webhook",
      "name": "Receber Pizza Pronta",
      "webhookId": "pizza-pronta",
      "httpMethod": "POST"
    },
    {
      "type": "n8n-nodes-base.function",
      "name": "Processar Dados",
      "functionCode": "return items.map(item => ({
        json: {
          telefone: item.json.cliente_telefone,
          mensagem: item.json.mensagem
        }
      }));"
    },
    {
      "type": "n8n-nodes-base.zapi",
      "name": "Enviar WhatsApp",
      "parameters": {
        "phone": "={{$json.telefone}}",
        "message": "={{$json.mensagem}}"
      }
    }
  ]
}
```

---

## 📊 Dashboard de Performance

### Métricas Calculadas

1. **Tempo Médio por Etapa**
   - Calculado a partir de `historico_timing_kds`
   - Agrupado por produto

2. **Taxa de Atraso**
   - % de etapas com desvio > 20%
   - Por período (dia/semana/mês)

3. **Gargalos Identificados**
   - Etapas com maior desvio médio
   - Horários de pico

4. **Eficiência da Cozinha**
   - Média geral: tempo_real / tempo_estimado
   - Por pizzaiolo (futuro)

---

## 🖥️ Rodar na TV

### Opção 1: Raspberry Pi (Recomendado)

**Hardware:**
- Raspberry Pi 4 (4GB RAM)
- Cartão SD 32GB
- Cabo HDMI
- Mouse + Teclado (só setup inicial)

**Setup:**
1. Instalar Raspberry Pi OS
2. Instalar Chromium
3. Configurar auto-start em kiosk mode:

```bash
# /home/pi/.config/lxsession/LXDE-pi/autostart
@chromium-browser --kiosk --incognito https://seu-dominio.replit.app/kds
```

### Opção 2: Mini PC / Notebook

**Configuração Windows:**
1. Instalar Chrome
2. Criar atalho com flags:
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --incognito https://seu-dominio.replit.app/kds
```
3. Adicionar ao startup do Windows

**Configuração Linux:**
```bash
# ~/.config/autostart/kds.desktop
[Desktop Entry]
Type=Application
Name=KDS
Exec=chromium-browser --kiosk https://seu-dominio.replit.app/kds
```

### Opção 3: Stick HDMI (Budget)

**Chromebit ou similar:**
1. Conectar stick HDMI na TV
2. Abrir Chrome
3. Acessar URL do KDS
4. Pressionar F11 (fullscreen)

---

## 📦 Cardápio Completo (100 Pizzas)

O sistema já vem com todas as 100 pizzas cadastradas:

### Categorias

1. **Peixes** (11 pizzas)
   - Atum, Atum Cheese, Atum Cebola, Atum Muss, Atum UVA (doce), Espanhola, Parma, Romana, Camarão, Bacalhau, Alliche

2. **Calabresa** (10 pizzas)
   - Calabresa, Baiana, Creta, Calabria, Di-A-Dia, Pantanal, Calabresa Light, Pepperone, Toscana, Paulista

3. **Lombo** (5 pizzas)
   - Canadense, Cancun, Italiana, Palestra, Paris

4. **Presunto** (10 pizzas)
   - Portuguesa, Portuga, Aurora, Amazon, Moda da Casa, Veneza, Cubana, Grega, Primavera, Baúru

5. **Frango** (7 pizzas)
   - Frango com Catupiry, Framily, Frangobom, Frango, Frangote, Moda Caipira, Frango Roquefão

6. **Peito de Peru** (4 pizzas)
   - Peru, Cariú, Peruana, Florense

7. **Legumes** (4 pizzas)
   - Abobrinha, Abobrinha Bacon, Berinjela, Beijim

8. **Queijos** (14 pizzas)
   - Mussarela, Marguerita, Napolitana, Dois Queijos, Quatro Queijos, Cinco Queijos, Catupiry, Catupiry Bacon, Catupiry Milho, Siciliana, Espiga, Mussarela de Búfala, Francesa, Bacon

9. **Variadas** (27 pizzas)
   - Alho, Carne Seca, Fiorentina, Indiana, Inglesa, Japonesa, Mineira, etc.

10. **Doces** (7 pizzas)
    - Sensação, Romeu e Julieta, Brigadeiro, Chocolate, Banana Mussarela, Banana Chocolate, Banocolate

---

## 🚀 Próximos Passos

1. ✅ Schema do banco criado
2. ⏳ Popular 100 pizzas com etapas IA
3. ⏳ Criar APIs do KDS
4. ⏳ WebSocket em tempo real
5. ⏳ Interface KDS para TV
6. ⏳ Sistema de alertas sonoros
7. ⏳ Webhooks automáticos
8. ⏳ Dashboard de performance

---

*Documentação técnica do Sistema KDS - Degusta Pizzas*
*Atualizado em 23 de Dezembro de 2025*
