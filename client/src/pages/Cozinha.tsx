import { useEffect, useState, useCallback, useLayoutEffect, useRef } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
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
  VolumeX,
  Gauge,
  Tv,
  Plus,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PedidoCardKDS from "@/components/PedidoCardKDS";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  tempoPreparoEstimado?: number | null;
  tempoEntregaEstimado?: number | null;
  inicioPreparoAt?: string | null;
  prontoEntregaAt?: string | null;
}

interface DPTRealtimeInfo {
  pedidoId: string;
  status: string;
  tempoPreparoEstimado: number;
  tempoRestante: number;
  progresso: number;
  atrasado: boolean;
  prioridadeOrdenacao: number;
}

interface ProducaoStatus {
  pedidoId: string;
  status: string;
  tempoDecorrido: number;
  tempoMetaMontagem: number;
  numeroLoop: number;
  progresso: number;
  urgencia: "verde" | "amarelo" | "vermelho";
  etapaAtual: string;
  proximaEtapa: string | null;
  tempoRestante: number;
}

interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  endereco?: string;
}

interface Produto {
  id: string;
  nome: string;
  preco: string;
  categoria?: string;
}

interface ItemPedido {
  produtoId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
}

export default function Cozinha() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [updatingPedidoId, setUpdatingPedidoId] = useState<string | null>(null);
  const [showTVModal, setShowTVModal] = useState(false);
  const [pedidoPreparoId, setPedidoPreparoId] = useState<string | null>(null);
  const [showInsertDialog, setShowInsertDialog] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<string>("");
  const [tipoEntrega, setTipoEntrega] = useState<"delivery" | "balcao">("balcao");
  const [endereco, setEndereco] = useState("");
  const [selectedProduto, setSelectedProduto] = useState<string>("");
  const [quantidade, setQuantidade] = useState(1);
  const [itensPedido, setItensPedido] = useState<ItemPedido[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const exampleOrdersCreatedRef = useRef(false);
  const hasTenant = !!user?.tenantId;

  useLayoutEffect(() => {
    setTheme("dark");
  }, [setTheme]);

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

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["clientes"],
    queryFn: async () => {
      const res = await fetch(`/api/clientes`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clientes");
      return res.json();
    },
    enabled: hasTenant,
  });

  const { data: produtosPizza = [] } = useQuery<Produto[]>({
    queryKey: ["produtos-pizza"],
    queryFn: async () => {
      const res = await fetch(`/api/produtos`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch produtos");
      const produtos: Produto[] = await res.json();
      return produtos.filter(p => p.categoria?.toLowerCase() === "pizza");
    },
    enabled: hasTenant,
  });

  const criarPedido = useMutation({
    mutationFn: async (pedidoData: {
      clienteId?: string;
      status: string;
      total: number;
      itens: ItemPedido[];
      observacoes?: string;
      enderecoEntrega?: string;
      origem: string;
    }) => {
      const res = await fetch(`/api/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(pedidoData),
      });
      if (!res.ok) throw new Error("Failed to create pedido");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-cozinha"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      setShowInsertDialog(false);
      resetForm();
      toast({
        title: "Pedido criado",
        description: "O pedido foi adicionado à fila da cozinha",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar o pedido",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedCliente("");
    setTipoEntrega("balcao");
    setEndereco("");
    setSelectedProduto("");
    setQuantidade(1);
    setItensPedido([]);
    setObservacoes("");
  };

  const adicionarItem = () => {
    if (!selectedProduto) return;
    const produto = produtosPizza.find(p => p.id === selectedProduto);
    if (!produto) return;
    
    setItensPedido(prev => [
      ...prev,
      {
        produtoId: produto.id,
        nome: produto.nome,
        quantidade,
        precoUnitario: parseFloat(produto.preco),
      }
    ]);
    setSelectedProduto("");
    setQuantidade(1);
  };

  const removerItem = (index: number) => {
    setItensPedido(prev => prev.filter((_, i) => i !== index));
  };

  const calcularTotal = () => {
    return itensPedido.reduce((acc, item) => acc + item.precoUnitario * item.quantidade, 0);
  };

  const handleCriarPedido = () => {
    if (itensPedido.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um item ao pedido",
        variant: "destructive",
      });
      return;
    }

    criarPedido.mutate({
      clienteId: selectedCliente === "balcao" ? undefined : selectedCliente || undefined,
      status: "recebido",
      total: calcularTotal(),
      itens: itensPedido,
      observacoes: observacoes || undefined,
      enderecoEntrega: tipoEntrega === "delivery" ? endereco : undefined,
      origem: "cozinha",
    });
  };

  useEffect(() => {
    if (!hasTenant || isLoading || exampleOrdersCreatedRef.current) return;
    
    const pedidosRecebidos = pedidos.filter(p => p.status === "recebido");
    const quantidadeFaltante = 3 - pedidosRecebidos.length;
    
    if (quantidadeFaltante > 0 && produtosPizza.length > 0) {
      exampleOrdersCreatedRef.current = true;
      
      const defaultPizza = produtosPizza[0];
      const pizza2 = produtosPizza[1] || defaultPizza;
      const pizza3 = produtosPizza[2] || defaultPizza;
      
      const todosExemplos = [
        {
          status: "recebido",
          total: parseFloat(defaultPizza.preco),
          itens: [{
            produtoId: defaultPizza.id,
            nome: defaultPizza.nome,
            quantidade: 1,
            precoUnitario: parseFloat(defaultPizza.preco),
          }],
          observacoes: "Pedido exemplo - João Silva",
          origem: "cozinha",
        },
        {
          status: "recebido",
          total: parseFloat(defaultPizza.preco) + parseFloat(pizza2.preco),
          itens: [
            {
              produtoId: defaultPizza.id,
              nome: defaultPizza.nome,
              quantidade: 1,
              precoUnitario: parseFloat(defaultPizza.preco),
            },
            {
              produtoId: pizza2.id,
              nome: pizza2.nome,
              quantidade: 1,
              precoUnitario: parseFloat(pizza2.preco),
            }
          ],
          observacoes: "Pedido exemplo - Maria Souza",
          origem: "cozinha",
        },
        {
          status: "recebido",
          total: parseFloat(pizza3.preco),
          itens: [{
            produtoId: pizza3.id,
            nome: pizza3.nome,
            quantidade: 1,
            precoUnitario: parseFloat(pizza3.preco),
          }],
          observacoes: "Pedido exemplo - Pedro Santos",
          origem: "cozinha",
        },
      ];
      
      const pedidosParaCriar = todosExemplos.slice(0, quantidadeFaltante);
      
      pedidosParaCriar.forEach(pedido => {
        criarPedido.mutate(pedido);
      });
    }
  }, [hasTenant, isLoading, pedidos, produtosPizza]);

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
      queryClient.invalidateQueries({ queryKey: ["dpt-realtime"] });
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

  const { data: dptRealtimeData = [] } = useQuery<DPTRealtimeInfo[]>({
    queryKey: ["dpt-realtime"],
    queryFn: async () => {
      const res = await fetch(`/api/dpt/realtime`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch DPT realtime");
      return res.json();
    },
    enabled: hasTenant,
    refetchInterval: 10000,
  });

  const { data: producaoStatusData = [] } = useQuery<ProducaoStatus[]>({
    queryKey: ["producao-status"],
    queryFn: async () => {
      const res = await fetch(`/api/producao/status`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch production status");
      return res.json();
    },
    enabled: hasTenant,
    refetchInterval: 5000,
  });

  const startPreparo = useMutation({
    mutationFn: async (pedidoId: string) => {
      setUpdatingPedidoId(pedidoId);
      const res = await fetch(`/api/dpt/iniciar-preparo/${pedidoId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to start preparo");
      return res.json();
    },
    onSuccess: (data, pedidoId) => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-cozinha"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["dpt-realtime"] });
      setPedidoPreparoId(pedidoId);
      setShowTVModal(true);
      toast({
        title: "Preparo iniciado",
        description: `Pedido #${pedidoId.slice(0, 8)} em preparo - ${data.itensDetalhados || 0} pizza(s) na fila`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o preparo",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setUpdatingPedidoId(null);
    },
  });

  const finishPreparo = useMutation({
    mutationFn: async (pedidoId: string) => {
      setUpdatingPedidoId(pedidoId);
      const res = await fetch(`/api/dpt/finalizar-preparo/${pedidoId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to finish preparo");
      return res.json();
    },
    onSuccess: (_, pedidoId) => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-cozinha"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["dpt-realtime"] });
      toast({
        title: "Preparo finalizado",
        description: `Pedido #${pedidoId.slice(0, 8)} pronto para entrega`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível finalizar o preparo",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setUpdatingPedidoId(null);
    },
  });

  const getDptInfo = (pedidoId: string) => {
    const info = dptRealtimeData.find(d => d.pedidoId === pedidoId);
    return info ? {
      tempoRestante: info.tempoRestante,
      progresso: info.progresso,
      atrasado: info.atrasado,
    } : undefined;
  };

  const getProducaoStatus = (pedidoId: string) => {
    return producaoStatusData.find(p => p.pedidoId === pedidoId);
  };

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
        queryClient.invalidateQueries({ queryKey: ["dpt-realtime"] });
        queryClient.invalidateQueries({ queryKey: ["producao-status"] });
        
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

  const sortByDPTPriority = (pedidosList: Pedido[]) => {
    return [...pedidosList].sort((a, b) => {
      const aInfo = dptRealtimeData.find(d => d.pedidoId === a.id);
      const bInfo = dptRealtimeData.find(d => d.pedidoId === b.id);
      
      if (aInfo && bInfo) {
        return aInfo.prioridadeOrdenacao - bInfo.prioridadeOrdenacao;
      }
      
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  };

  const pedidosByStatus = {
    recebido: sortByDPTPriority(pedidos.filter(p => p.status === "recebido")),
    em_preparo: sortByDPTPriority(pedidos.filter(p => p.status === "em_preparo")),
    pronto: sortByDPTPriority(pedidos.filter(p => p.status === "pronto")),
  };

  const totalPendentes = pedidosByStatus.recebido.length + pedidosByStatus.em_preparo.length;
  
  const avgProgress = dptRealtimeData.length > 0 
    ? Math.round(dptRealtimeData.reduce((sum, d) => sum + d.progresso, 0) / dptRealtimeData.length)
    : 0;

  const producaoUrgentes = producaoStatusData.filter(p => p.urgencia === "vermelho").length;
  const producaoAmarelos = producaoStatusData.filter(p => p.urgencia === "amarelo").length;
  const avgLoop = producaoStatusData.length > 0
    ? Math.round(producaoStatusData.reduce((sum, p) => sum + p.numeroLoop, 0) / producaoStatusData.length)
    : 0;

  const handleGoToTV = () => {
    setShowTVModal(false);
    navigate("/kds/tv");
  };

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
          {(dptRealtimeData.length > 0 || producaoStatusData.length > 0) && (
            <div className="flex items-center gap-2 mr-2">
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-blue-50 border border-blue-200">
                <Gauge className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-blue-700 font-medium">DPT: {avgProgress}%</span>
              </div>
              {avgLoop > 0 && (
                <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-purple-50 border border-purple-200">
                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-purple-700 font-medium">Loop: ~{avgLoop}min</span>
                </div>
              )}
              {producaoUrgentes > 0 && (
                <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-red-50 border border-red-200 animate-pulse">
                  <Clock className="w-3.5 h-3.5 text-red-600" />
                  <span className="text-red-700 font-medium">{producaoUrgentes} urgente(s)</span>
                </div>
              )}
              {producaoAmarelos > 0 && !producaoUrgentes && (
                <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-amber-50 border border-amber-200">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-amber-700 font-medium">{producaoAmarelos} atenção</span>
                </div>
              )}
            </div>
          )}
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

          <Button 
            onClick={() => setShowInsertDialog(true)}
            className="bg-green-600 hover:bg-green-700"
            size="sm"
            data-testid="button-inserir-pedido"
          >
            <Plus className="w-4 h-4 mr-2" />
            Inserir Pedido
          </Button>

          <Button 
            onClick={() => navigate("/kds/tv")}
            className="bg-orange-600 hover:bg-orange-700"
            size="sm"
            data-testid="button-ir-tv"
          >
            <Tv className="w-4 h-4 mr-2" />
            Abrir TV
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
                    onStartPreparo={(id) => startPreparo.mutate(id)}
                    isUpdating={updatingPedidoId === pedido.id}
                    compact={pedidosByStatus.recebido.length > 3}
                    dptInfo={getDptInfo(pedido.id)}
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
                    onFinishPreparo={(id) => finishPreparo.mutate(id)}
                    isUpdating={updatingPedidoId === pedido.id}
                    compact={pedidosByStatus.em_preparo.length > 3}
                    dptInfo={getDptInfo(pedido.id)}
                    producaoStatus={getProducaoStatus(pedido.id)}
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
                    dptInfo={getDptInfo(pedido.id)}
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
      
      <Dialog open={showTVModal} onOpenChange={setShowTVModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tv className="w-5 h-5 text-orange-500" />
              Pizza em Preparo
            </DialogTitle>
            <DialogDescription>
              O pedido #{pedidoPreparoId?.slice(0, 8)} foi enviado para a fila de produção.
              Deseja abrir a tela de montagem na TV?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowTVModal(false)}
              data-testid="button-modal-ficar"
            >
              Continuar aqui
            </Button>
            <Button
              onClick={handleGoToTV}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="button-modal-ir-tv"
            >
              <Tv className="w-4 h-4 mr-2" />
              Ir para TV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInsertDialog} onOpenChange={setShowInsertDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="dialog-title-inserir-pedido">
              <Plus className="w-5 h-5 text-green-500" />
              Inserir Novo Pedido
            </DialogTitle>
            <DialogDescription>
              Adicione pizzas e informações do pedido
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cliente" data-testid="label-cliente">Cliente</Label>
              <Select value={selectedCliente} onValueChange={setSelectedCliente} data-testid="select-cliente">
                <SelectTrigger id="cliente" data-testid="select-trigger-cliente">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent data-testid="select-content-cliente">
                  <SelectItem value="balcao" data-testid="select-item-balcao">Cliente Balcão</SelectItem>
                  {clientes.map(cliente => (
                    <SelectItem key={cliente.id} value={cliente.id} data-testid={`select-item-cliente-${cliente.id}`}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipoEntrega" data-testid="label-tipo-entrega">Tipo de Entrega</Label>
              <Select value={tipoEntrega} onValueChange={(v: "delivery" | "balcao") => setTipoEntrega(v)} data-testid="select-tipo-entrega">
                <SelectTrigger id="tipoEntrega" data-testid="select-trigger-tipo-entrega">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent data-testid="select-content-tipo-entrega">
                  <SelectItem value="balcao" data-testid="select-item-tipo-balcao">Balcão</SelectItem>
                  <SelectItem value="delivery" data-testid="select-item-tipo-delivery">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipoEntrega === "delivery" && (
              <div className="space-y-2">
                <Label htmlFor="endereco" data-testid="label-endereco">Endereço de Entrega</Label>
                <Input
                  id="endereco"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Digite o endereço completo"
                  data-testid="input-endereco"
                />
              </div>
            )}

            <div className="border-t pt-4 space-y-4">
              <h4 className="font-medium" data-testid="section-itens">Itens do Pedido</h4>
              
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={selectedProduto} onValueChange={setSelectedProduto} data-testid="select-produto">
                    <SelectTrigger data-testid="select-trigger-produto">
                      <SelectValue placeholder="Selecione uma pizza" />
                    </SelectTrigger>
                    <SelectContent data-testid="select-content-produto">
                      {produtosPizza.map(produto => (
                        <SelectItem key={produto.id} value={produto.id} data-testid={`select-item-produto-${produto.id}`}>
                          {produto.nome} - R$ {parseFloat(produto.preco).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  min={1}
                  value={quantidade}
                  onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                  className="w-20"
                  data-testid="input-quantidade"
                />
                <Button
                  type="button"
                  onClick={adicionarItem}
                  disabled={!selectedProduto}
                  data-testid="button-adicionar-item"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {itensPedido.length > 0 && (
                <div className="space-y-2" data-testid="lista-itens">
                  {itensPedido.map((item, index) => (
                    <div key={index} className="flex items-center justify-between bg-muted p-2 rounded" data-testid={`item-pedido-${index}`}>
                      <span className="text-sm" data-testid={`text-item-${index}`}>
                        {item.quantidade}x {item.nome} - R$ {(item.precoUnitario * item.quantidade).toFixed(2)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removerItem(index)}
                        data-testid={`button-remover-item-${index}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  <div className="text-right font-semibold" data-testid="text-total">
                    Total: R$ {calcularTotal().toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes" data-testid="label-observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações do pedido (opcional)"
                rows={3}
                data-testid="textarea-observacoes"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowInsertDialog(false);
                resetForm();
              }}
              data-testid="button-cancelar-pedido"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCriarPedido}
              disabled={itensPedido.length === 0 || criarPedido.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-criar-pedido"
            >
              {criarPedido.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Pedido
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
