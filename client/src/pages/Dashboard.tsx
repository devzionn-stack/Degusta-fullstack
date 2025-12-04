import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Users, Package, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHART_COLORS = ["#e67e22", "#d35400", "#f39c12", "#e74c3c", "#c0392b", "#9b59b6"];

export default function Dashboard() {
  const { user } = useAuth();
  const hasTenant = !!user?.tenantId;

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos"],
    queryFn: async () => {
      const res = await fetch(`/api/pedidos`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: hasTenant,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const res = await fetch(`/api/clientes`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: hasTenant,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const res = await fetch(`/api/produtos`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: hasTenant,
  });

  const { data: dailySales = [] } = useQuery({
    queryKey: ["analytics", "daily-sales"],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/daily-sales?days=7`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: hasTenant,
  });

  const { data: topItems = [] } = useQuery({
    queryKey: ["analytics", "top-items"],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/top-items?limit=5`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: hasTenant,
  });

  const pendingOrders = pedidos.filter((p: any) => p.status === "pendente" || p.status === "recebido").length;
  const completedOrders = pedidos.filter((p: any) => p.status === "entregue").length;
  const totalRevenue = pedidos.reduce((acc: number, p: any) => acc + parseFloat(p.total || 0), 0);

  const stats = [
    {
      title: "Total de Pedidos",
      value: pedidos.length,
      description: "Pedidos realizados",
      icon: ShoppingBag,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Clientes Cadastrados",
      value: clientes.length,
      description: "Base de clientes",
      icon: Users,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    {
      title: "Produtos no Cardápio",
      value: produtos.length,
      description: "Itens disponíveis",
      icon: Package,
      color: "text-accent",
      bgColor: "bg-accent/20",
    },
    {
      title: "Receita Total",
      value: `R$ ${totalRevenue.toFixed(2)}`,
      description: "Faturamento",
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
  ];

  const chartData = [...dailySales]
    .reverse()
    .map((item: any) => ({
      date: format(parseISO(item.date), "dd/MM", { locale: ptBR }),
      vendas: item.total,
      pedidos: item.count,
    }));

  const pieData = topItems.map((item: any, index: number) => ({
    name: item.name.length > 15 ? item.name.substring(0, 15) + "..." : item.name,
    value: item.quantity,
    color: CHART_COLORS[index % CHART_COLORS.length],
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, index) => (
                <Card key={index} data-testid={`stat-card-${index}`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Vendas Diárias
                  </CardTitle>
                  <CardDescription>
                    Faturamento dos últimos 7 dias
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {chartData.length === 0 ? (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      <p>Nenhum dado de vendas disponível</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          tickFormatter={(value) => `R$${value}`}
                        />
                        <Tooltip 
                          formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Vendas"]}
                          labelFormatter={(label) => `Data: ${label}`}
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar 
                          dataKey="vendas" 
                          fill="#e67e22" 
                          radius={[4, 4, 0, 0]}
                          name="Vendas"
                        />
                      </BarChart>
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
                    Top 5 produtos por quantidade vendida
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pieData.length === 0 ? (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      <p>Nenhum dado de vendas disponível</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) => 
                            `${name} (${(percent * 100).toFixed(0)}%)`
                          }
                          labelLine={false}
                        >
                          {pieData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [`${value} unidades`, "Quantidade"]}
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </PieChart>
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
                    {pendingOrders} pedidos aguardando
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingOrders === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Nenhum pedido pendente no momento.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pedidos
                        .filter((p: any) => p.status === "pendente" || p.status === "recebido")
                        .slice(0, 5)
                        .map((pedido: any) => (
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
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                              {pedido.status === "recebido" ? "Recebido" : "Pendente"}
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
                    {completedOrders} pedidos finalizados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {completedOrders === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Nenhum pedido entregue ainda.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pedidos
                        .filter((p: any) => p.status === "entregue")
                        .slice(0, 5)
                        .map((pedido: any) => (
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
