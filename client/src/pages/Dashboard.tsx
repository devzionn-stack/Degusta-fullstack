import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, ShoppingBag, Receipt, Package, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import KPICard, { KPIGrid } from "@/components/KPICard";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHART_COLORS = ["#e67e22", "#d35400", "#f39c12", "#e74c3c", "#c0392b", "#9b59b6"];

interface DashboardStats {
  vendasDiarias: number;
  ticketMedio: number;
  pedidosAbertos: number;
  totalPedidosHoje: number;
  variacaoVendas: number;
}

interface DailySale {
  date: string;
  total: number;
  count: number;
}

interface TopItem {
  name: string;
  quantity: number;
  revenue: number;
}

interface Pedido {
  id: string;
  status: string;
  total: string;
  createdAt: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const hasTenant = !!user?.tenantId;

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/dashboard-stats`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: hasTenant,
    refetchInterval: 60000,
  });

  const { data: pedidos = [] } = useQuery<Pedido[]>({
    queryKey: ["pedidos"],
    queryFn: async () => {
      const res = await fetch(`/api/pedidos`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: hasTenant,
  });

  const { data: dailySales = [] } = useQuery<DailySale[]>({
    queryKey: ["analytics", "daily-sales-30"],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/daily-sales?days=30`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: hasTenant,
  });

  const { data: topItems = [] } = useQuery<TopItem[]>({
    queryKey: ["analytics", "top-items"],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/top-items?limit=10`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: hasTenant,
  });

  const pendingOrders = pedidos.filter((p) => 
    ["pendente", "recebido", "em_preparo"].includes(p.status)
  );
  const completedOrders = pedidos.filter((p) => p.status === "entregue").slice(0, 5);

  const chartData = [...dailySales]
    .reverse()
    .map((item) => ({
      date: format(parseISO(item.date), "dd/MM", { locale: ptBR }),
      vendas: item.total,
      pedidos: item.count,
    }));

  const barData = topItems.map((item, index) => ({
    name: item.name.length > 12 ? item.name.substring(0, 12) + "..." : item.name,
    quantidade: item.quantity,
    receita: item.revenue,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-bold" data-testid="text-welcome">
            Bem-vindo, {user?.nome?.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground mt-1">
            {hasTenant 
              ? "Aqui está o resumo da sua pizzaria hoje."
              : "Você ainda não está vinculado a uma franquia."}
          </p>
        </div>

        {!hasTenant ? (
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Nenhuma franquia vinculada</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Para acessar os dados de pedidos, clientes e produtos, você precisa estar vinculado a uma franquia.
                Entre em contato com o administrador do sistema.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <KPIGrid columns={3}>
              <KPICard
                titulo="Vendas Diárias"
                valor={stats?.vendasDiarias ?? 0}
                formato="moeda"
                icone={DollarSign}
                variacaoPercentual={stats?.variacaoVendas}
                descricao="vs. ontem"
                loading={statsLoading}
              />
              <KPICard
                titulo="Ticket Médio"
                valor={stats?.ticketMedio ?? 0}
                formato="moeda"
                icone={Receipt}
                descricao="por pedido entregue"
                loading={statsLoading}
              />
              <KPICard
                titulo="Pedidos em Aberto"
                valor={stats?.pedidosAbertos ?? 0}
                formato="numero"
                icone={ShoppingBag}
                descricao="aguardando"
                corIcone={stats?.pedidosAbertos && stats.pedidosAbertos > 5 ? "text-orange-600" : "text-primary"}
                loading={statsLoading}
              />
            </KPIGrid>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Vendas Diárias
                  </CardTitle>
                  <CardDescription>
                    Faturamento dos últimos 30 dias
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {chartData.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      <p>Nenhum dado de vendas disponível</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis 
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          tickFormatter={(value) => `R$${value}`}
                        />
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            name === "vendas" ? `R$ ${value.toFixed(2)}` : value,
                            name === "vendas" ? "Vendas" : "Pedidos"
                          ]}
                          labelFormatter={(label) => `Data: ${label}`}
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone"
                          dataKey="vendas" 
                          stroke="#e67e22" 
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                          name="Vendas (R$)"
                        />
                        <Line 
                          type="monotone"
                          dataKey="pedidos" 
                          stroke="#3498db" 
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                          name="Qtd Pedidos"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Itens Mais Vendidos
                  </CardTitle>
                  <CardDescription>
                    Top 10 produtos por quantidade vendida
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {barData.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      <p>Nenhum dado de vendas disponível</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={barData} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          tick={{ fontSize: 11 }} 
                          width={100}
                        />
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            name === "quantidade" ? `${value} unidades` : `R$ ${value.toFixed(2)}`,
                            name === "quantidade" ? "Quantidade" : "Receita"
                          ]}
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar 
                          dataKey="quantidade" 
                          name="Quantidade"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-500" />
                    Pedidos Pendentes
                  </CardTitle>
                  <CardDescription>
                    {pendingOrders.length} pedidos aguardando
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingOrders.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Nenhum pedido pendente no momento.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      {pendingOrders.slice(0, 8).map((pedido) => (
                        <div
                          key={pedido.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                          data-testid={`pending-order-${pedido.id}`}
                        >
                          <div>
                            <p className="font-medium text-sm">
                              Pedido #{pedido.id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              R$ {parseFloat(pedido.total).toFixed(2)}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            pedido.status === "em_preparo" 
                              ? "bg-blue-100 text-blue-700" 
                              : "bg-orange-100 text-orange-700"
                          }`}>
                            {pedido.status === "recebido" ? "Recebido" : 
                             pedido.status === "em_preparo" ? "Em Preparo" : "Pendente"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Pedidos Entregues
                  </CardTitle>
                  <CardDescription>
                    Últimos pedidos finalizados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {completedOrders.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Nenhum pedido entregue ainda.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {completedOrders.map((pedido) => (
                        <div
                          key={pedido.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                          data-testid={`completed-order-${pedido.id}`}
                        >
                          <div>
                            <p className="font-medium text-sm">
                              Pedido #{pedido.id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              R$ {parseFloat(pedido.total).toFixed(2)}
                            </p>
                          </div>
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                            Entregue
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
