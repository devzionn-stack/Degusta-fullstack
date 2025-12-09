import { db } from "./db";
import { pedidos, motoboys, tenants, alertasFrota } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
const EARTH_RADIUS_KM = 6371;

export interface Coordenadas {
  lat: number;
  lng: number;
}

export interface RotaResultado {
  distanciaMetros: number;
  duracaoSegundos: number;
  polyline: string;
  passos: Array<{
    instrucao: string;
    distanciaMetros: number;
    duracaoSegundos: number;
  }>;
}

export interface ETAResultado {
  etaMinutos: number;
  distanciaMetros: number;
  trafegoAtual: "leve" | "moderado" | "intenso";
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function calcularDistanciaHaversine(
  origem: Coordenadas,
  destino: Coordenadas
): number {
  const dLat = toRadians(destino.lat - origem.lat);
  const dLng = toRadians(destino.lng - origem.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(origem.lat)) *
      Math.cos(toRadians(destino.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c * 1000;
}

export async function geocodificarEndereco(
  endereco: string
): Promise<Coordenadas | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn(
      "GOOGLE_MAPS_API_KEY não configurada. Usando coordenadas simuladas."
    );
    const hash = endereco.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    return {
      lat: -23.55 + (hash % 100) / 1000,
      lng: -46.63 + ((hash >> 8) % 100) / 1000,
    };
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", endereco);
    url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
      };
    }

    console.error("Geocodificação falhou:", data.status);
    return null;
  } catch (error) {
    console.error("Erro ao geocodificar:", error);
    return null;
  }
}

export async function calcularRota(
  origem: Coordenadas,
  destino: Coordenadas
): Promise<RotaResultado | null> {
  const distanciaMetros = calcularDistanciaHaversine(origem, destino);
  const velocidadeMediaKmH = 25;
  const duracaoSegundos = (distanciaMetros / 1000 / velocidadeMediaKmH) * 3600;

  if (!GOOGLE_MAPS_API_KEY) {
    console.warn(
      "GOOGLE_MAPS_API_KEY não configurada. Usando cálculo simples."
    );
    return {
      distanciaMetros: Math.round(distanciaMetros),
      duracaoSegundos: Math.round(duracaoSegundos),
      polyline: `${origem.lat},${origem.lng};${destino.lat},${destino.lng}`,
      passos: [
        {
          instrucao: "Siga em direção ao destino",
          distanciaMetros: Math.round(distanciaMetros),
          duracaoSegundos: Math.round(duracaoSegundos),
        },
      ],
    };
  }

  try {
    const url = new URL(
      "https://maps.googleapis.com/maps/api/directions/json"
    );
    url.searchParams.set("origin", `${origem.lat},${origem.lng}`);
    url.searchParams.set("destination", `${destino.lat},${destino.lng}`);
    url.searchParams.set("mode", "driving");
    url.searchParams.set("departure_time", "now");
    url.searchParams.set("traffic_model", "best_guess");
    url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === "OK" && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];

      return {
        distanciaMetros: leg.distance.value,
        duracaoSegundos: leg.duration_in_traffic?.value || leg.duration.value,
        polyline: route.overview_polyline.points,
        passos: leg.steps.map((step: any) => ({
          instrucao: step.html_instructions.replace(/<[^>]*>/g, ""),
          distanciaMetros: step.distance.value,
          duracaoSegundos: step.duration.value,
        })),
      };
    }

    console.error("Cálculo de rota falhou:", data.status);
    return null;
  } catch (error) {
    console.error("Erro ao calcular rota:", error);
    return null;
  }
}

export async function calcularETA(
  motoboyLat: number,
  motoboyLng: number,
  destinoLat: number,
  destinoLng: number
): Promise<ETAResultado> {
  const origem: Coordenadas = { lat: motoboyLat, lng: motoboyLng };
  const destino: Coordenadas = { lat: destinoLat, lng: destinoLng };
  const distanciaMetros = calcularDistanciaHaversine(origem, destino);

  if (!GOOGLE_MAPS_API_KEY) {
    const velocidadeMediaKmH = 25;
    const etaMinutos = Math.round(
      (distanciaMetros / 1000 / velocidadeMediaKmH) * 60
    );
    return {
      etaMinutos: Math.max(etaMinutos, 3),
      distanciaMetros: Math.round(distanciaMetros),
      trafegoAtual: "moderado",
    };
  }

  try {
    const url = new URL(
      "https://maps.googleapis.com/maps/api/distancematrix/json"
    );
    url.searchParams.set("origins", `${origem.lat},${origem.lng}`);
    url.searchParams.set("destinations", `${destino.lat},${destino.lng}`);
    url.searchParams.set("mode", "driving");
    url.searchParams.set("departure_time", "now");
    url.searchParams.set("traffic_model", "best_guess");
    url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === "OK" && data.rows.length > 0) {
      const element = data.rows[0].elements[0];
      if (element.status === "OK") {
        const duracaoNormal = element.duration.value;
        const duracaoTrafego = element.duration_in_traffic?.value || duracaoNormal;

        let trafegoAtual: "leve" | "moderado" | "intenso" = "leve";
        const ratio = duracaoTrafego / duracaoNormal;
        if (ratio > 1.5) trafegoAtual = "intenso";
        else if (ratio > 1.2) trafegoAtual = "moderado";

        return {
          etaMinutos: Math.round(duracaoTrafego / 60),
          distanciaMetros: element.distance.value,
          trafegoAtual,
        };
      }
    }

    throw new Error("Resposta inválida da API");
  } catch (error) {
    console.error("Erro ao calcular ETA:", error);
    const velocidadeMediaKmH = 25;
    return {
      etaMinutos: Math.round((distanciaMetros / 1000 / velocidadeMediaKmH) * 60),
      distanciaMetros: Math.round(distanciaMetros),
      trafegoAtual: "moderado",
    };
  }
}

export function decodificarPolyline(encoded: string): Coordenadas[] {
  const pontos: Coordenadas[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    pontos.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return pontos;
}

export function verificarForaDeRota(
  posicaoAtual: Coordenadas,
  rotaPolyline: string,
  toleranciaMetros: number = 200
): boolean {
  if (!rotaPolyline) return false;

  if (rotaPolyline.includes(";")) {
    const pontos = rotaPolyline.split(";").map((p) => {
      const [lat, lng] = p.split(",").map(Number);
      return { lat, lng };
    });

    const menorDistancia = Math.min(
      ...pontos.map((p) => calcularDistanciaHaversine(posicaoAtual, p))
    );
    return menorDistancia > toleranciaMetros;
  }

  try {
    const pontos = decodificarPolyline(rotaPolyline);
    if (pontos.length === 0) return false;

    const menorDistancia = Math.min(
      ...pontos.map((p) => calcularDistanciaHaversine(posicaoAtual, p))
    );
    return menorDistancia > toleranciaMetros;
  } catch (error) {
    console.error("Erro ao decodificar polyline:", error);
    return false;
  }
}

export async function registrarAlertaForaRota(
  tenantId: string,
  motoboyId: string,
  pedidoId: string,
  distanciaMetros: number
): Promise<void> {
  await db.insert(alertasFrota).values({
    tenantId,
    tipo: "motoboy_fora_rota",
    severidade: "warn",
    mensagem: `Motoboy fora da rota planejada. Distância: ${Math.round(distanciaMetros)}m`,
    meta: { motoboyId, pedidoId, distanciaMetros },
  });
}

export async function atualizarLocalizacaoMotoboy(
  motoboyId: string,
  tenantId: string,
  lat: number,
  lng: number
): Promise<void> {
  await db
    .update(motoboys)
    .set({
      lat: lat.toString(),
      lng: lng.toString(),
      lastLocationUpdate: new Date(),
    })
    .where(and(eq(motoboys.id, motoboyId), eq(motoboys.tenantId, tenantId)));
}

export async function obterMotoboyPorToken(
  accessToken: string
): Promise<{ id: string; tenantId: string } | null> {
  const result = await db
    .select({ id: motoboys.id, tenantId: motoboys.tenantId })
    .from(motoboys)
    .where(eq(motoboys.accessToken, accessToken))
    .limit(1);

  return result[0] || null;
}

export async function gerarTokenMotoboy(motoboyId: string): Promise<string> {
  const token = `mt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  await db.update(motoboys).set({ accessToken: token }).where(eq(motoboys.id, motoboyId));
  return token;
}
