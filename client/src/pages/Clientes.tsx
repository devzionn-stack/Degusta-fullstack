import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant-context";
import { buildApiUrl } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  Users, 
  Phone, 
  Mail, 
  MapPin, 
  Loader2, 
  Pencil, 
  Trash2,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Calendar,
  Award,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Cliente {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  createdAt: string;
}

interface ResumoClientes {
  totalClientes: number;
  clientesAtivos30d: number;
  ticketMedioGeral: number;
  receitaTotal: number;
  pedidosTotal: number;
}

interface RankingCliente {
  id: string;
  nome: string;
  totalPedidos: number;
  totalGasto: number;
  ticketMedio: number;
  ultimoPedido: string | null;
}

interface ClienteMetricas {
  clienteId: string;
  totalPedidos: number;
  totalGasto: number;
  ticketMedio: number;
  custoGerado: number;
  lucroGerado: number;
  margemMedia: number;
  ultimoPedido: string | null;
  frequenciaMensal: number;
  pizzasMaisCompradas: { nome: string; quantidade: number }[];
}

export default function Clientes() {
  const { isSuperAdmin } = useAuth();
  const { selectedTenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [ordenarPor, setOrdenarPor] = useState<"gasto" | "pedidos" | "ticket">("gasto");
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    endereco: "",
  });

  const effectiveTenantId = isSuperAdmin ? selectedTenantId : null;

  const { data: clientes = [], isLoading } = useQuery<Cliente[]>({
    queryKey: ["clientes", effectiveTenantId],
    queryFn: async () => {
      const url = buildApiUrl("/api/clientes", effectiveTenantId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) return [];
        throw new Error("Failed to fetch clients");
      }
      return res.json();
    },
    enabled: isSuperAdmin ? !!selectedTenantId : true,
  });

  const { data: resumo } = useQuery<ResumoClientes>({
    queryKey: ["clientes-resumo", effectiveTenantId],
    queryFn: async () => {
      const url = buildApiUrl("/api/clientes/metricas/resumo", effectiveTenantId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch resumo");
      return res.json();
    },
    enabled: isSuperAdmin ? !!selectedTenantId : true,
  });

  const { data: ranking = [] } = useQuery<RankingCliente[]>({
    queryKey: ["clientes-ranking", effectiveTenantId, ordenarPor],
    queryFn: async () => {
      const url = buildApiUrl(`/api/clientes/metricas/ranking?ordenarPor=${ordenarPor}&limite=10`, effectiveTenantId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch ranking");
      return res.json();
    },
    enabled: isSuperAdmin ? !!selectedTenantId : true,
  });

  const { data: clienteMetricas, isLoading: loadingMetricas } = useQuery<ClienteMetricas>({
    queryKey: ["cliente-metricas", selectedClienteId],
    queryFn: async () => {
      const url = buildApiUrl(`/api/clientes/${selectedClienteId}/metricas`, effectiveTenantId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch metricas");
      return res.json();
    },
    enabled: !!selectedClienteId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = buildApiUrl("/api/clientes", effectiveTenantId);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create client");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-resumo"] });
      toast({ title: "Cliente criado com sucesso!" });
      resetForm();
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao criar cliente" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const url = buildApiUrl(`/api/clientes/${id}`, effectiveTenantId);
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update client");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast({ title: "Cliente atualizado com sucesso!" });
      resetForm();
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao atualizar cliente" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const url = buildApiUrl(`/api/clientes/${id}`, effectiveTenantId);
      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete client");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-resumo"] });
      toast({ title: "Cliente removido com sucesso!" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao remover cliente" });
    },
  });

  const resetForm = () => {
    setFormData({ nome: "", email: "", telefone: "", endereco: "" });
    setEditingCliente(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCliente) {
      updateMutation.mutate({ id: editingCliente.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome,
      email: cliente.email || "",
      telefone: cliente.telefone || "",
      endereco: cliente.endereco || "",
    });
    setIsDialogOpen(true);
  };

  const filteredClientes = clientes.filter((cliente) =>
    cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.telefone?.includes(searchTerm)
  );

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
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">CRM - Clientes</h1>
            <p className="text-muted-foreground">Gerencie e analise sua base de clientes</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-client">
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCliente ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
                <DialogDescription>
                  {editingCliente ? "Atualize as informações do cliente" : "Adicione um novo cliente ao sistema"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Nome do cliente"
                      required
                      data-testid="input-client-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@exemplo.com"
                      data-testid="input-client-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      placeholder="(11) 99999-9999"
                      data-testid="input-client-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                      placeholder="Rua, número, bairro"
                      data-testid="input-client-address"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-client"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingCliente ? "Salvar" : "Criar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Clientes</p>
                  <p className="text-2xl font-bold">{resumo?.totalClientes || 0}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ativos (30 dias)</p>
                  <p className="text-2xl font-bold">{resumo?.clientesAtivos30d || 0}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ticket Médio</p>
                  <p className="text-2xl font-bold">{formatCurrency(resumo?.ticketMedioGeral || 0)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Receita Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(resumo?.receitaTotal || 0)}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pedidos</p>
                  <p className="text-2xl font-bold">{resumo?.pedidosTotal || 0}</p>
                </div>
                <ShoppingBag className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="lista" className="space-y-4">
          <TabsList>
            <TabsTrigger value="lista">Lista de Clientes</TabsTrigger>
            <TabsTrigger value="ranking">Ranking Top 10</TabsTrigger>
            <TabsTrigger value="detalhes">Detalhes Cliente</TabsTrigger>
          </TabsList>

          <TabsContent value="lista">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar clientes..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-clients"
                    />
                  </div>
                  <Badge variant="secondary">
                    {filteredClientes.length} clientes
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredClientes.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhum cliente encontrado</h3>
                    <p className="text-muted-foreground">
                      {searchTerm ? "Tente uma busca diferente" : "Adicione seu primeiro cliente"}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead>Endereço</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClientes.map((cliente) => (
                        <TableRow 
                          key={cliente.id} 
                          data-testid={`row-client-${cliente.id}`}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedClienteId(cliente.id)}
                        >
                          <TableCell className="font-medium">{cliente.nome}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {cliente.email && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Mail className="h-3 w-3" />
                                  {cliente.email}
                                </div>
                              )}
                              {cliente.telefone && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Phone className="h-3 w-3" />
                                  {cliente.telefone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {cliente.endereco && (
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate max-w-[200px]">{cliente.endereco}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(cliente.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(cliente)}
                                data-testid={`button-edit-client-${cliente.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteMutation.mutate(cliente.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-client-${cliente.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ranking">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-yellow-500" />
                      Top 10 Clientes
                    </CardTitle>
                    <CardDescription>Seus melhores clientes por desempenho</CardDescription>
                  </div>
                  <Select value={ordenarPor} onValueChange={(v: "gasto" | "pedidos" | "ticket") => setOrdenarPor(v)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gasto">Total Gasto</SelectItem>
                      <SelectItem value="pedidos">Qtd. Pedidos</SelectItem>
                      <SelectItem value="ticket">Ticket Médio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ranking.map((cliente, index) => {
                    const maxValue = ranking[0]?.[ordenarPor === "gasto" ? "totalGasto" : ordenarPor === "pedidos" ? "totalPedidos" : "ticketMedio"] || 1;
                    const currentValue = cliente[ordenarPor === "gasto" ? "totalGasto" : ordenarPor === "pedidos" ? "totalPedidos" : "ticketMedio"];
                    const percentage = (currentValue / maxValue) * 100;
                    
                    return (
                      <div 
                        key={cliente.id} 
                        className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedClienteId(cliente.id)}
                        data-testid={`ranking-client-${cliente.id}`}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium truncate">{cliente.nome}</span>
                            <span className="text-sm text-muted-foreground">
                              {ordenarPor === "gasto" ? formatCurrency(cliente.totalGasto) : 
                               ordenarPor === "pedidos" ? `${cliente.totalPedidos} pedidos` :
                               formatCurrency(cliente.ticketMedio)}
                            </span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                          <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                            <span>{cliente.totalPedidos} pedidos</span>
                            <span>Ticket: {formatCurrency(cliente.ticketMedio)}</span>
                            {cliente.ultimoPedido && (
                              <span>
                                Último: {formatDistanceToNow(new Date(cliente.ultimoPedido), { addSuffix: true, locale: ptBR })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {ranking.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum dado de ranking disponível</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detalhes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Detalhes do Cliente
                </CardTitle>
                <CardDescription>
                  {selectedClienteId ? "Análise detalhada do cliente selecionado" : "Clique em um cliente para ver os detalhes"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedClienteId ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Selecione um cliente na lista ou no ranking para ver os detalhes</p>
                  </div>
                ) : loadingMetricas ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : clienteMetricas ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Total Pedidos</p>
                        <p className="text-2xl font-bold">{clienteMetricas.totalPedidos}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Total Gasto</p>
                        <p className="text-2xl font-bold">{formatCurrency(clienteMetricas.totalGasto)}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Ticket Médio</p>
                        <p className="text-2xl font-bold">{formatCurrency(clienteMetricas.ticketMedio)}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Frequência Mensal</p>
                        <p className="text-2xl font-bold">{clienteMetricas.frequenciaMensal.toFixed(1)}x</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-muted-foreground">Custo Gerado</p>
                          <ArrowDownRight className="h-4 w-4 text-red-500" />
                        </div>
                        <p className="text-xl font-bold text-red-600">{formatCurrency(clienteMetricas.custoGerado)}</p>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-muted-foreground">Lucro Gerado</p>
                          <ArrowUpRight className="h-4 w-4 text-green-500" />
                        </div>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(clienteMetricas.lucroGerado)}</p>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-muted-foreground">Margem Média</p>
                          <TrendingUp className="h-4 w-4 text-blue-500" />
                        </div>
                        <p className="text-xl font-bold">{clienteMetricas.margemMedia.toFixed(1)}%</p>
                      </div>
                    </div>

                    {clienteMetricas.ultimoPedido && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Último pedido: {format(new Date(clienteMetricas.ultimoPedido), "dd/MM/yyyy HH:mm", { locale: ptBR })} 
                          ({formatDistanceToNow(new Date(clienteMetricas.ultimoPedido), { addSuffix: true, locale: ptBR })})
                        </span>
                      </div>
                    )}

                    {clienteMetricas.pizzasMaisCompradas.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3">Pizzas Mais Compradas</h4>
                        <div className="space-y-2">
                          {clienteMetricas.pizzasMaisCompradas.map((pizza, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/30">
                              <span>{pizza.nome}</span>
                              <Badge variant="secondary">{pizza.quantidade}x</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Não foi possível carregar os dados do cliente</p>
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
