import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Building2, Users, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

interface Tenant {
  id: string;
  nome: string;
  status: string;
  n8nWebhookUrl?: string;
  apiKeyN8n?: string;
  createdAt: string;
}

export default function SuperAdminFranquias() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    adminEmail: "",
    adminPassword: "",
    adminNome: "",
    status: "active",
    n8nWebhookUrl: "",
    apiKeyN8n: "",
  });

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["superadmin", "tenants"],
    queryFn: async () => {
      const res = await fetch("/api/superadmin/tenants", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar franquias");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao criar franquia");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "tenants"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "Franquia criada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const res = await fetch(`/api/superadmin/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao atualizar franquia");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "tenants"] });
      setEditingTenant(null);
      resetForm();
      toast({ title: "Franquia atualizada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/superadmin/tenants/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao excluir franquia");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "tenants"] });
      toast({ title: "Franquia excluída com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      nome: "",
      adminEmail: "",
      adminPassword: "",
      adminNome: "",
      status: "active",
      n8nWebhookUrl: "",
      apiKeyN8n: "",
    });
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!editingTenant) return;
    updateMutation.mutate({
      id: editingTenant.id,
      data: {
        nome: formData.nome,
        status: formData.status,
        n8nWebhookUrl: formData.n8nWebhookUrl,
        apiKeyN8n: formData.apiKeyN8n,
      },
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta franquia? Esta ação não pode ser desfeita.")) {
      deleteMutation.mutate(id);
    }
  };

  const openEditDialog = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormData({
      nome: tenant.nome,
      adminEmail: "",
      adminPassword: "",
      adminNome: "",
      status: tenant.status,
      n8nWebhookUrl: tenant.n8nWebhookUrl || "",
      apiKeyN8n: tenant.apiKeyN8n || "",
    });
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
            <Building2 className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Administração de Franquias</h1>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Franquias Cadastradas
            </CardTitle>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-franchise">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Franquia
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Criar Nova Franquia</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="nome">Nome da Franquia</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: Bella Napoli Centro"
                      data-testid="input-franchise-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="adminNome">Nome do Administrador</Label>
                    <Input
                      id="adminNome"
                      value={formData.adminNome}
                      onChange={(e) => setFormData({ ...formData, adminNome: e.target.value })}
                      placeholder="Nome completo"
                      data-testid="input-admin-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="adminEmail">Email do Administrador</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      value={formData.adminEmail}
                      onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                      placeholder="admin@franquia.com"
                      data-testid="input-admin-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="adminPassword">Senha do Administrador</Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      value={formData.adminPassword}
                      onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                      placeholder="Senha forte"
                      data-testid="input-admin-password"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                    data-testid="button-submit-franchise"
                  >
                    {createMutation.isPending ? "Criando..." : "Criar Franquia"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Webhook N8N</TableHead>
                    <TableHead>Data Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id} data-testid={`row-tenant-${tenant.id}`}>
                      <TableCell className="font-medium">{tenant.nome}</TableCell>
                      <TableCell>
                        <Badge
                          variant={tenant.status === "active" ? "default" : "secondary"}
                          data-testid={`badge-status-${tenant.id}`}
                        >
                          {tenant.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tenant.n8nWebhookUrl ? (
                          <Badge variant="outline">Configurado</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(tenant.createdAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Dialog
                            open={editingTenant?.id === tenant.id}
                            onOpenChange={(open) => !open && setEditingTenant(null)}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(tenant)}
                                data-testid={`button-edit-${tenant.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Editar Franquia</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div>
                                  <Label htmlFor="edit-nome">Nome da Franquia</Label>
                                  <Input
                                    id="edit-nome"
                                    value={formData.nome}
                                    onChange={(e) =>
                                      setFormData({ ...formData, nome: e.target.value })
                                    }
                                    data-testid="input-edit-name"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="edit-status">Status</Label>
                                  <Select
                                    value={formData.status}
                                    onValueChange={(value) =>
                                      setFormData({ ...formData, status: value })
                                    }
                                  >
                                    <SelectTrigger data-testid="select-edit-status">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="active">Ativo</SelectItem>
                                      <SelectItem value="inactive">Inativo</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="edit-webhook">Webhook N8N</Label>
                                  <Input
                                    id="edit-webhook"
                                    value={formData.n8nWebhookUrl}
                                    onChange={(e) =>
                                      setFormData({ ...formData, n8nWebhookUrl: e.target.value })
                                    }
                                    placeholder="https://n8n.example.com/webhook/..."
                                    data-testid="input-edit-webhook"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="edit-apikey">API Key N8N</Label>
                                  <Input
                                    id="edit-apikey"
                                    value={formData.apiKeyN8n}
                                    onChange={(e) =>
                                      setFormData({ ...formData, apiKeyN8n: e.target.value })
                                    }
                                    placeholder="Chave de API"
                                    data-testid="input-edit-apikey"
                                  />
                                </div>
                                <Button
                                  className="w-full"
                                  onClick={handleUpdate}
                                  disabled={updateMutation.isPending}
                                  data-testid="button-update-franchise"
                                >
                                  {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(tenant.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${tenant.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {tenants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhuma franquia cadastrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
