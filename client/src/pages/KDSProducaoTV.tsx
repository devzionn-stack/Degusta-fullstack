import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
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
  RefreshCw
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

export default function KDSProducaoTV() {
  const params = useParams<{ tenantId?: string }>();
  const [filaProducao, setFilaProducao] = useState<FilaProducao>({ emProducao: null, fila: [] });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [somAtivo, setSomAtivo] = useState(true);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [carregando, setCarregando] = useState(true);

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

  useEffect(() => {
    carregarFila();
    const interval = setInterval(carregarFila, 10000);
    return () => clearInterval(interval);
  }, [carregarFila]);

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
    <div className="min-h-screen bg-black text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <ChefHat className="w-10 h-10 text-orange-500" />
          <div>
            <h1 className="text-3xl font-bold">SISTEMA DE MONTAGEM</h1>
            <p className="text-gray-400">Pizza Passo a Passo</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-xl px-4 py-2 border-orange-500 text-orange-500">
            <Clock className="w-5 h-5 mr-2" />
            {formatarTempo(tempoDecorrido)}
          </Badge>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setSomAtivo(!somAtivo)}
            data-testid="button-toggle-som"
          >
            {somAtivo ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>

          <Button 
            variant="outline" 
            size="icon"
            onClick={toggleFullscreen}
            data-testid="button-fullscreen"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </Button>

          <Button 
            variant="outline" 
            size="icon"
            onClick={carregarFila}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {filaProducao.emProducao ? (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8">
            <Card className="bg-gray-900 border-gray-800 p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <Badge className="bg-green-600 text-lg px-4 py-1 mb-2">
                    EM PRODUÇÃO
                  </Badge>
                  <h2 className="text-2xl font-bold text-white">
                    {filaProducao.emProducao.nome}
                  </h2>
                  <p className="text-gray-400">
                    Pedido #{filaProducao.emProducao.pedidoId.slice(0, 8)}
                  </p>
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

              <PizzaDiagrama 
                diagrama={filaProducao.emProducao}
                tamanho={450}
                mostrarCustos={false}
                modoTV={true}
              />
            </Card>
          </div>

          <div className="col-span-4">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                <Clock className="w-5 h-5" />
                FILA DE PRODUÇÃO ({filaProducao.fila.length})
              </h3>
              
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filaProducao.fila.map((item, index) => (
                  <Card 
                    key={item.itemPedidoId}
                    className="bg-gray-800 border-gray-700 p-3"
                    data-testid={`fila-item-${index}`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <Badge variant="outline" className="mb-1">
                          #{index + 1}
                        </Badge>
                        <p className="text-white font-medium">{item.nome}</p>
                        <p className="text-gray-500 text-sm">
                          {item.sabores.length} sabor(es)
                        </p>
                      </div>
                      <Button 
                        size="sm"
                        variant="ghost"
                        className="text-orange-500 hover:text-orange-400"
                        onClick={() => iniciarProducao(item.itemPedidoId)}
                        data-testid={`button-iniciar-${index}`}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}

                {filaProducao.fila.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>Nenhuma pizza na fila</p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="bg-gray-900 border-gray-800 p-4 mt-4">
              <h3 className="text-lg font-bold mb-2 text-white">SEQUÊNCIA DE MONTAGEM</h3>
              <div className="space-y-2">
                {filaProducao.emProducao.sabores.map((sabor, index) => (
                  <div 
                    key={`seq-${index}`}
                    className="flex items-center gap-3 text-gray-300"
                  >
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: sabor.cor }}
                    >
                      {index + 1}
                    </div>
                    <span>{sabor.produtoNome}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
          {filaProducao.fila.length > 0 ? (
            <Card className="bg-gray-900 border-gray-800 p-8 text-center">
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
                {filaProducao.fila.slice(0, 3).map((item, index) => (
                  <div key={item.itemPedidoId} className="text-gray-400">
                    {index + 1}. {item.nome}
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="bg-gray-900 border-gray-800 p-8 text-center">
              <ChefHat className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-400">
                Nenhuma pizza na fila
              </h2>
              <p className="text-gray-500 mt-2">
                Aguardando novos pedidos...
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
