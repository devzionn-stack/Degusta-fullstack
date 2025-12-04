import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import type { Pedido } from "../shared/schema";

interface TenantConnection {
  ws: WebSocket;
  tenantId: string;
}

const connections: TenantConnection[] = [];

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/pedidos" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const tenantId = url.searchParams.get("tenantId");

    if (!tenantId) {
      ws.close(1008, "Missing tenantId");
      return;
    }

    const connection: TenantConnection = { ws, tenantId };
    connections.push(connection);

    console.log(`WebSocket connected for tenant: ${tenantId}`);

    ws.on("close", () => {
      const index = connections.indexOf(connection);
      if (index > -1) {
        connections.splice(index, 1);
      }
      console.log(`WebSocket disconnected for tenant: ${tenantId}`);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });

    ws.send(JSON.stringify({ type: "connected", tenantId }));
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
