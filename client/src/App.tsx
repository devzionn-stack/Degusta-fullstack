import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { TenantProvider } from "@/lib/tenant-context";
import { ThemeProvider } from "@/lib/theme";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Cozinha from "@/pages/Cozinha";
import Pedidos from "@/pages/Pedidos";
import PedidoDetails from "@/pages/PedidoDetails";
import Logistica from "@/pages/Logistica";
import Financeiro from "@/pages/Financeiro";
import Inteligencia from "@/pages/Inteligencia";
import Estoque from "@/pages/Estoque";
import Custos from "@/pages/Custos";
import AgenteIA from "@/pages/AgenteIA";
import Configuracoes from "@/pages/Configuracoes";
import Rastreio from "@/pages/Rastreio";
import Clientes from "@/pages/Clientes";
import Produtos from "@/pages/Produtos";
import KDS from "@/pages/KDS";
import KDSProducaoTV from "@/pages/KDSProducaoTV";
import SuperAdminDashboard from "@/pages/SuperAdminDashboard";
import SuperAdminDashboardGlobal from "@/pages/SuperAdminDashboardGlobal";
import SuperAdminLogistica from "@/pages/SuperAdminLogistica";
import SuperAdminFranquias from "@/pages/SuperAdminFranquias";
import SuperAdminUsuarios from "@/pages/SuperAdminUsuarios";
import SuperAdminLogs from "@/pages/SuperAdminLogs";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/superadmin" component={SuperAdminDashboard} />
      <Route path="/super-admin/dashboard" component={SuperAdminDashboardGlobal} />
      <Route path="/super-admin/logistica" component={SuperAdminLogistica} />
      <Route path="/super-admin/franquias" component={SuperAdminFranquias} />
      <Route path="/super-admin/usuarios" component={SuperAdminUsuarios} />
      <Route path="/super-admin/logs" component={SuperAdminLogs} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/pedidos" component={Pedidos} />
      <Route path="/pedidos/:id" component={PedidoDetails} />
      <Route path="/dashboard/logistica" component={Logistica} />
      <Route path="/dashboard/financeiro" component={Financeiro} />
      <Route path="/dashboard/inteligencia" component={Inteligencia} />
      <Route path="/dashboard/estoque" component={Estoque} />
      <Route path="/dashboard/clientes" component={Clientes} />
      <Route path="/dashboard/produtos" component={Produtos} />
      <Route path="/dashboard/custos" component={Custos} />
      <Route path="/dashboard/agente-ia" component={AgenteIA} />
      <Route path="/dashboard/configuracoes" component={Configuracoes} />
      <Route path="/cozinha" component={Cozinha} />
      <Route path="/kds" component={KDS} />
      <Route path="/kds/tv" component={KDSProducaoTV} />
      <Route path="/kds/tv/:tenantId" component={KDSProducaoTV} />
      <Route path="/rastreio/:pedidoId" component={Rastreio} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="degusta-theme">
        <AuthProvider>
          <TenantProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner position="top-right" richColors closeButton />
              <Router />
            </TooltipProvider>
          </TenantProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
