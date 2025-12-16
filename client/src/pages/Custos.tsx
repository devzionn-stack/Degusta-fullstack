import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import KPICard from "@/components/KPICard";
import { useQuery } from "@tanstack/react-query";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Percent,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Leaf,
  ShoppingBag,
  BarChart3
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CustoProduto {
  produtoId: string;
  produtoNome: string;
  precoVenda: number;
  custoReal: number;
  lucroBruto: number;
  margemLucro: number;
  ingredientes: {
    ingredienteId: string;
    nome: string;
    quantidade: number;
    unidade: string;
    custoUnitario: number;
    custoTotal: number;
  }[];
}

interface LucroFranquia {
  tenantId: string;
  tenantNome: string;
  totalVendas: number;
  custoTotalIngredientes: number;
  lucroBrutoTotal: number;
  margemLucroMedia: number;
  produtosVendidos: number;
}

interface LucroIngrediente {
  ingredienteId: string;
  ingredienteNome: string;
  unidade: string;
  custoAtual: number;
  quantidadeUsada: number;
  custoTotalPeriodo: number;
  produtosQueUsam: number;
}

export default function Custos() {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const { data: custosProdutos = [], isLoading: loadingProdutos, refetch: refetchProdutos } = useQuery<CustoProduto[]>({
    queryKey: ["custos", "produtos"],
    queryFn: async () => {
      const res = await fetch("/api/custo/produtos", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: lucroFranquia, isLoading: loadingFranquia, refetch: refetchFranquia } = useQuery<LucroFranquia>({
    queryKey: ["lucro", "franquia"],
    queryFn: async () => {
      const res = await fetch("/api/lucro/franquia", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: lucroIngredientes = [], isLoading: loadingIngredientes, refetch: refetchIngredientes } = useQuery<LucroIngrediente[]>({
    queryKey: ["lucro", "ingredientes"],
    queryFn: async () => {
      const res = await fetch("/api/lucro/ingredientes", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const toggleProductExpanded = (productId: string) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getMargemBadge = (margem: number) => {
    if (margem >= 50) return "default";
    if (margem >= 30) return "secondary";
    return "destructive";
  };

  const refetchAll = () => {
    refetchProdutos();
    refetchFranquia();
    refetchIngredientes();
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground font-playfair" data-testid="page-title">
              Custos e Lucro
            </h1>
            <p className="text-muted-foreground">
              Análise de custos por ingrediente e margem de lucro
            </p>
          </div>
          <Button onClick={refetchAll} variant="outline" data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <KPICard
            titulo="Vendas Totais"
            valor={formatCurrency(lucroFranquia?.totalVendas || 0)}
            icone={DollarSign}
            variacaoPercentual={5}
            loading={loadingFranquia}
          />
          <KPICard
            titulo="Custo Ingredientes"
            valor={formatCurrency(lucroFranquia?.custoTotalIngredientes || 0)}
            icone={Leaf}
            loading={loadingFranquia}
          />
          <KPICard
            titulo="Lucro Bruto"
            valor={formatCurrency(lucroFranquia?.lucroBrutoTotal || 0)}
            icone={TrendingUp}
            variacaoPercentual={lucroFranquia?.lucroBrutoTotal && lucroFranquia.lucroBrutoTotal > 0 ? 10 : -5}
            loading={loadingFranquia}
          />
          <KPICard
            titulo="Margem Média"
            valor={`${(lucroFranquia?.margemLucroMedia || 0).toFixed(1)}%`}
            icone={Percent}
            variacaoPercentual={lucroFranquia?.margemLucroMedia && lucroFranquia.margemLucroMedia >= 30 ? 2 : -3}
            loading={loadingFranquia}
          />
        </div>

        <Tabs defaultValue="produtos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="produtos" data-testid="tab-produtos">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Por Produto
            </TabsTrigger>
            <TabsTrigger value="ingredientes" data-testid="tab-ingredientes">
              <Leaf className="h-4 w-4 mr-2" />
              Por Ingrediente
            </TabsTrigger>
            <TabsTrigger value="resumo" data-testid="tab-resumo">
              <BarChart3 className="h-4 w-4 mr-2" />
              Resumo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="produtos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Custo e Lucro por Produto
                </CardTitle>
                <CardDescription>
                  Análise detalhada do custo de ingredientes e margem de cada produto
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingProdutos ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : custosProdutos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum produto com receita cadastrada encontrado.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {custosProdutos.map((produto) => (
                      <Collapsible
                        key={produto.produtoId}
                        open={expandedProducts.has(produto.produtoId)}
                        onOpenChange={() => toggleProductExpanded(produto.produtoId)}
                      >
                        <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                          <CollapsibleTrigger className="w-full" data-testid={`product-row-${produto.produtoId}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                {expandedProducts.has(produto.produtoId) ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                                <div className="text-left">
                                  <p className="font-medium">{produto.produtoNome}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {produto.ingredientes.length} ingredientes
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-6 text-right">
                                <div>
                                  <p className="text-sm text-muted-foreground">Preço Venda</p>
                                  <p className="font-medium">{formatCurrency(produto.precoVenda)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Custo</p>
                                  <p className="font-medium text-amber-600">{formatCurrency(produto.custoReal)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Lucro</p>
                                  <p className={`font-medium ${produto.lucroBruto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(produto.lucroBruto)}
                                  </p>
                                </div>
                                <Badge variant={getMargemBadge(produto.margemLucro)}>
                                  {produto.margemLucro.toFixed(1)}% margem
                                </Badge>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-4 pt-4 border-t">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Ingrediente</TableHead>
                                    <TableHead className="text-right">Quantidade</TableHead>
                                    <TableHead className="text-right">Custo Unit.</TableHead>
                                    <TableHead className="text-right">Custo Total</TableHead>
                                    <TableHead className="text-right">% do Custo</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {produto.ingredientes.map((ing) => (
                                    <TableRow key={ing.ingredienteId}>
                                      <TableCell>{ing.nome}</TableCell>
                                      <TableCell className="text-right">
                                        {ing.quantidade.toFixed(2)} {ing.unidade}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(ing.custoUnitario)}
                                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        {formatCurrency(ing.custoTotal)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <Progress 
                                            value={(ing.custoTotal / produto.custoReal) * 100} 
                                            className="w-16 h-2"
                                          />
                                          <span className="text-sm text-muted-foreground w-12">
                                            {((ing.custoTotal / produto.custoReal) * 100).toFixed(0)}%
                                          </span>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ingredientes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Leaf className="h-5 w-5" />
                  Análise por Ingrediente
                </CardTitle>
                <CardDescription>
                  Custo e consumo de cada ingrediente no período
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingIngredientes ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : lucroIngredientes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum ingrediente cadastrado encontrado.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingrediente</TableHead>
                        <TableHead className="text-right">Custo Atual</TableHead>
                        <TableHead className="text-right">Qtd. Usada</TableHead>
                        <TableHead className="text-right">Custo Total</TableHead>
                        <TableHead className="text-right">Produtos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lucroIngredientes.map((ing) => (
                        <TableRow key={ing.ingredienteId} data-testid={`ingredient-row-${ing.ingredienteId}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{ing.ingredienteNome}</p>
                              <p className="text-sm text-muted-foreground">por {ing.unidade}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(ing.custoAtual)}
                          </TableCell>
                          <TableCell className="text-right">
                            {ing.quantidadeUsada.toFixed(2)} {ing.unidade}
                          </TableCell>
                          <TableCell className="text-right font-medium text-amber-600">
                            {formatCurrency(ing.custoTotalPeriodo)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{ing.produtosQueUsam}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resumo" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Produtos Mais Lucrativos
                  </CardTitle>
                  <CardDescription>
                    Top 5 produtos com maior margem de lucro
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingProdutos ? (
                    <div className="flex justify-center py-4">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {custosProdutos
                        .sort((a, b) => b.margemLucro - a.margemLucro)
                        .slice(0, 5)
                        .map((produto, index) => (
                          <div key={produto.produtoId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-green-100 text-green-600 text-sm font-bold">
                                {index + 1}
                              </span>
                              <span className="font-medium">{produto.produtoNome}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-green-600 font-medium">
                                {formatCurrency(produto.lucroBruto)}
                              </span>
                              <Badge variant="default">
                                {produto.margemLucro.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-amber-500" />
                    Ingredientes Mais Caros
                  </CardTitle>
                  <CardDescription>
                    Top 5 ingredientes com maior custo total
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingIngredientes ? (
                    <div className="flex justify-center py-4">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {lucroIngredientes
                        .sort((a, b) => b.custoTotalPeriodo - a.custoTotalPeriodo)
                        .slice(0, 5)
                        .map((ing, index) => (
                          <div key={ing.ingredienteId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-100 text-amber-600 text-sm font-bold">
                                {index + 1}
                              </span>
                              <span className="font-medium">{ing.ingredienteNome}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-amber-600 font-medium">
                                {formatCurrency(ing.custoTotalPeriodo)}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {ing.quantidadeUsada.toFixed(0)} {ing.unidade}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Resumo Financeiro</CardTitle>
                <CardDescription>
                  Visão geral de custos e lucros da franquia
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-sm text-blue-600 font-medium">Total Vendas</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {formatCurrency(lucroFranquia?.totalVendas || 0)}
                    </p>
                    <p className="text-sm text-blue-500">
                      {lucroFranquia?.produtosVendidos || 0} produtos vendidos
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-sm text-amber-600 font-medium">Custo Ingredientes</p>
                    <p className="text-2xl font-bold text-amber-700">
                      {formatCurrency(lucroFranquia?.custoTotalIngredientes || 0)}
                    </p>
                    <p className="text-sm text-amber-500">
                      {lucroIngredientes.length} ingredientes rastreados
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-sm text-green-600 font-medium">Lucro Bruto</p>
                    <p className="text-2xl font-bold text-green-700">
                      {formatCurrency(lucroFranquia?.lucroBrutoTotal || 0)}
                    </p>
                    <p className="text-sm text-green-500">
                      Margem: {(lucroFranquia?.margemLucroMedia || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
