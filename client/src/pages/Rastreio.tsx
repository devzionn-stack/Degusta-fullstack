import { useEffect, useState, useMemo } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Clock, Truck, CheckCircle, Package, Navigation, AlertCircle } from "lucide-react";

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

const PIZZERIA_LOCATION: [number, number] = [-23.5505, -46.6333];

const motoboyIcon = L.divIcon({
  className: "custom-motoboy-marker",
  html: `
    <div style="
      background: #ea580c;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      border: 3px solid white;
      box-shadow: 0 3px 10px rgba(0,0,0,0.4);
      animation: pulse 2s infinite;
    ">
      🛵
    </div>
    <style>
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
    </style>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -22],
});

const destinationIcon = L.divIcon({
  className: "custom-destination-marker",
  html: `
    <div style="
      background: #22c55e;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">
      📍
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

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

  const mapCenter = useMemo<[number, number]>(() => {
    if (tracking?.trackingData?.lat && tracking?.trackingData?.lng) {
      return [tracking.trackingData.lat, tracking.trackingData.lng];
    }
    return PIZZERIA_LOCATION;
  }, [tracking]);

  const routeLine = useMemo(() => {
    if (!tracking?.trackingData?.lat || !tracking?.trackingData?.lng) return null;
    
    const motoboyPos: [number, number] = [tracking.trackingData.lat, tracking.trackingData.lng];
    const destLat = tracking.trackingData.lat + 0.01;
    const destLng = tracking.trackingData.lng + 0.015;
    
    return {
      motoboy: motoboyPos,
      destination: [destLat, destLng] as [number, number],
    };
  }, [tracking]);

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
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
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
      <div className="max-w-2xl mx-auto p-4 py-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            🍕 Bella Napoli
          </h1>
          <p className="text-gray-600">Rastreamento do Pedido</p>
        </div>

        {!isDelivered && tracking.trackingData && (
          <div className="mb-6 rounded-xl overflow-hidden shadow-lg border" data-testid="map-container">
            <div className="h-[300px] relative">
              <MapContainer
                center={mapCenter}
                zoom={15}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={false}
                dragging={true}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapUpdater center={mapCenter} zoom={15} />
                
                {tracking.trackingData.lat && tracking.trackingData.lng && (
                  <Marker 
                    position={[tracking.trackingData.lat, tracking.trackingData.lng]} 
                    icon={motoboyIcon}
                  >
                    <Popup>
                      <div className="text-center p-1">
                        <strong className="text-lg">🛵 Seu pedido</strong>
                        <p className="text-sm text-gray-600">
                          {trackingStatusLabels[tracking.trackingData.status] || "Em andamento"}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                )}
                
                {routeLine && (
                  <>
                    <Marker position={routeLine.destination} icon={destinationIcon}>
                      <Popup>
                        <div className="text-center p-1">
                          <strong>📍 Destino</strong>
                          <p className="text-sm text-gray-600">
                            {tracking.enderecoEntrega || "Endereço de entrega"}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                    
                    <Polyline
                      positions={[routeLine.motoboy, routeLine.destination]}
                      color="#ea580c"
                      weight={4}
                      opacity={0.7}
                      dashArray="10, 10"
                    />
                  </>
                )}
              </MapContainer>
              
              <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 z-[1000]">
                <p className="text-xs text-gray-500">Atualização automática</p>
                <p className="text-sm font-medium text-orange-600">a cada 30s</p>
              </div>
            </div>
          </div>
        )}

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

                <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-5 mb-4 border border-orange-200" data-testid="eta-container">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-500 rounded-full shadow-lg">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-orange-700 font-medium">ETA Preditivo</p>
                      <p className="text-3xl font-bold text-gray-800" data-testid="eta-time">
                        {timeLeft || "Calculando..."}
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
                        Previsão baseada em tempo real
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

        <p className="text-center text-xs text-gray-400 mt-8">
          Pedido feito em {new Date(tracking.createdAt).toLocaleDateString('pt-BR')}
        </p>
      </div>
    </div>
  );
}
