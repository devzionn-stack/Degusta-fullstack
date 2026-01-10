import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant-context";
import { buildApiUrl } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Pizza,
  Calendar,
  Clock,
  DollarSign,
  ShoppingBag,
  Loader2,
  Package,
  Award,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AnalyticsSummary {
  pizzasPersonalizadasTotal: number;
  pedidosUltimos30Dias: number;
  pizzasUltimos30Dias: number;
  receitaUltimos30Dias: number;
  crescimentoMensal: number;
  horarioPico: string;
  diaSemanaPopular: string;
}

interface PizzaPopular {
  pizzaId: string;
  nome: string;
  hashSabores: string;
  quantidadeVendida: number;
  receitaTotal: number;
  saboresNomes: string[];
}

interface TendenciaDiaria {
  data: string;
  totalPedidos: number;
  totalPizzas: number;
  receitaTotal: number;
  ticketMedio: number;
}

interface TendenciaSabor {
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  tendencia: "subindo" | "estavel" | "descendo";
  variacao: number;
}

interface IngredienteConsumo {
  ingredienteId: string;
  nome: string;
  quantidadeConsumida: number;
  unidade: string;
  custoTotal: number;
}

const COLORS = ["#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1"];

export default function Analytics() {
  const { isSuperAdmin } = useAuth();
  const { selectedTenantId } = useTenant();
  const [diasFiltro, setDiasFiltro] = useState("30");
  
  const effectiveTenantId = isSuperAdmin ? selectedTenantId : null;

  const { data: resumo, isLoading: loadingResumo } = useQuery<AnalyticsSummary>({
    queryKey: ["analytics-resumo", effectiveTenantId],
    queryFn: async () => {
      const url = buildApiUrl("/api/analytics/resumo", effectiveTenantId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch resumo");
      return res.json();
    },
    enabled: isSuperAdmin ? !!selectedTenantId : true,
  });

  const { data: pizzasPopulares = [] } = useQuery<PizzaPopular[]>({
    queryKey: ["analytics-pizzas", effectiveTenantId, diasFiltro],
    queryFn: async () => {
      const url = buildApiUrl(`/api/analytics/pizzas-populares?dias=${diasFiltro}`, effectiveTenantId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pizzas");
      return res.json();
    },
    enabled: isSuperAdmin ? !!selectedTenantId : true,
  });

  const { data: tendenciaDiaria = [] } = useQuery<TendenciaDiaria[]>({
    queryKey: ["analytics-tendencia", effectiveTenantId, diasFiltro],
    queryFn: async () => {
      const url = buildApiUrl(`/api/analytics/tendencia-diaria?dias=${diasFiltro}`, effectiveTenantId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tendencia");
      return res.json();
    },
    enabled: isSuperAdmin ? !!selectedTenantId : true,
  });

  const { data: tendenciaSabores = [] } = useQuery<TendenciaSabor[]>({
    queryKey: ["analytics-sabores", effectiveTenantId, diasFiltro],
    queryFn: async () => {
      const url = buildApiUrl(`/api/analytics/tendencia-sabores?dias=${diasFiltro}`, effectiveTenantId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sabores");
      return res.json();
    },
    enabled: isSuperAdmin ? !!selectedTenantId : true,
  });

  const { data: consumoIngredientes = [] } = useQuery<IngredienteConsumo[]>({
    queryKey: ["analytics-consumo", effectiveTenantId, diasFiltro],
    queryFn: async () => {
      const url = buildApiUrl(`/api/analytics/consumo-ingredientes?dias=${diasFiltro}`, effectiveTenantId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch consumo");
      return res.json();
    },
    enabled: isSuperAdmin ? !!selectedTenantId : true,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isSuperAdmin && !selectedTenantId) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Selecione uma Franquia</h3>
              <p className="text-muted-foreground">
                Use o seletor no topo da página para escolher qual franquia visualizar.
              </p>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (loadingResumo) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Analytics</h1>
            <p className="text-muted-foreground">Análise de tendências e pizzas personalizadas</p>
          </div>
          
          <Select value={diasFiltro} onValueChange={setDiasFiltro}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="15">Últimos 15 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pizzas Personalizadas</p>
                  <p className="text-2xl font-bold">{resumo?.pizzasPersonalizadasTotal || 0}</p>
                  <p className="text-xs text-muted-foreground">combinações únicas</p>
                </div>
                <Pizza className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pedidos (30d)</p>
                  <p className="text-2xl font-bold">{resumo?.pedidosUltimos30Dias || 0}</p>
                  <div className="flex items-center gap-1">
                    {(resumo?.crescimentoMensal || 0) >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span className={`text-xs ${(resumo?.crescimentoMensal || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {(resumo?.crescimentoMensal || 0).toFixed(1)}% vs mês anterior
                    </span>
                  </div>
                </div>
                <ShoppingBag className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Receita (30d)</p>
                  <p className="text-2xl font-bold">{formatCurrency(resumo?.receitaUltimos30Dias || 0)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Horário Pico:</span>
                  <Badge variant="secondary">{resumo?.horarioPico || "N/A"}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Dia Popular:</span>
                  <Badge variant="secondary">{resumo?.diaSemanaPopular || "N/A"}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="vendas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="vendas">Vendas Diárias</TabsTrigger>
            <TabsTrigger value="populares">Pizzas Populares</TabsTrigger>
            <TabsTrigger value="tendencias">Tendências Sabores</TabsTrigger>
            <TabsTrigger value="ingredientes">Consumo Ingredientes</TabsTrigger>
          </TabsList>

          <TabsContent value="vendas">
            <Card>
              <CardHeader>
                <CardTitle>Evolução de Vendas</CardTitle>
                <CardDescription>Pedidos e receita ao longo do tempo</CardDescription>
              </CardHeader>
              <CardContent>
                {tendenciaDiaria.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={tendenciaDiaria}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="data" 
                        tickFormatter={(value) => format(new Date(value), "dd/MM", { locale: ptBR })}
                      />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip 
                        labelFormatter={(value) => format(new Date(value), "dd/MM/yyyy", { locale: ptBR })}
                        formatter={(value: number, name: string) => {
                          if (name === "receitaTotal" || name === "ticketMedio") {
                            return formatCurrency(value);
                          }
                          return value;
                        }}
                      />
                      <Line 
                        yAxisId="left" 
                        type="monotone" 
                        dataKey="totalPedidos" 
                        stroke="#3b82f6" 
                        name="Pedidos"
                        strokeWidth={2}
                      />
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey="receitaTotal" 
                        stroke="#22c55e" 
                        name="Receita"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Sem dados de vendas no período selecionado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="populares">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-500" />
                  Pizzas Mais Vendidas
                </CardTitle>
                <CardDescription>Combinações personalizadas mais populares</CardDescription>
              </CardHeader>
              <CardContent>
                {pizzasPopulares.length > 0 ? (
                  <div className="space-y-4">
                    {pizzasPopulares.map((pizza, index) => {
                      const maxQtd = pizzasPopulares[0]?.quantidadeVendida || 1;
                      const percentage = (pizza.quantidadeVendida / maxQtd) * 100;
                      
                      return (
                        <div 
                          key={pizza.pizzaId} 
                          className="p-4 rounded-lg border hover:bg-muted/30 transition-colors"
                          data-testid={`pizza-popular-${pizza.pizzaId}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div 
                                className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-white"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              >
                                {index + 1}
                              </div>
                              <div>
                                <h4 className="font-medium">{pizza.nome}</h4>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {pizza.saboresNomes.map((sabor, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {sabor}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold">{pizza.quantidadeVendida}x</p>
                              <p className="text-sm text-muted-foreground">{formatCurrency(pizza.receitaTotal)}</p>
                            </div>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Pizza className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma pizza personalizada vendida no período</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tendencias">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Tendências de Sabores
                </CardTitle>
                <CardDescription>Sabores em alta e em baixa no período</CardDescription>
              </CardHeader>
              <CardContent>
                {tendenciaSabores.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        Em Alta
                      </h4>
                      <div className="space-y-2">
                        {tendenciaSabores
                          .filter(s => s.tendencia === "subindo")
                          .slice(0, 5)
                          .map((sabor) => (
                            <div 
                              key={sabor.produtoId} 
                              className="flex items-center justify-between p-2 rounded bg-green-50 dark:bg-green-950/20"
                            >
                              <span>{sabor.produtoNome}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{sabor.quantidade}x</Badge>
                                <span className="text-green-600 text-sm font-medium">
                                  +{sabor.variacao.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        {tendenciaSabores.filter(s => s.tendencia === "subindo").length === 0 && (
                          <p className="text-sm text-muted-foreground">Nenhum sabor em alta</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        Em Baixa
                      </h4>
                      <div className="space-y-2">
                        {tendenciaSabores
                          .filter(s => s.tendencia === "descendo")
                          .slice(0, 5)
                          .map((sabor) => (
                            <div 
                              key={sabor.produtoId} 
                              className="flex items-center justify-between p-2 rounded bg-red-50 dark:bg-red-950/20"
                            >
                              <span>{sabor.produtoNome}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{sabor.quantidade}x</Badge>
                                <span className="text-red-600 text-sm font-medium">
                                  {sabor.variacao.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        {tendenciaSabores.filter(s => s.tendencia === "descendo").length === 0 && (
                          <p className="text-sm text-muted-foreground">Nenhum sabor em baixa</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Sem dados de tendências no período</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ingredientes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-500" />
                  Consumo de Ingredientes
                </CardTitle>
                <CardDescription>Ingredientes mais consumidos e seus custos</CardDescription>
              </CardHeader>
              <CardContent>
                {consumoIngredientes.length > 0 ? (
                  <div className="space-y-3">
                    {consumoIngredientes.map((ing, index) => {
                      const maxCusto = consumoIngredientes[0]?.custoTotal || 1;
                      const percentage = (ing.custoTotal / maxCusto) * 100;
                      
                      return (
                        <div 
                          key={ing.ingredienteId || index} 
                          className="p-3 rounded-lg border"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="font-medium">{ing.nome}</span>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatCurrency(ing.custoTotal)}</p>
                              <p className="text-xs text-muted-foreground">
                                {ing.quantidadeConsumida.toFixed(1)} {ing.unidade}
                              </p>
                            </div>
                          </div>
                          <Progress value={percentage} className="h-1.5" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Sem dados de consumo no período</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
