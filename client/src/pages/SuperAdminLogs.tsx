import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, FileText, Bell, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";

interface LogN8n {
  id: string;
  tenantId: string;
  tipo: string;
  payload: unknown;
  status: string;
  createdAt: string;
}

interface AlertaFrota {
  id: string;
  tenantId: string;
  tipo: string;
  mensagem: string;
  severidade: string;
  lida: boolean;
  createdAt: string;
}

interface Tenant {
  id: string;
  nome: string;
}

interface LogsResponse {
  webhookLogs: LogN8n[];
  alertas: AlertaFrota[];
  pagination: {
    page: number;
    limit: number;
    totalWebhooks: number;
    totalAlertas: number;
    totalPages: number;
  };
}

const severidadeColors: Record<string, "default" | "secondary" | "destructive"> = {
  info: "default",
  warn: "secondary",
  critical: "destructive",
};

export default function SuperAdminLogs() {
  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["superadmin", "tenants"],
    queryFn: async () => {
      const res = await fetch("/api/superadmin/tenants", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar franquias");
      return res.json();
    },
  });

  const { data: logsData, isLoading } = useQuery<LogsResponse>({
    queryKey: ["/api/superadmin/logs", filterTenant, filterTipo, startDate, endDate, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterTenant !== "all") params.append("tenantId", filterTenant);
      if (filterTipo !== "all") params.append("tipo", filterTipo);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("page", page.toString());
      params.append("limit", "20");

      const res = await fetch(`/api/superadmin/logs?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar logs");
      return res.json();
    },
  });

  const getTenantName = (tenantId: string) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    return tenant?.nome || tenantId.slice(0, 8) + "...";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("pt-BR");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/superadmin">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Logs do Sistema</h1>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Franquia</Label>
                <Select value={filterTenant} onValueChange={(v) => { setFilterTenant(v); setPage(1); }}>
                  <SelectTrigger data-testid="select-filter-tenant">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); setPage(1); }}>
                  <SelectTrigger data-testid="select-filter-tipo">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="pedido">Pedido</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warn">Aviso</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  data-testid="input-end-date"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="webhooks">
              <TabsList className="mb-4">
                <TabsTrigger value="webhooks" data-testid="tab-webhooks">
                  <FileText className="w-4 h-4 mr-2" />
                  Logs Webhook ({logsData?.pagination.totalWebhooks || 0})
                </TabsTrigger>
                <TabsTrigger value="alertas" data-testid="tab-alertas">
                  <Bell className="w-4 h-4 mr-2" />
                  Alertas ({logsData?.pagination.totalAlertas || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="webhooks">
                {isLoading ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Franquia</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Payload</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logsData?.webhookLogs.map((log) => (
                          <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(log.createdAt)}
                            </TableCell>
                            <TableCell>{getTenantName(log.tenantId)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.tipo}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={log.status === "success" ? "default" : "destructive"}
                              >
                                {log.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {JSON.stringify(log.payload).slice(0, 50)}...
                              </code>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!logsData?.webhookLogs || logsData.webhookLogs.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              Nenhum log encontrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </>
                )}
              </TabsContent>

              <TabsContent value="alertas">
                {isLoading ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Franquia</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Severidade</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logsData?.alertas.map((alerta) => (
                        <TableRow key={alerta.id} data-testid={`row-alerta-${alerta.id}`}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(alerta.createdAt)}
                          </TableCell>
                          <TableCell>{getTenantName(alerta.tenantId)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{alerta.tipo}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={severidadeColors[alerta.severidade] || "default"}>
                              {alerta.severidade}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md truncate">{alerta.mensagem}</TableCell>
                          <TableCell>
                            {alerta.lida ? (
                              <Badge variant="secondary">Lido</Badge>
                            ) : (
                              <Badge variant="default">Não lido</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!logsData?.alertas || logsData.alertas.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Nenhum alerta encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>

            {logsData && logsData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page} de {logsData.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(logsData.pagination.totalPages, p + 1))}
                  disabled={page === logsData.pagination.totalPages}
                  data-testid="button-next-page"
                >
                  Próxima
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
