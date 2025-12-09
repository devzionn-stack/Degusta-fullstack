import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuperAdminGuard } from "@/components/SuperAdminGuard";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  Clock, 
  Bike,
  Package,
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

interface LogisticsData {
  taxaAtrasoGlobal: number;
  tempoMedioEntrega: number;
  motoboysAtivos: number;
  totalPedidos: number;
  heatmapData: { lat: number; lng: number; intensity: number }[];
}

function getHeatmapColor(intensity: number, maxIntensity: number): string {
  const normalized = intensity / maxIntensity;
  if (normalized > 0.7) return "#ef4444";
  if (normalized > 0.5) return "#f97316";
  if (normalized > 0.3) return "#eab308";
  return "#22c55e";
}

function getRadius(intensity: number, maxIntensity: number): number {
  const normalized = intensity / maxIntensity;
  return 10 + normalized * 30;
}

function MapBounds({ heatmapData }: { heatmapData: { lat: number; lng: number; intensity: number }[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (heatmapData.length > 0) {
      const lats = heatmapData.map(d => d.lat);
      const lngs = heatmapData.map(d => d.lng);
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lats) - 0.05, Math.min(...lngs) - 0.05],
        [Math.max(...lats) + 0.05, Math.max(...lngs) + 0.05]
      ];
      map.fitBounds(bounds);
    }
  }, [heatmapData, map]);
  
  return null;
}

function LogisticsContent() {
  const { data: logistics, isLoading } = useQuery<LogisticsData>({
    queryKey: ["/api/superadmin/logistics"],
  });

  const maxIntensity = logistics?.heatmapData?.reduce((max, d) => Math.max(max, d.intensity), 1) || 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  const defaultCenter: [number, number] = logistics?.heatmapData?.length 
    ? [
        logistics.heatmapData.reduce((sum, d) => sum + d.lat, 0) / logistics.heatmapData.length,
        logistics.heatmapData.reduce((sum, d) => sum + d.lng, 0) / logistics.heatmapData.length
      ]
    : [-23.5505, -46.6333];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/superadmin">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900" data-testid="text-title">
                Controle Logístico Global
              </h1>
              <p className="text-gray-500">Monitoramento de entregas em toda a rede</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-taxa-atraso">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Taxa de Atraso Global
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                (logistics?.taxaAtrasoGlobal || 0) > 20 ? "text-red-600" : 
                (logistics?.taxaAtrasoGlobal || 0) > 10 ? "text-yellow-600" : "text-green-600"
              }`} data-testid="value-taxa-atraso">
                {(logistics?.taxaAtrasoGlobal || 0).toFixed(1)}%
              </div>
              <p className="text-xs text-gray-500 mt-1">Entregas com mais de 45 min</p>
            </CardContent>
          </Card>

          <Card data-testid="card-tempo-medio">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Tempo Médio de Entrega
              </CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="value-tempo-medio">
                {logistics?.tempoMedioEntrega || 0} min
              </div>
              <p className="text-xs text-gray-500 mt-1">Média da rede (30 dias)</p>
            </CardContent>
          </Card>

          <Card data-testid="card-motoboys">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Motoboys Ativos na Rede
              </CardTitle>
              <Bike className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="value-motoboys">
                {logistics?.motoboysAtivos || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Disponíveis ou em entrega</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-pedidos">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total de Pedidos (30d)
              </CardTitle>
              <Package className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="value-total-pedidos">
                {logistics?.totalPedidos || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Todas as franquias</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Mapa de Calor - Concentração de Pedidos por Região</span>
              <div className="flex items-center gap-4 text-sm font-normal">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Baixa</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>Média</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span>Alta</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Muito Alta</span>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[500px] rounded-lg overflow-hidden border">
              <MapContainer
                center={defaultCenter}
                zoom={12}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {logistics?.heatmapData && logistics.heatmapData.length > 0 && (
                  <>
                    <MapBounds heatmapData={logistics.heatmapData} />
                    {logistics.heatmapData.map((point, index) => (
                      <CircleMarker
                        key={index}
                        center={[point.lat, point.lng]}
                        radius={getRadius(point.intensity, maxIntensity)}
                        fillColor={getHeatmapColor(point.intensity, maxIntensity)}
                        fillOpacity={0.6}
                        stroke={false}
                      >
                        <Popup>
                          <div className="text-center">
                            <strong>{point.intensity} pedidos</strong>
                            <br />
                            <span className="text-gray-500 text-sm">
                              Lat: {point.lat.toFixed(4)}, Lng: {point.lng.toFixed(4)}
                            </span>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
                  </>
                )}
              </MapContainer>
            </div>
            {(!logistics?.heatmapData || logistics.heatmapData.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                <p className="text-gray-500">Nenhum dado de localização disponível</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SuperAdminLogistica() {
  return (
    <SuperAdminGuard>
      <LogisticsContent />
    </SuperAdminGuard>
  );
}
