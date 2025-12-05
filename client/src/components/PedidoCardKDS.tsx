import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ChefHat, 
  Clock, 
  Truck, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Timer,
  Flame,
  Package,
  Gauge,
  TrendingUp
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
  tempoPreparoEstimado?: number | null;
  tempoEntregaEstimado?: number | null;
  inicioPreparoAt?: string | null;
  prontoEntregaAt?: string | null;
}

interface DPTRealtimeInfo {
  tempoRestante: number;
  progresso: number;
  atrasado: boolean;
}

interface PedidoCardKDSProps {
  pedido: Pedido;
  onStatusChange: (pedidoId: string, newStatus: string) => void;
  onStartPreparo?: (pedidoId: string) => void;
  onFinishPreparo?: (pedidoId: string) => void;
  isUpdating?: boolean;
  compact?: boolean;
  dptInfo?: DPTRealtimeInfo;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  icon: typeof Clock;
  nextStatus?: string;
  nextLabel?: string;
  nextIcon?: typeof Clock;
  useDPTStart?: boolean;
  useDPTFinish?: boolean;
}> = {
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
    useDPTStart: true,
  },
  em_preparo: {
    label: "Em Preparo",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: ChefHat,
    nextStatus: "pronto",
    nextLabel: "Marcar Pronto",
    nextIcon: CheckCircle2,
    useDPTFinish: true,
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

function calculateLocalDPT(itens: PedidoItem[]): number {
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

function getWaitTimeInfo(createdAt: string, status: string, inicioPreparoAt?: string | null, tempoPreparoEstimado?: number | null) {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMinutes = Math.floor((now.getTime() - created.getTime()) / 1000 / 60);
  
  let urgencyLevel: "green" | "yellow" | "red" = "green";
  let urgencyLabel = "No prazo";
  
  const estimado = tempoPreparoEstimado || 15;
  
  if (status === "recebido") {
    if (diffMinutes >= 15) {
      urgencyLevel = "red";
      urgencyLabel = "Urgente!";
    } else if (diffMinutes >= 8) {
      urgencyLevel = "yellow";
      urgencyLabel = "Atenção";
    }
  } else if (status === "em_preparo") {
    const inicio = inicioPreparoAt ? new Date(inicioPreparoAt) : created;
    const tempoEmPreparo = Math.floor((now.getTime() - inicio.getTime()) / 1000 / 60);
    
    if (tempoEmPreparo > estimado) {
      urgencyLevel = "red";
      urgencyLabel = `+${tempoEmPreparo - estimado}min atrasado`;
    } else if (tempoEmPreparo >= estimado * 0.8) {
      urgencyLevel = "yellow";
      urgencyLabel = `${estimado - tempoEmPreparo}min restante`;
    } else {
      urgencyLabel = `${estimado - tempoEmPreparo}min restante`;
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

function calculateProgress(pedido: Pedido): { progress: number; isLate: boolean; tempoDecorrido: number } {
  if (pedido.status !== "em_preparo") {
    return { progress: 0, isLate: false, tempoDecorrido: 0 };
  }
  
  const now = new Date();
  const inicio = pedido.inicioPreparoAt ? new Date(pedido.inicioPreparoAt) : new Date(pedido.createdAt);
  const tempoDecorrido = Math.floor((now.getTime() - inicio.getTime()) / 1000 / 60);
  const tempoEstimado = pedido.tempoPreparoEstimado || 15;
  
  const progress = Math.min(100, Math.round((tempoDecorrido / tempoEstimado) * 100));
  const isLate = tempoDecorrido > tempoEstimado;
  
  return { progress, isLate, tempoDecorrido };
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
  onStartPreparo,
  onFinishPreparo,
  isUpdating = false,
  compact = false,
  dptInfo 
}: PedidoCardKDSProps) {
  const config = STATUS_CONFIG[pedido.status as keyof typeof STATUS_CONFIG];
  
  const { diffMinutes, urgencyLevel, urgencyLabel } = useMemo(
    () => getWaitTimeInfo(pedido.createdAt, pedido.status, pedido.inicioPreparoAt, pedido.tempoPreparoEstimado),
    [pedido.createdAt, pedido.status, pedido.inicioPreparoAt, pedido.tempoPreparoEstimado]
  );
  
  const localDpt = useMemo(
    () => calculateLocalDPT(pedido.itens),
    [pedido.itens]
  );
  
  const dpt = pedido.tempoPreparoEstimado || localDpt;
  
  const { progress, isLate, tempoDecorrido } = useMemo(
    () => calculateProgress(pedido),
    [pedido]
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

  const handleActionClick = () => {
    if (config.useDPTStart && onStartPreparo) {
      onStartPreparo(pedido.id);
    } else if (config.useDPTFinish && onFinishPreparo) {
      onFinishPreparo(pedido.id);
    } else if (config.nextStatus) {
      onStatusChange(pedido.id, config.nextStatus);
    }
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
        
        <div className="flex items-center justify-between mt-2 gap-2">
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
            <Gauge className="w-3 h-3" />
            <span>DPT: {dpt}min</span>
          </div>
        </div>

        {pedido.status === "em_preparo" && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <TrendingUp className="w-3 h-3" />
                Progresso do preparo
              </span>
              <span className={`font-medium ${isLate ? 'text-red-600' : 'text-blue-600'}`}>
                {dptInfo?.progresso ?? progress}%
              </span>
            </div>
            <Progress 
              value={dptInfo?.progresso ?? progress} 
              className={`h-2 ${isLate ? '[&>div]:bg-red-500' : ''}`}
            />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{tempoDecorrido} min decorridos</span>
              <span>{Math.max(0, dpt - tempoDecorrido)} min restantes</span>
            </div>
          </div>
        )}
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

          {pedido.tempoEntregaEstimado && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 px-2 py-1.5 rounded-md">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>Tempo total estimado: <strong className="text-blue-700">{pedido.tempoEntregaEstimado} min</strong> (preparo + entrega)</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t gap-2">
            <span className="font-bold text-lg text-primary">
              R$ {parseFloat(pedido.total).toFixed(2)}
            </span>
            
            {config.nextStatus && (
              <Button
                onClick={handleActionClick}
                disabled={isUpdating}
                size={compact ? "sm" : "default"}
                className={`shrink-0 ${config.useDPTStart ? 'bg-orange-500 hover:bg-orange-600' : ''} ${config.useDPTFinish ? 'bg-green-500 hover:bg-green-600' : ''}`}
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

export { calculateLocalDPT as calculateDPT, getWaitTimeInfo, STATUS_CONFIG };
