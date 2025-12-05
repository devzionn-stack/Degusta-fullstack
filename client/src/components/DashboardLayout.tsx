import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Menu, X, Bell, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Alerta {
  id: string;
  tenantId: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  severidade: string;
  lida: boolean;
  createdAt: string;
}

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [, navigate] = useLocation();
  const { isLoading, isAuthenticated, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: alertas = [] } = useQuery<Alerta[]>({
    queryKey: ["alertas"],
    queryFn: async () => {
      const res = await fetch("/api/alertas?limit=10", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!user?.tenantId,
    refetchInterval: 30000,
  });

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["alertas", "nao-lidos"],
    queryFn: async () => {
      const res = await fetch("/api/alertas/nao-lidos", { credentials: "include" });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.count;
    },
    enabled: isAuthenticated && !!user?.tenantId,
    refetchInterval: 30000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/alertas/${id}/lida`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas"] });
      queryClient.invalidateQueries({ queryKey: ["alertas", "nao-lidos"] });
    },
  });

  const getSeverityIcon = (severidade: string) => {
    switch (severidade) {
      case "critical": return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warn": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Spinner className="w-10 h-10 mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="fixed top-0 left-0 right-0 h-14 bg-background border-b z-30 lg:pl-64">
        <div className="flex items-center justify-between h-full px-4">
          <button
            className="lg:hidden p-2 hover:bg-muted rounded-md"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="button-toggle-sidebar"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <div className="flex-1" />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative"
                data-testid="button-alerts"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Alertas</span>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} não lidos
                  </Badge>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {alertas.length > 0 ? (
                <div className="max-h-80 overflow-y-auto">
                  {alertas.map((alerta) => (
                    <DropdownMenuItem
                      key={alerta.id}
                      className={`flex items-start gap-3 p-3 cursor-pointer ${!alerta.lida ? 'bg-muted/50' : ''}`}
                      onClick={() => {
                        if (!alerta.lida) {
                          markAsReadMutation.mutate(alerta.id);
                        }
                      }}
                      data-testid={`alert-item-${alerta.id}`}
                    >
                      {getSeverityIcon(alerta.severidade)}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{alerta.titulo}</span>
                          {!alerta.lida && (
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {alerta.mensagem}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(alerta.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum alerta</p>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out pt-14
          lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="lg:pl-64 pt-14">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
