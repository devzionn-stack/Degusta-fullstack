import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CircularProgress } from "@/components/ui/circular-progress";
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

interface ProducaoStatus {
  pedidoId: string;
  tempoDecorrido: number;
  tempoMetaMontagem: number;
  numeroLoop: number;
  progresso: number;
  urgencia: "verde" | "amarelo" | "vermelho";
  etapaAtual: string;
  proximaEtapa: string | null;
  tempoRestante: number;
}

interface PedidoCardKDSProps {
  pedido: Pedido;
  onStatusChange: (pedidoId: string, newStatus: string) => void;
  onStartPreparo?: (pedidoId: string) => void;
  onFinishPreparo?: (pedidoId: string) => void;
  isUpdating?: boolean;
  compact?: boolean;
  dptInfo?: DPTRealtimeInfo;
  producaoStatus?: ProducaoStatus;
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
  dptInfo,
  producaoStatus
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

  const progressColor = isLate || producaoStatus?.urgencia === "vermelho" ? "danger" :
    producaoStatus?.urgencia === "amarelo" ? "warning" : "default";

  return (
    <Card 
      className={`
        shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden
        ${urgencyLevel === "red" ? "ring-2 ring-red-400 animate-pulse" : ""}
        ${urgencyLevel === "yellow" ? "ring-1 ring-amber-300" : ""}
      `}
      data-testid={`kds-card-${pedido.id}`}
    >
      <CardHeader className={`pb-2 ${compact ? "p-4" : "p-5"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-lg md:text-xl font-bold text-primary truncate">
              #{pedido.id.slice(0, 8)}
            </span>
            {pedido.origem === "n8n" && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5 shrink-0">
                N8N
              </Badge>
            )}
          </div>
          <Badge className={`${config.color} shrink-0 text-sm px-3 py-1`}>
            <StatusIcon className="w-4 h-4 mr-1.5" />
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
          <div className="mt-4">
            <div className="flex items-center gap-4">
              <CircularProgress 
                value={Math.min(100, producaoStatus?.progresso ?? dptInfo?.progresso ?? progress)}
                size={70}
                strokeWidth={6}
                color={progressColor}
                label="preparo"
              />
              <div className="flex-1 space-y-2">
                {producaoStatus && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold
                      ${producaoStatus.urgencia === "vermelho" ? "bg-red-100 text-red-800 border border-red-300 animate-pulse" : ""}
                      ${producaoStatus.urgencia === "amarelo" ? "bg-amber-100 text-amber-800 border border-amber-300" : ""}
                      ${producaoStatus.urgencia === "verde" ? "bg-green-100 text-green-800 border border-green-300" : ""}
                    `}>
                      <Clock className="w-4 h-4" />
                      Loop: {producaoStatus.numeroLoop}min
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-sm text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-700">
                      <ChefHat className="w-4 h-4" />
                      {producaoStatus.etapaAtual}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {producaoStatus?.tempoDecorrido ? Math.floor(producaoStatus.tempoDecorrido / 60) : tempoDecorrido} min decorridos
                  </span>
                  {producaoStatus?.tempoRestante !== undefined && producaoStatus.tempoRestante < 0 ? (
                    <span className="font-bold text-red-600 animate-pulse text-base">
                      +{Math.abs(Math.floor(producaoStatus.tempoRestante / 60))}min ATRASADO
                    </span>
                  ) : (
                    <span className={`font-semibold ${progressColor === "danger" ? 'text-red-600' : progressColor === "warning" ? 'text-amber-600' : 'text-foreground'}`}>
                      {producaoStatus ? Math.floor(producaoStatus.tempoRestante / 60) : Math.max(0, dpt - tempoDecorrido)}min restantes
                    </span>
                  )}
                </div>
                {producaoStatus?.proximaEtapa && (
                  <div className="text-xs text-muted-foreground bg-muted/50 dark:bg-muted/20 py-1.5 px-2 rounded">
                    Próxima: <span className="font-medium text-foreground">{producaoStatus.proximaEtapa}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className={compact ? "p-4 pt-0" : "p-5 pt-0"}>
        <div className="space-y-4">
          <div className="bg-muted/30 dark:bg-muted/10 rounded-lg p-3">
            <ul className="space-y-2">
              {pedido.itens.map((item, idx) => (
                <li 
                  key={idx} 
                  className="flex items-start gap-3 text-base md:text-lg"
                  data-testid={`kds-item-${pedido.id}-${idx}`}
                >
                  <span className="font-bold text-primary bg-primary/10 px-2 py-1 rounded text-sm md:text-base min-w-[32px] text-center">
                    {item.quantidade}x
                  </span>
                  <span className="flex-1 font-semibold">{item.nome}</span>
                  {item.validado === false && (
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  )}
                </li>
              ))}
            </ul>
          </div>

          {pedido.observacoes && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-base text-amber-800 dark:text-amber-200 font-medium">{pedido.observacoes}</p>
              </div>
            </div>
          )}

          {pedido.enderecoEntrega && !compact && (
            <div className="flex items-start gap-2 text-base text-muted-foreground">
              <Truck className="w-5 h-5 shrink-0 mt-0.5" />
              <span className="truncate">{pedido.enderecoEntrega}</span>
            </div>
          )}

          {pedido.tempoEntregaEstimado && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
              <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              <span>Tempo total: <strong className="text-blue-700 dark:text-blue-300">{pedido.tempoEntregaEstimado} min</strong></span>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t gap-3">
            <span className="font-bold text-xl md:text-2xl text-primary">
              R$ {parseFloat(pedido.total).toFixed(2)}
            </span>
            
            {config.nextStatus && (
              <Button
                onClick={handleActionClick}
                disabled={isUpdating}
                size="lg"
                className={`shrink-0 text-base md:text-lg px-6 h-12 ${config.useDPTStart ? 'bg-orange-500 hover:bg-orange-600' : ''} ${config.useDPTFinish ? 'bg-green-500 hover:bg-green-600' : ''}`}
                data-testid={`kds-action-${pedido.id}`}
              >
                {isUpdating ? (
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <NextIcon className="w-5 h-5 mr-2" />
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
