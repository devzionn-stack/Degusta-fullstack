import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Ingrediente {
  ingredienteId: string;
  nome: string;
  quantidade: number;
  unidade: string;
  custo: number;
}

interface Sabor {
  produtoId: string;
  produtoNome: string;
  fracao: number;
  setorInicio: number;
  setorFim: number;
  cor: string;
  ingredientes: Ingrediente[];
}

interface DiagramaPizza {
  itemPedidoId: string;
  pedidoId: string;
  nome: string;
  sabores: Sabor[];
  ingredientesTotal: Ingrediente[];
  custoTotal: number;
  precoVenda: number;
  margemLucro: number;
}

interface PizzaDiagramaProps {
  diagrama: DiagramaPizza;
  tamanho?: number;
  mostrarCustos?: boolean;
  modoTV?: boolean;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", cx, cy,
    "L", start.x, start.y,
    "A", r, r, 0, largeArcFlag, 0, end.x, end.y,
    "Z"
  ].join(" ");
}

export function PizzaDiagrama({ diagrama, tamanho = 400, mostrarCustos = true, modoTV = false }: PizzaDiagramaProps) {
  const [saborHover, setSaborHover] = useState<Sabor | null>(null);
  const [saborSelecionado, setSaborSelecionado] = useState<Sabor | null>(null);

  const saborAtivo = saborSelecionado || saborHover;
  const cx = tamanho / 2;
  const cy = tamanho / 2;
  const raio = (tamanho / 2) - 20;

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const formatarQuantidade = (qtd: number, unidade: string) => {
    if (qtd >= 1000 && unidade === 'g') {
      return `${(qtd / 1000).toFixed(2)}kg`;
    }
    return `${qtd.toFixed(1)}${unidade}`;
  };

  return (
    <div className={`flex ${modoTV ? 'gap-8' : 'gap-6'} ${modoTV ? 'flex-row' : 'flex-col lg:flex-row'}`}>
      <div className="flex-shrink-0">
        <div className="relative" style={{ width: tamanho, height: tamanho }}>
          <svg 
            width={tamanho} 
            height={tamanho} 
            className="drop-shadow-lg"
            data-testid="pizza-diagrama-svg"
          >
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            <circle 
              cx={cx} 
              cy={cy} 
              r={raio + 5} 
              fill="#8B4513" 
              className="drop-shadow-md"
            />
            <circle 
              cx={cx} 
              cy={cy} 
              r={raio} 
              fill="#FCD34D" 
              className="drop-shadow-sm"
            />

            {diagrama.sabores.map((sabor, index) => {
              const isAtivo = saborAtivo?.produtoId === sabor.produtoId && 
                              saborAtivo?.setorInicio === sabor.setorInicio;
              
              return (
                <g key={`${sabor.produtoId}-${index}`}>
                  <path
                    d={describeArc(cx, cy, raio - 2, sabor.setorInicio, sabor.setorFim)}
                    fill={sabor.cor}
                    opacity={isAtivo ? 1 : 0.85}
                    stroke={isAtivo ? "#fff" : "#333"}
                    strokeWidth={isAtivo ? 3 : 1}
                    className="cursor-pointer transition-all duration-200"
                    style={{ filter: isAtivo ? "url(#glow)" : "none" }}
                    onMouseEnter={() => setSaborHover(sabor)}
                    onMouseLeave={() => setSaborHover(null)}
                    onClick={() => setSaborSelecionado(prev => 
                      prev?.produtoId === sabor.produtoId && prev?.setorInicio === sabor.setorInicio 
                        ? null 
                        : sabor
                    )}
                    data-testid={`pizza-setor-${index}`}
                  />
                  
                  {/* Número do setor */}
                  {(() => {
                    const midAngle = (sabor.setorInicio + sabor.setorFim) / 2;
                    const labelRadius = raio * 0.6;
                    const pos = polarToCartesian(cx, cy, labelRadius, midAngle);
                    return (
                      <g>
                        <circle 
                          cx={pos.x} 
                          cy={pos.y} 
                          r={modoTV ? 24 : 18} 
                          fill="#1f2937" 
                          stroke="#fff"
                          strokeWidth={2}
                        />
                        <text
                          x={pos.x}
                          y={pos.y + (modoTV ? 8 : 6)}
                          textAnchor="middle"
                          fill="#fff"
                          fontSize={modoTV ? 20 : 16}
                          fontWeight="bold"
                        >
                          {index + 1}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          {diagrama.sabores.map((sabor, index) => (
            <Badge
              key={`legend-${index}`}
              className="cursor-pointer text-white"
              style={{ backgroundColor: sabor.cor }}
              onClick={() => setSaborSelecionado(prev => 
                prev?.produtoId === sabor.produtoId && prev?.setorInicio === sabor.setorInicio 
                  ? null 
                  : sabor
              )}
              data-testid={`pizza-legenda-${index}`}
            >
              {index + 1}. {sabor.produtoNome} ({Math.round(sabor.fracao * 100)}%)
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <Card className={`p-4 ${modoTV ? 'bg-gray-900 text-white' : ''}`}>
          <h3 className={`font-bold mb-3 ${modoTV ? 'text-xl' : 'text-lg'}`}>
            {saborAtivo ? `${saborAtivo.produtoNome}` : 'INGREDIENTES TOTAIS'}
          </h3>
          
          <div className="space-y-2">
            {(saborAtivo ? saborAtivo.ingredientes : diagrama.ingredientesTotal).map((ing, idx) => (
              <div 
                key={`${ing.ingredienteId}-${idx}`}
                className={`flex justify-between items-center py-2 border-b ${modoTV ? 'border-gray-700' : 'border-gray-200'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${modoTV ? 'text-lg' : ''}`}>{ing.nome}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`${modoTV ? 'text-gray-300' : 'text-gray-500'}`}>
                    {formatarQuantidade(ing.quantidade, ing.unidade)}
                  </span>
                  {mostrarCustos && (
                    <span className={`font-semibold ${modoTV ? 'text-green-400' : 'text-green-600'}`}>
                      {formatarMoeda(ing.custo)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {mostrarCustos && (
          <Card className={`p-4 ${modoTV ? 'bg-gray-900 text-white' : ''}`}>
            <h3 className={`font-bold mb-3 ${modoTV ? 'text-xl' : 'text-lg'}`}>RESUMO FINANCEIRO</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Custo Total:</span>
                <span className="font-bold text-red-500">{formatarMoeda(diagrama.custoTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Preço de Venda:</span>
                <span className="font-bold">{formatarMoeda(diagrama.precoVenda)}</span>
              </div>
              <div className={`flex justify-between border-t pt-2 ${modoTV ? 'border-gray-700' : ''}`}>
                <span>Margem de Lucro:</span>
                <span className={`font-bold ${diagrama.margemLucro > 30 ? 'text-green-500' : 'text-yellow-500'}`}>
                  {diagrama.margemLucro}%
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export default PizzaDiagrama;
