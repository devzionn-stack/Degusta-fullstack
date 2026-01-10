import { EventEmitter } from "events";
import type { Pedido } from "@shared/schema";
import { db } from "./db";
import { alertasEstoque, estoque, ingredientes } from "@shared/schema";
import { eq, and, lt } from "drizzle-orm";
import { handlePedidoPronto } from "./smart_dispatch";
import {
  broadcastOrderStatusChange,
  broadcastNewOrder,
  broadcastKDSUpdate,
} from "./websocket";

export type EventosPedido =
  | "pedido:criado"
  | "pedido:status_alterado"
  | "pedido:pronto"
  | "estoque:baixo"
  | "cliente:inativo"
  | "despacho:realizado";

export interface PedidoCriadoPayload {
  pedido: Pedido;
  tenantId: string;
}

export interface PedidoStatusAlteradoPayload {
  pedido: Pedido;
  tenantId: string;
  statusAnterior: string;
  statusNovo: string;
}

export interface PedidoProntoPayload {
  pedidoId: string;
  tenantId: string;
  pedido: Pedido;
}

export interface EstoqueBaixoPayload {
  tenantId: string;
  ingredienteId: string;
  ingredienteNome: string;
  quantidadeAtual: number;
  quantidadeMinima: number;
}

export interface ClienteInativoPayload {
  tenantId: string;
  clienteId: string;
  clienteNome: string;
  diasInativo: number;
}

export interface DespachoRealizadoPayload {
  tenantId: string;
  pedidoId: string;
  motoboyId: string;
  motoboyNome: string;
  score: number;
  timestamp: string;
}

type EventPayloadMap = {
  "pedido:criado": PedidoCriadoPayload;
  "pedido:status_alterado": PedidoStatusAlteradoPayload;
  "pedido:pronto": PedidoProntoPayload;
  "estoque:baixo": EstoqueBaixoPayload;
  "cliente:inativo": ClienteInativoPayload;
  "despacho:realizado": DespachoRealizadoPayload;
};

type EventCallback<T extends EventosPedido> = (data: EventPayloadMap[T]) => void | Promise<void>;

class EventBus {
  private emitter: EventEmitter;
  private debugMode: boolean;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
    this.debugMode = process.env.NODE_ENV !== "production";
    this.registrarHandlersAutomaticos();
  }

  on<T extends EventosPedido>(evento: T, callback: EventCallback<T>): void {
    this.emitter.on(evento, callback as (...args: any[]) => void);
    this.log(`[EventBus] Listener registrado para: ${evento}`);
  }

  off<T extends EventosPedido>(evento: T, callback: EventCallback<T>): void {
    this.emitter.off(evento, callback as (...args: any[]) => void);
    this.log(`[EventBus] Listener removido para: ${evento}`);
  }

  emit<T extends EventosPedido>(evento: T, dados: EventPayloadMap[T]): void {
    this.log(`[EventBus] Evento emitido: ${evento}`, dados);
    this.emitter.emit(evento, dados);
  }

  private log(message: string, data?: any): void {
    if (this.debugMode) {
      const timestamp = new Date().toISOString();
      if (data) {
        console.log(`[${timestamp}] ${message}`, JSON.stringify(data, null, 2));
      } else {
        console.log(`[${timestamp}] ${message}`);
      }
    }
  }

  private registrarHandlersAutomaticos(): void {
    this.on("pedido:criado", async (data) => {
      try {
        broadcastNewOrder(data.tenantId, data.pedido);
        this.log(`[EventBus] WebSocket broadcast para novo pedido: ${data.pedido.id}`);
      } catch (error) {
        console.error("[EventBus] Erro no handler pedido:criado:", error);
      }
    });

    this.on("pedido:status_alterado", async (data) => {
      try {
        broadcastOrderStatusChange(data.tenantId, data.pedido);
        
        broadcastKDSUpdate(data.tenantId, "status_atualizado", {
          pedidoId: data.pedido.id,
          statusAnterior: data.statusAnterior,
          statusNovo: data.statusNovo,
        });
        
        this.log(`[EventBus] Métricas atualizadas para pedido ${data.pedido.id}: ${data.statusAnterior} -> ${data.statusNovo}`);
      } catch (error) {
        console.error("[EventBus] Erro no handler pedido:status_alterado:", error);
      }
    });

    this.on("pedido:pronto", async (data) => {
      try {
        this.log(`[EventBus] Pedido pronto, acionando despacho inteligente: ${data.pedidoId}`);
        await handlePedidoPronto(data.tenantId, data.pedidoId);
      } catch (error) {
        console.error("[EventBus] Erro no handler pedido:pronto:", error);
      }
    });

    this.on("estoque:baixo", async (data) => {
      try {
        await db.insert(alertasEstoque).values({
          tenantId: data.tenantId,
          ingredienteId: data.ingredienteId,
          tipo: "estoque_baixo",
          mensagem: `Estoque baixo: ${data.ingredienteNome} está com ${data.quantidadeAtual} unidades (mínimo: ${data.quantidadeMinima})`,
          status: "pendente",
        });
        
        this.log(`[EventBus] Alerta de estoque baixo criado para ${data.ingredienteNome}`);
      } catch (error) {
        console.error("[EventBus] Erro no handler estoque:baixo:", error);
      }
    });

    this.on("cliente:inativo", async (data) => {
      try {
        this.log(`[EventBus] Cliente inativo detectado: ${data.clienteNome} (${data.diasInativo} dias)`);
      } catch (error) {
        console.error("[EventBus] Erro no handler cliente:inativo:", error);
      }
    });
  }

  async verificarEstoqueBaixo(tenantId: string): Promise<void> {
    try {
      const estoquesBaixos = await db
        .select({
          estoqueId: estoque.id,
          ingredienteId: estoque.ingredienteId,
          quantidade: estoque.quantidade,
          quantidadeMinima: estoque.quantidadeMinima,
          ingredienteNome: ingredientes.nome,
        })
        .from(estoque)
        .leftJoin(ingredientes, eq(estoque.ingredienteId, ingredientes.id))
        .where(
          and(
            eq(estoque.tenantId, tenantId),
            lt(estoque.quantidade, estoque.quantidadeMinima)
          )
        );

      for (const item of estoquesBaixos) {
        if (item.ingredienteId && item.ingredienteNome) {
          this.emit("estoque:baixo", {
            tenantId,
            ingredienteId: item.ingredienteId,
            ingredienteNome: item.ingredienteNome,
            quantidadeAtual: item.quantidade,
            quantidadeMinima: item.quantidadeMinima || 0,
          });
        }
      }
    } catch (error) {
      console.error("[EventBus] Erro ao verificar estoque baixo:", error);
    }
  }
}

export const eventBus = new EventBus();

export function emitPedidoCriado(tenantId: string, pedido: Pedido): void {
  eventBus.emit("pedido:criado", { pedido, tenantId });
}

export function emitPedidoStatusAlterado(
  tenantId: string,
  pedido: Pedido,
  statusAnterior: string,
  statusNovo: string
): void {
  eventBus.emit("pedido:status_alterado", {
    pedido,
    tenantId,
    statusAnterior,
    statusNovo,
  });

  if (statusNovo === "pronto" || statusNovo === "pronto_entrega") {
    eventBus.emit("pedido:pronto", {
      pedidoId: pedido.id,
      tenantId,
      pedido,
    });
  }
}

export function emitEstoqueBaixo(
  tenantId: string,
  ingredienteId: string,
  ingredienteNome: string,
  quantidadeAtual: number,
  quantidadeMinima: number
): void {
  eventBus.emit("estoque:baixo", {
    tenantId,
    ingredienteId,
    ingredienteNome,
    quantidadeAtual,
    quantidadeMinima,
  });
}

export function emitClienteInativo(
  tenantId: string,
  clienteId: string,
  clienteNome: string,
  diasInativo: number
): void {
  eventBus.emit("cliente:inativo", {
    tenantId,
    clienteId,
    clienteNome,
    diasInativo,
  });
}

export function emitDespachoRealizado(
  tenantId: string,
  pedidoId: string,
  motoboyId: string,
  motoboyNome: string,
  score: number
): void {
  eventBus.emit("despacho:realizado", {
    tenantId,
    pedidoId,
    motoboyId,
    motoboyNome,
    score,
    timestamp: new Date().toISOString(),
  });
}
