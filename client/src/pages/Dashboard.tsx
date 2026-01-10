import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant-context";
import { buildApiUrl } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { 
  DollarSign, ShoppingBag, Receipt, Package, TrendingUp, Clock, CheckCircle2, 
  AlertTriangle, Truck, ChefHat, Timer, Target, ArrowUp, ArrowDown, ArrowRight,
  Sun, Sunset, Moon
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  AreaChart,
  Area,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo, useState, useEffect } from "react";

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

type DayPeriod = "morning" | "afternoon" | "evening" | "night";

const getDayPeriod = (): DayPeriod => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 23) return "evening";
  return "night";
};

const getPeriodConfig = (period: DayPeriod) => {
  const configs = {
    morning: {
      icon: Sun,
      label: "Bom dia",
      sublabel: "Foco no preparo",
      gradient: "from-amber-50 to-orange-50",
      borderColor: "border-amber-200",
      accentColor: "text-amber-600",
      bgAccent: "bg-amber-100",
    },
    afternoon: {
      icon: Sun,
      label: "Boa tarde", 
      sublabel: "Foco nas entregas",
      gradient: "from-orange-50 to-red-50",
      borderColor: "border-orange-200",
      accentColor: "text-orange-600",
      bgAccent: "bg-orange-100",
    },
    evening: {
      icon: Sunset,
      label: "Boa noite",
      sublabel: "Pico de pedidos",
      gradient: "from-purple-50 to-indigo-50",
      borderColor: "border-purple-300",
      accentColor: "text-purple-600",
      bgAccent: "bg-purple-100",
    },
    night: {
      icon: Moon,
      label: "Boa noite",
      sublabel: "Horário tranquilo",
      gradient: "from-slate-50 to-gray-50",
      borderColor: "border-slate-200",
      accentColor: "text-slate-600",
      bgAccent: "bg-slate-100",
    },
  };
  return configs[period];
};

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

function Sparkline({ data, color = "#22c55e", height = 32 }: SparklineProps) {
  const chartData = data.map((value, index) => ({ value, index }));
  const trend = data.length >= 2 ? data[data.length - 1] - data[0] : 0;
  const sparkColor = trend >= 0 ? "#22c55e" : "#ef4444";
  
  return (
    <div className="w-20 h-8">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`sparkGradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={sparkColor}
            strokeWidth={1.5}
            fill={`url(#sparkGradient-${color})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface VarianceChipProps {
  value: number;
  suffix?: string;
}

function VarianceChip({ value, suffix = "%" }: VarianceChipProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  
  const Icon = isPositive ? ArrowUp : isNeutral ? ArrowRight : ArrowDown;
  
  const chipClasses = cn(
    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-all duration-300",
    isPositive && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    isNeutral && "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    !isPositive && !isNeutral && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  );

  return (
    <span className={chipClasses} data-testid="variance-chip">
      <Icon className="w-3 h-3" />
      {isPositive && "+"}
      {value.toFixed(1)}{suffix}
    </span>
  );
}

interface SituationCardProps {
  title: string;
  value: string | number;
  format?: "currency" | "number" | "percent";
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  variance?: number;
  sparklineData?: number[];
  isAnomaly?: boolean;
  anomalyType?: "positive" | "negative" | "warning";
  period: DayPeriod;
  priority?: "high" | "normal" | "low";
  loading?: boolean;
}

function SituationCard({
  title,
  value,
  format = "number",
  icon: Icon,
  description,
  variance,
  sparklineData,
  isAnomaly = false,
  anomalyType,
  period,
  priority = "normal",
  loading = false,
}: SituationCardProps) {
  const periodConfig = getPeriodConfig(period);
  
  const formatValue = (val: string | number): string => {
    if (typeof val === "string") return val;
    switch (format) {
      case "currency":
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
      case "percent":
        return `${val.toFixed(1)}%`;
      default:
        return new Intl.NumberFormat("pt-BR").format(val);
    }
  };

  const cardClasses = cn(
    "relative overflow-hidden transition-all duration-500 hover:shadow-lg",
    `bg-gradient-to-br ${periodConfig.gradient}`,
    periodConfig.borderColor,
    priority === "high" && period === "evening" && "ring-2 ring-purple-400 shadow-lg shadow-purple-100",
    isAnomaly && anomalyType === "positive" && "ring-2 ring-green-400 shadow-lg shadow-green-100 animate-pulse-subtle",
    isAnomaly && anomalyType === "negative" && "ring-2 ring-red-500 shadow-lg shadow-red-100 animate-pulse",
    isAnomaly && anomalyType === "warning" && "ring-2 ring-amber-400 shadow-lg shadow-amber-100"
  );

  if (loading) {
    return (
      <Card className={cardClasses} data-testid={`situation-card-${title.toLowerCase().replace(/\s+/g, "-")}-loading`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <div className="h-4 w-24 bg-white/50 animate-pulse rounded" />
              <div className="h-8 w-32 bg-white/50 animate-pulse rounded" />
              <div className="h-3 w-20 bg-white/50 animate-pulse rounded" />
            </div>
            <div className="w-12 h-12 bg-white/50 animate-pulse rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardClasses} data-testid={`situation-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      {isAnomaly && (
        <div className={cn(
          "absolute top-0 left-0 right-0 h-1",
          anomalyType === "positive" && "bg-green-500",
          anomalyType === "negative" && "bg-red-500",
          anomalyType === "warning" && "bg-amber-500"
        )} />
      )}
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              {isAnomaly && anomalyType === "warning" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                  ALERTA
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <p className="text-2xl font-bold tracking-tight" data-testid={`situation-value-${title.toLowerCase().replace(/\s+/g, "-")}`}>
                {formatValue(value)}
              </p>
              {sparklineData && sparklineData.length > 0 && (
                <Sparkline data={sparklineData} />
              )}
            </div>
            
            <div className="flex items-center gap-2 pt-1">
              {variance !== undefined && <VarianceChip value={variance} />}
              {description && (
                <span className="text-xs text-muted-foreground">{description}</span>
              )}
            </div>
          </div>
          
          <div className={cn("p-3 rounded-xl", periodConfig.bgAccent)}>
            <Icon className={cn("w-6 h-6", periodConfig.accentColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SingleGlancePanelProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  period: DayPeriod;
  highlight?: boolean;
}

function SingleGlancePanel({ title, icon: Icon, children, period, highlight = false }: SingleGlancePanelProps) {
  const periodConfig = getPeriodConfig(period);
  
  return (
    <Card className={cn(
      "transition-all duration-500",
      highlight && "ring-2 ring-primary shadow-lg"
    )}>
      <CardHeader className={cn("pb-3 bg-gradient-to-r", periodConfig.gradient)}>
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className={cn("p-2 rounded-lg", periodConfig.bgAccent)}>
            <Icon className={cn("h-5 w-5", periodConfig.accentColor)} />
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-3 gap-4">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

interface MiniMetricProps {
  label: string;
  value: string | number;
  variance?: number;
  format?: "currency" | "number" | "percent";
  sparklineData?: number[];
  isHighlight?: boolean;
}

function MiniMetric({ label, value, variance, format = "number", sparklineData, isHighlight }: MiniMetricProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === "string") return val;
    switch (format) {
      case "currency":
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(val);
      case "percent":
        return `${val.toFixed(0)}%`;
      default:
        return new Intl.NumberFormat("pt-BR").format(val);
    }
  };

  return (
    <div className={cn(
      "p-3 rounded-lg transition-all duration-300",
      isHighlight ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/50 hover:bg-muted"
    )}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-lg font-bold", isHighlight && "text-primary")}>
          {formatValue(value)}
        </p>
        {sparklineData && sparklineData.length > 0 && (
          <Sparkline data={sparklineData} height={24} />
        )}
      </div>
      {variance !== undefined && (
        <div className="mt-1">
          <VarianceChip value={variance} />
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user, isSuperAdmin } = useAuth();
  const { selectedTenantId } = useTenant();
  const [currentPeriod, setCurrentPeriod] = useState<DayPeriod>(getDayPeriod());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPeriod(getDayPeriod());
    }, 60000);
    return () => clearInterval(interval);
  }, []);
  
  const periodConfig = getPeriodConfig(currentPeriod);
  const PeriodIcon = periodConfig.icon;
  
  const effectiveTenantId = isSuperAdmin ? selectedTenantId : null;
  const hasTenant = isSuperAdmin ? !!selectedTenantId : !!user?.tenantId;

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", effectiveTenantId],
    queryFn: async () => {
      const url = buildApiUrl("/api/analytics/dashboard-stats", effectiveTenantId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: hasTenant,
    refetchInterval: 60000,
  });

  const { data: pedidos = [] } = useQuery<Pedido[]>({
    queryKey: ["pedidos", effectiveTenantId],
    queryFn: async () => {
      const url = buildApiUrl("/api/pedidos", effectiveTenantId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: hasTenant,
  });

  const { data: dailySales = [] } = useQuery<DailySale[]>({
    queryKey: ["analytics", "daily-sales-30", effectiveTenantId],
    queryFn: async () => {
      const url = buildApiUrl("/api/analytics/daily-sales?days=30", effectiveTenantId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: hasTenant,
  });

  const { data: topItems = [] } = useQuery<TopItem[]>({
    queryKey: ["analytics", "top-items", effectiveTenantId],
    queryFn: async () => {
      const url = buildApiUrl("/api/analytics/top-items?limit=10", effectiveTenantId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: hasTenant,
  });

  const pendingOrders = pedidos.filter((p) => 
    ["pendente", "recebido", "em_preparo"].includes(p.status)
  );
  const inTransitOrders = pedidos.filter((p) => p.status === "em_entrega");
  const completedOrders = pedidos.filter((p) => p.status === "entregue").slice(0, 5);

  const last7DaysSales = useMemo(() => {
    const reversedSales = [...dailySales].reverse();
    return reversedSales.slice(0, 7).map(d => d.total);
  }, [dailySales]);

  const last7DaysOrders = useMemo(() => {
    const reversedSales = [...dailySales].reverse();
    return reversedSales.slice(0, 7).map(d => d.count);
  }, [dailySales]);

  const averageDailySales = useMemo(() => {
    if (dailySales.length === 0) return 0;
    const sum = dailySales.reduce((acc, d) => acc + d.total, 0);
    return sum / dailySales.length;
  }, [dailySales]);

  const isSalesAnomaly = useMemo(() => {
    if (!stats?.vendasDiarias || averageDailySales === 0) return false;
    return stats.vendasDiarias > averageDailySales * 1.2;
  }, [stats?.vendasDiarias, averageDailySales]);

  const hasDelayedDeliveries = useMemo(() => {
    return pendingOrders.length > 8;
  }, [pendingOrders.length]);

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

  const deliveryEfficiency = useMemo(() => {
    const total = completedOrders.length + inTransitOrders.length;
    if (total === 0) return 100;
    return (completedOrders.length / total) * 100;
  }, [completedOrders.length, inTransitOrders.length]);

  return (
    <DashboardLayout>
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 3s ease-in-out infinite;
        }
      `}</style>
      
      <div className="space-y-6">
        <div className={cn(
          "p-4 rounded-xl transition-all duration-500 bg-gradient-to-r",
          periodConfig.gradient,
          periodConfig.borderColor,
          "border"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", periodConfig.bgAccent)}>
                <PeriodIcon className={cn("w-6 h-6", periodConfig.accentColor)} />
              </div>
              <div>
                <h1 className="text-2xl font-serif font-bold" data-testid="text-welcome">
                  {periodConfig.label}, {user?.nome?.split(" ")[0]}!
                </h1>
                <p className={cn("text-sm", periodConfig.accentColor)}>
                  {periodConfig.sublabel} • {hasTenant ? "Dashboard da pizzaria" : "Sem franquia vinculada"}
                </p>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-muted-foreground">
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
              <p className={cn("text-lg font-bold", periodConfig.accentColor)}>
                {format(new Date(), "HH:mm")}
              </p>
            </div>
          </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <SituationCard
                title="Vendas Diárias"
                value={stats?.vendasDiarias ?? 0}
                format="currency"
                icon={DollarSign}
                variance={stats?.variacaoVendas}
                sparklineData={last7DaysSales}
                description="últimos 7 dias"
                period={currentPeriod}
                isAnomaly={isSalesAnomaly}
                anomalyType="positive"
                priority={currentPeriod === "evening" ? "high" : "normal"}
                loading={statsLoading}
              />
              <SituationCard
                title="Ticket Médio"
                value={stats?.ticketMedio ?? 0}
                format="currency"
                icon={Receipt}
                description="por pedido"
                period={currentPeriod}
                loading={statsLoading}
              />
              <SituationCard
                title="Pedidos em Aberto"
                value={stats?.pedidosAbertos ?? 0}
                format="number"
                icon={ShoppingBag}
                description="aguardando"
                period={currentPeriod}
                isAnomaly={hasDelayedDeliveries}
                anomalyType="negative"
                priority={currentPeriod === "morning" ? "high" : "normal"}
                loading={statsLoading}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <SingleGlancePanel 
                title="Vendas" 
                icon={DollarSign} 
                period={currentPeriod}
                highlight={currentPeriod === "evening"}
              >
                <MiniMetric
                  label="Total Hoje"
                  value={stats?.vendasDiarias ?? 0}
                  format="currency"
                  variance={stats?.variacaoVendas}
                  isHighlight={currentPeriod === "evening"}
                />
                <MiniMetric
                  label="Ticket Médio"
                  value={stats?.ticketMedio ?? 0}
                  format="currency"
                />
                <MiniMetric
                  label="Pedidos"
                  value={stats?.totalPedidosHoje ?? 0}
                  sparklineData={last7DaysOrders}
                />
              </SingleGlancePanel>

              <SingleGlancePanel 
                title="Cozinha" 
                icon={ChefHat} 
                period={currentPeriod}
                highlight={currentPeriod === "morning"}
              >
                <MiniMetric
                  label="Pendentes"
                  value={pendingOrders.filter(p => p.status === "pendente").length}
                  isHighlight={currentPeriod === "morning"}
                />
                <MiniMetric
                  label="Em Preparo"
                  value={pendingOrders.filter(p => p.status === "em_preparo").length}
                />
                <MiniMetric
                  label="Eficiência"
                  value={pendingOrders.length > 0 ? Math.max(0, 100 - pendingOrders.length * 5) : 100}
                  format="percent"
                />
              </SingleGlancePanel>

              <SingleGlancePanel 
                title="Entregas" 
                icon={Truck} 
                period={currentPeriod}
                highlight={currentPeriod === "afternoon"}
              >
                <MiniMetric
                  label="Em Trânsito"
                  value={inTransitOrders.length}
                  isHighlight={currentPeriod === "afternoon"}
                />
                <MiniMetric
                  label="Entregues"
                  value={completedOrders.length}
                />
                <MiniMetric
                  label="SLA"
                  value={deliveryEfficiency}
                  format="percent"
                  variance={deliveryEfficiency >= 90 ? 5 : deliveryEfficiency >= 70 ? 0 : -10}
                />
              </SingleGlancePanel>
            </div>

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
              <Card className={cn(
                "transition-all duration-300",
                hasDelayedDeliveries && "ring-2 ring-red-500 animate-pulse"
              )}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className={cn(
                      "h-5 w-5",
                      hasDelayedDeliveries ? "text-red-500" : "text-orange-500"
                    )} />
                    Pedidos Pendentes
                    {hasDelayedDeliveries && (
                      <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded animate-pulse">
                        ATENÇÃO
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    {pendingOrders.length} pedidos aguardando
                    {pendingOrders.length > 5 && (
                      <VarianceChip value={(pendingOrders.length - 5) * 20} />
                    )}
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
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg transition-all duration-300",
                            pedido.status === "pendente" && hasDelayedDeliveries
                              ? "bg-red-50 dark:bg-red-900/20"
                              : "bg-muted/50"
                          )}
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
                  <CardDescription className="flex items-center gap-2">
                    Últimos pedidos finalizados
                    {completedOrders.length > 0 && (
                      <span className="text-green-600 text-xs font-medium">
                        {completedOrders.length} hoje
                      </span>
                    )}
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
                          className="flex items-center justify-between p-3 bg-green-50/50 dark:bg-green-900/10 rounded-lg transition-all duration-300 hover:bg-green-100/50"
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
