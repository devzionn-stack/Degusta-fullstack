import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./auth";

interface Tenant {
  id: string;
  nome: string;
  status: string;
}

interface TenantContextType {
  selectedTenantId: string | null;
  selectedTenant: Tenant | null;
  tenants: Tenant[];
  setSelectedTenantId: (id: string | null) => void;
  isLoading: boolean;
  needsTenantSelection: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { isSuperAdmin, tenantId: userTenantId } = useAuth();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isSuperAdmin) {
      fetch("/api/tenants", { credentials: "include" })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch tenants");
          return res.json();
        })
        .then((data) => {
          const tenantsArray = Array.isArray(data) ? data : [];
          setTenants(tenantsArray);
          if (tenantsArray.length > 0 && !selectedTenantId) {
            setSelectedTenantId(tenantsArray[0].id);
          }
          setIsLoading(false);
        })
        .catch(() => {
          setTenants([]);
          setIsLoading(false);
        });
    } else if (userTenantId) {
      setSelectedTenantId(userTenantId);
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [isSuperAdmin, userTenantId]);

  const selectedTenant = Array.isArray(tenants) 
    ? tenants.find((t) => t.id === selectedTenantId) || null
    : null;

  const needsTenantSelection = isSuperAdmin && !selectedTenantId;

  return (
    <TenantContext.Provider
      value={{
        selectedTenantId,
        selectedTenant,
        tenants,
        setSelectedTenantId,
        isLoading,
        needsTenantSelection,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

export function useEffectiveTenantId(): string | null {
  const { selectedTenantId } = useTenant();
  return selectedTenantId;
}
