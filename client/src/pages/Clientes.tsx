import { useState, useMemo } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  TrendingDown,
  Minus,
  DollarSign,
  ShoppingBag,
  Calendar,
  Award,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  MessageCircle,
  Gift,
  Tag,
  Crown,
  Clock,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, ResponsiveContainer } from "recharts";

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

interface ClienteEnhanced extends Cliente {
  totalPedidos?: number;
  totalGasto?: number;
  ticketMedio?: number;
  ultimoPedido?: string | null;
  frequenciaMensal?: number;
  frequenciaAnterior?: number;
  gastosUltimos30Dias?: number[];
  pedidosUltimos30Dias?: number[];
  isVIP?: boolean;
  isInativo?: boolean;
  isNovo?: boolean;
  trendPercentual?: number;
}

type CohortFilter = "todos" | "vips" | "inativos" | "novos";

function MicroSparkline({ 
  data, 
  color = "#22c55e",
  height = 24,
  width = 60
}: { 
  data: number[]; 
  color?: string;
  height?: number;
  width?: number;
}) {
  const chartData = data.map((value, index) => ({ value, index }));
  
  return (
    <div style={{ width, height }} className="inline-block">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendBadge({ 
  percentual, 
  showPercentual = true 
}: { 
  percentual: number; 
  showPercentual?: boolean;
}) {
  if (percentual > 5) {
    return (
      <Badge 
        variant="outline" 
        className="bg-green-50 text-green-700 border-green-200 gap-1"
        data-testid="badge-trend-up"
      >
        <TrendingUp className="h-3 w-3" />
        {showPercentual && <span>+{percentual.toFixed(0)}%</span>}
      </Badge>
    );
  } else if (percentual < -5) {
    return (
      <Badge 
        variant="outline" 
        className="bg-red-50 text-red-700 border-red-200 gap-1"
        data-testid="badge-trend-down"
      >
        <TrendingDown className="h-3 w-3" />
        {showPercentual && <span>{percentual.toFixed(0)}%</span>}
      </Badge>
    );
  }
  return (
    <Badge 
      variant="outline" 
      className="bg-gray-50 text-gray-600 border-gray-200 gap-1"
      data-testid="badge-trend-stable"
    >
      <Minus className="h-3 w-3" />
      {showPercentual && <span>0%</span>}
    </Badge>
  );
}

function VIPBadge() {
  return (
    <Badge 
      className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white border-0 gap-1"
      data-testid="badge-vip"
    >
      <Crown className="h-3 w-3" />
      VIP
    </Badge>
  );
}

function InativoBadge() {
  return (
    <Badge 
      variant="outline" 
      className="bg-gray-100 text-gray-500 border-gray-300 gap-1"
      data-testid="badge-inativo"
    >
      <Clock className="h-3 w-3" />
      Inativo
    </Badge>
  );
}

function NovoBadge() {
  return (
    <Badge 
      variant="outline" 
      className="bg-blue-50 text-blue-700 border-blue-200 gap-1"
      data-testid="badge-novo"
    >
      <Sparkles className="h-3 w-3" />
      Novo
    </Badge>
  );
}

function QuickActionsRail({ 
  cliente, 
  onWhatsApp, 
  onPromo, 
  onTag 
}: { 
  cliente: ClienteEnhanced;
  onWhatsApp: () => void;
  onPromo: () => void;
  onTag: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={(e) => { e.stopPropagation(); onWhatsApp(); }}
              disabled={!cliente.telefone}
              data-testid={`button-whatsapp-${cliente.id}`}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Contato via WhatsApp</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
              onClick={(e) => { e.stopPropagation(); onPromo(); }}
              data-testid={`button-promo-${cliente.id}`}
            >
              <Gift className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Enviar cupom/promoção</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={(e) => { e.stopPropagation(); onTag(); }}
              data-testid={`button-tag-${cliente.id}`}
            >
              <Tag className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Categorizar cliente</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function generateMockSparklineData(): number[] {
  return Array.from({ length: 30 }, () => Math.floor(Math.random() * 10));
}

function generateMockGastosData(): number[] {
  return Array.from({ length: 30 }, () => Math.floor(Math.random() * 200));
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
  const [cohortFilter, setCohortFilter] = useState<CohortFilter>("todos");
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

  const enhancedClientes = useMemo<ClienteEnhanced[]>(() => {
    const rankingMap = new Map(ranking.map(r => [r.id, r]));
    const sortedByGasto = [...ranking].sort((a, b) => b.totalGasto - a.totalGasto);
    const top10PercentThreshold = sortedByGasto.length > 0 
      ? sortedByGasto[Math.floor(sortedByGasto.length * 0.1)]?.totalGasto || 0 
      : 0;

    return clientes.map(cliente => {
      const rankingData = rankingMap.get(cliente.id);
      const createdDate = new Date(cliente.createdAt);
      const daysSinceCreation = differenceInDays(new Date(), createdDate);
      const isNovo = daysSinceCreation <= 7;
      
      const ultimoPedidoDate = rankingData?.ultimoPedido ? new Date(rankingData.ultimoPedido) : null;
      const diasDesdeUltimoPedido = ultimoPedidoDate 
        ? differenceInDays(new Date(), ultimoPedidoDate) 
        : 999;
      const isInativo = diasDesdeUltimoPedido > 30;
      
      const totalGasto = rankingData?.totalGasto || 0;
      const isVIP = totalGasto >= top10PercentThreshold && top10PercentThreshold > 0;

      const frequenciaMensal = rankingData?.totalPedidos 
        ? (rankingData.totalPedidos / Math.max(1, daysSinceCreation / 30)) 
        : 0;
      const frequenciaAnterior = frequenciaMensal * (0.8 + Math.random() * 0.4);
      const trendPercentual = frequenciaAnterior > 0 
        ? ((frequenciaMensal - frequenciaAnterior) / frequenciaAnterior) * 100 
        : 0;

      return {
        ...cliente,
        totalPedidos: rankingData?.totalPedidos || 0,
        totalGasto,
        ticketMedio: rankingData?.ticketMedio || 0,
        ultimoPedido: rankingData?.ultimoPedido,
        frequenciaMensal,
        frequenciaAnterior,
        gastosUltimos30Dias: generateMockGastosData(),
        pedidosUltimos30Dias: generateMockSparklineData(),
        isVIP,
        isInativo,
        isNovo,
        trendPercentual,
      };
    });
  }, [clientes, ranking]);

  const cohortCounts = useMemo(() => {
    return {
      todos: enhancedClientes.length,
      vips: enhancedClientes.filter(c => c.isVIP).length,
      inativos: enhancedClientes.filter(c => c.isInativo).length,
      novos: enhancedClientes.filter(c => c.isNovo).length,
    };
  }, [enhancedClientes]);

  const filteredClientes = useMemo(() => {
    let result = enhancedClientes;

    if (cohortFilter === "vips") {
      result = result.filter(c => c.isVIP);
    } else if (cohortFilter === "inativos") {
      result = result.filter(c => c.isInativo);
    } else if (cohortFilter === "novos") {
      result = result.filter(c => c.isNovo);
    }

    if (searchTerm) {
      result = result.filter((cliente) =>
        cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.telefone?.includes(searchTerm)
      );
    }

    return result;
  }, [enhancedClientes, cohortFilter, searchTerm]);

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

  const handleWhatsApp = (cliente: ClienteEnhanced) => {
    if (cliente.telefone) {
      const phone = cliente.telefone.replace(/\D/g, "");
      window.open(`https://wa.me/55${phone}`, "_blank");
    }
  };

  const handlePromo = (cliente: ClienteEnhanced) => {
    toast({ 
      title: "Enviar Promoção", 
      description: `Abrindo modal de promoção para ${cliente.nome}` 
    });
  };

  const handleTag = (cliente: ClienteEnhanced) => {
    toast({ 
      title: "Categorizar Cliente", 
      description: `Abrindo categorização para ${cliente.nome}` 
    });
  };

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
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={cohortFilter === "todos" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCohortFilter("todos")}
                      className="gap-2"
                      data-testid="tab-todos"
                    >
                      <Users className="h-4 w-4" />
                      Todos
                      <Badge variant="secondary" className="ml-1">{cohortCounts.todos}</Badge>
                    </Button>
                    <Button
                      variant={cohortFilter === "vips" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCohortFilter("vips")}
                      className="gap-2"
                      data-testid="tab-vips"
                    >
                      <Crown className="h-4 w-4 text-amber-500" />
                      VIPs
                      <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700">{cohortCounts.vips}</Badge>
                    </Button>
                    <Button
                      variant={cohortFilter === "inativos" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCohortFilter("inativos")}
                      className="gap-2"
                      data-testid="tab-inativos"
                    >
                      <Clock className="h-4 w-4 text-gray-500" />
                      Inativos
                      <Badge variant="secondary" className="ml-1 bg-gray-100 text-gray-600">{cohortCounts.inativos}</Badge>
                    </Button>
                    <Button
                      variant={cohortFilter === "novos" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCohortFilter("novos")}
                      className="gap-2"
                      data-testid="tab-novos"
                    >
                      <UserPlus className="h-4 w-4 text-blue-500" />
                      Novos
                      <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-700">{cohortCounts.novos}</Badge>
                    </Button>
                  </div>
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Pedidos (30d)</TableHead>
                          <TableHead>Gastos (30d)</TableHead>
                          <TableHead>Ticket Médio</TableHead>
                          <TableHead>Tendência</TableHead>
                          <TableHead>Ações Rápidas</TableHead>
                          <TableHead className="text-right">Editar</TableHead>
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
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{cliente.nome}</span>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  {cliente.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      {cliente.email}
                                    </span>
                                  )}
                                </div>
                                {cliente.telefone && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Phone className="h-3 w-3" />
                                    {cliente.telefone}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {cliente.isVIP && <VIPBadge />}
                                {cliente.isInativo && <InativoBadge />}
                                {cliente.isNovo && <NovoBadge />}
                                {!cliente.isVIP && !cliente.isInativo && !cliente.isNovo && (
                                  <Badge variant="outline" className="text-gray-500">Regular</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{cliente.totalPedidos || 0}</span>
                                {cliente.pedidosUltimos30Dias && (
                                  <MicroSparkline 
                                    data={cliente.pedidosUltimos30Dias} 
                                    color="#22c55e"
                                  />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {formatCurrency(cliente.totalGasto || 0)}
                                </span>
                                {cliente.gastosUltimos30Dias && (
                                  <MicroSparkline 
                                    data={cliente.gastosUltimos30Dias} 
                                    color="#8b5cf6"
                                  />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">
                                {formatCurrency(cliente.ticketMedio || 0)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <TrendBadge percentual={cliente.trendPercentual || 0} />
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <QuickActionsRail
                                cliente={cliente}
                                onWhatsApp={() => handleWhatsApp(cliente)}
                                onPromo={() => handlePromo(cliente)}
                                onTag={() => handleTag(cliente)}
                              />
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
                  </div>
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
                    const isVIP = index < Math.ceil(ranking.length * 0.1);
                    
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
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{cliente.nome}</span>
                              {isVIP && <VIPBadge />}
                            </div>
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
