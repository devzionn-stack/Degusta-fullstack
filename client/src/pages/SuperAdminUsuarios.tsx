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
import { Pencil, Trash2, Users, ArrowLeft, Filter } from "lucide-react";
import { Link } from "wouter";

interface User {
  id: string;
  nome: string;
  email: string;
  role: string;
  tenantId: string | null;
  createdAt: string;
}

interface Tenant {
  id: string;
  nome: string;
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  tenant_admin: "Admin Franquia",
  operator: "Operador",
  motoboy: "Motoboy",
};

export default function SuperAdminUsuarios() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    role: "",
    tenantId: "",
  });

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["superadmin", "tenants"],
    queryFn: async () => {
      const res = await fetch("/api/superadmin/tenants", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar franquias");
      return res.json();
    },
  });

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: [
      "/api/superadmin/users/filtered",
      filterTenant !== "all" ? `tenantId=${filterTenant}` : "",
      filterRole !== "all" ? `role=${filterRole}` : "",
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterTenant !== "all") params.append("tenantId", filterTenant);
      if (filterRole !== "all") params.append("role", filterRole);
      const res = await fetch(`/api/superadmin/users/filtered?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar usuários");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await fetch(`/api/superadmin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao atualizar usuário");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/users/filtered"] });
      setEditingUser(null);
      toast({ title: "Usuário atualizado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/superadmin/users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao excluir usuário");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/users/filtered"] });
      toast({ title: "Usuário excluído com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleUpdate = () => {
    if (!editingUser) return;
    updateMutation.mutate({
      id: editingUser.id,
      data: {
        nome: formData.nome,
        email: formData.email,
        role: formData.role,
        tenantId: formData.tenantId || "",
      },
    });
  };

  const handleDelete = (user: User) => {
    if (confirm(`Tem certeza que deseja excluir o usuário ${user.nome}?`)) {
      deleteMutation.mutate(user.id);
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      nome: user.nome,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId || "",
    });
  };

  const getTenantName = (tenantId: string | null) => {
    if (!tenantId) return "-";
    const tenant = tenants.find((t) => t.id === tenantId);
    return tenant?.nome || tenantId;
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
            <Users className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Administração de Usuários</h1>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Franquia</Label>
                <Select value={filterTenant} onValueChange={setFilterTenant}>
                  <SelectTrigger data-testid="select-filter-tenant">
                    <SelectValue placeholder="Todas as franquias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as franquias</SelectItem>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cargo</Label>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger data-testid="select-filter-role">
                    <SelectValue placeholder="Todos os cargos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os cargos</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="tenant_admin">Admin Franquia</SelectItem>
                    <SelectItem value="operator">Operador</SelectItem>
                    <SelectItem value="motoboy">Motoboy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Franquia</TableHead>
                    <TableHead>Data Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium">{user.nome}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={user.role === "super_admin" ? "default" : "secondary"}
                          data-testid={`badge-role-${user.id}`}
                        >
                          {roleLabels[user.role] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{getTenantName(user.tenantId)}</TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Dialog
                            open={editingUser?.id === user.id}
                            onOpenChange={(open) => !open && setEditingUser(null)}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(user)}
                                data-testid={`button-edit-${user.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Editar Usuário</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div>
                                  <Label htmlFor="edit-nome">Nome</Label>
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
                                  <Label htmlFor="edit-email">Email</Label>
                                  <Input
                                    id="edit-email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) =>
                                      setFormData({ ...formData, email: e.target.value })
                                    }
                                    data-testid="input-edit-email"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="edit-role">Cargo</Label>
                                  <Select
                                    value={formData.role}
                                    onValueChange={(value) =>
                                      setFormData({ ...formData, role: value })
                                    }
                                  >
                                    <SelectTrigger data-testid="select-edit-role">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="super_admin">Super Admin</SelectItem>
                                      <SelectItem value="tenant_admin">Admin Franquia</SelectItem>
                                      <SelectItem value="operator">Operador</SelectItem>
                                      <SelectItem value="motoboy">Motoboy</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="edit-tenant">Franquia</Label>
                                  <Select
                                    value={formData.tenantId || "none"}
                                    onValueChange={(value) =>
                                      setFormData({
                                        ...formData,
                                        tenantId: value === "none" ? "" : value,
                                      })
                                    }
                                  >
                                    <SelectTrigger data-testid="select-edit-tenant">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Nenhuma</SelectItem>
                                      {tenants.map((tenant) => (
                                        <SelectItem key={tenant.id} value={tenant.id}>
                                          {tenant.nome}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Button
                                  className="w-full"
                                  onClick={handleUpdate}
                                  disabled={updateMutation.isPending}
                                  data-testid="button-update-user"
                                >
                                  {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(user)}
                            disabled={deleteMutation.isPending || user.role === "super_admin"}
                            data-testid={`button-delete-${user.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum usuário encontrado
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
