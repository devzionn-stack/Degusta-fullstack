import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Clock, Truck, CheckCircle, Package, Navigation } from "lucide-react";

interface TrackingData {
  lat: number;
  lng: number;
  eta: string;
  lastUpdate: string;
  status: string;
}

interface TrackingInfo {
  pedidoId: string;
  status: string;
  trackingStatus: string | null;
  trackingData: TrackingData;
  enderecoEntrega: string | null;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  recebido: "Recebido",
  em_preparo: "Em Preparo",
  pronto: "Pronto",
  saiu_entrega: "Saiu para Entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const trackingStatusLabels: Record<string, string> = {
  coletando: "Coletando pedido",
  em_transito: "Em trânsito",
  chegando: "Chegando ao destino",
  finalizado: "Entregue",
};

export default function Rastreio() {
  const params = useParams();
  const trackingToken = params.pedidoId || params.trackingToken;
  const [timeLeft, setTimeLeft] = useState<string>("");

  const { data: tracking, isLoading, error } = useQuery<TrackingInfo>({
    queryKey: ["tracking", trackingToken],
    queryFn: async () => {
      const res = await fetch(`/api/public/rastreio/${trackingToken}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Rastreamento não encontrado");
      }
      return res.json();
    },
    refetchInterval: 30000,
    enabled: !!trackingToken,
  });

  useEffect(() => {
    if (tracking?.trackingData?.eta) {
      const updateTimer = () => {
        const eta = new Date(tracking.trackingData.eta);
        const now = new Date();
        const diff = eta.getTime() - now.getTime();
        
        if (diff <= 0) {
          setTimeLeft("Chegando...");
          return;
        }
        
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) {
          setTimeLeft("Menos de 1 minuto");
        } else if (minutes === 1) {
          setTimeLeft("1 minuto");
        } else {
          setTimeLeft(`${minutes} minutos`);
        }
      };
      
      updateTimer();
      const interval = setInterval(updateTimer, 30000);
      return () => clearInterval(interval);
    }
  }, [tracking?.trackingData?.eta]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center" data-testid="loading-container">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando rastreamento...</p>
        </div>
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4" data-testid="error-container">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Rastreamento não disponível
            </h2>
            <p className="text-gray-600">
              {error instanceof Error ? error.message : "Não foi possível encontrar o rastreamento deste pedido."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getProgressPercentage = () => {
    switch (tracking.trackingData?.status) {
      case "coletando": return 20;
      case "em_transito": return 60;
      case "chegando": return 85;
      case "finalizado": return 100;
      default: return 0;
    }
  };

  const isDelivered = tracking.status === "entregue";

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="max-w-lg mx-auto p-4 py-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            🍕 Bella Napoli
          </h1>
          <p className="text-gray-600">Rastreamento do Pedido</p>
        </div>

        <Card className="mb-6" data-testid="tracking-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Pedido #{tracking.pedidoId.slice(0, 8).toUpperCase()}
              </CardTitle>
              <Badge variant={isDelivered ? "default" : "secondary"} data-testid="status-badge">
                {statusLabels[tracking.status] || tracking.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {!isDelivered && tracking.trackingData && (
              <>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Progresso da entrega</span>
                    <span className="text-sm font-medium text-orange-600">
                      {trackingStatusLabels[tracking.trackingData.status] || "Em andamento"}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${getProgressPercentage()}%` }}
                      data-testid="progress-bar"
                    />
                  </div>
                </div>

                <div className="bg-orange-50 rounded-lg p-4 mb-4" data-testid="eta-container">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-full">
                      <Clock className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Tempo estimado</p>
                      <p className="text-lg font-semibold text-gray-800" data-testid="eta-time">
                        {timeLeft || "Calculando..."}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <Package className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Pedido preparado</p>
                      <p className="text-xs text-gray-500">Seu pedido foi preparado com carinho</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${tracking.trackingData.status !== "coletando" ? "bg-green-100" : "bg-gray-100"}`}>
                      <Truck className={`w-4 h-4 ${tracking.trackingData.status !== "coletando" ? "text-green-600" : "text-gray-400"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Saiu para entrega</p>
                      <p className="text-xs text-gray-500">Motoboy a caminho</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${tracking.trackingData.status === "chegando" ? "bg-orange-100" : "bg-gray-100"}`}>
                      <Navigation className={`w-4 h-4 ${tracking.trackingData.status === "chegando" ? "text-orange-600" : "text-gray-400"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Chegando</p>
                      <p className="text-xs text-gray-500">Quase lá!</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {isDelivered && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Pedido Entregue!
                </h3>
                <p className="text-gray-600">
                  Obrigado por escolher a Bella Napoli. Bom apetite! 🍕
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {tracking.enderecoEntrega && (
          <Card data-testid="address-card">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Endereço de entrega</p>
                  <p className="text-sm text-gray-600" data-testid="delivery-address">
                    {tracking.enderecoEntrega}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 bg-blue-50 rounded-lg p-4" data-testid="map-container">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Mapa de Rastreamento</span>
          </div>
          <div className="bg-gray-200 rounded-lg h-48 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-green-200 opacity-50" />
            <div className="relative z-10 text-center">
              <div className="text-4xl mb-2">🛵</div>
              <p className="text-sm text-gray-700">
                {tracking.trackingData?.lat && tracking.trackingData?.lng 
                  ? `Localização: ${tracking.trackingData.lat.toFixed(4)}, ${tracking.trackingData.lng.toFixed(4)}`
                  : "Localizando entregador..."
                }
              </p>
              {tracking.trackingData?.lastUpdate && (
                <p className="text-xs text-gray-500 mt-1">
                  Atualizado: {new Date(tracking.trackingData.lastUpdate).toLocaleTimeString('pt-BR')}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            O mapa é atualizado automaticamente a cada 30 segundos
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Pedido feito em {new Date(tracking.createdAt).toLocaleDateString('pt-BR')}
        </p>
      </div>
    </div>
  );
}
