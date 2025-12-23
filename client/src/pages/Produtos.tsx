import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant-context";
import { buildApiUrl } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Plus, Search, Package, Clock, DollarSign, Loader2, Pencil, Trash2, Image } from "lucide-react";

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco: string;
  categoria: string | null;
  imagem: string | null;
  tempoPreparoEstimado: number | null;
  createdAt: string;
}

const CATEGORIAS = [
  "Pizzas Tradicionais",
  "Pizzas Premium",
  "Pizzas Doces",
  "Bebidas",
  "Sobremesas",
  "Combos",
  "Outros",
];

export default function Produtos() {
  const { isSuperAdmin } = useAuth();
  const { selectedTenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    preco: "",
    categoria: "",
    imagem: "",
    tempoPreparoEstimado: "15",
  });

  const effectiveTenantId = isSuperAdmin ? selectedTenantId : null;

  const { data: produtos = [], isLoading } = useQuery<Produto[]>({
    queryKey: ["produtos", effectiveTenantId],
    queryFn: async () => {
      const url = buildApiUrl("/api/produtos", effectiveTenantId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) return [];
        throw new Error("Failed to fetch products");
      }
      return res.json();
    },
    enabled: isSuperAdmin ? !!selectedTenantId : true,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = buildApiUrl("/api/produtos", effectiveTenantId);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          preco: parseFloat(data.preco),
          tempoPreparoEstimado: parseInt(data.tempoPreparoEstimado),
        }),
      });
      if (!res.ok) throw new Error("Failed to create product");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast({ title: "Produto criado com sucesso!" });
      resetForm();
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao criar produto" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const url = buildApiUrl(`/api/produtos/${id}`, effectiveTenantId);
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          preco: parseFloat(data.preco),
          tempoPreparoEstimado: parseInt(data.tempoPreparoEstimado),
        }),
      });
      if (!res.ok) throw new Error("Failed to update product");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast({ title: "Produto atualizado com sucesso!" });
      resetForm();
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao atualizar produto" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const url = buildApiUrl(`/api/produtos/${id}`, effectiveTenantId);
      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete product");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast({ title: "Produto removido com sucesso!" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao remover produto" });
    },
  });

  const resetForm = () => {
    setFormData({
      nome: "",
      descricao: "",
      preco: "",
      categoria: "",
      imagem: "",
      tempoPreparoEstimado: "15",
    });
    setEditingProduto(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduto) {
      updateMutation.mutate({ id: editingProduto.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (produto: Produto) => {
    setEditingProduto(produto);
    setFormData({
      nome: produto.nome,
      descricao: produto.descricao || "",
      preco: produto.preco,
      categoria: produto.categoria || "",
      imagem: produto.imagem || "",
      tempoPreparoEstimado: (produto.tempoPreparoEstimado || 15).toString(),
    });
    setIsDialogOpen(true);
  };

  const filteredProdutos = produtos.filter((produto) => {
    const matchesSearch = produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      produto.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || produto.categoria === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(produtos.map((p) => p.categoria).filter(Boolean))] as string[];

  if (isSuperAdmin && !selectedTenantId) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Selecione uma Franquia</h3>
              <p className="text-muted-foreground">
                Use o seletor no topo da página para escolher qual franquia visualizar.
              </p>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Produtos</h1>
            <p className="text-muted-foreground">Gerencie o cardápio da pizzaria</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-product">
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingProduto ? "Editar Produto" : "Novo Produto"}</DialogTitle>
                <DialogDescription>
                  {editingProduto ? "Atualize as informações do produto" : "Adicione um novo item ao cardápio"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: Pizza Margherita"
                      required
                      data-testid="input-product-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição</Label>
                    <Textarea
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder="Molho de tomate, mussarela, manjericão..."
                      rows={3}
                      data-testid="input-product-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="preco">Preço (R$) *</Label>
                      <Input
                        id="preco"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.preco}
                        onChange={(e) => setFormData({ ...formData, preco: e.target.value })}
                        placeholder="45.90"
                        required
                        data-testid="input-product-price"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tempo">Tempo Preparo (min)</Label>
                      <Input
                        id="tempo"
                        type="number"
                        min="1"
                        value={formData.tempoPreparoEstimado}
                        onChange={(e) => setFormData({ ...formData, tempoPreparoEstimado: e.target.value })}
                        placeholder="15"
                        data-testid="input-product-time"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoria</Label>
                    <Select
                      value={formData.categoria}
                      onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                    >
                      <SelectTrigger data-testid="select-product-category">
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="imagem">URL da Imagem</Label>
                    <Input
                      id="imagem"
                      type="url"
                      value={formData.imagem}
                      onChange={(e) => setFormData({ ...formData, imagem: e.target.value })}
                      placeholder="https://exemplo.com/imagem.jpg"
                      data-testid="input-product-image"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-product"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingProduto ? "Salvar" : "Criar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-products"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter-category">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary">
                {filteredProdutos.length} produtos
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProdutos.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum produto encontrado</h3>
                <p className="text-muted-foreground">
                  {searchTerm || categoryFilter !== "all" ? "Tente uma busca diferente" : "Adicione seu primeiro produto"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProdutos.map((produto) => (
                  <Card key={produto.id} className="overflow-hidden group" data-testid={`card-product-${produto.id}`}>
                    <div className="aspect-video bg-muted relative">
                      {produto.imagem ? (
                        <img 
                          src={produto.imagem} 
                          alt={produto.nome}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Image className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8"
                          onClick={() => handleEdit(produto)}
                          data-testid={`button-edit-product-${produto.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-8 w-8"
                          onClick={() => deleteMutation.mutate(produto.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-product-${produto.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold truncate">{produto.nome}</h3>
                        <Badge variant="outline" className="shrink-0">
                          {produto.categoria || "Sem categoria"}
                        </Badge>
                      </div>
                      {produto.descricao && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {produto.descricao}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-lg font-bold text-primary">
                          <DollarSign className="h-4 w-4" />
                          {parseFloat(produto.preco).toFixed(2)}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {produto.tempoPreparoEstimado || 15} min
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
