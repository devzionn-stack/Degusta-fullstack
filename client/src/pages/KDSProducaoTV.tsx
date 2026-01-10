import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PizzaDiagrama } from "@/components/PizzaDiagrama";
import { 
  Play, 
  CheckCircle, 
  Clock, 
  ChefHat, 
  Maximize, 
  Minimize,
  Volume2,
  VolumeX,
  RefreshCw,
  Wifi,
  WifiOff,
  Brain,
  Loader2,
  Lightbulb,
  ArrowLeft,
  AlertTriangle,
  Timer,
  TrendingUp,
  Flame
} from "lucide-react";

interface Ingrediente {
  ingredienteId: string;
  nome: string;
  quantidade: number;
  unidade: string;
  custo: number;
}

interface Sabor {
  produtoId: string;
  produtoNome: string;
  fracao: number;
  setorInicio: number;
  setorFim: number;
  cor: string;
  ingredientes: Ingrediente[];
}

interface DiagramaPizza {
  itemPedidoId: string;
  pedidoId: string;
  nome: string;
  sabores: Sabor[];
  ingredientesTotal: Ingrediente[];
  custoTotal: number;
  precoVenda: number;
  margemLucro: number;
}

interface FilaProducao {
  emProducao: DiagramaPizza | null;
  fila: DiagramaPizza[];
}

interface PassoPreparo {
  numero: number;
  instrucao: string;
  tempo?: number;
  dica?: string;
  ingredientes?: string[];
}

interface InstrucoesPreparo {
  titulo: string;
  passos: PassoPreparo[];
  tempoEstimado: number;
  dicasGerais: string[];
}

type UrgencyLevel = 'normal' | 'warning' | 'critical';

const SLA_TEMPO_SEGUNDOS = 300;
const SLA_WARNING_THRESHOLD = 0.7;

function getUrgencyLevel(tempoDecorrido: number): UrgencyLevel {
  const percentual = tempoDecorrido / SLA_TEMPO_SEGUNDOS;
  if (percentual >= 1) return 'critical';
  if (percentual >= SLA_WARNING_THRESHOLD) return 'warning';
  return 'normal';
}

function getUrgencyStyles(level: UrgencyLevel) {
  switch (level) {
    case 'critical':
      return {
        border: 'border-red-500 border-2',
        bg: 'bg-red-950/50',
        text: 'text-red-400',
        badge: 'bg-red-600',
        pulse: 'animate-pulse',
        scale: 'scale-[1.02]',
        glow: 'shadow-[0_0_30px_rgba(239,68,68,0.5)]'
      };
    case 'warning':
      return {
        border: 'border-yellow-500 border-2',
        bg: 'bg-yellow-950/30',
        text: 'text-yellow-400',
        badge: 'bg-yellow-600',
        pulse: 'animate-pulse',
        scale: 'scale-[1.01]',
        glow: 'shadow-[0_0_20px_rgba(234,179,8,0.3)]'
      };
    default:
      return {
        border: 'border-green-600',
        bg: 'bg-gray-900',
        text: 'text-green-400',
        badge: 'bg-green-600',
        pulse: '',
        scale: '',
        glow: ''
      };
  }
}

function getProgressColor(percentual: number): string {
  if (percentual >= 100) return 'bg-red-500';
  if (percentual >= 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getQueueItemUrgency(index: number, totalFila: number): UrgencyLevel {
  if (totalFila > 5 && index >= totalFila - 2) return 'warning';
  if (totalFila > 8) return 'warning';
  return 'normal';
}

export default function KDSProducaoTV() {
  const params = useParams<{ tenantId?: string }>();
  const [, navigate] = useLocation();
  const [filaProducao, setFilaProducao] = useState<FilaProducao>({ emProducao: null, fila: [] });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [somAtivo, setSomAtivo] = useState(true);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [wsConectado, setWsConectado] = useState(false);
  const [instrucoes, setInstrucoes] = useState<InstrucoesPreparo | null>(null);
  const [carregandoInstrucoes, setCarregandoInstrucoes] = useState(false);
  const [passoAtual, setPassoAtual] = useState(0);
  const [temposMedios, setTemposMedios] = useState<number[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const urgencyLevel = useMemo(() => getUrgencyLevel(tempoDecorrido), [tempoDecorrido]);
  const urgencyStyles = useMemo(() => getUrgencyStyles(urgencyLevel), [urgencyLevel]);
  const progressPercentual = useMemo(() => Math.min((tempoDecorrido / SLA_TEMPO_SEGUNDOS) * 100, 100), [tempoDecorrido]);
  const tempoRestante = useMemo(() => Math.max(SLA_TEMPO_SEGUNDOS - tempoDecorrido, 0), [tempoDecorrido]);
  
  const pizzasAtrasadas = useMemo(() => {
    return urgencyLevel === 'critical' ? 1 : 0;
  }, [urgencyLevel]);

  const tempoMedioPreparo = useMemo(() => {
    if (temposMedios.length === 0) return 0;
    return Math.round(temposMedios.reduce((a, b) => a + b, 0) / temposMedios.length);
  }, [temposMedios]);

  const carregarFila = useCallback(async (): Promise<FilaProducao | null> => {
    try {
      const url = params.tenantId 
        ? `/api/diagrama/fila?tenantId=${params.tenantId}`
        : "/api/diagrama/fila";
      
      const response = await fetch(url, {
        credentials: "include",
        headers: params.tenantId ? { "X-Tenant-Id": params.tenantId } : {},
      });

      if (response.ok) {
        const data: FilaProducao = await response.json();
        setFilaProducao(data);
        return data;
      }
      return null;
    } catch (error) {
      console.error("Erro ao carregar fila:", error);
      return null;
    } finally {
      setCarregando(false);
    }
  }, [params.tenantId]);

  const carregarInstrucoes = useCallback(async (itemPedidoId: string) => {
    setCarregandoInstrucoes(true);
    setInstrucoes(null);
    setPassoAtual(0);
    try {
      const response = await fetch(`/api/diagrama/instrucoes/${itemPedidoId}`, {
        credentials: "include",
        headers: params.tenantId ? { "X-Tenant-Id": params.tenantId } : {},
      });

      if (response.ok) {
        const data: InstrucoesPreparo = await response.json();
        setInstrucoes(data);
      }
    } catch (error) {
      console.error("Erro ao carregar instruções:", error);
    } finally {
      setCarregandoInstrucoes(false);
    }
  }, [params.tenantId]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/pedidos`;
    
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        
        ws.onopen = () => {
          console.log("[KDS] WebSocket conectado");
          setWsConectado(true);
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === "novo_pedido_kds" || 
                data.type === "etapa_avancada_kds" || 
                data.type === "pizza_pronta_kds" ||
                data.type === "pedido_update") {
              carregarFila();
            }
          } catch (e) {
            console.error("[KDS] Erro ao processar mensagem WS:", e);
          }
        };
        
        ws.onclose = () => {
          console.log("[KDS] WebSocket desconectado, reconectando...");
          setWsConectado(false);
          setTimeout(connectWebSocket, 3000);
        };
        
        ws.onerror = (error) => {
          console.error("[KDS] Erro WebSocket:", error);
          setWsConectado(false);
        };
      } catch (error) {
        console.error("[KDS] Erro ao criar WebSocket:", error);
        setTimeout(connectWebSocket, 3000);
      }
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [carregarFila]);

  useEffect(() => {
    carregarFila();
    const interval = setInterval(carregarFila, 30000);
    return () => clearInterval(interval);
  }, [carregarFila]);

  useEffect(() => {
    if (filaProducao.emProducao) {
      carregarInstrucoes(filaProducao.emProducao.itemPedidoId);
    } else {
      setInstrucoes(null);
      setPassoAtual(0);
    }
  }, [filaProducao.emProducao?.itemPedidoId, carregarInstrucoes]);

  useEffect(() => {
    if (!filaProducao.emProducao) {
      setTempoDecorrido(0);
      return;
    }

    const interval = setInterval(() => {
      setTempoDecorrido(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [filaProducao.emProducao?.itemPedidoId]);

  const tocarSom = useCallback(() => {
    if (!somAtivo) return;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 880;
      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.error("Erro ao tocar som:", e);
    }
  }, [somAtivo]);

  const iniciarProducao = async (itemPedidoId: string) => {
    try {
      const response = await fetch(`/api/diagrama/iniciar/${itemPedidoId}`, {
        method: "POST",
        credentials: "include",
        headers: params.tenantId ? { "X-Tenant-Id": params.tenantId } : {},
      });

      if (response.ok) {
        tocarSom();
        setTempoDecorrido(0);
        await carregarFila();
      }
    } catch (error) {
      console.error("Erro ao iniciar produção:", error);
    }
  };

  const finalizarProducao = async (itemPedidoId: string) => {
    try {
      const response = await fetch(`/api/diagrama/finalizar/${itemPedidoId}`, {
        method: "POST",
        credentials: "include",
        headers: params.tenantId ? { "X-Tenant-Id": params.tenantId } : {},
      });

      if (response.ok) {
        tocarSom();
        setTemposMedios(prev => [...prev.slice(-9), tempoDecorrido]);
        const filaAtualizada = await carregarFila();
        
        if (filaAtualizada && filaAtualizada.fila.length > 0 && !filaAtualizada.emProducao) {
          setTimeout(() => {
            iniciarProducao(filaAtualizada.fila[0].itemPedidoId);
          }, 2000);
        }
      }
    } catch (error) {
      console.error("Erro ao finalizar produção:", error);
    }
  };

  const avancarPasso = () => {
    if (instrucoes && passoAtual < instrucoes.passos.length - 1) {
      setPassoAtual(prev => prev + 1);
      tocarSom();
    }
  };

  const voltarPasso = () => {
    if (passoAtual > 0) {
      setPassoAtual(prev => prev - 1);
    }
  };

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

  const formatarTempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const estimarTempoFila = (index: number) => {
    const tempoBase = tempoMedioPreparo > 0 ? tempoMedioPreparo : 180;
    return tempoBase * (index + 1);
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl flex items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin" />
          Carregando sistema de produção...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="sticky top-0 z-50 bg-gray-950 border-b border-gray-800 px-6 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/cozinha")}
              className="border-gray-600 hover:bg-gray-800"
              data-testid="button-voltar-kds"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <ChefHat className="w-8 h-8 text-orange-500" />
            <div>
              <h1 className="text-xl font-bold">SISTEMA DE MONTAGEM</h1>
              <p className="text-gray-400 text-sm">Control Room • Pizza Passo a Passo</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 rounded-lg border border-gray-700">
              <Timer className="w-5 h-5 text-blue-400" />
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {filaProducao.fila.length + (filaProducao.emProducao ? 1 : 0)}
                </div>
                <div className="text-xs text-gray-400">NA FILA</div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 rounded-lg border border-gray-700">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {formatarTempo(tempoMedioPreparo || 180)}
                </div>
                <div className="text-xs text-gray-400">MÉDIA</div>
              </div>
            </div>

            {pizzasAtrasadas > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-950 rounded-lg border border-red-600 animate-pulse">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">
                    {pizzasAtrasadas}
                  </div>
                  <div className="text-xs text-red-300">ATRASADA</div>
                </div>
              </div>
            )}

            <Badge 
              variant="outline" 
              className={`px-3 py-1 ${wsConectado ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'}`}
              data-testid="status-websocket"
            >
              {wsConectado ? <Wifi className="w-4 h-4 mr-1" /> : <WifiOff className="w-4 h-4 mr-1" />}
              {wsConectado ? "Live" : "Offline"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setSomAtivo(!somAtivo)}
              className="border-gray-600"
              data-testid="button-toggle-som"
            >
              {somAtivo ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </Button>

            <Button 
              variant="outline" 
              size="icon"
              onClick={toggleFullscreen}
              className="border-gray-600"
              data-testid="button-fullscreen"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </Button>

            <Button 
              variant="outline" 
              size="icon"
              onClick={carregarFila}
              className="border-gray-600"
              data-testid="button-refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4">
        {filaProducao.emProducao ? (
          <div className="flex gap-4 h-full">
            <div className="w-[70%] flex flex-col gap-4">
              <Card className={`${urgencyStyles.bg} ${urgencyStyles.border} ${urgencyStyles.glow} p-4 transition-all duration-300 ${urgencyStyles.scale}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Badge className={`${urgencyStyles.badge} ${urgencyStyles.pulse} text-lg px-4 py-1`}>
                      {urgencyLevel === 'critical' ? (
                        <span className="flex items-center gap-2">
                          <Flame className="w-4 h-4" />
                          ATRASADO
                        </span>
                      ) : urgencyLevel === 'warning' ? (
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          ATENÇÃO
                        </span>
                      ) : (
                        'EM PRODUÇÃO'
                      )}
                    </Badge>
                    <h2 className="text-2xl font-bold text-white">
                      {filaProducao.emProducao.nome}
                    </h2>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className={`text-center ${urgencyStyles.pulse}`}>
                      <div className={`text-4xl font-mono font-bold ${urgencyStyles.text}`}>
                        {urgencyLevel === 'critical' ? '+' : ''}{formatarTempo(urgencyLevel === 'critical' ? tempoDecorrido - SLA_TEMPO_SEGUNDOS : tempoRestante)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {urgencyLevel === 'critical' ? 'EXCEDIDO' : 'RESTANTE'}
                      </div>
                    </div>
                    
                    <Button 
                      size="lg"
                      className="bg-green-600 hover:bg-green-700 text-xl px-8 py-6"
                      onClick={() => finalizarProducao(filaProducao.emProducao!.itemPedidoId)}
                      data-testid="button-finalizar-producao"
                    >
                      <CheckCircle className="w-6 h-6 mr-2" />
                      FINALIZAR
                    </Button>
                  </div>
                </div>

                <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${getProgressColor(progressPercentual)} ${progressPercentual >= 70 ? 'animate-pulse' : ''}`}
                    style={{ width: `${Math.min(progressPercentual, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0:00</span>
                  <span className="text-yellow-500">3:30</span>
                  <span className="text-red-500">5:00</span>
                </div>
              </Card>

              <div className="flex-1 grid grid-cols-2 gap-4">
                <Card className={`${urgencyStyles.bg} ${urgencyStyles.border} p-4 transition-all duration-300`}>
                  <PizzaDiagrama 
                    diagrama={filaProducao.emProducao}
                    tamanho={320}
                    mostrarCustos={false}
                    modoTV={true}
                  />
                  
                  <div className="mt-4">
                    <h3 className="text-lg font-bold mb-2 text-white">SABORES</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {filaProducao.emProducao.sabores.map((sabor, index) => (
                        <div 
                          key={`seq-${index}`}
                          className="flex items-center gap-2 text-gray-300 text-sm bg-gray-800 rounded-lg p-2"
                        >
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                            style={{ backgroundColor: sabor.cor }}
                          >
                            {index + 1}
                          </div>
                          <span className="truncate">{sabor.produtoNome}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                <Card className="bg-gray-900 border-gray-800 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="w-6 h-6 text-purple-500" />
                    <h3 className="text-xl font-bold text-white">INSTRUÇÕES IA</h3>
                    {carregandoInstrucoes && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
                  </div>

                  {instrucoes ? (
                    <div className="space-y-3 h-full flex flex-col">
                      <div className="flex justify-between items-center text-sm text-gray-400">
                        <span>Passo {passoAtual + 1} de {instrucoes.passos.length}</span>
                        <span>~{Math.round(instrucoes.tempoEstimado / 60)} min total</span>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="bg-purple-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                            {instrucoes.passos[passoAtual].numero}
                          </div>
                          <div className="flex-1">
                            <p className="text-white text-lg font-medium leading-relaxed">
                              {instrucoes.passos[passoAtual].instrucao}
                            </p>
                            
                            {instrucoes.passos[passoAtual].dica && (
                              <div className="mt-3 flex items-start gap-2 text-yellow-400 text-sm">
                                <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{instrucoes.passos[passoAtual].dica}</span>
                              </div>
                            )}

                            {instrucoes.passos[passoAtual].ingredientes && instrucoes.passos[passoAtual].ingredientes!.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1">
                                {instrucoes.passos[passoAtual].ingredientes!.map((ing, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {ing}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {instrucoes.passos[passoAtual].tempo && (
                              <div className="mt-2 text-gray-500 text-sm">
                                <Clock className="w-3 h-3 inline mr-1" />
                                ~{instrucoes.passos[passoAtual].tempo}s
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between gap-2">
                        <Button 
                          variant="outline" 
                          onClick={voltarPasso}
                          disabled={passoAtual === 0}
                          className="flex-1"
                          data-testid="button-passo-anterior"
                        >
                          Anterior
                        </Button>
                        <Button 
                          onClick={avancarPasso}
                          disabled={passoAtual === instrucoes.passos.length - 1}
                          className="flex-1 bg-purple-600 hover:bg-purple-700"
                          data-testid="button-proximo-passo"
                        >
                          Próximo
                        </Button>
                      </div>

                      <div className="flex gap-1">
                        {instrucoes.passos.map((_, idx) => (
                          <div 
                            key={idx} 
                            className={`h-1.5 flex-1 rounded-full transition-colors ${idx <= passoAtual ? 'bg-purple-500' : 'bg-gray-700'}`}
                          />
                        ))}
                      </div>

                      {instrucoes.dicasGerais.length > 0 && (
                        <div className="p-3 bg-yellow-900/30 rounded-lg border border-yellow-800">
                          <p className="text-yellow-400 text-sm font-medium mb-1">Dicas:</p>
                          <ul className="text-xs text-yellow-300 space-y-1">
                            {instrucoes.dicasGerais.slice(0, 2).map((dica, i) => (
                              <li key={i}>• {dica}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                      {carregandoInstrucoes ? (
                        <>
                          <Loader2 className="w-12 h-12 animate-spin mb-4 text-purple-400" />
                          <p>Gerando instruções com IA...</p>
                        </>
                      ) : (
                        <>
                          <Brain className="w-12 h-12 mb-4 opacity-50" />
                          <p>Instruções não disponíveis</p>
                        </>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            </div>

            <div className="w-[30%]">
              <Card className="bg-gray-900 border-gray-800 p-4 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    FILA DE PRODUÇÃO
                  </h3>
                  <Badge variant="outline" className="text-orange-400 border-orange-400">
                    {filaProducao.fila.length} pizzas
                  </Badge>
                </div>
                
                <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                  {filaProducao.fila.map((item, index) => {
                    const itemUrgency = getQueueItemUrgency(index, filaProducao.fila.length);
                    const itemStyles = getUrgencyStyles(itemUrgency);
                    const tempoEstimado = estimarTempoFila(index);
                    
                    return (
                      <Card 
                        key={item.itemPedidoId}
                        className={`${itemStyles.bg} ${itemStyles.border} p-3 transition-all duration-300 hover:scale-[1.02] cursor-pointer`}
                        data-testid={`fila-item-${index}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge 
                                className={`${itemStyles.badge} text-xs`}
                              >
                                #{index + 1}
                              </Badge>
                              {itemUrgency === 'warning' && (
                                <AlertTriangle className="w-3 h-3 text-yellow-400" />
                              )}
                            </div>
                            <p className={`font-medium ${itemUrgency === 'warning' ? 'text-base' : 'text-sm'} text-white truncate`}>
                              {item.nome}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.sabores.length} sabor{item.sabores.length > 1 ? 'es' : ''}
                            </p>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${itemStyles.text} border-current`}
                            >
                              ~{formatarTempo(tempoEstimado)}
                            </Badge>
                            <Button 
                              size="sm"
                              variant="ghost"
                              className="text-orange-500 hover:text-orange-400 h-6 px-2"
                              onClick={() => iniciarProducao(item.itemPedidoId)}
                              data-testid={`button-iniciar-${index}`}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${itemStyles.badge}`}
                            style={{ width: `${Math.min(20 + (index * 10), 80)}%` }}
                          />
                        </div>
                      </Card>
                    );
                  })}

                  {filaProducao.fila.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                      <ChefHat className="w-12 h-12 mb-4 opacity-50" />
                      <p className="text-sm">Nenhuma pizza na fila</p>
                      <p className="text-xs mt-1">Aguardando pedidos...</p>
                    </div>
                  )}
                </div>

                {filaProducao.fila.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-gray-800 rounded-lg p-2">
                        <div className="text-lg font-bold text-blue-400">
                          {filaProducao.fila.length}
                        </div>
                        <div className="text-xs text-gray-500">Total</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-2">
                        <div className="text-lg font-bold text-orange-400">
                          ~{formatarTempo(estimarTempoFila(filaProducao.fila.length - 1))}
                        </div>
                        <div className="text-xs text-gray-500">Tempo Total</div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[70vh]">
            {filaProducao.fila.length > 0 ? (
              <Card className="bg-gray-900 border-gray-800 p-8 text-center max-w-lg">
                <ChefHat className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-4">
                  {filaProducao.fila.length} pizza(s) aguardando
                </h2>
                <p className="text-gray-400 mb-6">
                  Clique para iniciar a produção da próxima pizza
                </p>
                <Button 
                  size="lg"
                  className="bg-orange-600 hover:bg-orange-700 text-xl px-8 py-6"
                  onClick={() => iniciarProducao(filaProducao.fila[0].itemPedidoId)}
                  data-testid="button-iniciar-proxima"
                >
                  <Play className="w-6 h-6 mr-2" />
                  INICIAR PRODUÇÃO
                </Button>

                <div className="mt-6 space-y-2">
                  {filaProducao.fila.slice(0, 5).map((item, index) => {
                    const itemUrgency = getQueueItemUrgency(index, filaProducao.fila.length);
                    const itemStyles = getUrgencyStyles(itemUrgency);
                    return (
                      <div 
                        key={item.itemPedidoId} 
                        className={`flex items-center justify-between p-2 rounded-lg ${itemStyles.bg} ${itemStyles.border}`}
                      >
                        <span className="text-gray-400">
                          {index + 1}. {item.nome}
                        </span>
                        <Badge variant="outline" className={`text-xs ${itemStyles.text}`}>
                          ~{formatarTempo(estimarTempoFila(index))}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : (
              <Card className="bg-gray-900 border-gray-800 p-12 text-center max-w-md">
                <div className="relative">
                  <ChefHat className="w-20 h-20 text-gray-600 mx-auto mb-6" />
                  <div className="absolute -top-2 -right-2">
                    {wsConectado ? (
                      <Badge className="bg-green-600">
                        <Wifi className="w-3 h-3 mr-1" /> Live
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <WifiOff className="w-3 h-3 mr-1" /> Offline
                      </Badge>
                    )}
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-gray-300 mb-2">
                  Nenhuma pizza na fila
                </h2>
                <p className="text-gray-500 text-lg">
                  Aguardando novos pedidos...
                </p>
                <p className="text-gray-600 text-sm mt-4">
                  {wsConectado 
                    ? "Você receberá atualizações em tempo real" 
                    : "Tentando reconectar..."}
                </p>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
