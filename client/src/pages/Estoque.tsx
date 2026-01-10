import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { CircularProgress } from "@/components/ui/circular-progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Warehouse,
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Plus,
  RefreshCw,
  ShoppingCart,
  Check,
  X,
  Brain,
  Sparkles,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

interface EstoqueItem {
  id: string;
  tenantId: string;
  produtoId: string;
  quantidade: number;
  quantidadeMinima: number | null;
  unidade: string | null;
  localizacao: string | null;
  lote: string | null;
  validade: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Produto {
  id: string;
  nome: string;
  preco: string;
  categoria: string | null;
}

interface PrevisaoEstoque {
  id: string;
  tenantId: string;
  produtoId: string;
  produtoNome: string;
  quantidadeAtual: number;
  quantidadeSugerida: number;
  confianca: number;
  motivo: string | null;
  status: string;
  createdAt: string;
}

function generateMockTrendData(currentQty: number, minimo: number) {
  const data = [];
  let qty = currentQty + Math.floor(Math.random() * minimo * 2);
  for (let i = 6; i >= 0; i--) {
    const consumption = Math.floor(Math.random() * (minimo * 0.3)) + 1;
    qty = Math.max(0, qty - consumption);
    data.push({
      day: i,
      quantidade: i === 0 ? currentQty : qty + Math.floor(Math.random() * 10)
    });
  }
  data.reverse();
  data[data.length - 1].quantidade = currentQty;
  return data;
}

function calculateDaysUntilEmpty(currentQty: number, trendData: { day: number; quantidade: number }[]) {
  if (trendData.length < 2) return null;
  const avgConsumption = (trendData[0].quantidade - currentQty) / 7;
  if (avgConsumption <= 0) return null;
  return Math.ceil(currentQty / avgConsumption);
}

function SparklineChart({ data, color }: { data: { day: number; quantidade: number }[]; color: string }) {
  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Tooltip 
            contentStyle={{ 
              fontSize: '10px', 
              padding: '4px 8px',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '4px'
            }}
            formatter={(value: number) => [`${value} un.`, 'Qtd']}
            labelFormatter={(label: number) => `Dia ${7 - label}`}
          />
          <Line 
            type="monotone" 
            dataKey="quantidade" 
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function StockStatusBadge({ status, isCritical }: { status: string; isCritical: boolean }) {
  if (status === 'critico' || status === 'sem_estoque') {
    return (
      <Badge 
        className={`bg-red-500 text-white border-0 flex items-center gap-1 ${isCritical ? 'animate-pulse-critical' : ''}`}
        data-testid="badge-critico"
      >
        <AlertTriangle className="h-3 w-3" />
        CRÍTICO
      </Badge>
    );
  }
  if (status === 'baixo') {
    return (
      <Badge className="bg-amber-500 text-white border-0 flex items-center gap-1" data-testid="badge-baixo">
        <AlertCircle className="h-3 w-3" />
        BAIXO
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-500 text-white border-0 flex items-center gap-1" data-testid="badge-ok">
      <CheckCircle2 className="h-3 w-3" />
      OK
    </Badge>
  );
}

function RadialGauge({ percentage, size = 60 }: { percentage: number; size?: number }) {
  let color: "success" | "warning" | "danger" = "success";
  if (percentage < 20) color = "danger";
  else if (percentage < 50) color = "warning";
  
  return (
    <CircularProgress 
      value={percentage} 
      size={size}
      strokeWidth={6}
      color={color}
      showValue={true}
    />
  );
}

export default function Estoque() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isReporDialogOpen, setIsReporDialogOpen] = useState(false);
  const [selectedReporItem, setSelectedReporItem] = useState<EstoqueItem | null>(null);
  const [reporQuantidade, setReporQuantidade] = useState("");
  const [selectedProduto, setSelectedProduto] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [quantidadeMinima, setQuantidadeMinima] = useState("");

  const { data: estoqueItems = [], isLoading: loadingEstoque } = useQuery<EstoqueItem[]>({
    queryKey: ["estoque"],
    queryFn: async () => {
      const res = await fetch("/api/estoque", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar estoque");
      return res.json();
    },
  });

  const { data: produtos = [] } = useQuery<Produto[]>({
    queryKey: ["produtos"],
    queryFn: async () => {
      const res = await fetch("/api/produtos", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: previsoes = [], isLoading: loadingPrevisoes } = useQuery<PrevisaoEstoque[]>({
    queryKey: ["estoque", "previsoes"],
    queryFn: async () => {
      const res = await fetch("/api/estoque/previsoes", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar previsões");
      return res.json();
    },
  });

  const gerarPrevisoesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/estoque/gerar-previsoes", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao gerar previsões");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["estoque", "previsoes"] });
      toast({ title: data.message });
    },
    onError: () => {
      toast({ title: "Erro ao gerar previsões", variant: "destructive" });
    },
  });

  const updatePrevisaoMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/estoque/previsoes/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar previsão");
      return res.json();
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["estoque", "previsoes"] });
      toast({ 
        title: status === "aprovada" 
          ? "Previsão aprovada!" 
          : "Previsão rejeitada" 
      });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar previsão", variant: "destructive" });
    },
  });

  const addEstoqueMutation = useMutation({
    mutationFn: async (data: { produtoId: string; quantidade: number; quantidadeMinima: number }) => {
      const res = await fetch("/api/estoque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao adicionar estoque");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      toast({ title: "Estoque adicionado com sucesso!" });
      setIsAddDialogOpen(false);
      setSelectedProduto("");
      setQuantidade("");
      setQuantidadeMinima("");
    },
    onError: () => {
      toast({ title: "Erro ao adicionar estoque", variant: "destructive" });
    },
  });

  const reporEstoqueMutation = useMutation({
    mutationFn: async (data: { id: string; quantidade: number }) => {
      const res = await fetch(`/api/estoque/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quantidade: data.quantidade }),
      });
      if (!res.ok) throw new Error("Erro ao repor estoque");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      toast({ title: "Estoque reposto com sucesso!" });
      setIsReporDialogOpen(false);
      setSelectedReporItem(null);
      setReporQuantidade("");
    },
    onError: () => {
      toast({ title: "Erro ao repor estoque", variant: "destructive" });
    },
  });

  const handleAddEstoque = () => {
    if (!selectedProduto || !quantidade) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    addEstoqueMutation.mutate({
      produtoId: selectedProduto,
      quantidade: parseInt(quantidade),
      quantidadeMinima: parseInt(quantidadeMinima) || 10,
    });
  };

  const handleRepor = () => {
    if (!selectedReporItem || !reporQuantidade) {
      toast({ title: "Preencha a quantidade", variant: "destructive" });
      return;
    }
    const novaQuantidade = selectedReporItem.quantidade + parseInt(reporQuantidade);
    reporEstoqueMutation.mutate({
      id: selectedReporItem.id,
      quantidade: novaQuantidade,
    });
  };

  const openReporModal = (item: EstoqueItem) => {
    setSelectedReporItem(item);
    setReporQuantidade("");
    setIsReporDialogOpen(true);
  };

  const produtoMap = new Map(produtos.map(p => [p.id, p]));

  const getStockStatus = (item: EstoqueItem) => {
    const minimo = item.quantidadeMinima ?? 10;
    if (item.quantidade <= 0) return { status: "sem_estoque", label: "Sem Estoque", color: "bg-red-100 text-red-800" };
    if (item.quantidade < minimo) return { status: "critico", label: "Crítico", color: "bg-red-100 text-red-800" };
    if (item.quantidade < minimo * 2) return { status: "baixo", label: "Baixo", color: "bg-amber-100 text-amber-800" };
    return { status: "normal", label: "Normal", color: "bg-green-100 text-green-800" };
  };

  const getStockPercentage = (item: EstoqueItem) => {
    const minimo = item.quantidadeMinima ?? 10;
    const ideal = minimo * 3;
    return Math.min((item.quantidade / ideal) * 100, 100);
  };

  const sortedEstoqueItems = useMemo(() => {
    return [...estoqueItems].sort((a, b) => {
      const statusA = getStockStatus(a).status;
      const statusB = getStockStatus(b).status;
      const priority: Record<string, number> = { sem_estoque: 0, critico: 1, baixo: 2, normal: 3 };
      return priority[statusA] - priority[statusB];
    });
  }, [estoqueItems]);

  const trendDataMap = useMemo(() => {
    const map = new Map<string, { day: number; quantidade: number }[]>();
    estoqueItems.forEach(item => {
      map.set(item.id, generateMockTrendData(item.quantidade, item.quantidadeMinima ?? 10));
    });
    return map;
  }, [estoqueItems]);

  const stats = {
    totalItens: estoqueItems.length,
    criticos: estoqueItems.filter(i => i.quantidade < (i.quantidadeMinima ?? 10)).length,
    baixos: estoqueItems.filter(i => {
      const min = i.quantidadeMinima ?? 10;
      return i.quantidade >= min && i.quantidade < min * 2;
    }).length,
    normais: estoqueItems.filter(i => i.quantidade >= (i.quantidadeMinima ?? 10) * 2).length,
  };

  const previsoesPendentes = previsoes.filter(p => p.status === "pendente");

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Warehouse className="h-6 w-6 text-blue-600" />
              Gestão de Estoque
            </h1>
            <p className="text-gray-500 mt-1">
              Controle de inventário e previsões de compra
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-estoque">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar ao Estoque</DialogTitle>
                <DialogDescription>
                  Adicione um novo item ao controle de estoque
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="produto">Produto</Label>
                  <Select value={selectedProduto} onValueChange={setSelectedProduto}>
                    <SelectTrigger data-testid="select-produto">
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos.map((produto) => (
                        <SelectItem key={produto.id} value={produto.id}>
                          {produto.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade</Label>
                  <Input
                    id="quantidade"
                    data-testid="input-quantidade"
                    type="number"
                    min="0"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    placeholder="Ex: 100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantidadeMinima">Quantidade Mínima</Label>
                  <Input
                    id="quantidadeMinima"
                    data-testid="input-quantidade-minima"
                    type="number"
                    min="0"
                    value={quantidadeMinima}
                    onChange={(e) => setQuantidadeMinima(e.target.value)}
                    placeholder="Ex: 10"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAddEstoque}
                  disabled={addEstoqueMutation.isPending}
                  data-testid="button-submit-estoque"
                >
                  {addEstoqueMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={isReporDialogOpen} onOpenChange={setIsReporDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-green-600" />
                Reposição Rápida
              </DialogTitle>
              <DialogDescription>
                {selectedReporItem && produtoMap.get(selectedReporItem.produtoId)?.nome}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedReporItem && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500">Estoque Atual</p>
                    <p className="text-xl font-bold text-red-600">{selectedReporItem.quantidade}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Mínimo</p>
                    <p className="text-xl font-bold">{selectedReporItem.quantidadeMinima ?? 10}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Sugerido</p>
                    <p className="text-xl font-bold text-green-600">
                      +{Math.max((selectedReporItem.quantidadeMinima ?? 10) * 3 - selectedReporItem.quantidade, 10)}
                    </p>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="reporQuantidade">Quantidade a Repor</Label>
                <Input
                  id="reporQuantidade"
                  data-testid="input-repor-quantidade"
                  type="number"
                  min="1"
                  value={reporQuantidade}
                  onChange={(e) => setReporQuantidade(e.target.value)}
                  placeholder="Ex: 50"
                />
              </div>
              {reporQuantidade && selectedReporItem && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700">
                    Novo estoque: <span className="font-bold">{selectedReporItem.quantidade + parseInt(reporQuantidade || "0")}</span> unidades
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReporDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleRepor}
                disabled={reporEstoqueMutation.isPending || !reporQuantidade}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-confirmar-repor"
              >
                {reporEstoqueMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Confirmar Reposição
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-itens">
                {stats.totalItens}
              </div>
              <p className="text-xs text-muted-foreground">
                Produtos em estoque
              </p>
            </CardContent>
          </Card>

          <Card className={stats.criticos > 0 ? "border-red-300 bg-red-50/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estoque Crítico</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${stats.criticos > 0 ? "text-red-500 animate-pulse-critical" : "text-red-500"}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-criticos">
                {stats.criticos}
              </div>
              <p className="text-xs text-muted-foreground">
                Abaixo do mínimo
              </p>
            </CardContent>
          </Card>

          <Card className={stats.baixos > 0 ? "border-amber-300 bg-amber-50/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
              <TrendingDown className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600" data-testid="text-baixos">
                {stats.baixos}
              </div>
              <p className="text-xs text-muted-foreground">
                Próximo do mínimo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estoque Normal</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-normais">
                {stats.normais}
              </div>
              <p className="text-xs text-muted-foreground">
                Níveis adequados
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="estoque">
          <TabsList>
            <TabsTrigger value="estoque" data-testid="tab-estoque">
              <Package className="h-4 w-4 mr-2" />
              Estoque Atual
            </TabsTrigger>
            <TabsTrigger value="previsoes" data-testid="tab-previsoes">
              <Brain className="h-4 w-4 mr-2" />
              Previsão de Compras
              {previsoesPendentes.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {previsoesPendentes.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="estoque">
            <Card>
              <CardHeader>
                <CardTitle>Inventário</CardTitle>
                <CardDescription>
                  Produtos ordenados por criticidade • Itens mais urgentes aparecem primeiro
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEstoque ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : sortedEstoqueItems.length > 0 ? (
                  <div className="space-y-3">
                    {sortedEstoqueItems.map((item, index) => {
                      const produto = produtoMap.get(item.produtoId);
                      const stockStatus = getStockStatus(item);
                      const percentage = getStockPercentage(item);
                      const trendData = trendDataMap.get(item.id) || [];
                      const daysUntilEmpty = calculateDaysUntilEmpty(item.quantidade, trendData);
                      const isCritical = stockStatus.status === 'critico' || stockStatus.status === 'sem_estoque';
                      const isLow = stockStatus.status === 'baixo';
                      
                      const cardClasses = `
                        border rounded-lg p-4 transition-all duration-300
                        ${isCritical ? 'stock-card-critical animate-shake-attention border-2' : ''}
                        ${isLow ? 'stock-card-low border-2' : ''}
                        ${!isCritical && !isLow ? 'hover:shadow-md' : ''}
                      `;
                      
                      const trendColor = isCritical ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e';
                      
                      return (
                        <div 
                          key={item.id} 
                          className={cardClasses}
                          style={{ animationDelay: `${index * 0.1}s` }}
                          data-testid={`card-estoque-${item.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <RadialGauge percentage={percentage} size={70} />
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-lg truncate">
                                  {produto?.nome || "Produto não encontrado"}
                                </h3>
                                <StockStatusBadge status={stockStatus.status} isCritical={isCritical} />
                              </div>
                              
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span>
                                  <span className="font-semibold text-gray-900">{item.quantidade}</span>
                                  {item.unidade && <span className="ml-1">{item.unidade}</span>}
                                  {!item.unidade && <span className="ml-1">unidades</span>}
                                </span>
                                <span className="text-gray-300">|</span>
                                <span>Mínimo: {item.quantidadeMinima ?? 10}</span>
                                
                                {daysUntilEmpty && daysUntilEmpty <= 14 && (
                                  <>
                                    <span className="text-gray-300">|</span>
                                    <span className={`flex items-center gap-1 ${daysUntilEmpty <= 3 ? 'text-red-600 font-semibold' : daysUntilEmpty <= 7 ? 'text-amber-600' : 'text-gray-500'}`}>
                                      <Clock className="h-3 w-3" />
                                      {daysUntilEmpty <= 3 ? 'Esgota em' : 'Previsão:'} ~{daysUntilEmpty} dias
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-center gap-1">
                              <p className="text-xs text-gray-400">Tendência 7 dias</p>
                              <SparklineChart data={trendData} color={trendColor} />
                            </div>
                            
                            {isCritical && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                                onClick={() => openReporModal(item)}
                                data-testid={`button-repor-${item.id}`}
                              >
                                <ShoppingCart className="h-4 w-4 mr-1" />
                                Repor
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum item no estoque ainda.</p>
                    <p className="text-sm">Clique em "Adicionar Item" para começar.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="previsoes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    Previsões de Compra Inteligentes
                  </CardTitle>
                  <CardDescription>
                    Sugestões baseadas no nível atual de estoque e histórico de vendas
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => gerarPrevisoesMutation.mutate()}
                  disabled={gerarPrevisoesMutation.isPending}
                  data-testid="button-gerar-previsoes"
                >
                  {gerarPrevisoesMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Brain className="h-4 w-4 mr-2" />
                  )}
                  Gerar Previsões
                </Button>
              </CardHeader>
              <CardContent>
                {loadingPrevisoes ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : previsoes.length > 0 ? (
                  <div className="space-y-4">
                    {previsoes.map((previsao) => (
                      <div 
                        key={previsao.id} 
                        className={`border rounded-lg p-4 ${previsao.status === 'aprovada' ? 'bg-green-50 border-green-200' : previsao.status === 'rejeitada' ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white'}`}
                        data-testid={`card-previsao-${previsao.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h4 className="font-semibold text-lg">{previsao.produtoNome}</h4>
                            <p className="text-sm text-gray-500">{previsao.motivo}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center gap-1 text-sm">
                                <ArrowDown className="h-4 w-4 text-red-500" />
                                <span className="text-gray-600">Atual:</span>
                                <span className="font-medium">{previsao.quantidadeAtual}</span>
                              </div>
                              <div className="flex items-center gap-1 text-sm">
                                <ArrowUp className="h-4 w-4 text-green-500" />
                                <span className="text-gray-600">Sugerido:</span>
                                <span className="font-medium text-green-600">+{previsao.quantidadeSugerida}</span>
                              </div>
                              <div className="flex items-center gap-1 text-sm">
                                <Brain className="h-4 w-4 text-purple-500" />
                                <span className="text-gray-600">Confiança:</span>
                                <span className="font-medium">{Math.round(previsao.confianca * 100)}%</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {previsao.status === "pendente" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:bg-red-50"
                                  onClick={() => updatePrevisaoMutation.mutate({ id: previsao.id, status: "rejeitada" })}
                                  disabled={updatePrevisaoMutation.isPending}
                                  data-testid={`button-rejeitar-${previsao.id}`}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Rejeitar
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => updatePrevisaoMutation.mutate({ id: previsao.id, status: "aprovada" })}
                                  disabled={updatePrevisaoMutation.isPending}
                                  data-testid={`button-aprovar-${previsao.id}`}
                                >
                                  <ShoppingCart className="h-4 w-4 mr-1" />
                                  Gerar Pedido
                                </Button>
                              </>
                            ) : (
                              <Badge className={previsao.status === 'aprovada' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                {previsao.status === 'aprovada' ? (
                                  <><Check className="h-3 w-3 mr-1" /> Aprovada</>
                                ) : (
                                  <><X className="h-3 w-3 mr-1" /> Rejeitada</>
                                )}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>Criado em {format(new Date(previsao.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma previsão de compra gerada ainda.</p>
                    <p className="text-sm">Clique em "Gerar Previsões" para analisar seu estoque.</p>
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
