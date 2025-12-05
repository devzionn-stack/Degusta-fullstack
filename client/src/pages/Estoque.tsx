import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  ArrowDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export default function Estoque() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estoque Crítico</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
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

          <Card>
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
                  Todos os produtos e suas quantidades em estoque
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEstoque ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : estoqueItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Mínimo</TableHead>
                        <TableHead>Nível</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {estoqueItems.map((item) => {
                        const produto = produtoMap.get(item.produtoId);
                        const stockStatus = getStockStatus(item);
                        const percentage = getStockPercentage(item);
                        
                        return (
                          <TableRow key={item.id} data-testid={`row-estoque-${item.id}`}>
                            <TableCell className="font-medium">
                              {produto?.nome || "Produto não encontrado"}
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold">{item.quantidade}</span>
                              {item.unidade && <span className="text-gray-500 ml-1">{item.unidade}</span>}
                            </TableCell>
                            <TableCell>
                              {item.quantidadeMinima ?? 10}
                            </TableCell>
                            <TableCell className="w-32">
                              <Progress 
                                value={percentage} 
                                className={`h-2 ${stockStatus.status === 'critico' ? '[&>div]:bg-red-500' : stockStatus.status === 'baixo' ? '[&>div]:bg-amber-500' : '[&>div]:bg-green-500'}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge className={stockStatus.color}>
                                {stockStatus.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
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
