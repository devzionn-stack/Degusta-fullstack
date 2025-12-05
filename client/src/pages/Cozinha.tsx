import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ChefHat, 
  Clock, 
  CheckCircle2, 
  RefreshCw,
  Wifi,
  WifiOff,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PedidoCardKDS from "@/components/PedidoCardKDS";

interface PedidoItem {
  produtoId: string | null;
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
  status: string;
  total: string;
  itens: PedidoItem[];
  observacoes: string | null;
  enderecoEntrega: string | null;
  origem: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function Cozinha() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [updatingPedidoId, setUpdatingPedidoId] = useState<string | null>(null);
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
      setUpdatingPedidoId(pedidoId);
      const res = await fetch(`/api/pedidos/${pedidoId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-cozinha"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      toast({
        title: "Status atualizado",
        description: `Pedido #${variables.pedidoId.slice(0, 8)} movido para próximo estágio`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do pedido",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setUpdatingPedidoId(null);
    },
  });

  const playNotificationSound = useCallback(() => {
    if (soundEnabled) {
      try {
        const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleNQ3BVx9tL6lTg8ABmyb1OqnYQwOBHip3POmZQwABXKw4fm0bAIABHG1/gqodgAON4DCEg6bdAAWP5XaDQqIhgAoRZjnBQB3dwAvR5joGQB4dwgsMpb3HwCJhAYsTpPyHAB7fQAqQI7vDACCgw4oM4jmBACBgxAoJ4LiGAB8gREnH3viEgB4dg0mF3DXDABxcQsmEGzQBgBrbQsl"); 
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (e) {}
    }
  }, [soundEnabled]);

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "connected") {
        setIsConnected(true);
      } else if (data.type === "pedido_update") {
        queryClient.invalidateQueries({ queryKey: ["pedidos-cozinha"] });
        queryClient.invalidateQueries({ queryKey: ["pedidos"] });
        
        if (data.action === "created") {
          playNotificationSound();
          toast({
            title: "🔔 Novo Pedido!",
            description: `Pedido #${data.pedido.id.slice(0, 8)} recebido`,
            duration: 5000,
          });
        }
      }
    } catch (error) {
      console.error("WebSocket parse error:", error);
    }
  }, [queryClient, toast, playNotificationSound]);

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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleStatusChange = (pedidoId: string, newStatus: string) => {
    updateStatus.mutate({ pedidoId, status: newStatus });
  };

  const pedidosByStatus = {
    recebido: pedidos.filter(p => p.status === "recebido"),
    em_preparo: pedidos.filter(p => p.status === "em_preparo"),
    pronto: pedidos.filter(p => p.status === "pronto"),
  };

  const totalPendentes = pedidosByStatus.recebido.length + pedidosByStatus.em_preparo.length;

  const KDSContent = () => (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold flex items-center gap-3">
            <ChefHat className="h-7 w-7 md:h-8 md:w-8 text-primary" />
            Cozinha
            {totalPendentes > 0 && (
              <Badge variant="destructive" className="ml-2 text-sm">
                {totalPendentes} pendentes
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Sistema de exibição da cozinha (KDS)
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-muted">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-green-600 font-medium">Conectado</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span className="text-red-600 font-medium">Desconectado</span>
              </>
            )}
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setSoundEnabled(!soundEnabled)}
            data-testid="button-toggle-sound"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleFullscreen}
            data-testid="button-fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
          
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4">
              <div className="h-10 bg-muted rounded-lg animate-pulse" />
              <div className="h-48 bg-muted rounded-lg animate-pulse" />
              <div className="h-48 bg-muted rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-600" />
                <h2 className="font-semibold text-orange-800">Recebidos</h2>
              </div>
              <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                {pedidosByStatus.recebido.length}
              </Badge>
            </div>
            <div className="space-y-4 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {pedidosByStatus.recebido.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 bg-muted/30 rounded-lg">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum pedido aguardando</p>
                </div>
              ) : (
                pedidosByStatus.recebido.map((pedido) => (
                  <PedidoCardKDS
                    key={pedido.id}
                    pedido={pedido}
                    onStatusChange={handleStatusChange}
                    isUpdating={updatingPedidoId === pedido.id}
                    compact={pedidosByStatus.recebido.length > 3}
                  />
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold text-blue-800">Em Preparo</h2>
              </div>
              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                {pedidosByStatus.em_preparo.length}
              </Badge>
            </div>
            <div className="space-y-4 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {pedidosByStatus.em_preparo.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 bg-muted/30 rounded-lg">
                  <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum pedido em preparo</p>
                </div>
              ) : (
                pedidosByStatus.em_preparo.map((pedido) => (
                  <PedidoCardKDS
                    key={pedido.id}
                    pedido={pedido}
                    onStatusChange={handleStatusChange}
                    isUpdating={updatingPedidoId === pedido.id}
                    compact={pedidosByStatus.em_preparo.length > 3}
                  />
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h2 className="font-semibold text-green-800">Prontos</h2>
              </div>
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                {pedidosByStatus.pronto.length}
              </Badge>
            </div>
            <div className="space-y-4 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {pedidosByStatus.pronto.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 bg-muted/30 rounded-lg">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum pedido pronto</p>
                </div>
              ) : (
                pedidosByStatus.pronto.map((pedido) => (
                  <PedidoCardKDS
                    key={pedido.id}
                    pedido={pedido}
                    onStatusChange={handleStatusChange}
                    isUpdating={updatingPedidoId === pedido.id}
                    compact={pedidosByStatus.pronto.length > 3}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <KDSContent />
    </DashboardLayout>
  );
}
