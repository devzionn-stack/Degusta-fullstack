import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Users, Package, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const res = await fetch(`/api/pedidos?tenantId=${tenantId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tenantId,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const res = await fetch(`/api/clientes?tenantId=${tenantId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tenantId,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const res = await fetch(`/api/produtos?tenantId=${tenantId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tenantId,
  });

  const pendingOrders = pedidos.filter((p: any) => p.status === "pendente").length;
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-bold">
            Bem-vindo, {user?.nome?.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground mt-1">
            {tenantId 
              ? "Aqui está o resumo da sua pizzaria hoje."
              : "Você ainda não está vinculado a uma franquia."}
          </p>
        </div>

        {!tenantId ? (
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
                        .filter((p: any) => p.status === "pendente")
                        .slice(0, 5)
                        .map((pedido: any) => (
                          <div
                            key={pedido.id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
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
                              Pendente
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
                    Pedidos Entregues Hoje
                  </CardTitle>
                  <CardDescription>
                    {completedOrders} pedidos finalizados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {completedOrders === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Nenhum pedido entregue ainda hoje.
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
