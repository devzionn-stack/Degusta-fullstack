import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant-context";
import { useKDSSounds } from "@/hooks/useKDSSounds";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Clock, ChefHat, Flame, CheckCircle, Play } from "lucide-react";

interface EtapaKDS {
  nome: string;
  tempoSegundos: number;
  instrucoes: string;
  iniciadoEm?: string;
  concluidoEm?: string;
  tempoReal?: number;
}

interface PizzaKDS {
  progressoId: string;
  produtoNome: string;
  etapaAtual: number;
  totalEtapas: number;
  statusKDS: string;
  tempoDecorrido: number | null;
  tempoEstimadoTotal: number;
  etapas: EtapaKDS[];
  iniciadoEm?: Date;
}

interface PedidoKDS {
  pedidoId: string;
  numeroPedido: number;
  clienteNome: string;
  horarioPedido: Date;
  pizzas: PizzaKDS[];
}

function formatarTempo(segundos: number): string {
  const mins = Math.floor(segundos / 60);
  const secs = segundos % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function PizzaCard({ pizza, pedido, onIniciar, onAvancar }: {
  pizza: PizzaKDS;
  pedido: PedidoKDS;
  onIniciar: (id: string) => void;
  onAvancar: (id: string) => void;
}) {
  const [tempoAtual, setTempoAtual] = useState(pizza.tempoDecorrido || 0);

  useEffect(() => {
    if (pizza.statusKDS === "preparando" && pizza.iniciadoEm) {
      const interval = setInterval(() => {
        const agora = new Date();
        const inicio = new Date(pizza.iniciadoEm!);
        const decorrido = Math.floor((agora.getTime() - inicio.getTime()) / 1000);
        setTempoAtual(decorrido);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [pizza.statusKDS, pizza.iniciadoEm]);

  const progresso = pizza.totalEtapas > 0 ? (pizza.etapaAtual / pizza.totalEtapas) * 100 : 0;
  const atrasado = tempoAtual > pizza.tempoEstimadoTotal;
  const etapaAtualInfo = pizza.etapas[pizza.etapaAtual];

  const getStatusColor = () => {
    if (pizza.statusKDS === "concluido") return "bg-green-500";
    if (atrasado) return "bg-red-500";
    if (pizza.statusKDS === "preparando") return "bg-yellow-500";
    return "bg-gray-300";
  };

  return (
    <Card className={`p-4 border-2 ${atrasado ? "border-red-500" : "border-gray-200"}`} data-testid={`card-pizza-${pizza.progressoId}`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-lg" data-testid={`text-pizza-nome-${pizza.progressoId}`}>{pizza.produtoNome}</h3>
            <p className="text-sm text-muted-foreground">Pedido #{pedido.numeroPedido}</p>
          </div>
          <Badge className={getStatusColor()} data-testid={`badge-status-${pizza.progressoId}`}>
            {pizza.statusKDS === "aguardando" && "Aguardando"}
            {pizza.statusKDS === "preparando" && `${pizza.etapaAtual}/${pizza.totalEtapas}`}
            {pizza.statusKDS === "concluido" && "Pronto"}
          </Badge>
        </div>

        <Progress value={progresso} className="h-3" data-testid={`progress-${pizza.progressoId}`} />

        {pizza.statusKDS === "preparando" && etapaAtualInfo && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm" data-testid={`text-etapa-atual-${pizza.progressoId}`}>
                {etapaAtualInfo.nome}
              </span>
              <span className={`text-sm font-mono ${atrasado ? "text-red-600" : ""}`} data-testid={`text-tempo-${pizza.progressoId}`}>
                {formatarTempo(tempoAtual)} / {formatarTempo(pizza.tempoEstimadoTotal)}
              </span>
            </div>
            <p className="text-xs text-gray-600">{etapaAtualInfo.instrucoes}</p>
          </div>
        )}

        {pizza.statusKDS === "aguardando" && (
          <Button 
            onClick={() => onIniciar(pizza.progressoId)} 
            className="w-full"
            data-testid={`button-iniciar-${pizza.progressoId}`}
          >
            <Play className="w-4 h-4 mr-2" />
            Iniciar Preparo
          </Button>
        )}

        {pizza.statusKDS === "preparando" && (
          <Button 
            onClick={() => onAvancar(pizza.progressoId)}
            className="w-full bg-green-600 hover:bg-green-700"
            data-testid={`button-avancar-${pizza.progressoId}`}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Concluir Etapa
          </Button>
        )}
      </div>
    </Card>
  );
}

function ColunaKDS({ titulo, icon: Icon, pedidos, onIniciar, onAvancar }: {
  titulo: string;
  icon: any;
  pedidos: PedidoKDS[];
  onIniciar: (id: string) => void;
  onAvancar: (id: string) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-800 text-white p-4 rounded-t-lg flex items-center gap-2">
        <Icon className="w-5 h-5" />
        <h2 className="font-bold text-lg">{titulo}</h2>
        <Badge variant="secondary" className="ml-auto">{pedidos.reduce((acc, p) => acc + p.pizzas.length, 0)}</Badge>
      </div>
      <div className="flex-1 bg-gray-50 p-4 space-y-3 overflow-y-auto rounded-b-lg" style={{ maxHeight: "calc(100vh - 180px)" }}>
        {pedidos.map((pedido) =>
          pedido.pizzas.map((pizza) => (
            <PizzaCard
              key={pizza.progressoId}
              pizza={pizza}
              pedido={pedido}
              onIniciar={onIniciar}
              onAvancar={onAvancar}
            />
          ))
        )}
        {pedidos.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <p>Nenhuma pizza</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function KDS() {
  const { user } = useAuth();
  const { selectedTenantId } = useTenant();
  const sounds = useKDSSounds();
  const [pedidos, setPedidos] = useState<PedidoKDS[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const tenantId = selectedTenantId || user?.tenantId;

  const carregarPedidos = useCallback(async () => {
    try {
      const url = tenantId && user?.role === "super_admin"
        ? `/api/kds/pedidos-ativos?tenantId=${tenantId}`
        : "/api/kds/pedidos-ativos";
      
      const response = await fetch(url, {
        credentials: "include",
        headers: tenantId ? { "X-Tenant-Id": tenantId } : {},
      });
      
      if (response.ok) {
        const data = await response.json();
        setPedidos(data);
      }
    } catch (error) {
      console.error("Erro ao carregar pedidos KDS:", error);
    }
  }, [tenantId, user?.role]);

  useEffect(() => {
    carregarPedidos();
    const interval = setInterval(carregarPedidos, 30000); // Reload a cada 30s como fallback
    return () => clearInterval(interval);
  }, [carregarPedidos]);

  // WebSocket connection
  useEffect(() => {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/pedidos`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log("WebSocket KDS conectado");
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === "novo_pedido_kds") {
        sounds.novoPedido();
        carregarPedidos();
      } else if (message.type === "etapa_avancada_kds") {
        sounds.etapaConcluida();
        carregarPedidos();
      } else if (message.type === "pizza_pronta_kds") {
        sounds.pizzaPronta();
        carregarPedidos();
      } else if (message.type === "atualizar_kds") {
        carregarPedidos();
      }
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    websocket.onclose = () => {
      console.log("WebSocket KDS desconectado");
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [sounds, carregarPedidos]);

  const handleIniciar = async (progressoId: string) => {
    try {
      const url = tenantId && user?.role === "super_admin"
        ? `/api/kds/iniciar-preparo/${progressoId}?tenantId=${tenantId}`
        : `/api/kds/iniciar-preparo/${progressoId}`;
      
      await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: tenantId ? { "X-Tenant-Id": tenantId } : {},
      });
      carregarPedidos();
    } catch (error) {
      console.error("Erro ao iniciar preparo:", error);
    }
  };

  const handleAvancar = async (progressoId: string) => {
    try {
      const url = tenantId && user?.role === "super_admin"
        ? `/api/kds/avancar-etapa/${progressoId}?tenantId=${tenantId}`
        : `/api/kds/avancar-etapa/${progressoId}`;
      
      await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: tenantId ? { "X-Tenant-Id": tenantId } : {},
      });
      carregarPedidos();
    } catch (error) {
      console.error("Erro ao avançar etapa:", error);
    }
  };

  // Separar pedidos por status
  const recebidos = pedidos.filter(p => p.pizzas.some(pizza => pizza.statusKDS === "aguardando"));
  const emPreparo = pedidos.filter(p => p.pizzas.some(pizza => pizza.statusKDS === "preparando" && pizza.etapaAtual < 3));
  const noForno = pedidos.filter(p => p.pizzas.some(pizza => pizza.statusKDS === "preparando" && pizza.etapaAtual === 3));
  const prontos = pedidos.filter(p => p.pizzas.some(pizza => pizza.statusKDS === "concluido"));

  return (
    <div className="h-screen bg-gray-100 p-4" data-testid="page-kds">
      <div className="mb-4 bg-white rounded-lg shadow p-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ChefHat className="w-8 h-8" />
          Kitchen Display System
        </h1>
        <div className="text-right">
          <p className="text-sm text-gray-600">Pedidos Ativos</p>
          <p className="text-2xl font-bold">{pedidos.reduce((acc, p) => acc + p.pizzas.length, 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 h-[calc(100vh-140px)]">
        <ColunaKDS 
          titulo="RECEBIDO" 
          icon={Clock} 
          pedidos={recebidos}
          onIniciar={handleIniciar}
          onAvancar={handleAvancar}
        />
        <ColunaKDS 
          titulo="EM PREPARO" 
          icon={ChefHat} 
          pedidos={emPreparo}
          onIniciar={handleIniciar}
          onAvancar={handleAvancar}
        />
        <ColunaKDS 
          titulo="NO FORNO" 
          icon={Flame} 
          pedidos={noForno}
          onIniciar={handleIniciar}
          onAvancar={handleAvancar}
        />
        <ColunaKDS 
          titulo="PRONTO" 
          icon={CheckCircle} 
          pedidos={prontos}
          onIniciar={handleIniciar}
          onAvancar={handleAvancar}
        />
      </div>
    </div>
  );
}
