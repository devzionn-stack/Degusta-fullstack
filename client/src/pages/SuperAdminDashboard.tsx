import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Redirect, Link } from "wouter";
import { 
  Shield, 
  Building2, 
  Users, 
  Activity,
  TrendingUp,
  Store,
  RefreshCw,
  Settings,
  LogOut,
  BarChart3,
  Truck,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Tenant {
  id: string;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  telefone: string | null;
  createdAt: string;
}

interface GlobalStats {
  totalTenants: number;
  totalUsers: number;
  totalPedidosHoje: number;
  faturamentoTotal: number;
}

export default function SuperAdminDashboard() {
  const { user, isLoading, logout } = useAuth();

  const { data: tenants = [], isLoading: loadingTenants } = useQuery<Tenant[]>({
    queryKey: ["superadmin", "tenants"],
    queryFn: async () => {
      const res = await fetch("/api/superadmin/tenants", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar franquias");
      return res.json();
    },
    enabled: user?.role === "super_admin",
  });

  const { data: stats, isLoading: loadingStats } = useQuery<GlobalStats>({
    queryKey: ["superadmin", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/superadmin/stats", { credentials: "include" });
      if (!res.ok) {
        return {
          totalTenants: 0,
          totalUsers: 0,
          totalPedidosHoje: 0,
          faturamentoTotal: 0,
        };
      }
      return res.json();
    },
    enabled: user?.role === "super_admin",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.role !== "super_admin") {
    return <Redirect to="/dashboard" />;
  }

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-orange-500 to-red-600 p-2 rounded-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Super Admin</h1>
                <p className="text-sm text-gray-500">Degusta Pizza - Painel Global</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                <Shield className="h-3 w-3 mr-1" />
                Super Admin
              </Badge>
              <span className="text-sm text-gray-600">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Franquias</CardTitle>
              <Building2 className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-tenants">
                {loadingStats ? "..." : stats?.totalTenants || tenants.length}
              </div>
              <p className="text-xs text-muted-foreground">Franquias cadastradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Usuários</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">
                {loadingStats ? "..." : stats?.totalUsers || 0}
              </div>
              <p className="text-xs text-muted-foreground">Em todas as franquias</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Hoje</CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pedidos-hoje">
                {loadingStats ? "..." : stats?.totalPedidosHoje || 0}
              </div>
              <p className="text-xs text-muted-foreground">Em toda a rede</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturamento Global</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-faturamento">
                {loadingStats ? "..." : `R$ ${(stats?.faturamentoTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              </div>
              <p className="text-xs text-muted-foreground">Hoje em toda a rede</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/super-admin/dashboard">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <BarChart3 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Dashboard Global</CardTitle>
                      <CardDescription>KPIs agregados e comparativo de faturamento</CardDescription>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/super-admin/logistica">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-green-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Truck className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Controle Logístico Global</CardTitle>
                      <CardDescription>Mapa de calor e KPIs de entregas</CardDescription>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </CardHeader>
            </Card>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Franquias Cadastradas
            </CardTitle>
            <CardDescription>
              Gerencie todas as franquias da rede Degusta Pizza
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTenants ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : tenants.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id} data-testid={`row-tenant-${tenant.id}`}>
                      <TableCell className="font-medium">{tenant.nome}</TableCell>
                      <TableCell>{tenant.cnpj || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">{tenant.endereco || "-"}</TableCell>
                      <TableCell>{tenant.telefone || "-"}</TableCell>
                      <TableCell>
                        {format(new Date(tenant.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-manage-${tenant.id}`}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Gerenciar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma franquia cadastrada ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
