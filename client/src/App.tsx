import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
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
import Configuracoes from "@/pages/Configuracoes";
import Rastreio from "@/pages/Rastreio";
import SuperAdminDashboard from "@/pages/SuperAdminDashboard";
import SuperAdminDashboardGlobal from "@/pages/SuperAdminDashboardGlobal";
import SuperAdminLogistica from "@/pages/SuperAdminLogistica";
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
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/pedidos" component={Pedidos} />
      <Route path="/pedidos/:id" component={PedidoDetails} />
      <Route path="/dashboard/logistica" component={Logistica} />
      <Route path="/dashboard/financeiro" component={Financeiro} />
      <Route path="/dashboard/inteligencia" component={Inteligencia} />
      <Route path="/dashboard/estoque" component={Estoque} />
      <Route path="/dashboard/configuracoes" component={Configuracoes} />
      <Route path="/cozinha" component={Cozinha} />
      <Route path="/rastreio/:pedidoId" component={Rastreio} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
