import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant-context";
import { Building2, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export default function TenantSelector() {
  const { isSuperAdmin } = useAuth();
  const { tenants, selectedTenant, selectedTenantId, setSelectedTenantId, isLoading } = useTenant();

  if (!isSuperAdmin) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4 animate-pulse" />
        <span>Carregando...</span>
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>Nenhuma franquia</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 min-w-[200px] justify-between"
          data-testid="tenant-selector"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="truncate max-w-[150px]">
              {selectedTenant?.nome || "Selecionar franquia"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[250px]">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Selecionar Franquia
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-y-auto">
          {tenants.map((tenant) => (
            <DropdownMenuItem
              key={tenant.id}
              onClick={() => setSelectedTenantId(tenant.id)}
              className="flex items-center justify-between cursor-pointer"
              data-testid={`tenant-option-${tenant.id}`}
            >
              <div className="flex items-center gap-2">
                <span>{tenant.nome}</span>
                {tenant.status === "active" ? (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    Ativo
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {tenant.status}
                  </Badge>
                )}
              </div>
              {selectedTenantId === tenant.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
