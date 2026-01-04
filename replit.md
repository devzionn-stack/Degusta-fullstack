# Degusta Pizzas - Multi-Tenant Pizza Franchise Management System

## Overview

Degusta Pizzas is a full-stack multi-tenant pizzeria management system designed for franchise operations. It allows multiple pizza franchises (tenants) to operate independently with complete data isolation via Row Level Security (RLS). Each franchise can manage orders, customers, products, and inventory. The system includes authentication, a dashboard for key metrics, and comprehensive CRUD operations. It features a modern TypeScript stack with React (frontend), Express (backend), and PostgreSQL. The project aims to provide a robust, scalable, and secure platform for pizza franchise management, optimizing operations, enhancing customer experience, and providing advanced analytics for business growth.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is a Single Page Application (SPA) built with React 18 and TypeScript. It uses Wouter for lightweight client-side routing, Radix UI primitives with shadcn/ui for accessible components following the "new-york" style, and Tailwind CSS v4 for styling with custom themes and typography (Lato and Playfair Display). State management utilizes TanStack Query for server state (with optimistic updates), React Context for authentication, and React Hook Form with Zod for form validation. The design emphasizes component composition, authenticated routes, and a protected, responsive dashboard.

### Backend Architecture

The backend is developed with Express.js and TypeScript. It implements session-based authentication using `express-session` with PostgreSQL persistence (`connect-pg-simple`) and Node.js native `scrypt` for password hashing. Multi-tenancy is enforced by storing the tenant ID in the user session, scoping all database operations via middleware, and leveraging PostgreSQL's Row Level Security (RLS) policies for data isolation. APIs are RESTful, grouped by resource, and utilize Zod for input validation. Centralized error handling provides consistent responses.

### Database Architecture

PostgreSQL (via Neon serverless with WebSocket support) is the chosen database, managed with Drizzle ORM for type-safe queries and migrations. The schema, defined in `shared/schema.ts`, includes core tables like `tenants`, `users`, `clientes`, `produtos`, `estoque`, `pedidos`, `historico_preparo`, `motoboys`, `transacoes`, `feedbacks`, `previsao_estoque`, and `alertas_frota`. All business-critical tables include a `tenant_id` foreign key for multi-tenancy. Row Level Security (RLS) policies are extensively used on tenant-scoped tables to ensure data isolation, automatically filtering rows based on the current tenant's session context.

### System Design Choices

- **Dynamic Prep Time (DPT) System**: A machine learning-based system (`server/dpt_calculator.ts`) estimates and tracks pizza preparation times using historical data and queue analysis. It includes real-time monitoring and priority-based sorting for kitchen workflow optimization.
- **Kitchen Display System (KDS)**: The `client/src/pages/Cozinha.tsx` page provides a real-time KDS with WebSocket updates, sound alerts for new orders, progress bars, and urgency indicators, integrated with the DPT system.
- **Geo Fleet Management System**: Services (`server/geo_service.ts`, `server/despacho.ts`, `server/eta_cron.ts`) integrate with Google Maps API for geocoding, routing, ETA calculation, and geofencing. It manages motoboy dispatch, real-time ETA tracking, and provides alerts for deviations.
- **Intelligent Stock and Cost Management System**: The `server/custo_lucro.ts` service tracks real-time market prices, historical costs, and performs profit analysis across franchises, products, and ingredients. It supports N8N webhooks for price updates.
- **Proactive Customer Communication System**: The `server/alerta_chegada.ts` service manages automated customer alerts for delivery, including ETA-10 minute notifications and 50-meter geofence "pizza arriving" alerts, integrated with N8N for WhatsApp messaging.

## External Dependencies

- **Runtime**: Node.js (ES Modules), `ws` for WebSocket support (Neon DB).
- **Build Tools**: Vite (frontend), esbuild (server), TypeScript compiler, ESLint, Prettier.
- **UI Libraries**: Radix UI (`@radix-ui/*`), Lucide React (icons), class-variance-authority (CVA), tailwind-merge, clsx.
- **Validation & Forms**: Zod, React Hook Form, `@hookform/resolvers`.
- **Database**: `@neondatabase/serverless` (PostgreSQL), drizzle-orm, drizzle-kit, connect-pg-simple.
- **Session Management**: express-session.
- **External Service Integrations**: N8N workflow automation (tenant-specific API keys), Google Maps API (optional for Geo services).