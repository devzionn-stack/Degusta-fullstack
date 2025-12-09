import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SuperAdminGuard } from "@/components/SuperAdminGuard";
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingUp, 
  Clock, 
  Building2,
  ArrowUpDown,
  Search,
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useState, useMemo } from "react";

interface DashboardStats {
  faturamentoTotal: number;
  totalPedidos: number;
  ticketMedio: number;
  tempoMedioEntrega: number;
  totalFranquias: number;
}

interface RevenueComparison {
  labels: string[];
  franchises: { tenantId: string; nome: string; data: number[] }[];
}

interface FinancialKPI {
  tenantId: string;
  nome: string;
  faturamento: number;
  totalPedidos: number;
  ticketMedio: number;
  cmv: number;
  margemBruta: number;
}

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", 
  "#3b82f6", "#8b5cf6", "#ec4899", "#6366f1", "#06b6d4"
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function DashboardContent() {
  const [sortField, setSortField] = useState<keyof FinancialKPI>("faturamento");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPerformance, setFilterPerformance] = useState<string>("all");

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/superadmin/dashboard"],
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery<RevenueComparison>({
    queryKey: ["/api/superadmin/revenue-comparison"],
  });

  const { data: financialKPIs, isLoading: financialLoading } = useQuery<FinancialKPI[]>({
    queryKey: ["/api/superadmin/financial-kpis"],
  });

  const chartData = useMemo(() => {
    if (!revenueData) return [];
    return revenueData.labels.map((label, index) => {
      const dataPoint: Record<string, string | number> = { date: label.slice(5) };
      revenueData.franchises.forEach(franchise => {
        dataPoint[franchise.nome] = franchise.data[index];
      });
      return dataPoint;
    });
  }, [revenueData]);

  const filteredAndSortedKPIs = useMemo(() => {
    if (!financialKPIs) return [];
    
    let filtered = financialKPIs.filter(kpi => 
      kpi.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filterPerformance === "high") {
      filtered = filtered.filter(kpi => kpi.margemBruta >= 60);
    } else if (filterPerformance === "medium") {
      filtered = filtered.filter(kpi => kpi.margemBruta >= 40 && kpi.margemBruta < 60);
    } else if (filterPerformance === "low") {
      filtered = filtered.filter(kpi => kpi.margemBruta < 40);
    }

    return [...filtered].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      return sortDirection === "asc" 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [financialKPIs, searchTerm, filterPerformance, sortField, sortDirection]);

  const handleSort = (field: keyof FinancialKPI) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/superadmin">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900" data-testid="text-title">
                Dashboard Global
              </h1>
              <p className="text-gray-500">Visão consolidada da rede de franquias</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card data-testid="card-faturamento">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Faturamento Total (30 dias)
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="value-faturamento">
                {formatCurrency(stats?.faturamentoTotal || 0)}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-pedidos">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total de Pedidos
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="value-pedidos">
                {stats?.totalPedidos || 0}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-ticket">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Ticket Médio Global
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="value-ticket">
                {formatCurrency(stats?.ticketMedio || 0)}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-tempo">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Tempo Médio Entrega
              </CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="value-tempo">
                {stats?.tempoMedioEntrega || 0} min
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-franquias">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Franquias
              </CardTitle>
              <Building2 className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="value-franquias">
                {stats?.totalFranquias || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="grafico" className="space-y-4">
          <TabsList>
            <TabsTrigger value="grafico" data-testid="tab-grafico">
              Comparativo de Faturamento
            </TabsTrigger>
            <TabsTrigger value="financeiro" data-testid="tab-financeiro">
              KPIs Financeiros
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grafico">
            <Card>
              <CardHeader>
                <CardTitle>Faturamento por Franquia (Últimos 30 dias)</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueLoading ? (
                  <div className="flex items-center justify-center h-80">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                  </div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), ""]}
                        labelFormatter={(label) => `Data: ${label}`}
                      />
                      <Legend />
                      {revenueData?.franchises.map((franchise, index) => (
                        <Line
                          key={franchise.tenantId}
                          type="monotone"
                          dataKey={franchise.nome}
                          stroke={COLORS[index % COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-80 text-gray-500">
                    Nenhum dado disponível para o período
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financeiro">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle>KPIs Financeiros por Franquia</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Buscar franquia..."
                        className="pl-9 w-48"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        data-testid="input-search-franchise"
                      />
                    </div>
                    <Select value={filterPerformance} onValueChange={setFilterPerformance}>
                      <SelectTrigger className="w-40" data-testid="select-performance">
                        <SelectValue placeholder="Desempenho" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="high">Alto (≥60%)</SelectItem>
                        <SelectItem value="medium">Médio (40-60%)</SelectItem>
                        <SelectItem value="low">Baixo (&lt;40%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {financialLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => handleSort("nome")}
                          >
                            <div className="flex items-center gap-1">
                              Franquia
                              <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-gray-50 text-right"
                            onClick={() => handleSort("faturamento")}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Faturamento
                              <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-gray-50 text-right"
                            onClick={() => handleSort("totalPedidos")}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Pedidos
                              <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-gray-50 text-right"
                            onClick={() => handleSort("ticketMedio")}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Ticket Médio
                              <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-gray-50 text-right"
                            onClick={() => handleSort("cmv")}
                          >
                            <div className="flex items-center justify-end gap-1">
                              CMV
                              <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:bg-gray-50 text-right"
                            onClick={() => handleSort("margemBruta")}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Margem Bruta
                              <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedKPIs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                              Nenhuma franquia encontrada
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredAndSortedKPIs.map((kpi) => (
                            <TableRow key={kpi.tenantId} data-testid={`row-kpi-${kpi.tenantId}`}>
                              <TableCell className="font-medium">{kpi.nome}</TableCell>
                              <TableCell className="text-right">{formatCurrency(kpi.faturamento)}</TableCell>
                              <TableCell className="text-right">{kpi.totalPedidos}</TableCell>
                              <TableCell className="text-right">{formatCurrency(kpi.ticketMedio)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(kpi.cmv)}</TableCell>
                              <TableCell className="text-right">
                                <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                                  kpi.margemBruta >= 60 
                                    ? "bg-green-100 text-green-800"
                                    : kpi.margemBruta >= 40
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                                }`}>
                                  {kpi.margemBruta.toFixed(1)}%
                                </span>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function SuperAdminDashboardGlobal() {
  return (
    <SuperAdminGuard>
      <DashboardContent />
    </SuperAdminGuard>
  );
}
