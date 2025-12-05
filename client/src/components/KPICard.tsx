import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  titulo: string;
  valor: string | number;
  variacaoPercentual?: number;
  icone: LucideIcon;
  descricao?: string;
  formato?: "moeda" | "numero" | "percentual";
  corIcone?: string;
  loading?: boolean;
}

export default function KPICard({
  titulo,
  valor,
  variacaoPercentual,
  icone: Icone,
  descricao,
  formato = "numero",
  corIcone = "text-primary",
  loading = false,
}: KPICardProps) {
  const formatarValor = (val: string | number): string => {
    if (typeof val === "string") return val;
    
    switch (formato) {
      case "moeda":
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(val);
      case "percentual":
        return `${val.toFixed(1)}%`;
      case "numero":
      default:
        return new Intl.NumberFormat("pt-BR").format(val);
    }
  };

  const getVariacaoInfo = () => {
    if (variacaoPercentual === undefined || variacaoPercentual === null) {
      return null;
    }

    if (variacaoPercentual > 0) {
      return {
        icon: TrendingUp,
        color: "text-green-600",
        bgColor: "bg-green-50",
        label: `+${variacaoPercentual.toFixed(1)}%`,
      };
    } else if (variacaoPercentual < 0) {
      return {
        icon: TrendingDown,
        color: "text-red-600",
        bgColor: "bg-red-50",
        label: `${variacaoPercentual.toFixed(1)}%`,
      };
    } else {
      return {
        icon: Minus,
        color: "text-gray-500",
        bgColor: "bg-gray-50",
        label: "0%",
      };
    }
  };

  const variacao = getVariacaoInfo();

  if (loading) {
    return (
      <Card className="overflow-hidden" data-testid={`kpi-card-${titulo.toLowerCase().replace(/\s+/g, "-")}-loading`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            </div>
            <div className="w-12 h-12 bg-muted animate-pulse rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="overflow-hidden hover:shadow-md transition-shadow"
      data-testid={`kpi-card-${titulo.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              {titulo}
            </p>
            <p className="text-2xl font-bold tracking-tight" data-testid={`kpi-valor-${titulo.toLowerCase().replace(/\s+/g, "-")}`}>
              {formatarValor(valor)}
            </p>
            
            <div className="flex items-center gap-2 pt-1">
              {variacao && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                    variacao.bgColor,
                    variacao.color
                  )}
                  data-testid={`kpi-variacao-${titulo.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <variacao.icon className="w-3 h-3" />
                  {variacao.label}
                </span>
              )}
              {descricao && (
                <span className="text-xs text-muted-foreground">
                  {descricao}
                </span>
              )}
            </div>
          </div>
          
          <div className={cn(
            "p-3 rounded-xl bg-primary/10",
            corIcone.includes("bg-") ? corIcone : ""
          )}>
            <Icone className={cn(
              "w-6 h-6",
              corIcone.includes("text-") ? corIcone : "text-primary"
            )} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface KPIGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}

export function KPIGrid({ children, columns = 4 }: KPIGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns])} data-testid="kpi-grid">
      {children}
    </div>
  );
}
