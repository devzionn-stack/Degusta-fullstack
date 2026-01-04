import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import type { Pedido } from "../shared/schema";
import { storage } from "./storage";
import { parse as parseCookie } from "cookie";
import { unsign } from "cookie-signature";
import { pool } from "./db";
import { getSessionSecret } from "./session-config";

interface TenantConnection {
  ws: WebSocket;
  tenantId: string;
  userId: string;
}

const connections: TenantConnection[] = [];

function verifySignedCookie(signedValue: string): string | false {
  const secret = getSessionSecret();
  
  if (!signedValue.startsWith("s:")) {
    return false;
  }
  
  const signedPart = signedValue.slice(2);
  const result = unsign(signedPart, secret);
  
  return result;
}

async function getSessionUser(sessionId: string): Promise<{ userId: string; tenantId: string | null } | null> {
  try {
    const result = await pool.query(
      'SELECT sess FROM sessions WHERE sid = $1 AND expire > NOW()',
      [sessionId]
    );
    
    if (result.rows.length === 0) return null;
    
    const session = result.rows[0].sess;
    if (!session?.userId) return null;
    
    const user = await storage.getUser(session.userId);
    if (!user) return null;
    
    return { userId: user.id, tenantId: user.tenantId };
  } catch (error) {
    console.error("WebSocket session lookup error:", error);
    return null;
  }
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/pedidos" });

  wss.on("connection", async (ws, req) => {
    try {
      const cookies = parseCookie(req.headers.cookie || "");
      const signedSessionId = cookies["connect.sid"];
      
      if (!signedSessionId) {
        ws.close(1008, "Authentication required");
        return;
      }

      const sessionId = verifySignedCookie(signedSessionId);
      
      if (!sessionId) {
        console.warn("WebSocket: Invalid session signature");
        ws.close(1008, "Invalid session");
        return;
      }

      const sessionUser = await getSessionUser(sessionId);
      
      if (!sessionUser || !sessionUser.tenantId) {
        ws.close(1008, "Authentication required or no tenant");
        return;
      }

      const connection: TenantConnection = { 
        ws, 
        tenantId: sessionUser.tenantId,
        userId: sessionUser.userId
      };
      connections.push(connection);

      console.log(`WebSocket connected for tenant: ${sessionUser.tenantId}, user: ${sessionUser.userId}`);

      ws.on("close", () => {
        const index = connections.indexOf(connection);
        if (index > -1) {
          connections.splice(index, 1);
        }
        console.log(`WebSocket disconnected for tenant: ${sessionUser.tenantId}`);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });

      ws.send(JSON.stringify({ 
        type: "connected", 
        tenantId: sessionUser.tenantId 
      }));
    } catch (error) {
      console.error("WebSocket connection error:", error);
      ws.close(1011, "Internal error");
    }
  });

  return wss;
}

export function broadcastPedidoUpdate(tenantId: string, pedido: Pedido, action: "created" | "updated" | "deleted") {
  const message = JSON.stringify({
    type: "pedido_update",
    action,
    pedido,
    timestamp: new Date().toISOString(),
  });

  connections
    .filter((conn) => conn.tenantId === tenantId && conn.ws.readyState === WebSocket.OPEN)
    .forEach((conn) => {
      try {
        conn.ws.send(message);
      } catch (error) {
        console.error("Error sending WebSocket message:", error);
      }
    });
}

export function broadcastNewOrder(tenantId: string, pedido: Pedido) {
  broadcastPedidoUpdate(tenantId, pedido, "created");
}

export function broadcastOrderStatusChange(tenantId: string, pedido: Pedido) {
  broadcastPedidoUpdate(tenantId, pedido, "updated");
}

// ============================================
// KDS WEBSOCKET EVENTS
// ============================================

export function broadcastKDSUpdate(tenantId: string, type: string, data: any) {
  const message = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString(),
  });

  connections
    .filter((conn) => conn.tenantId === tenantId && conn.ws.readyState === WebSocket.OPEN)
    .forEach((conn) => {
      try {
        conn.ws.send(message);
      } catch (error) {
        console.error("Error sending KDS WebSocket message:", error);
      }
    });
}

export function broadcastNovoPedidoKDS(tenantId: string, pedidoId: string) {
  broadcastKDSUpdate(tenantId, "novo_pedido_kds", { pedidoId });
}

export function broadcastEtapaAvancadaKDS(tenantId: string, progressoId: string, etapaAtual: number) {
  broadcastKDSUpdate(tenantId, "etapa_avancada_kds", { progressoId, etapaAtual });
}

export function broadcastPizzaProntaKDS(tenantId: string, progressoId: string, produtoNome: string) {
  broadcastKDSUpdate(tenantId, "pizza_pronta_kds", { progressoId, produtoNome });
}

export function broadcastAtualizarKDS(tenantId: string) {
  broadcastKDSUpdate(tenantId, "atualizar_kds", {});
}
