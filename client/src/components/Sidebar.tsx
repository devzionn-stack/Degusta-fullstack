import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pizza,
  LayoutDashboard,
  ShoppingBag,
  Users,
  Package,
  Warehouse,
  Settings,
  LogOut,
  ChevronDown,
  ChefHat,
  DollarSign,
  Building2,
  Truck,
  Brain,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Tenant {
  id: string;
  nome: string;
  status: string;
}

interface SidebarProps {
  onNavigate?: () => void;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: ChefHat, label: "Cozinha", path: "/cozinha" },
  { icon: ShoppingBag, label: "Pedidos", path: "/dashboard/pedidos" },
  { icon: Users, label: "Clientes", path: "/dashboard/clientes" },
  { icon: Package, label: "Produtos", path: "/dashboard/produtos" },
  { icon: Warehouse, label: "Estoque", path: "/dashboard/estoque" },
  { icon: Truck, label: "Logística", path: "/dashboard/logistica" },
  { icon: DollarSign, label: "Financeiro", path: "/dashboard/financeiro" },
  { icon: Brain, label: "Inteligência", path: "/dashboard/inteligencia" },
  { icon: Settings, label: "Configurações", path: "/dashboard/configuracoes" },
];

export default function Sidebar({ onNavigate }: SidebarProps) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";

  const { data: tenants } = useQuery<Tenant[]>({
    queryKey: ["tenants"],
    queryFn: async () => {
      const res = await fetch("/api/tenants", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const switchTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await fetch("/api/auth/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao trocar franquia");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      queryClient.invalidateQueries();
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const handleTenantChange = (tenantId: string) => {
    switchTenantMutation.mutate(tenantId);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const currentTenant = tenants?.find((t) => t.id === user?.tenantId);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <Pizza className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold">Bella Napoli</h1>
            <p className="text-xs text-muted-foreground">Sistema de Gestão</p>
          </div>
        </div>
      </div>

      {isAdmin && tenants && tenants.length > 0 && (
        <div className="p-4 border-b bg-muted/30">
          <label className="text-xs font-medium text-muted-foreground mb-2 block">
            <Building2 className="w-3 h-3 inline mr-1" />
            Franquia Ativa
          </label>
          <Select
            value={user?.tenantId || ""}
            onValueChange={handleTenantChange}
            disabled={switchTenantMutation.isPending}
          >
            <SelectTrigger 
              className="w-full bg-background"
              data-testid="select-tenant"
            >
              <SelectValue placeholder="Selecione uma franquia">
                {currentTenant ? (
                  <span className="flex items-center gap-2">
                    {currentTenant.nome}
                    {currentTenant.status === "active" && (
                      <Badge variant="outline" className="text-xs py-0 px-1 text-green-600 border-green-300">
                        Ativo
                      </Badge>
                    )}
                  </span>
                ) : (
                  "Selecione uma franquia"
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {tenants.map((tenant) => (
                <SelectItem 
                  key={tenant.id} 
                  value={tenant.id}
                  data-testid={`tenant-option-${tenant.id}`}
                >
                  <span className="flex items-center gap-2">
                    {tenant.nome}
                    {tenant.status === "active" && (
                      <Badge variant="outline" className="text-xs py-0 px-1 text-green-600 border-green-300">
                        Ativo
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {switchTenantMutation.isPending && (
            <p className="text-xs text-muted-foreground mt-1">Trocando franquia...</p>
          )}
        </div>
      )}

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.path || (item.path !== "/dashboard" && location.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
              data-testid="button-user-menu"
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {user?.nome ? getInitials(user.nome) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{user?.nome}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                  {isAdmin && (
                    <Badge variant="secondary" className="ml-1 text-[10px] py-0 px-1">
                      Admin
                    </Badge>
                  )}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => handleNavigation("/dashboard/configuracoes")} 
              data-testid="menu-settings"
            >
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
              data-testid="menu-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
