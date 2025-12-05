import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import KPICard from "@/components/KPICard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { 
  Truck, 
  Clock, 
  AlertTriangle, 
  MapPin, 
  RefreshCw, 
  Phone,
  Bike,
  Car,
  Navigation,
  CheckCircle,
  XCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333];
const DEFAULT_ZOOM = 13;

const createMotoboyIcon = (status: string, veiculoTipo: string | null) => {
  const color = status === "em_entrega" ? "#ef4444" : status === "disponivel" ? "#22c55e" : "#6b7280";
  const emoji = veiculoTipo === "carro" ? "🚗" : veiculoTipo === "bicicleta" ? "🚲" : "🛵";
  
  return L.divIcon({
    className: "custom-motoboy-marker",
    html: `
      <div style="
        background: ${color};
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        ${emoji}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

const pizzeriaIcon = L.divIcon({
  className: "custom-pizzeria-marker",
  html: `
    <div style="
      background: #ea580c;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">
      🍕
    </div>
  `,
  iconSize: [50, 50],
  iconAnchor: [25, 25],
  popupAnchor: [0, -25],
});

interface Motoboy {
  id: string;
  nome: string;
  telefone: string | null;
  placa: string | null;
  veiculoTipo: string | null;
  status: string;
  lat: string | null;
  lng: string | null;
  lastLocationUpdate: string | null;
  pedidoAtual?: {
    id: string;
    enderecoEntrega: string | null;
    status: string;
  } | null;
}

interface LogisticsStats {
  tempoMedioEntrega: number;
  atrasosHoje: number;
  entregasHoje: number;
  motoboyAtivos: number;
  variacaoTempo: number;
  variacaoAtrasos: number;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, DEFAULT_ZOOM);
  }, [center, map]);
  return null;
}

export default function Logistica() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMotoboy, setSelectedMotoboy] = useState<Motoboy | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);

  const { data: motoboys = [], isLoading: loadingMotoboys } = useQuery<Motoboy[]>({
    queryKey: ["motoboys", "all"],
    queryFn: async () => {
      const res = await fetch("/api/motoboys", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar motoboys");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: stats, isLoading: loadingStats } = useQuery<LogisticsStats>({
    queryKey: ["logistics", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/logistics", { credentials: "include" });
      if (!res.ok) {
        return {
          tempoMedioEntrega: 0,
          atrasosHoje: 0,
          entregasHoje: 0,
          motoboyAtivos: 0,
          variacaoTempo: 0,
          variacaoAtrasos: 0,
        };
      }
      return res.json();
    },
    refetchInterval: 60000,
  });

  const updateLocationMutation = useMutation({
    mutationFn: async ({ motoboyId, lat, lng }: { motoboyId: string; lat: number; lng: number }) => {
      const res = await fetch(`/api/motoboys/${motoboyId}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lat, lng }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar localização");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motoboys"] });
      toast({
        title: "Localização Atualizada",
        description: "A localização do motoboy foi atualizada.",
      });
    },
  });

  const motoboysComLocalizacao = useMemo(() => {
    return motoboys.filter(m => m.lat && m.lng);
  }, [motoboys]);

  const motoboysAtivos = useMemo(() => {
    return motoboys.filter(m => m.status === "em_entrega" || m.status === "disponivel");
  }, [motoboys]);

  useEffect(() => {
    if (motoboysComLocalizacao.length > 0) {
      const firstMotoboy = motoboysComLocalizacao[0];
      if (firstMotoboy.lat && firstMotoboy.lng) {
        setMapCenter([parseFloat(firstMotoboy.lat), parseFloat(firstMotoboy.lng)]);
      }
    }
  }, [motoboysComLocalizacao]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "disponivel":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Disponível</Badge>;
      case "em_entrega":
        return <Badge className="bg-red-100 text-red-700"><Navigation className="h-3 w-3 mr-1" />Em Entrega</Badge>;
      case "indisponivel":
        return <Badge className="bg-gray-100 text-gray-700"><XCircle className="h-3 w-3 mr-1" />Indisponível</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getVehicleIcon = (tipo: string | null) => {
    switch (tipo) {
      case "carro":
        return <Car className="h-4 w-4" />;
      case "bicicleta":
        return <Bike className="h-4 w-4" />;
      default:
        return <Truck className="h-4 w-4" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold flex items-center gap-2" data-testid="text-title">
              <Truck className="h-6 w-6 text-primary" />
              Logística
            </h1>
            <p className="text-muted-foreground">
              Acompanhe a frota e entregas em tempo real
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["motoboys"] })}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Tempo Médio de Entrega"
            value={stats?.tempoMedioEntrega ? `${stats.tempoMedioEntrega} min` : "-- min"}
            variation={stats?.variacaoTempo || 0}
            icon={Clock}
            iconColor="text-blue-600"
            loading={loadingStats}
            testId="kpi-tempo-medio"
          />
          <KPICard
            title="Atrasos Hoje"
            value={stats?.atrasosHoje?.toString() || "0"}
            variation={stats?.variacaoAtrasos || 0}
            invertVariation
            icon={AlertTriangle}
            iconColor="text-red-600"
            loading={loadingStats}
            testId="kpi-atrasos"
          />
          <KPICard
            title="Entregas Hoje"
            value={stats?.entregasHoje?.toString() || "0"}
            icon={CheckCircle}
            iconColor="text-green-600"
            loading={loadingStats}
            testId="kpi-entregas"
          />
          <KPICard
            title="Motoboys Ativos"
            value={motoboysAtivos.length.toString()}
            icon={Truck}
            iconColor="text-orange-600"
            loading={loadingMotoboys}
            testId="kpi-motoboys"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Mapa de Rastreamento
              </CardTitle>
              <CardDescription>
                Localização em tempo real dos motoboys
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] rounded-lg overflow-hidden border" data-testid="logistics-map">
                <MapContainer
                  center={mapCenter}
                  zoom={DEFAULT_ZOOM}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapUpdater center={mapCenter} />
                  
                  <Marker position={mapCenter} icon={pizzeriaIcon}>
                    <Popup>
                      <div className="text-center p-2">
                        <strong className="text-lg">🍕 Bella Napoli</strong>
                        <p className="text-sm text-gray-600">Matriz</p>
                      </div>
                    </Popup>
                  </Marker>

                  {motoboysComLocalizacao.map((motoboy) => (
                    <Marker
                      key={motoboy.id}
                      position={[parseFloat(motoboy.lat!), parseFloat(motoboy.lng!)]}
                      icon={createMotoboyIcon(motoboy.status, motoboy.veiculoTipo)}
                      eventHandlers={{
                        click: () => setSelectedMotoboy(motoboy),
                      }}
                    >
                      <Popup>
                        <div className="p-2 min-w-[200px]">
                          <div className="flex items-center gap-2 mb-2">
                            {getVehicleIcon(motoboy.veiculoTipo)}
                            <strong>{motoboy.nome}</strong>
                          </div>
                          {getStatusBadge(motoboy.status)}
                          {motoboy.placa && (
                            <p className="text-sm text-gray-600 mt-2">Placa: {motoboy.placa}</p>
                          )}
                          {motoboy.telefone && (
                            <p className="text-sm text-gray-600 flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {motoboy.telefone}
                            </p>
                          )}
                          {motoboy.lastLocationUpdate && (
                            <p className="text-xs text-gray-400 mt-2">
                              Última atualização: {new Date(motoboy.lastLocationUpdate).toLocaleTimeString("pt-BR")}
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span>Disponível</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <span>Em Entrega</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-gray-500"></div>
                  <span>Indisponível</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Motoboys
              </CardTitle>
              <CardDescription>
                {motoboys.length} motoboy(s) cadastrados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMotoboys ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : motoboys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum motoboy cadastrado</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {motoboys.map((motoboy) => (
                    <div
                      key={motoboy.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedMotoboy?.id === motoboy.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        setSelectedMotoboy(motoboy);
                        if (motoboy.lat && motoboy.lng) {
                          setMapCenter([parseFloat(motoboy.lat), parseFloat(motoboy.lng)]);
                        }
                      }}
                      data-testid={`motoboy-card-${motoboy.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getVehicleIcon(motoboy.veiculoTipo)}
                          <span className="font-medium">{motoboy.nome}</span>
                        </div>
                        {getStatusBadge(motoboy.status)}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {motoboy.placa && <p>Placa: {motoboy.placa}</p>}
                        {motoboy.telefone && (
                          <p className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {motoboy.telefone}
                          </p>
                        )}
                        {motoboy.lat && motoboy.lng ? (
                          <p className="flex items-center gap-1 text-green-600">
                            <MapPin className="h-3 w-3" />
                            Localização ativa
                          </p>
                        ) : (
                          <p className="flex items-center gap-1 text-gray-400">
                            <MapPin className="h-3 w-3" />
                            Sem localização
                          </p>
                        )}
                      </div>
                      {motoboy.pedidoAtual && (
                        <div className="mt-2 p-2 bg-orange-50 rounded text-sm">
                          <p className="font-medium text-orange-800">
                            Pedido #{motoboy.pedidoAtual.id.slice(0, 8)}
                          </p>
                          {motoboy.pedidoAtual.enderecoEntrega && (
                            <p className="text-orange-600 text-xs truncate">
                              {motoboy.pedidoAtual.enderecoEntrega}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
