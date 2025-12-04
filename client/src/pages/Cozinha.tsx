import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ChefHat, 
  Clock, 
  Truck, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PedidoItem {
  produtoId: string | null;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  validado?: boolean;
}

interface Pedido {
  id: string;
  tenantId: string;
  clienteId: string | null;
  status: string;
  total: string;
  itens: PedidoItem[];
  observacoes: string | null;
  enderecoEntrega: string | null;
  origem: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG = {
  recebido: {
    label: "Recebido",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: Clock,
    nextStatus: "em_preparo",
    nextLabel: "Iniciar Preparo",
  },
  em_preparo: {
    label: "Em Preparo",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: ChefHat,
    nextStatus: "pronto",
    nextLabel: "Pronto",
  },
  pronto: {
    label: "Pronto",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: CheckCircle2,
    nextStatus: "saiu_entrega",
    nextLabel: "Saiu para Entrega",
  },
  saiu_entrega: {
    label: "Saiu para Entrega",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: Truck,
    nextStatus: "entregue",
    nextLabel: "Entregue",
  },
};

function formatTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatTimeAgo(dateString: string) {
  const now = new Date();
  const date = new Date(dateString);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);
  
  if (diff < 1) return "Agora";
  if (diff === 1) return "1 min atrás";
  if (diff < 60) return `${diff} min atrás`;
  
  const hours = Math.floor(diff / 60);
  if (hours === 1) return "1 hora atrás";
  return `${hours} horas atrás`;
}

export default function Cozinha() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const hasTenant = !!user?.tenantId;

  const { data: pedidos = [], isLoading, refetch } = useQuery<Pedido[]>({
    queryKey: ["pedidos-cozinha"],
    queryFn: async () => {
      const res = await fetch(`/api/pedidos/cozinha`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pedidos");
      return res.json();
    },
    enabled: hasTenant,
    refetchInterval: 30000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ pedidoId, status }: { pedidoId: string; status: string }) => {
      const res = await fetch(`/api/pedidos/${pedidoId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-cozinha"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do pedido",
        variant: "destructive",
      });
    },
  });

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "connected") {
        setIsConnected(true);
      } else if (data.type === "pedido_update") {
        queryClient.invalidateQueries({ queryKey: ["pedidos-cozinha"] });
        queryClient.invalidateQueries({ queryKey: ["pedidos"] });
        
        if (data.action === "created") {
          toast({
            title: "Novo Pedido!",
            description: `Pedido #${data.pedido.id.slice(0, 8)} recebido`,
          });
        }
      }
    } catch (error) {
      console.error("WebSocket parse error:", error);
    }
  }, [queryClient, toast]);

  useEffect(() => {
    if (!hasTenant) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/pedidos`;
    
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
      };

      ws.onmessage = handleWebSocketMessage;

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 5000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [hasTenant, handleWebSocketMessage]);

  const pedidosByStatus = {
    recebido: pedidos.filter(p => p.status === "recebido"),
    em_preparo: pedidos.filter(p => p.status === "em_preparo"),
    pronto: pedidos.filter(p => p.status === "pronto"),
  };

  const renderPedidoCard = (pedido: Pedido) => {
    const config = STATUS_CONFIG[pedido.status as keyof typeof STATUS_CONFIG];
    if (!config) return null;

    const StatusIcon = config.icon;

    return (
      <Card 
        key={pedido.id} 
        className="mb-4 shadow-md hover:shadow-lg transition-shadow"
        data-testid={`card-pedido-${pedido.id}`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">
                #{pedido.id.slice(0, 8)}
              </span>
              {pedido.origem === "n8n" && (
                <Badge variant="outline" className="text-xs">N8N</Badge>
              )}
            </CardTitle>
            <Badge className={config.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatTime(pedido.createdAt)} • {formatTimeAgo(pedido.createdAt)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <h4 className="text-sm font-medium mb-2">Itens:</h4>
              <ul className="space-y-1">
                {(pedido.itens as PedidoItem[]).map((item, idx) => (
                  <li key={idx} className="flex justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <span className="font-medium">{item.quantidade}x</span>
                      <span>{item.nome}</span>
                      {item.validado === false && (
                        <AlertCircle className="w-3 h-3 text-amber-500" />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {pedido.observacoes && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-amber-800 mb-1">Observações:</h4>
                <p className="text-sm text-amber-700">{pedido.observacoes}</p>
              </div>
            )}

            {pedido.enderecoEntrega && (
              <div className="text-sm">
                <span className="font-medium">Entrega:</span> {pedido.enderecoEntrega}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="font-bold text-lg">
                R$ {parseFloat(pedido.total).toFixed(2)}
              </span>
              
              {config.nextStatus && (
                <Button
                  onClick={() => updateStatus.mutate({ 
                    pedidoId: pedido.id, 
                    status: config.nextStatus 
                  })}
                  disabled={updateStatus.isPending}
                  data-testid={`button-status-${pedido.id}`}
                >
                  {updateStatus.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <config.icon className="w-4 h-4 mr-2" />
                  )}
                  {config.nextLabel}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold flex items-center gap-3">
              <ChefHat className="h-8 w-8 text-primary" />
              Cozinha
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os pedidos em tempo real
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-500" />
                  <span className="text-green-600">Conectado</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-500" />
                  <span className="text-red-600">Desconectado</span>
                </>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {!hasTenant ? (
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <ChefHat className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Nenhuma franquia vinculada</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Para acessar a cozinha, você precisa estar vinculado a uma franquia.
              </p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-4">
                <div className="h-8 bg-muted rounded animate-pulse" />
                <div className="h-48 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <Clock className="w-5 h-5 text-orange-600" />
                <h2 className="font-semibold text-orange-800">
                  Recebidos ({pedidosByStatus.recebido.length})
                </h2>
              </div>
              <div className="min-h-[200px]">
                {pedidosByStatus.recebido.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum pedido aguardando
                  </p>
                ) : (
                  pedidosByStatus.recebido.map(renderPedidoCard)
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <ChefHat className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold text-blue-800">
                  Em Preparo ({pedidosByStatus.em_preparo.length})
                </h2>
              </div>
              <div className="min-h-[200px]">
                {pedidosByStatus.em_preparo.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum pedido em preparo
                  </p>
                ) : (
                  pedidosByStatus.em_preparo.map(renderPedidoCard)
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h2 className="font-semibold text-green-800">
                  Prontos ({pedidosByStatus.pronto.length})
                </h2>
              </div>
              <div className="min-h-[200px]">
                {pedidosByStatus.pronto.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum pedido pronto
                  </p>
                ) : (
                  pedidosByStatus.pronto.map(renderPedidoCard)
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
