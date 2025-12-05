import { useRoute, useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ArrowLeft, 
  ShoppingBag, 
  User, 
  MapPin, 
  Clock, 
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Truck,
  ChefHat,
  Package,
  Send,
  Bell,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; bgColor: string }> = {
  pendente: { label: "Pendente", color: "text-gray-700", bgColor: "bg-gray-100", icon: Clock },
  recebido: { label: "Recebido", color: "text-orange-700", bgColor: "bg-orange-100", icon: Clock },
  em_preparo: { label: "Em Preparo", color: "text-blue-700", bgColor: "bg-blue-100", icon: ChefHat },
  pronto: { label: "Pronto", color: "text-green-700", bgColor: "bg-green-100", icon: CheckCircle2 },
  saiu_entrega: { label: "Saiu para Entrega", color: "text-purple-700", bgColor: "bg-purple-100", icon: Truck },
  entregue: { label: "Entregue", color: "text-emerald-700", bgColor: "bg-emerald-100", icon: Package },
  cancelado: { label: "Cancelado", color: "text-red-700", bgColor: "bg-red-100", icon: AlertCircle },
};

const STATUS_FLOW = ["pendente", "recebido", "em_preparo", "pronto", "saiu_entrega", "entregue"];

interface PedidoItem {
  produtoId?: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal?: number;
  validado?: boolean;
}

interface Pedido {
  id: string;
  tenantId: string;
  clienteId: string | null;
  motoboyId: string | null;
  status: string;
  total: string;
  itens: PedidoItem[];
  observacoes: string | null;
  enderecoEntrega: string | null;
  origem: string | null;
  trackingLink: string | null;
  trackingToken: string | null;
  trackingStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
}

interface StatusHistoryItem {
  status: string;
  timestamp: string;
  label: string;
  completed: boolean;
  current: boolean;
}

function generateStatusHistory(pedido: Pedido): StatusHistoryItem[] {
  const currentIndex = STATUS_FLOW.indexOf(pedido.status);
  const createdDate = new Date(pedido.createdAt);
  const updatedDate = new Date(pedido.updatedAt);
  
  if (pedido.status === "cancelado") {
    return [{
      status: "cancelado",
      timestamp: format(updatedDate, "dd/MM/yyyy HH:mm", { locale: ptBR }),
      label: "Cancelado",
      completed: true,
      current: true,
    }];
  }
  
  return STATUS_FLOW.map((status, index) => {
    const config = STATUS_CONFIG[status];
    const isCompleted = index <= currentIndex;
    const isCurrent = index === currentIndex;
    
    let timestamp = "";
    if (index === 0 && isCompleted) {
      timestamp = format(createdDate, "dd/MM/yyyy HH:mm", { locale: ptBR });
    } else if (isCurrent) {
      timestamp = format(updatedDate, "dd/MM/yyyy HH:mm", { locale: ptBR });
    } else if (isCompleted) {
      const timeOffset = (index * 10) * 60 * 1000;
      const estimatedTime = new Date(createdDate.getTime() + timeOffset);
      timestamp = format(estimatedTime, "dd/MM/yyyy HH:mm", { locale: ptBR });
    }
    
    return {
      status,
      timestamp,
      label: config?.label || status,
      completed: isCompleted,
      current: isCurrent,
    };
  });
}

export default function PedidoDetails() {
  const [, params] = useRoute("/pedidos/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pedidoId = params?.id;

  const { data: pedido, isLoading, error } = useQuery<Pedido>({
    queryKey: ["pedido", pedidoId],
    queryFn: async () => {
      const res = await fetch(`/api/pedidos/${pedidoId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Pedido não encontrado");
      return res.json();
    },
    enabled: !!pedidoId,
  });

  const { data: cliente } = useQuery<Cliente>({
    queryKey: ["cliente", pedido?.clienteId],
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${pedido!.clienteId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!pedido?.clienteId,
  });

  const acionarCobrancaMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/n8n/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          endpoint: "webhook/cobranca",
          payload: {
            tipo: "cobranca",
            pedidoId: pedido?.id,
            clienteId: pedido?.clienteId,
            total: pedido?.total,
            itens: pedido?.itens,
            enderecoEntrega: pedido?.enderecoEntrega,
            clienteNome: cliente?.nome,
            clienteTelefone: cliente?.telefone,
            timestamp: new Date().toISOString(),
          },
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao acionar cobrança");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Cobrança Acionada",
        description: "O webhook de cobrança foi enviado para o N8N com sucesso.",
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
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/pedidos/${pedidoId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedido", pedidoId] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      toast({
        title: "Status Atualizado",
        description: "O status do pedido foi atualizado com sucesso.",
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

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !pedido) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => navigate("/dashboard/pedidos")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Card>
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-medium">Pedido não encontrado</h3>
              <p className="text-muted-foreground mt-2">
                O pedido que você está procurando não existe ou foi removido.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const statusConfig = STATUS_CONFIG[pedido.status] || STATUS_CONFIG.pendente;
  const StatusIcon = statusConfig.icon;
  const statusHistory = generateStatusHistory(pedido);
  const currentStatusIndex = STATUS_FLOW.indexOf(pedido.status);
  const nextStatus = STATUS_FLOW[currentStatusIndex + 1];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/pedidos")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-serif font-bold flex items-center gap-2" data-testid="text-title">
                <ShoppingBag className="h-6 w-6 text-primary" />
                Pedido #{pedido.id.slice(0, 8)}
              </h1>
              <p className="text-sm text-muted-foreground">
                Criado em {format(new Date(pedido.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className={`${statusConfig.bgColor} ${statusConfig.color} gap-1 px-3 py-1`}>
              <StatusIcon className="h-4 w-4" />
              {statusConfig.label}
            </Badge>
            {pedido.origem && (
              <Badge variant="outline" className="capitalize">
                {pedido.origem}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Itens do Pedido
                </CardTitle>
                <CardDescription>
                  {pedido.itens.length} item(s) no pedido
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pedido.itens.map((item, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      data-testid={`item-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-primary bg-primary/10 px-2 py-1 rounded text-sm">
                          {item.quantidade}x
                        </span>
                        <div>
                          <p className="font-medium">{item.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            R$ {item.precoUnitario.toFixed(2)} / unidade
                          </p>
                        </div>
                        {item.validado === false && (
                          <Badge variant="destructive" className="text-xs">
                            Não validado
                          </Badge>
                        )}
                      </div>
                      <span className="font-semibold">
                        R$ {(item.subtotal || item.quantidade * item.precoUnitario).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                
                <Separator className="my-4" />
                
                <div className="flex items-center justify-between">
                  <span className="text-lg font-medium">Total do Pedido</span>
                  <span className="text-2xl font-bold text-primary" data-testid="text-total">
                    R$ {parseFloat(pedido.total).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Histórico de Status
                </CardTitle>
                <CardDescription>
                  Acompanhe a evolução do pedido
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {statusHistory.map((item, index) => {
                    const config = STATUS_CONFIG[item.status];
                    const Icon = config?.icon || Clock;
                    
                    return (
                      <div key={item.status} className="flex gap-4 pb-6 last:pb-0" data-testid={`status-${item.status}`}>
                        <div className="flex flex-col items-center">
                          <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center
                            ${item.completed 
                              ? item.current 
                                ? `${config?.bgColor} ${config?.color} ring-2 ring-offset-2 ring-primary` 
                                : `bg-green-100 text-green-700`
                              : 'bg-muted text-muted-foreground'
                            }
                          `}>
                            {item.completed && !item.current ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : (
                              <Icon className="h-5 w-5" />
                            )}
                          </div>
                          {index < statusHistory.length - 1 && (
                            <div className={`w-0.5 flex-1 mt-2 ${
                              item.completed ? 'bg-green-300' : 'bg-muted'
                            }`} />
                          )}
                        </div>
                        <div className="flex-1 pt-1">
                          <p className={`font-medium ${item.current ? 'text-primary' : ''}`}>
                            {item.label}
                          </p>
                          {item.timestamp && (
                            <p className="text-sm text-muted-foreground">
                              {item.timestamp}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {cliente && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-medium" data-testid="text-cliente-nome">{cliente.nome}</p>
                  {cliente.telefone && (
                    <p className="text-sm text-muted-foreground">{cliente.telefone}</p>
                  )}
                  {cliente.email && (
                    <p className="text-sm text-muted-foreground">{cliente.email}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {pedido.enderecoEntrega && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Endereço de Entrega
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm" data-testid="text-endereco">{pedido.enderecoEntrega}</p>
                </CardContent>
              </Card>
            )}

            {pedido.observacoes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Observações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800" data-testid="text-observacoes">
                    {pedido.observacoes}
                  </p>
                </CardContent>
              </Card>
            )}

            {pedido.trackingLink && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Rastreamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <a
                    href={pedido.trackingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                    data-testid="link-tracking"
                  >
                    <MapPin className="h-4 w-4" />
                    Ver localização em tempo real
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  {pedido.trackingStatus && (
                    <Badge variant="outline" className="mt-2 capitalize">
                      {pedido.trackingStatus}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Ações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {nextStatus && pedido.status !== "cancelado" && pedido.status !== "entregue" && (
                  <Button
                    className="w-full"
                    onClick={() => updateStatusMutation.mutate(nextStatus)}
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-next-status"
                  >
                    {updateStatusMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Avançar para {STATUS_CONFIG[nextStatus]?.label}
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => acionarCobrancaMutation.mutate()}
                  disabled={acionarCobrancaMutation.isPending}
                  data-testid="button-acionar-cobranca"
                >
                  {acionarCobrancaMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Bell className="h-4 w-4 mr-2" />
                  )}
                  Acionar Cobrança (N8N)
                </Button>
                
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => {
                    navigator.clipboard.writeText(pedido.id);
                    toast({
                      title: "ID Copiado",
                      description: "O ID do pedido foi copiado para a área de transferência.",
                    });
                  }}
                  data-testid="button-copy-id"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Copiar ID Completo
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
