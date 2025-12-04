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
- `pedidos` - orders with JSONB items array, scoped to tenant

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

**Deployment Considerations**:
- Environment variable `DATABASE_URL` required
- Optional `SESSION_SECRET` for production
- Build process separates client (Vite) and server (esbuild) builds
- Static file serving from `dist/public` in production