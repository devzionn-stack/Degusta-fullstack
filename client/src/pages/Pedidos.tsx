import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ShoppingBag, Filter, Eye, ChevronLeft, ChevronRight, Search, X, Truck, MapPin, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos os Status" },
  { value: "recebido", label: "Recebido" },
  { value: "em_preparo", label: "Em Preparo" },
  { value: "pronto", label: "Pronto" },
  { value: "saiu_entrega", label: "Saiu para Entrega" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
];

const STATUS_COLORS: Record<string, string> = {
  recebido: "bg-blue-100 text-blue-700",
  em_preparo: "bg-yellow-100 text-yellow-700",
  pronto: "bg-green-100 text-green-700",
  saiu_entrega: "bg-purple-100 text-purple-700",
  entregue: "bg-gray-100 text-gray-700",
  cancelado: "bg-red-100 text-red-700",
  pendente: "bg-orange-100 text-orange-700",
};

const ITEMS_PER_PAGE = 10;

interface PedidoItem {
  produtoId?: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  validado?: boolean;
}

interface Pedido {
  id: string;
  clienteId: string | null;
  motoboyId: string | null;
  status: string;
  total: string;
  itens: PedidoItem[];
  observacoes: string | null;
  enderecoEntrega: string | null;
  origem: string | null;
  trackingLink: string | null;
  trackingStatus: string | null;
  createdAt: string;
}

interface Motoboy {
  id: string;
  nome: string;
  telefone: string | null;
  placa: string | null;
  veiculoTipo: string | null;
  status: string;
}

export default function Pedidos() {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [selectedMotoboyId, setSelectedMotoboyId] = useState<string>("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: motoboys = [] } = useQuery<Motoboy[]>({
    queryKey: ["motoboys", "disponiveis"],
    queryFn: async () => {
      const res = await fetch("/api/motoboys/disponiveis", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const iniciarEntregaMutation = useMutation({
    mutationFn: async ({ pedidoId, motoboyId }: { pedidoId: string; motoboyId: string }) => {
      const res = await fetch(`/api/pedidos/${pedidoId}/iniciar-entrega`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ motoboyId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao iniciar entrega");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["motoboys"] });
      setDeliveryDialogOpen(false);
      setSelectedMotoboyId("");
      setSelectedPedido(null);
      toast({
        title: "Entrega Iniciada!",
        description: `Rastreamento disponível em: ${data.trackingLink}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const queryParams = new URLSearchParams();
  if (statusFilter !== "todos") queryParams.append("status", statusFilter);
  if (startDate) queryParams.append("startDate", startDate);
  if (endDate) queryParams.append("endDate", endDate);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos", "filtered", statusFilter, startDate, endDate],
    queryFn: async () => {
      const url = queryParams.toString() 
        ? `/api/pedidos/filtered?${queryParams.toString()}` 
        : `/api/pedidos`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filteredPedidos = useMemo(() => {
    if (!searchTerm) return pedidos;
    const term = searchTerm.toLowerCase();
    return pedidos.filter((pedido: Pedido) => 
      pedido.id.toLowerCase().includes(term) ||
      pedido.enderecoEntrega?.toLowerCase().includes(term) ||
      pedido.observacoes?.toLowerCase().includes(term)
    );
  }, [pedidos, searchTerm]);

  const totalPages = Math.ceil(filteredPedidos.length / ITEMS_PER_PAGE);
  const paginatedPedidos = filteredPedidos.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleClearFilters = () => {
    setStatusFilter("todos");
    setStartDate("");
    setEndDate("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const hasActiveFilters = statusFilter !== "todos" || startDate || endDate || searchTerm;

  const formatStatus = (status: string) => {
    const found = STATUS_OPTIONS.find(s => s.value === status);
    return found?.label || status;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold flex items-center gap-3" data-testid="text-title">
              <ShoppingBag className="h-8 w-8 text-primary" />
              Pedidos
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie todos os pedidos da sua pizzaria
            </p>
          </div>
          <div className="text-sm text-muted-foreground" data-testid="text-total-count">
            {filteredPedidos.length} pedido{filteredPedidos.length !== 1 ? "s" : ""} encontrado{filteredPedidos.length !== 1 ? "s" : ""}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="ID, endereço..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger id="status" data-testid="select-status">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inicial</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  data-testid="input-start-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">Data Final</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  data-testid="input-end-date"
                />
              </div>

              <div className="flex items-end">
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={handleClearFilters}
                    className="w-full"
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : paginatedPedidos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mb-4 opacity-50" />
                <p>Nenhum pedido encontrado</p>
                {hasActiveFilters && (
                  <Button
                    variant="link"
                    onClick={handleClearFilters}
                    className="mt-2"
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rastreio</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPedidos.map((pedido: Pedido) => (
                      <TableRow key={pedido.id} data-testid={`row-pedido-${pedido.id}`}>
                        <TableCell className="font-mono text-sm">
                          #{pedido.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(pedido.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary"
                            className={STATUS_COLORS[pedido.status] || "bg-gray-100"}
                          >
                            {formatStatus(pedido.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {pedido.trackingLink ? (
                            <a
                              href={pedido.trackingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                              data-testid={`link-tracking-${pedido.id}`}
                            >
                              <MapPin className="h-3 w-3" />
                              Rastrear
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : pedido.status === "pronto" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                setSelectedPedido(pedido);
                                setDeliveryDialogOpen(true);
                              }}
                              data-testid={`button-start-delivery-${pedido.id}`}
                            >
                              <Truck className="h-3 w-3 mr-1" />
                              Enviar
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {Array.isArray(pedido.itens) ? pedido.itens.length : 0} item(s)
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          R$ {parseFloat(pedido.total).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPedido(pedido)}
                            data-testid={`button-view-${pedido.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedPedido} onOpenChange={() => setSelectedPedido(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Detalhes do Pedido #{selectedPedido?.id.slice(0, 8)}
              </DialogTitle>
              <DialogDescription>
                {selectedPedido && format(new Date(selectedPedido.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </DialogDescription>
            </DialogHeader>
            
            {selectedPedido && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge className={STATUS_COLORS[selectedPedido.status] || "bg-gray-100"}>
                    {formatStatus(selectedPedido.status)}
                  </Badge>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Itens do Pedido</h4>
                  <div className="space-y-2">
                    {Array.isArray(selectedPedido.itens) && selectedPedido.itens.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.quantidade}x</span>
                          <span>{item.nome}</span>
                          {item.validado === false && (
                            <Badge variant="destructive" className="text-xs">
                              Não validado
                            </Badge>
                          )}
                        </div>
                        <span className="font-medium">
                          R$ {(item.subtotal || item.quantidade * item.precoUnitario).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-bold text-primary">
                    R$ {parseFloat(selectedPedido.total).toFixed(2)}
                  </span>
                </div>

                {selectedPedido.enderecoEntrega && (
                  <div>
                    <h4 className="font-medium mb-1">Endereço de Entrega</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedPedido.enderecoEntrega}
                    </p>
                  </div>
                )}

                {selectedPedido.observacoes && (
                  <div>
                    <h4 className="font-medium mb-1">Observações</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedPedido.observacoes}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t text-sm text-muted-foreground">
                  <span>Origem:</span>
                  <Badge variant="outline" className="capitalize">
                    {selectedPedido.origem || "sistema"}
                  </Badge>
                </div>

                {selectedPedido.trackingLink && (
                  <div className="pt-2 border-t">
                    <a
                      href={selectedPedido.trackingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
                    >
                      <MapPin className="h-4 w-4" />
                      Ver Rastreamento
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Iniciar Entrega
              </DialogTitle>
              <DialogDescription>
                Selecione um motoboy disponível para entregar o pedido #{selectedPedido?.id.slice(0, 8)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {selectedPedido?.enderecoEntrega && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Endereço de Entrega</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedPedido.enderecoEntrega}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="motoboy">Motoboy</Label>
                <Select
                  value={selectedMotoboyId}
                  onValueChange={setSelectedMotoboyId}
                >
                  <SelectTrigger id="motoboy" data-testid="select-motoboy">
                    <SelectValue placeholder="Selecione um motoboy" />
                  </SelectTrigger>
                  <SelectContent>
                    {motoboys.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Nenhum motoboy disponível
                      </SelectItem>
                    ) : (
                      motoboys.map((motoboy) => (
                        <SelectItem key={motoboy.id} value={motoboy.id}>
                          {motoboy.nome} {motoboy.placa && `(${motoboy.placa})`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeliveryDialogOpen(false);
                  setSelectedMotoboyId("");
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (selectedPedido && selectedMotoboyId) {
                    iniciarEntregaMutation.mutate({
                      pedidoId: selectedPedido.id,
                      motoboyId: selectedMotoboyId,
                    });
                  }
                }}
                disabled={!selectedMotoboyId || iniciarEntregaMutation.isPending}
                data-testid="button-confirm-delivery"
              >
                {iniciarEntregaMutation.isPending ? "Iniciando..." : "Iniciar Entrega"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
