import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import KPICard from "@/components/KPICard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  Download, 
  Plus,
  Filter,
  X,
  CreditCard,
  Banknote,
  QrCode,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TIPO_OPTIONS = [
  { value: "todos", label: "Todos os Tipos" },
  { value: "receita", label: "Receita" },
  { value: "venda", label: "Venda" },
  { value: "despesa", label: "Despesa" },
  { value: "custo", label: "Custo" },
];

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos os Status" },
  { value: "confirmado", label: "Confirmado" },
  { value: "pendente", label: "Pendente" },
  { value: "cancelado", label: "Cancelado" },
];

const METODO_OPTIONS = [
  { value: "", label: "Selecione o método" },
  { value: "pix", label: "PIX" },
  { value: "cartao", label: "Cartão" },
  { value: "boleto", label: "Boleto" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
];

const ITEMS_PER_PAGE = 10;

interface Transacao {
  id: string;
  tenantId: string;
  pedidoId: string | null;
  tipo: string;
  valor: string;
  data: string;
  status: string;
  descricao: string | null;
  metodoPagamento: string | null;
  referenciaPagamento: string | null;
  createdAt: string;
}

interface FinancialStats {
  receitas: number;
  despesas: number;
  lucroLiquido: number;
  variacaoReceitas: number;
  variacaoDespesas: number;
  variacaoLucro: number;
  totalTransacoes: number;
}

export default function Financeiro() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTransacao, setNewTransacao] = useState({
    tipo: "receita",
    valor: "",
    descricao: "",
    metodoPagamento: "",
    status: "pendente",
  });

  const { data: stats, isLoading: loadingStats } = useQuery<FinancialStats>({
    queryKey: ["financial", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/financial", { credentials: "include" });
      if (!res.ok) {
        return {
          receitas: 0,
          despesas: 0,
          lucroLiquido: 0,
          variacaoReceitas: 0,
          variacaoDespesas: 0,
          variacaoLucro: 0,
          totalTransacoes: 0,
        };
      }
      return res.json();
    },
  });

  const { data: transacoes = [], isLoading: loadingTransacoes } = useQuery<Transacao[]>({
    queryKey: ["transacoes", tipoFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tipoFilter !== "todos") params.append("tipo", tipoFilter);
      if (statusFilter !== "todos") params.append("status", statusFilter);
      
      const res = await fetch(`/api/transacoes?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createTransacaoMutation = useMutation({
    mutationFn: async (data: typeof newTransacao) => {
      const res = await fetch("/api/transacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          valor: parseFloat(data.valor),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao criar transação");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transacoes"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      setIsAddDialogOpen(false);
      setNewTransacao({
        tipo: "receita",
        valor: "",
        descricao: "",
        metodoPagamento: "",
        status: "pendente",
      });
      toast({
        title: "Transação Criada",
        description: "A transação foi registrada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/transacoes/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transacoes"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      toast({
        title: "Status Atualizado",
        description: "O status da transação foi atualizado.",
      });
    },
  });

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (tipoFilter !== "todos") params.append("tipo", tipoFilter);
      if (statusFilter !== "todos") params.append("status", statusFilter);
      
      const res = await fetch(`/api/transacoes/export-csv?${params.toString()}`, {
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Erro ao exportar CSV");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transacoes_${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Exportação Concluída",
        description: "O arquivo CSV foi baixado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível exportar o CSV.",
        variant: "destructive",
      });
    }
  };

  const filteredTransacoes = useMemo(() => {
    return transacoes;
  }, [transacoes]);

  const totalPages = Math.ceil(filteredTransacoes.length / ITEMS_PER_PAGE);
  const paginatedTransacoes = filteredTransacoes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmado":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Confirmado</Badge>;
      case "pendente":
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "cancelado":
        return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case "receita":
      case "venda":
        return <Badge className="bg-blue-100 text-blue-700"><TrendingUp className="h-3 w-3 mr-1" />{tipo}</Badge>;
      case "despesa":
      case "custo":
        return <Badge className="bg-orange-100 text-orange-700"><TrendingDown className="h-3 w-3 mr-1" />{tipo}</Badge>;
      default:
        return <Badge variant="outline">{tipo}</Badge>;
    }
  };

  const getMetodoIcon = (metodo: string | null) => {
    switch (metodo) {
      case "pix":
        return <QrCode className="h-4 w-4 text-green-600" />;
      case "cartao":
        return <CreditCard className="h-4 w-4 text-blue-600" />;
      case "boleto":
        return <Receipt className="h-4 w-4 text-orange-600" />;
      case "dinheiro":
        return <Banknote className="h-4 w-4 text-green-700" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-400" />;
    }
  };

  const clearFilters = () => {
    setTipoFilter("todos");
    setStatusFilter("todos");
    setCurrentPage(1);
  };

  const hasActiveFilters = tipoFilter !== "todos" || statusFilter !== "todos";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold flex items-center gap-2" data-testid="text-title">
              <DollarSign className="h-6 w-6 text-primary" />
              Financeiro
            </h1>
            <p className="text-muted-foreground">
              Gestão de receitas, despesas e fluxo de caixa
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-transacao">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Transação
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Transação</DialogTitle>
                  <DialogDescription>
                    Registre uma nova receita ou despesa
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select
                        value={newTransacao.tipo}
                        onValueChange={(v) => setNewTransacao(prev => ({ ...prev, tipo: v }))}
                      >
                        <SelectTrigger data-testid="select-new-tipo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="receita">Receita</SelectItem>
                          <SelectItem value="venda">Venda</SelectItem>
                          <SelectItem value="despesa">Despesa</SelectItem>
                          <SelectItem value="custo">Custo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Valor (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={newTransacao.valor}
                        onChange={(e) => setNewTransacao(prev => ({ ...prev, valor: e.target.value }))}
                        data-testid="input-new-valor"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      placeholder="Descrição da transação"
                      value={newTransacao.descricao}
                      onChange={(e) => setNewTransacao(prev => ({ ...prev, descricao: e.target.value }))}
                      data-testid="input-new-descricao"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Método de Pagamento</Label>
                      <Select
                        value={newTransacao.metodoPagamento}
                        onValueChange={(v) => setNewTransacao(prev => ({ ...prev, metodoPagamento: v }))}
                      >
                        <SelectTrigger data-testid="select-new-metodo">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {METODO_OPTIONS.filter(m => m.value).map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={newTransacao.status}
                        onValueChange={(v) => setNewTransacao(prev => ({ ...prev, status: v }))}
                      >
                        <SelectTrigger data-testid="select-new-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="confirmado">Confirmado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => createTransacaoMutation.mutate(newTransacao)}
                    disabled={!newTransacao.valor || createTransacaoMutation.isPending}
                    data-testid="button-confirm-add"
                  >
                    {createTransacaoMutation.isPending ? (
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            titulo="Receitas do Mês"
            valor={`R$ ${(stats?.receitas || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            variacaoPercentual={stats?.variacaoReceitas || 0}
            icone={TrendingUp}
            corIcone="text-green-600"
            loading={loadingStats}
          />
          <KPICard
            titulo="Despesas do Mês"
            valor={`R$ ${(stats?.despesas || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            variacaoPercentual={stats?.variacaoDespesas ? -Math.abs(stats.variacaoDespesas) : 0}
            icone={TrendingDown}
            corIcone="text-red-600"
            loading={loadingStats}
          />
          <KPICard
            titulo="Lucro Líquido"
            valor={`R$ ${(stats?.lucroLiquido || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            variacaoPercentual={stats?.variacaoLucro || 0}
            icone={DollarSign}
            corIcone="text-blue-600"
            loading={loadingStats}
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Transações
                </CardTitle>
                <CardDescription>
                  {filteredTransacoes.length} transação(ões) encontrada(s)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[160px]" data-testid="select-filter-tipo">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[160px]" data-testid="select-filter-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingTransacoes ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTransacoes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhuma transação encontrada</p>
                <p className="text-sm">Adicione uma nova transação para começar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransacoes.map((transacao) => (
                      <TableRow key={transacao.id} data-testid={`row-transacao-${transacao.id}`}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(transacao.data), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{getTipoBadge(transacao.tipo)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {transacao.descricao || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getMetodoIcon(transacao.metodoPagamento)}
                            <span className="capitalize">{transacao.metodoPagamento || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${
                          transacao.tipo === "receita" || transacao.tipo === "venda" 
                            ? "text-green-600" 
                            : "text-red-600"
                        }`}>
                          {transacao.tipo === "receita" || transacao.tipo === "venda" ? "+" : "-"}
                          R$ {parseFloat(transacao.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>{getStatusBadge(transacao.status)}</TableCell>
                        <TableCell className="text-center">
                          {transacao.status === "pendente" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: transacao.id, status: "confirmado" })}
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-confirm-${transacao.id}`}
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t mt-4">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
