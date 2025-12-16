# Bella Napoli Pizzeria - Multi-Tenant Pizza Management System

## Overview

This is a full-stack multi-tenant pizzeria management system designed for franchise operations. The application enables multiple pizza franchises (tenants) to operate independently within a single system, with complete data isolation through Row Level Security (RLS). Each franchise can manage their own orders, customers, products, and inventory while maintaining strict data boundaries.

The system provides authentication, a dashboard for monitoring key metrics, and comprehensive CRUD operations for managing pizzeria operations. It's built with a modern TypeScript stack featuring React on the frontend and Express on the backend, with PostgreSQL handling data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript in SPA (Single Page Application) mode

**Routing**: Wouter - lightweight client-side routing without full framework overhead

**UI Components**: Radix UI primitives with shadcn/ui component library providing accessible, pre-styled components following the "new-york" style variant

**Styling**: 
- Tailwind CSS v4 with custom CSS variables for theming
- Custom design tokens for colors, spacing, and shadows
- Two typography families: Lato (sans-serif) and Playfair Display (serif) for branding

**State Management**:
- TanStack Query (React Query) for server state management with optimistic updates
- React Context for authentication state
- Form state handled by React Hook Form with Zod resolvers for validation

**Design Pattern**: Component composition with clear separation between layout components (`Layout`, `DashboardLayout`) and page components

**Key Features**:
- Authenticated routes with automatic redirect to login
- Protected dashboard requiring both authentication and tenant association
- Responsive design with mobile breakpoint at 768px

### Backend Architecture

**Framework**: Express.js with TypeScript

**Authentication Strategy**:
- Session-based authentication using express-session
- Sessions persisted to PostgreSQL via connect-pg-simple
- Password hashing with Node.js native scrypt (no external bcrypt dependency)
- Session cookies with httpOnly, secure in production, 7-day expiration

**Multi-Tenancy Implementation**:
- Tenant ID stored in user session after authentication
- Every database operation scoped by tenant ID through middleware
- Row Level Security (RLS) policies enforce data isolation at database level
- Tenant context propagated through PostgreSQL session variables

**API Design**:
- RESTful endpoints grouped by resource (tenants, pedidos, clientes, produtos, estoque)
- Middleware chain: session → user loading → tenant validation → route handler
- Input validation using Zod schemas with detailed error messages via zod-validation-error

**Error Handling**: Centralized error responses with appropriate HTTP status codes (400 for validation, 401 for auth, 404 for not found)

### Database Architecture

**Database**: PostgreSQL (via Neon serverless with WebSocket support)

**ORM**: Drizzle ORM
- Type-safe query builder
- Schema defined in `shared/schema.ts` for sharing between client and server
- Migrations managed through drizzle-kit

**Schema Design**:

Core tables with UUID primary keys:
- `tenants` - franchise/company records with optional N8N API key integration
- `users` - user accounts with email/password auth, linked to tenant (nullable for admin users)
- `clientes` - customer records scoped to tenant
- `produtos` - product/menu items scoped to tenant  
- `estoque` - inventory tracking linked to products and tenants
- `pedidos` - orders with JSONB items array, DPT tracking fields (tempo_preparo_estimado_min, horario_inicio_preparo, horario_fim_preparo_estimado), scoped to tenant
- `historico_preparo` - tracks actual vs estimated prep times for DPT ML optimization
- `motoboys` - delivery drivers with status and real-time location tracking
- `transacoes` - financial transactions with payment methods and status
- `feedbacks` - customer feedback with sentiment analysis (1-5 scale) and topic tags (JSONB array)
- `previsao_estoque` - AI-generated purchase predictions with confidence levels and approval status
- `alertas_frota` - global alerts system with severity levels (info/warn/critical) and read status

**Multi-Tenancy Pattern**: All business tables (clientes, produtos, estoque, pedidos) include a `tenant_id` foreign key with cascade delete

**Row Level Security (RLS)**:
- Helper function `get_current_tenant_id()` extracts tenant from session context
- SELECT, INSERT, UPDATE, DELETE policies on all tenant-scoped tables
- Policies filter rows to match current tenant automatically
- RLS setup script located at `server/rls-setup.sql` (requires manual execution)

**Data Isolation Guarantee**: Database-level enforcement ensures tenant data cannot leak even if application code has bugs

### External Dependencies

**Core Runtime**:
- Node.js with ES Modules
- WebSocket support via `ws` package for Neon database connection

**Build Tools**:
- Vite for frontend development and production builds
- esbuild for server bundling (reduces cold start time by bundling allowlisted dependencies)
- TypeScript compiler for type checking

**UI Libraries**:
- Radix UI collection (@radix-ui/*) - 20+ accessible component primitives
- Lucide React for icons
- class-variance-authority (CVA) for component variant management
- tailwind-merge and clsx for className composition

**Validation & Forms**:
- Zod for runtime type validation and schema definition
- React Hook Form for form state management
- @hookform/resolvers for integrating Zod with React Hook Form

**Development Tools**:
- ESLint with TypeScript and React plugins
- Prettier for code formatting
- Replit-specific plugins (@replit/vite-plugin-*) for development experience

**Database Stack**:
- @neondatabase/serverless for PostgreSQL connection with WebSocket support
- drizzle-orm and drizzle-kit for ORM and migrations
- connect-pg-simple for PostgreSQL session store

**Session Management**: 
- express-session with PostgreSQL-backed session store
- Automatic session table creation if missing
- Session secret from environment variable (falls back to random for development)

**External Service Integrations**:
- N8N workflow automation (API key stored per tenant for webhook/automation integration)
- Optional: OpenGraph image meta tags dynamically updated for deployment URLs

### Dynamic Prep Time (DPT) System

**Service**: `server/dpt_calculator.ts` - ML-based preparation time estimation

**Key Features**:
- Calculates dynamic prep times using historical data and queue analysis
- Considers product base prep times, queue length factor, and historical accuracy
- Real-time monitoring of all active orders with progress tracking
- Priority-based order sorting for optimal kitchen workflow

**API Endpoints** (all protected with requireAuth + requireTenant):
- `GET /api/dpt/realtime` - Real-time DPT info for all active orders
- `POST /api/dpt/calcular` - Manual DPT calculation for items
- `POST /api/dpt/iniciar-preparo/:pedidoId` - Start prep time tracking
- `POST /api/dpt/finalizar-preparo/:pedidoId` - Record actual prep time for ML optimization

**Kitchen Display System (KDS)** - `client/src/pages/Cozinha.tsx`:
- Real-time WebSocket updates with sound alerts for new orders
- Progress bars showing elapsed vs estimated prep time
- Color-coded urgency indicators (green/yellow/red)
- Priority-based order sorting using DPT data
- DPT stats display in header (average progress, delayed orders count)

**Status Coverage**: Includes 'recebido', 'em_preparo', 'pendente', 'confirmado' for complete order tracking

### Geo Fleet Management System

**Services**: 
- `server/geo_service.ts` - Geocoding, routing, ETA calculation, geofencing
- `server/despacho.ts` - Motoboy dispatch with optimal selection
- `server/eta_cron.ts` - ETA recalculation cron job (every 5 minutes)

**Key Features**:
- Google Maps API integration (geocoding, directions, distance matrix) with fallback to Haversine
- Motoboy selection based on distance + workload scoring
- Token-based authentication for motoboy mobile app
- Real-time ETA calculation with traffic awareness
- Automatic geofencing alerts when motoboy deviates from route
- N8N webhook integration for ETA change notifications (> 2 min threshold)

**API Endpoints**:
- `POST /api/motoboy/localizacao` - Public endpoint with Bearer token auth for motoboy app
- `POST /api/motoboys/:id/gerar-token` - Generate access token for motoboy (protected)
- `POST /api/geo/geocodificar` - Address to coordinates (protected)
- `POST /api/geo/rota` - Calculate route between two points (protected)
- `POST /api/geo/eta` - Calculate ETA between motoboy and destination (protected)
- `POST /api/despacho/selecionar-motoboy` - Find optimal motoboy (protected)
- `POST /api/despacho/enviar/:pedidoId` - Dispatch order to motoboy (protected)
- `POST /api/despacho/finalizar/:pedidoId` - Complete delivery (protected)

**ETA Cron Job**: Runs every 5 minutes to:
- Recalculate ETA for all orders in transit
- Detect motoboys off-route (geofencing) and create alerts
- Notify N8N when ETA changes by more than 2 minutes

**Environment Variables**:
- `GOOGLE_MAPS_API_KEY` - Optional, enables real Google Maps API calls

**Deployment Considerations**:
- Environment variable `DATABASE_URL` required
- Optional `SESSION_SECRET` for production
- Build process separates client (Vite) and server (esbuild) builds
- Static file serving from `dist/public` in production

### Intelligent Stock and Cost Management System

**Service**: `server/custo_lucro.ts` - Real-time cost tracking and profit analysis

**Database Schema**:
- `custo_mercado` - Historical market price tracking with supplier info and timestamps
- `ingredientes.idExternoEstoque` - External ID for N8N integration
- `estoque.ingredienteId` - Links stock entries to ingredients for cost calculations

**Key Features**:
- Real-time market price updates via authenticated N8N webhooks
- Historical cost tracking for accurate profit analysis
- Order-date-based cost calculations (not current prices)
- Franchise, product, and ingredient profitability analytics

**API Endpoints**:
- `POST /api/custo/mercado` - Market price webhook (N8N authenticated with tenant validation)
- `GET /api/custo/produto/:produtoId` - Product cost breakdown with recipes
- `GET /api/lucro/franquia` - Franchise profit summary with KPIs
- `GET /api/custos/produtos` - All products cost analysis
- `GET /api/lucro/ingredientes` - Ingredient profitability with historical pricing
- `GET /api/custo/historico/:ingredienteId` - Price history for an ingredient

**Security Features**:
- `validateN8nWebhook` middleware for webhook authentication
- Tenant ownership validation before price updates
- Cross-tenant data tampering prevention at database level

**Historical Pricing Logic**:
- `getCustoIngredienteNaData(ingredienteId, date)` - Gets price at specific date
- Falls back to `ingrediente.custoUnitario` when no historical data exists
- Ensures closed orders retain accurate costs even after price changes

**Dashboard**: `client/src/pages/Custos.tsx`
- Profit KPIs (revenue, costs, gross profit, margin)
- Products tab with cost breakdown and margin analysis
- Ingredients tab with usage and historical cost tracking
- Summary tab with financial overview