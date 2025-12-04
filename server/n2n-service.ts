import { storage } from "./storage";
import type { Pedido, Motoboy, Cliente } from "../shared/schema";

export interface TrackingResult {
  success: boolean;
  trackingLink?: string;
  trackingToken?: string;
  externalId?: string;
  error?: string;
}

export interface TrackingData {
  lat?: number;
  lng?: number;
  eta?: string;
  lastUpdate?: string;
  status?: string;
}

export async function iniciarRastreamento(
  pedidoId: string,
  motoboyId: string,
  tenantId: string
): Promise<TrackingResult> {
  try {
    const pedido = await storage.getPedido(pedidoId, tenantId);
    if (!pedido) {
      return { success: false, error: "Pedido não encontrado" };
    }

    const motoboy = await storage.getMotoboy(motoboyId, tenantId);
    if (!motoboy) {
      return { success: false, error: "Motoboy não encontrado" };
    }

    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      return { success: false, error: "Tenant não encontrado" };
    }

    let cliente: Cliente | undefined;
    if (pedido.clienteId) {
      cliente = await storage.getCliente(pedido.clienteId, tenantId);
    }

    const payload = {
      orderId: pedidoId,
      tenantId: tenantId,
      delivery: {
        driverName: motoboy.nome,
        driverPhone: motoboy.telefone,
        vehiclePlate: motoboy.placa,
        vehicleType: motoboy.veiculoTipo,
      },
      customer: cliente ? {
        name: cliente.nome,
        phone: cliente.telefone,
        address: pedido.enderecoEntrega || cliente.endereco,
      } : {
        name: "Cliente",
        address: pedido.enderecoEntrega,
      },
      items: pedido.itens,
      total: pedido.total,
    };

    const n2nApiUrl = process.env.N2N_API_URL;
    const n2nApiKey = process.env.N2N_API_KEY;

    if (n2nApiUrl && n2nApiKey) {
      try {
        const response = await fetch(`${n2nApiUrl}/tracking/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${n2nApiKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = await response.json();
          
          await storage.createLogN8n({
            tenantId,
            tipo: "n2n_tracking",
            endpoint: "/tracking/start",
            payload,
            resposta: data,
            status: "sucesso",
          });

          return {
            success: true,
            trackingLink: data.trackingLink || data.tracking_url,
            externalId: data.trackingId || data.id,
          };
        } else {
          const errorText = await response.text();
          
          await storage.createLogN8n({
            tenantId,
            tipo: "n2n_tracking",
            endpoint: "/tracking/start",
            payload,
            status: "erro",
            erro: errorText,
          });

          return { success: false, error: `API retornou erro: ${response.status}` };
        }
      } catch (fetchError: any) {
        await storage.createLogN8n({
          tenantId,
          tipo: "n2n_tracking",
          endpoint: "/tracking/start",
          payload,
          status: "erro",
          erro: fetchError.message,
        });

        console.error("Erro ao chamar N2N API:", fetchError);
      }
    }

    const trackingToken = `TRK-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
    const baseUrl = process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000";
    const trackingLink = `https://${baseUrl}/rastreio/${trackingToken}`;

    await storage.createLogN8n({
      tenantId,
      tipo: "n2n_tracking_simulated",
      endpoint: "/tracking/start",
      payload,
      resposta: { trackingLink, trackingToken },
      status: "sucesso",
    });

    return {
      success: true,
      trackingLink,
      trackingToken,
      externalId: trackingToken,
    };
  } catch (error: any) {
    console.error("Erro em iniciarRastreamento:", error);
    return { success: false, error: error.message };
  }
}

export function generateSimulatedTrackingData(pedidoId: string): TrackingData {
  const now = new Date();
  const baseLat = -23.5505;
  const baseLng = -46.6333;
  
  const timeOffset = parseInt(pedidoId.slice(0, 4), 16) % 100;
  const progress = Math.min((timeOffset / 100) * 0.8 + 0.1, 0.9);
  
  const lat = baseLat + (progress * 0.05);
  const lng = baseLng + (progress * 0.03);
  
  const etaMinutes = Math.max(5, Math.floor((1 - progress) * 30));
  const eta = new Date(now.getTime() + etaMinutes * 60000);

  let status = "em_transito";
  if (progress < 0.2) status = "coletando";
  else if (progress > 0.8) status = "chegando";

  return {
    lat,
    lng,
    eta: eta.toISOString(),
    lastUpdate: now.toISOString(),
    status,
  };
}
