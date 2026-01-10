# Degusta Pizzas - Multi-Tenant Pizza Franchise Management System

## Overview

Degusta Pizzas is a full-stack multi-tenant pizzeria management system designed for franchise operations. It allows multiple pizza franchises (tenants) to operate independently with complete data isolation via Row Level Security (RLS). Each franchise can manage orders, customers, products, and inventory. The system includes authentication, a dashboard for key metrics, and comprehensive CRUD operations. It features a modern TypeScript stack with React (frontend), Express (backend), and PostgreSQL. The project aims to provide a robust, scalable, and secure platform for pizza franchise management, optimizing operations, enhancing customer experience, and providing advanced analytics for business growth.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (January 2026)

### Phase 3 - CRM & Analytics
- **CRM Metrics Service** (`server/cliente_metrics_service.ts`): Customer analytics with ticket médio, frequência, custo/lucro per customer
- **Pizza Analytics Service** (`server/pizza_analytics_service.ts`): Personalized pizza trends, sales evolution, ingredient consumption
- **Analytics Dashboard** (`client/src/pages/Analytics.tsx`): Recharts visualizations for sales, popular pizzas, flavor trends

### KDS AI-Guided Preparation
- **KDS IA Service** (`server/kds_ia_service.ts`): OpenAI-powered step-by-step pizza preparation instructions
- **KDS Production TV** (`client/src/pages/KDSProducaoTV.tsx`): Real-time WebSocket updates, AI instructions panel, progress tracking

### Security Improvements
- **RLS Enabled**: Row Level Security activated on `pedidos`, `clientes`, `produtos`, `estoque` tables

## System Architecture

### Frontend Architecture

The frontend is a Single Page Application (SPA) built with React 18 and TypeScript. It uses Wouter for lightweight client-side routing, Radix UI primitives with shadcn/ui for accessible components following the "new-york" style, and Tailwind CSS v4 for styling with custom themes and typography (Lato and Playfair Display). State management utilizes TanStack Query for server state (with optimistic updates), React Context for authentication, and React Hook Form with Zod for form validation. The design emphasizes component composition, authenticated routes, and a protected, responsive dashboard.

### Backend Architecture

The backend is developed with Express.js and TypeScript. It implements session-based authentication using `express-session` with PostgreSQL persistence (`connect-pg-simple`) and Node.js native `scrypt` for password hashing. Multi-tenancy is enforced by storing the tenant ID in the user session, scoping all database operations via middleware, and leveraging PostgreSQL's Row Level Security (RLS) policies for data isolation. APIs are RESTful, grouped by resource, and utilize Zod for input validation. Centralized error handling provides consistent responses.

### Database Architecture

PostgreSQL (via Neon serverless with WebSocket support) is the chosen database, managed with Drizzle ORM for type-safe queries and migrations. The schema, defined in `shared/schema.ts`, includes core tables like `tenants`, `users`, `clientes`, `produtos`, `estoque`, `pedidos`, `historico_preparo`, `motoboys`, `transacoes`, `feedbacks`, `previsao_estoque`, and `alertas_frota`. All business-critical tables include a `tenant_id` foreign key for multi-tenancy. Row Level Security (RLS) policies are extensively used on tenant-scoped tables to ensure data isolation.

## API Reference

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User login |
| `/api/auth/register` | POST | Register new franchise |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/me` | GET | Current user info |

### Customer Metrics (CRM)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clientes/metricas/resumo` | GET | Summary: total clients, active 30d, revenue |
| `/api/clientes/metricas/ranking` | GET | Top 10 customers by spending/orders |
| `/api/clientes/metricas/:id/metricas` | GET | Detailed metrics for specific customer |

### Pizza Analytics
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analytics/resumo` | GET | Summary: peak hour, popular day, monthly growth |
| `/api/analytics/pizzas-populares` | GET | Most sold personalized pizzas |
| `/api/analytics/tendencia-diaria` | GET | Daily sales evolution |
| `/api/analytics/tendencia-sabores` | GET | Flavor trends (rising/falling/stable) |
| `/api/analytics/consumo-ingredientes` | GET | Ingredient consumption with costs |

### KDS & Pizza Diagrams
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/diagrama/fila` | GET | Production queue |
| `/api/diagrama/item/:itemId` | GET | Pizza diagram for item |
| `/api/diagrama/instrucoes/:itemId` | GET | AI-generated preparation instructions |
| `/api/diagrama/iniciar/:itemId` | POST | Start pizza production |
| `/api/diagrama/finalizar/:itemId` | POST | Complete pizza production |
| `/api/diagrama/gerar` | POST | Generate pizza diagram from flavors |

### External Integrations (WhatsApp, N8N, CrewAI)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/externo/pedido` | POST | Create order from external source |
| `/api/externo/webhook/status` | POST | Receive status updates |

## WebSocket Events

Connect to `/ws/pedidos` for real-time updates:

| Event Type | Description |
|------------|-------------|
| `connected` | Connection established |
| `pedido_update` | Order created/updated/deleted |
| `novo_pedido_kds` | New order in kitchen queue |
| `etapa_avancada_kds` | Preparation step advanced |
| `pizza_pronta_kds` | Pizza completed |

## System Design Choices

- **Dynamic Prep Time (DPT) System**: A machine learning-based system (`server/dpt_calculator.ts`) estimates and tracks pizza preparation times using historical data and queue analysis.
- **Kitchen Display System (KDS)**: Real-time KDS with WebSocket updates, sound alerts, AI-guided preparation instructions, and progress tracking.
- **AI-Guided Preparation** (`server/kds_ia_service.ts`): OpenAI integration generates step-by-step instructions for pizza assembly, optimized for multi-flavor pizzas with fractions (1/2, 1/3, 1/4).
- **Geo Fleet Management System**: Services integrate with Google Maps API for geocoding, routing, ETA calculation, and geofencing.
- **Intelligent Stock and Cost Management System**: Tracks real-time market prices, historical costs, and performs profit analysis.
- **Proactive Customer Communication System**: Automated customer alerts for delivery, integrated with N8N for WhatsApp messaging.

## External Dependencies

- **Runtime**: Node.js (ES Modules), `ws` for WebSocket support (Neon DB).
- **Build Tools**: Vite (frontend), esbuild (server), TypeScript compiler, ESLint, Prettier.
- **UI Libraries**: Radix UI (`@radix-ui/*`), Lucide React (icons), class-variance-authority (CVA), tailwind-merge, clsx.
- **Validation & Forms**: Zod, React Hook Form, `@hookform/resolvers`.
- **Database**: `@neondatabase/serverless` (PostgreSQL), drizzle-orm, drizzle-kit, connect-pg-simple.
- **AI Integration**: OpenAI via Replit AI Integrations (gpt-4o-mini for KDS, gpt-5 for agent).
- **Session Management**: express-session.
- **External Service Integrations**: N8N workflow automation (tenant-specific API keys), Google Maps API (optional for Geo services).

## Known Issues

- **Vite HMR WebSocket**: Hot Module Replacement WebSocket may fail in Replit environment. This is a development-only issue and does not affect application functionality.

## Integration Guide

### Creating Orders via API (WhatsApp/N8N)

```json
POST /api/externo/pedido
Headers: {
  "X-Api-Key": "<tenant-api-key>",
  "Content-Type": "application/json"
}
Body: {
  "cliente": {
    "nome": "João Silva",
    "telefone": "11999999999"
  },
  "itens": [
    {
      "tipo": "pizza",
      "sabores": [
        { "pizza_id": "<produto-uuid>", "fracao": 0.5 },
        { "pizza_id": "<produto-uuid>", "fracao": 0.5 }
      ],
      "quantidade": 1
    }
  ],
  "tipo_entrega": "delivery",
  "endereco": "Rua Exemplo, 123"
}
```

### Receiving AI Instructions

```json
GET /api/diagrama/instrucoes/:itemId
Response: {
  "titulo": "Calabresa + Mussarela",
  "passos": [
    { "numero": 1, "instrucao": "Abra a massa...", "tempo": 30 },
    { "numero": 2, "instrucao": "Espalhe o molho...", "tempo": 20 }
  ],
  "tempoEstimado": 180,
  "dicasGerais": ["Mantenha ingredientes frescos..."]
}
```

### WebSocket Connection

```javascript
const ws = new WebSocket('wss://your-domain/ws/pedidos');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'novo_pedido_kds') {
    // Refresh kitchen queue
  }
};
```
