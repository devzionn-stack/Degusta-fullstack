import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Financeiro() {
  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos"],
    queryFn: async () => {
      const res = await fetch(`/api/pedidos`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const totalRevenue = pedidos.reduce((acc: number, p: any) => {
    if (p.status !== "cancelado") {
      return acc + parseFloat(p.total || 0);
    }
    return acc;
  }, 0);

  const canceledValue = pedidos
    .filter((p: any) => p.status === "cancelado")
    .reduce((acc: number, p: any) => acc + parseFloat(p.total || 0), 0);

  const deliveredValue = pedidos
    .filter((p: any) => p.status === "entregue")
    .reduce((acc: number, p: any) => acc + parseFloat(p.total || 0), 0);

  const averageTicket = pedidos.length > 0 ? totalRevenue / pedidos.length : 0;

  const stats = [
    {
      title: "Receita Total",
      value: `R$ ${totalRevenue.toFixed(2)}`,
      description: "Total de vendas não canceladas",
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Vendas Entregues",
      value: `R$ ${deliveredValue.toFixed(2)}`,
      description: "Pedidos finalizados",
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Cancelamentos",
      value: `R$ ${canceledValue.toFixed(2)}`,
      description: "Valor em pedidos cancelados",
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "Ticket Médio",
      value: `R$ ${averageTicket.toFixed(2)}`,
      description: "Valor médio por pedido",
      icon: Wallet,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-bold flex items-center gap-3" data-testid="text-title">
            <DollarSign className="h-8 w-8 text-primary" />
            Financeiro
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe o desempenho financeiro da sua pizzaria
          </p>
        </div>

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

        <Card>
          <CardHeader>
            <CardTitle>Resumo Financeiro</CardTitle>
            <CardDescription>
              Visão geral das transações da pizzaria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Total de Pedidos</span>
                <span className="font-bold">{pedidos.length}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Pedidos Entregues</span>
                <span className="font-bold">
                  {pedidos.filter((p: any) => p.status === "entregue").length}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Pedidos Cancelados</span>
                <span className="font-bold text-red-600">
                  {pedidos.filter((p: any) => p.status === "cancelado").length}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <span className="font-medium">Receita Líquida</span>
                <span className="font-bold text-green-600 text-lg">
                  R$ {totalRevenue.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
