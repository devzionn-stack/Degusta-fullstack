import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChefHat, 
  Clock, 
  Truck, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Timer,
  Flame,
  Package
} from "lucide-react";

interface PedidoItem {
  produtoId: string | null;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal?: number;
  validado?: boolean;
}

interface Pedido {
  id: string;
  tenantId: string;
  clienteId: string | null;
  status: string;
  total: string;
  itens: PedidoItem[];
  observacoes: string | null;
  enderecoEntrega: string | null;
  origem: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PedidoCardKDSProps {
  pedido: Pedido;
  onStatusChange: (pedidoId: string, newStatus: string) => void;
  isUpdating?: boolean;
  compact?: boolean;
}

const STATUS_CONFIG = {
  pendente: {
    label: "Pendente",
    color: "bg-gray-100 text-gray-800 border-gray-200",
    icon: Clock,
    nextStatus: "recebido",
    nextLabel: "Receber",
    nextIcon: Clock,
  },
  recebido: {
    label: "Recebido",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: Clock,
    nextStatus: "em_preparo",
    nextLabel: "Iniciar Preparo",
    nextIcon: ChefHat,
  },
  em_preparo: {
    label: "Em Preparo",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: ChefHat,
    nextStatus: "pronto",
    nextLabel: "Marcar Pronto",
    nextIcon: CheckCircle2,
  },
  pronto: {
    label: "Pronto",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: CheckCircle2,
    nextStatus: "saiu_entrega",
    nextLabel: "Saiu p/ Entrega",
    nextIcon: Truck,
  },
  saiu_entrega: {
    label: "Saiu para Entrega",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: Truck,
    nextStatus: "entregue",
    nextLabel: "Entregue",
    nextIcon: Package,
  },
};

function calculateDPT(itens: PedidoItem[]): number {
  const baseTime = 5;
  const perItemTime = 2;
  const complexItemBonus = 3;
  
  let totalItems = 0;
  let complexItems = 0;
  
  itens.forEach(item => {
    totalItems += item.quantidade;
    if (item.nome.toLowerCase().includes("pizza") || 
        item.nome.toLowerCase().includes("lasanha") ||
        item.nome.toLowerCase().includes("calzone")) {
      complexItems += item.quantidade;
    }
  });
  
  return baseTime + (totalItems * perItemTime) + (complexItems * complexItemBonus);
}

function getWaitTimeInfo(createdAt: string, status: string) {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMinutes = Math.floor((now.getTime() - created.getTime()) / 1000 / 60);
  
  let urgencyLevel: "green" | "yellow" | "red" = "green";
  let urgencyLabel = "No prazo";
  
  if (status === "recebido") {
    if (diffMinutes >= 15) {
      urgencyLevel = "red";
      urgencyLabel = "Urgente!";
    } else if (diffMinutes >= 8) {
      urgencyLevel = "yellow";
      urgencyLabel = "Atenção";
    }
  } else if (status === "em_preparo") {
    if (diffMinutes >= 25) {
      urgencyLevel = "red";
      urgencyLabel = "Atrasado!";
    } else if (diffMinutes >= 15) {
      urgencyLevel = "yellow";
      urgencyLabel = "Atenção";
    }
  } else if (status === "pronto") {
    if (diffMinutes >= 35) {
      urgencyLevel = "red";
      urgencyLabel = "Aguardando!";
    } else if (diffMinutes >= 20) {
      urgencyLevel = "yellow";
      urgencyLabel = "Retirar";
    }
  } else if (status === "saiu_entrega") {
    if (diffMinutes >= 60) {
      urgencyLevel = "red";
      urgencyLabel = "Verificar!";
    } else if (diffMinutes >= 40) {
      urgencyLevel = "yellow";
      urgencyLabel = "Em rota";
    }
  }
  
  return { diffMinutes, urgencyLevel, urgencyLabel };
}

const URGENCY_COLORS = {
  green: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    icon: "text-green-600",
  },
  yellow: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-700",
    icon: "text-amber-600",
  },
  red: {
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-700",
    icon: "text-red-600",
    pulse: true,
  },
};

export default function PedidoCardKDS({ 
  pedido, 
  onStatusChange, 
  isUpdating = false,
  compact = false 
}: PedidoCardKDSProps) {
  const config = STATUS_CONFIG[pedido.status as keyof typeof STATUS_CONFIG];
  
  const { diffMinutes, urgencyLevel, urgencyLabel } = useMemo(
    () => getWaitTimeInfo(pedido.createdAt, pedido.status),
    [pedido.createdAt, pedido.status]
  );
  
  const dpt = useMemo(
    () => calculateDPT(pedido.itens),
    [pedido.itens]
  );
  
  const urgencyColors = URGENCY_COLORS[urgencyLevel];
  
  if (!config) return null;
  
  const StatusIcon = config.icon;
  const NextIcon = config.nextIcon || config.icon;

  const formatWaitTime = (minutes: number) => {
    if (minutes < 1) return "Agora";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <Card 
      className={`
        shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden
        ${urgencyLevel === "red" ? "ring-2 ring-red-400 animate-pulse" : ""}
        ${urgencyLevel === "yellow" ? "ring-1 ring-amber-300" : ""}
      `}
      data-testid={`kds-card-${pedido.id}`}
    >
      <CardHeader className={`pb-2 ${compact ? "p-3" : "p-4"}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-sm font-bold text-primary truncate">
              #{pedido.id.slice(0, 8)}
            </span>
            {pedido.origem === "n8n" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                N8N
              </Badge>
            )}
          </div>
          <Badge className={`${config.color} shrink-0`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <div className={`
            flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
            ${urgencyColors.bg} ${urgencyColors.border} ${urgencyColors.text} border
          `}>
            {urgencyLevel === "red" ? (
              <Flame className={`w-3.5 h-3.5 ${urgencyColors.icon}`} />
            ) : (
              <Timer className={`w-3.5 h-3.5 ${urgencyColors.icon}`} />
            )}
            <span>{formatWaitTime(diffMinutes)}</span>
            <span className="opacity-70">• {urgencyLabel}</span>
          </div>
          
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
            <Clock className="w-3 h-3" />
            <span>DPT: ~{dpt}min</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className={compact ? "p-3 pt-0" : "p-4 pt-0"}>
        <div className="space-y-3">
          <div className="bg-muted/30 rounded-lg p-2.5">
            <ul className="space-y-1">
              {pedido.itens.map((item, idx) => (
                <li 
                  key={idx} 
                  className="flex items-start gap-2 text-sm"
                  data-testid={`kds-item-${pedido.id}-${idx}`}
                >
                  <span className="font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs min-w-[24px] text-center">
                    {item.quantidade}x
                  </span>
                  <span className="flex-1 font-medium">{item.nome}</span>
                  {item.validado === false && (
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                </li>
              ))}
            </ul>
          </div>

          {pedido.observacoes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 font-medium">{pedido.observacoes}</p>
              </div>
            </div>
          )}

          {pedido.enderecoEntrega && !compact && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Truck className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="truncate">{pedido.enderecoEntrega}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t gap-2">
            <span className="font-bold text-lg text-primary">
              R$ {parseFloat(pedido.total).toFixed(2)}
            </span>
            
            {config.nextStatus && (
              <Button
                onClick={() => onStatusChange(pedido.id, config.nextStatus!)}
                disabled={isUpdating}
                size={compact ? "sm" : "default"}
                className="shrink-0"
                data-testid={`kds-action-${pedido.id}`}
              >
                {isUpdating ? (
                  <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <NextIcon className="w-4 h-4 mr-1.5" />
                )}
                {config.nextLabel}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { calculateDPT, getWaitTimeInfo, STATUS_CONFIG };
