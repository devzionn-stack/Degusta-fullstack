import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant-context";
import { useKDSSounds } from "@/hooks/useKDSSounds";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, ChefHat, Flame, CheckCircle, Play, Pause, WifiOff, Maximize, Minimize, Settings } from "lucide-react";

type KDSView = 'all' | 'cozinha' | 'forno' | 'expedicao';

interface EtapaKDS {
  nome: string;
  tempoSegundos: number;
  instrucoes: string;
  iniciadoEm?: string;
  concluidoEm?: string;
  tempoReal?: number;
  pausadoEm?: string;
  tempoPausado?: number;
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

interface MetricasKDS {
  pizzasHora: number;
  tempoMedio: number;
  pizzasAtrasadas: number;
  totalAguardando: number;
  totalPreparando: number;
  totalConcluidas: number;
}

function formatarTempo(segundos: number): string {
  const mins = Math.floor(segundos / 60);
  const secs = segundos % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function PizzaCard({ pizza, pedido, onIniciar, onAvancar, onPausar, onRetomar, fontSize, highContrast }: {
  pizza: PizzaKDS;
  pedido: PedidoKDS;
  onIniciar: (id: string) => void;
  onAvancar: (id: string) => void;
  onPausar: (id: string) => void;
  onRetomar: (id: string) => void;
  fontSize: 'normal' | 'large' | 'xlarge';
  highContrast: boolean;
}) {
  const [tempoAtual, setTempoAtual] = useState(pizza.tempoDecorrido || 0);

  useEffect(() => {
    if (pizza.statusKDS === "preparando" && pizza.iniciadoEm) {
      const interval = setInterval(() => {
        const agora = new Date();
        const inicio = new Date(pizza.iniciadoEm!);
        const decorrido = Math.floor((agora.getTime() - inicio.getTime()) / 1000);
        const tempoPausado = pizza.etapas.reduce((sum, e) => sum + (e.tempoPausado || 0), 0);
        setTempoAtual(decorrido - tempoPausado);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [pizza.statusKDS, pizza.iniciadoEm, pizza.etapas]);

  const progresso = pizza.totalEtapas > 0 ? (pizza.etapaAtual / pizza.totalEtapas) * 100 : 0;
  const atrasado = tempoAtual > pizza.tempoEstimadoTotal;
  const etapaAtualInfo = pizza.etapas[pizza.etapaAtual];

  const getStatusColor = () => {
    if (pizza.statusKDS === "concluido") return "bg-green-500";
    if (pizza.statusKDS === "pausado") return "bg-orange-500";
    if (atrasado) return "bg-red-500";
    if (pizza.statusKDS === "preparando") return "bg-yellow-500";
    return "bg-gray-300";
  };

  const getCardPaddingClass = () => {
    switch (fontSize) {
      case 'large': return 'p-5';
      case 'xlarge': return 'p-6';
      default: return 'p-4';
    }
  };

  const getTitleClass = () => {
    switch (fontSize) {
      case 'large': return 'text-xl';
      case 'xlarge': return 'text-2xl';
      default: return 'text-lg';
    }
  };

  return (
    <Card className={`${getCardPaddingClass()} border-2 ${atrasado ? "border-red-500" : "border-gray-200"} ${highContrast ? "bg-gray-900 text-white border-gray-600" : ""}`} data-testid={`card-pizza-${pizza.progressoId}`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className={`font-bold ${getTitleClass()}`} data-testid={`text-pizza-nome-${pizza.progressoId}`}>{pizza.produtoNome}</h3>
            <p className={`text-sm ${highContrast ? "text-gray-300" : "text-muted-foreground"}`}>Pedido #{pedido.numeroPedido}</p>
          </div>
          <Badge className={getStatusColor()} data-testid={`badge-status-${pizza.progressoId}`}>
            {pizza.statusKDS === "aguardando" && "Aguardando"}
            {pizza.statusKDS === "preparando" && `${pizza.etapaAtual}/${pizza.totalEtapas}`}
            {pizza.statusKDS === "pausado" && "Pausado"}
            {pizza.statusKDS === "concluido" && "Pronto"}
          </Badge>
        </div>

        <Progress value={progresso} className="h-3" data-testid={`progress-${pizza.progressoId}`} />

        {pizza.statusKDS === "preparando" && etapaAtualInfo && (
          <div className={`p-3 rounded-lg ${highContrast ? "bg-blue-900" : "bg-blue-50"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm" data-testid={`text-etapa-atual-${pizza.progressoId}`}>
                {etapaAtualInfo.nome}
              </span>
              <span className={`text-sm font-mono ${atrasado ? "text-red-600" : ""}`} data-testid={`text-tempo-${pizza.progressoId}`}>
                {formatarTempo(tempoAtual)} / {formatarTempo(pizza.tempoEstimadoTotal)}
              </span>
            </div>
            <p className={`text-xs ${highContrast ? "text-gray-300" : "text-gray-600"}`}>{etapaAtualInfo.instrucoes}</p>
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
          <div className="flex gap-2">
            <Button 
              onClick={() => onPausar(pizza.progressoId)}
              variant="outline"
              className="flex-1"
              data-testid={`button-pausar-${pizza.progressoId}`}
            >
              <Pause className="w-4 h-4 mr-2" />
              Pausar
            </Button>
            <Button 
              onClick={() => onAvancar(pizza.progressoId)}
              className="flex-1 bg-green-600 hover:bg-green-700"
              data-testid={`button-avancar-${pizza.progressoId}`}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Próxima
            </Button>
          </div>
        )}

        {pizza.statusKDS === "pausado" && (
          <Button 
            onClick={() => onRetomar(pizza.progressoId)}
            className="w-full bg-blue-600 hover:bg-blue-700"
            data-testid={`button-retomar-${pizza.progressoId}`}
          >
            <Play className="w-4 h-4 mr-2" />
            Retomar Preparo
          </Button>
        )}
      </div>
    </Card>
  );
}

function ColunaKDS({ titulo, icon: Icon, pedidos, onIniciar, onAvancar, onPausar, onRetomar, fontSize, highContrast }: {
  titulo: string;
  icon: any;
  pedidos: PedidoKDS[];
  onIniciar: (id: string) => void;
  onAvancar: (id: string) => void;
  onPausar: (id: string) => void;
  onRetomar: (id: string) => void;
  fontSize: 'normal' | 'large' | 'xlarge';
  highContrast: boolean;
}) {
  const getTitleClass = () => {
    switch (fontSize) {
      case 'large': return 'text-xl';
      case 'xlarge': return 'text-2xl';
      default: return 'text-lg';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className={`${highContrast ? "bg-gray-950" : "bg-gray-800"} text-white p-4 rounded-t-lg flex items-center gap-2`}>
        <Icon className="w-5 h-5" />
        <h2 className={`font-bold ${getTitleClass()}`}>{titulo}</h2>
        <Badge variant="secondary" className="ml-auto">{pedidos.reduce((acc, p) => acc + p.pizzas.length, 0)}</Badge>
      </div>
      <div className={`flex-1 ${highContrast ? "bg-gray-800" : "bg-gray-50"} p-4 space-y-3 overflow-y-auto rounded-b-lg`} style={{ maxHeight: "calc(100vh - 180px)" }}>
        {pedidos.map((pedido) =>
          pedido.pizzas.map((pizza) => (
            <PizzaCard
              key={pizza.progressoId}
              pizza={pizza}
              pedido={pedido}
              onIniciar={onIniciar}
              onAvancar={onAvancar}
              onPausar={onPausar}
              onRetomar={onRetomar}
              fontSize={fontSize}
              highContrast={highContrast}
            />
          ))
        )}
        {pedidos.length === 0 && (
          <div className={`text-center ${highContrast ? "text-gray-500" : "text-gray-400"} py-8`}>
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
  const [metricas, setMetricas] = useState<MetricasKDS | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [highContrast, setHighContrast] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentView, setCurrentView] = useState<KDSView>('all');

  const tenantId = selectedTenantId || user?.tenantId;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'large': return 'text-lg';
      case 'xlarge': return 'text-xl';
      default: return 'text-base';
    }
  };

  const filterPizzasByView = (pizzas: PizzaKDS[], view: KDSView): PizzaKDS[] => {
    if (view === 'all') return pizzas;
    
    return pizzas.filter(pizza => {
      const etapaAtual = pizza.etapas[pizza.etapaAtual];
      if (!etapaAtual) return false;
      
      const nomeEtapa = etapaAtual.nome.toLowerCase();
      
      switch (view) {
        case 'cozinha':
          return nomeEtapa.includes('preparo') || 
                 nomeEtapa.includes('montagem') || 
                 nomeEtapa.includes('abertura') ||
                 nomeEtapa.includes('massa') ||
                 pizza.statusKDS === 'aguardando';
        case 'forno':
          return nomeEtapa.includes('forno') || 
                 nomeEtapa.includes('assar') || 
                 nomeEtapa.includes('grelhar');
        case 'expedicao':
          return nomeEtapa.includes('final') || 
                 nomeEtapa.includes('corte') || 
                 nomeEtapa.includes('embala') ||
                 pizza.statusKDS === 'concluido';
        default:
          return true;
      }
    });
  };

  const getGridCols = () => {
    if (currentView === 'all') return 'grid-cols-4';
    return 'grid-cols-1 md:grid-cols-2';
  };

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

  const carregarMetricas = useCallback(async () => {
    try {
      const url = tenantId && user?.role === "super_admin"
        ? `/api/kds/metricas?tenantId=${tenantId}`
        : "/api/kds/metricas";
      const response = await fetch(url, {
        credentials: "include",
        headers: tenantId ? { "X-Tenant-Id": tenantId } : {},
      });
      if (response.ok) {
        const data = await response.json();
        setMetricas(data);
      }
    } catch (error) {
      console.error("Erro ao carregar métricas:", error);
    }
  }, [tenantId, user?.role]);

  useEffect(() => {
    carregarPedidos();
    carregarMetricas();
    const interval = setInterval(() => {
      carregarPedidos();
      carregarMetricas();
    }, 30000);
    return () => clearInterval(interval);
  }, [carregarPedidos, carregarMetricas]);

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    
    const connect = () => {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/pedidos`;
      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log("WebSocket KDS conectado");
        setIsOnline(true);
        setReconnectAttempts(0);
        carregarPedidos();
      };

      websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        setLastUpdate(new Date());
        
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
        } else if (message.type === "pedido_cancelado_kds") {
          setPedidos(prev => prev.filter(p => p.pedidoId !== message.pedidoId));
        } else if (message.type === "pedido_saiu_entrega_kds") {
          setPedidos(prev => prev.filter(p => p.pedidoId !== message.pedidoId));
        }
      };

      websocket.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsOnline(false);
      };

      websocket.onclose = () => {
        console.log("WebSocket KDS desconectado");
        setIsOnline(false);
        
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        setReconnectAttempts(prev => prev + 1);
        reconnectTimeout = setTimeout(connect, delay);
      };

      wsRef.current = websocket;
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handlePausar = async (progressoId: string) => {
    try {
      const url = tenantId && user?.role === "super_admin"
        ? `/api/kds/pausar/${progressoId}?tenantId=${tenantId}`
        : `/api/kds/pausar/${progressoId}`;
      await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: tenantId ? { "X-Tenant-Id": tenantId } : {},
      });
      carregarPedidos();
    } catch (error) {
      console.error("Erro ao pausar:", error);
    }
  };

  const handleRetomar = async (progressoId: string) => {
    try {
      const url = tenantId && user?.role === "super_admin"
        ? `/api/kds/retomar/${progressoId}?tenantId=${tenantId}`
        : `/api/kds/retomar/${progressoId}`;
      await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: tenantId ? { "X-Tenant-Id": tenantId } : {},
      });
      carregarPedidos();
    } catch (error) {
      console.error("Erro ao retomar:", error);
    }
  };

  const pedidosFiltrados = pedidos.map(pedido => ({
    ...pedido,
    pizzas: filterPizzasByView(pedido.pizzas, currentView)
  })).filter(p => p.pizzas.length > 0);

  const pedidosRecebidos = pedidosFiltrados.filter((p) =>
    p.pizzas.some((pizza) => pizza.statusKDS === "aguardando")
  );
  const pedidosEmPreparo = pedidosFiltrados.filter((p) =>
    p.pizzas.some((pizza) => pizza.statusKDS === "preparando" || pizza.statusKDS === "pausado")
  );
  const pedidosNoForno = pedidosFiltrados.filter((p) =>
    p.pizzas.some((pizza) => {
      const etapa = pizza.etapas[pizza.etapaAtual];
      return etapa && (etapa.nome.toLowerCase().includes('forno') || etapa.nome.toLowerCase().includes('assar'));
    })
  );
  const pedidosProntos = pedidosFiltrados.filter((p) =>
    p.pizzas.some((pizza) => pizza.statusKDS === "concluido")
  );

  return (
    <div className={`h-screen p-4 ${highContrast ? 'bg-black' : 'bg-gray-100'} ${getFontSizeClass()}`} data-testid="page-kds">
      {!isOnline && (
        <div className="bg-red-500 text-white p-2 text-center rounded-lg mb-4 flex items-center justify-center gap-2" data-testid="status-offline">
          <WifiOff className="w-4 h-4" />
          <span>Conexão perdida - Reconectando... (Última atualização: {lastUpdate.toLocaleTimeString()})</span>
        </div>
      )}
      <div className={`mb-4 ${highContrast ? 'bg-gray-900 text-white' : 'bg-white'} rounded-lg shadow p-4 flex items-center justify-between`}>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ChefHat className="w-8 h-8" />
          Kitchen Display System
        </h1>
        <div className="flex items-center gap-4">
          <Tabs value={currentView} onValueChange={(v) => setCurrentView(v as KDSView)} className="w-auto">
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-view-all">
                Todos
              </TabsTrigger>
              <TabsTrigger value="cozinha" data-testid="tab-view-cozinha">
                <ChefHat className="w-4 h-4 mr-1" />
                Cozinha
              </TabsTrigger>
              <TabsTrigger value="forno" data-testid="tab-view-forno">
                <Flame className="w-4 h-4 mr-1" />
                Forno
              </TabsTrigger>
              <TabsTrigger value="expedicao" data-testid="tab-view-expedicao">
                <CheckCircle className="w-4 h-4 mr-1" />
                Expedição
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-kds-settings">
                  <Settings className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="high-contrast">Alto Contraste</Label>
                    <Switch
                      id="high-contrast"
                      checked={highContrast}
                      onCheckedChange={setHighContrast}
                      data-testid="switch-high-contrast"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tamanho da Fonte</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={fontSize === 'normal' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFontSize('normal')}
                        data-testid="button-font-normal"
                      >
                        A
                      </Button>
                      <Button
                        variant={fontSize === 'large' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFontSize('large')}
                        data-testid="button-font-large"
                      >
                        A+
                      </Button>
                      <Button
                        variant={fontSize === 'xlarge' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFontSize('xlarge')}
                        data-testid="button-font-xlarge"
                      >
                        A++
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              data-testid="button-fullscreen"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </Button>
          </div>
          <div className="text-right">
            <p className={`text-sm ${highContrast ? 'text-gray-400' : 'text-gray-600'}`}>Pedidos Ativos</p>
            <p className="text-2xl font-bold">{pedidos.reduce((acc, p) => acc + p.pizzas.length, 0)}</p>
          </div>
        </div>
      </div>

      {metricas && (
        <div className="grid grid-cols-4 gap-4 mb-4">
          <Card className={`p-4 text-center ${highContrast ? 'bg-gray-900' : ''}`} data-testid="card-metricas-pizzas-hora">
            <div className="text-3xl font-bold text-blue-600">{metricas.pizzasHora}</div>
            <div className={`text-sm ${highContrast ? 'text-gray-400' : 'text-gray-500'}`}>Pizzas/Hora</div>
          </Card>
          <Card className={`p-4 text-center ${highContrast ? 'bg-gray-900' : ''}`} data-testid="card-metricas-tempo-medio">
            <div className="text-3xl font-bold text-green-600">{formatarTempo(metricas.tempoMedio)}</div>
            <div className={`text-sm ${highContrast ? 'text-gray-400' : 'text-gray-500'}`}>Tempo Médio</div>
          </Card>
          <Card className={`p-4 text-center ${metricas.pizzasAtrasadas > 0 ? 'bg-red-50' : ''} ${highContrast ? 'bg-gray-900' : ''}`} data-testid="card-metricas-atrasadas">
            <div className={`text-3xl font-bold ${metricas.pizzasAtrasadas > 0 ? 'text-red-600' : highContrast ? 'text-gray-400' : 'text-gray-600'}`}>
              {metricas.pizzasAtrasadas}
            </div>
            <div className={`text-sm ${highContrast ? 'text-gray-400' : 'text-gray-500'}`}>Atrasadas</div>
          </Card>
          <Card className={`p-4 text-center ${highContrast ? 'bg-gray-900' : ''}`} data-testid="card-metricas-em-producao">
            <div className="text-3xl font-bold text-purple-600">{metricas.totalAguardando + metricas.totalPreparando}</div>
            <div className={`text-sm ${highContrast ? 'text-gray-400' : 'text-gray-500'}`}>Em Produção</div>
          </Card>
        </div>
      )}

      <div className={`grid ${getGridCols()} gap-4 flex-1`} style={{ height: "calc(100vh - 140px)" }}>
        {(currentView === 'all' || currentView === 'cozinha') && (
          <ColunaKDS 
            titulo="RECEBIDO" 
            icon={Clock} 
            pedidos={pedidosRecebidos}
            onIniciar={handleIniciar}
            onAvancar={handleAvancar}
            onPausar={handlePausar}
            onRetomar={handleRetomar}
            fontSize={fontSize}
            highContrast={highContrast}
          />
        )}
        {(currentView === 'all' || currentView === 'cozinha') && (
          <ColunaKDS 
            titulo="EM PREPARO" 
            icon={ChefHat} 
            pedidos={pedidosEmPreparo}
            onIniciar={handleIniciar}
            onAvancar={handleAvancar}
            onPausar={handlePausar}
            onRetomar={handleRetomar}
            fontSize={fontSize}
            highContrast={highContrast}
          />
        )}
        {(currentView === 'all' || currentView === 'forno') && (
          <ColunaKDS 
            titulo="NO FORNO" 
            icon={Flame} 
            pedidos={pedidosNoForno}
            onIniciar={handleIniciar}
            onAvancar={handleAvancar}
            onPausar={handlePausar}
            onRetomar={handleRetomar}
            fontSize={fontSize}
            highContrast={highContrast}
          />
        )}
        {(currentView === 'all' || currentView === 'expedicao') && (
          <ColunaKDS 
            titulo="PRONTO" 
            icon={CheckCircle} 
            pedidos={pedidosProntos}
            onIniciar={handleIniciar}
            onAvancar={handleAvancar}
            onPausar={handlePausar}
            onRetomar={handleRetomar}
            fontSize={fontSize}
            highContrast={highContrast}
          />
        )}
      </div>
    </div>
  );
}
