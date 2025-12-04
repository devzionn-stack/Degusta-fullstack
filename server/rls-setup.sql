-- ============================================
-- ROW LEVEL SECURITY (RLS) CONFIGURATION
-- Multi-Tenancy Security for Pizzaria System
-- ============================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: Extract tenant_id from JWT
-- ============================================
-- This function reads the tenant_id claim from the JWT token
-- passed in the auth.jwt() context (Supabase/PostgreSQL pattern)
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS VARCHAR AS $$
BEGIN
  -- In production with Supabase/JWT auth, this would be:
  -- RETURN NULLIF(current_setting('request.jwt.claims', true)::json->>'tenant_id', '')::VARCHAR;
  
  -- For development/testing, you can set tenant_id manually:
  -- SET SESSION "app.current_tenant_id" = '<your-tenant-uuid>';
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::VARCHAR;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES FOR: pedidos
-- ============================================

-- Policy: Allow SELECT only for current tenant
CREATE POLICY "tenant_isolation_select_pedidos"
ON pedidos
FOR SELECT
USING (tenant_id = get_current_tenant_id());

-- Policy: Allow INSERT only with current tenant_id
CREATE POLICY "tenant_isolation_insert_pedidos"
ON pedidos
FOR INSERT
WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Allow UPDATE only for current tenant
CREATE POLICY "tenant_isolation_update_pedidos"
ON pedidos
FOR UPDATE
USING (tenant_id = get_current_tenant_id())
WITH CHECK (tenant_id = get_current_tenant_id());

-- Policy: Allow DELETE only for current tenant
CREATE POLICY "tenant_isolation_delete_pedidos"
ON pedidos
FOR DELETE
USING (tenant_id = get_current_tenant_id());

-- ============================================
-- RLS POLICIES FOR: clientes
-- ============================================

CREATE POLICY "tenant_isolation_select_clientes"
ON clientes
FOR SELECT
USING (tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_isolation_insert_clientes"
ON clientes
FOR INSERT
WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_isolation_update_clientes"
ON clientes
FOR UPDATE
USING (tenant_id = get_current_tenant_id())
WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_isolation_delete_clientes"
ON clientes
FOR DELETE
USING (tenant_id = get_current_tenant_id());

-- ============================================
-- RLS POLICIES FOR: produtos
-- ============================================

CREATE POLICY "tenant_isolation_select_produtos"
ON produtos
FOR SELECT
USING (tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_isolation_insert_produtos"
ON produtos
FOR INSERT
WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_isolation_update_produtos"
ON produtos
FOR UPDATE
USING (tenant_id = get_current_tenant_id())
WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_isolation_delete_produtos"
ON produtos
FOR DELETE
USING (tenant_id = get_current_tenant_id());

-- ============================================
-- RLS POLICIES FOR: estoque
-- ============================================

CREATE POLICY "tenant_isolation_select_estoque"
ON estoque
FOR SELECT
USING (tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_isolation_insert_estoque"
ON estoque
FOR INSERT
WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_isolation_update_estoque"
ON estoque
FOR UPDATE
USING (tenant_id = get_current_tenant_id())
WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_isolation_delete_estoque"
ON estoque
FOR DELETE
USING (tenant_id = get_current_tenant_id());

-- ============================================
-- USAGE EXAMPLE (Development/Testing)
-- ============================================
-- To test RLS in development, set the tenant context before queries:
-- 
-- SET SESSION "app.current_tenant_id" = '<tenant-uuid-here>';
-- SELECT * FROM pedidos; -- Will only return rows for that tenant
-- 
-- In production with JWT authentication (Supabase):
-- The tenant_id would be extracted from auth.jwt() automatically
