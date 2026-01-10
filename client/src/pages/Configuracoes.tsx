import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Key, Webhook, Copy, RefreshCw, CheckCircle, Building2, MapPin, FileText, Shield, Upload, Save, Zap, Plus, Pencil, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const ESTADOS_BR = [
  { uf: "AC", nome: "Acre" },
  { uf: "AL", nome: "Alagoas" },
  { uf: "AP", nome: "Amapá" },
  { uf: "AM", nome: "Amazonas" },
  { uf: "BA", nome: "Bahia" },
  { uf: "CE", nome: "Ceará" },
  { uf: "DF", nome: "Distrito Federal" },
  { uf: "ES", nome: "Espírito Santo" },
  { uf: "GO", nome: "Goiás" },
  { uf: "MA", nome: "Maranhão" },
  { uf: "MT", nome: "Mato Grosso" },
  { uf: "MS", nome: "Mato Grosso do Sul" },
  { uf: "MG", nome: "Minas Gerais" },
  { uf: "PA", nome: "Pará" },
  { uf: "PB", nome: "Paraíba" },
  { uf: "PR", nome: "Paraná" },
  { uf: "PE", nome: "Pernambuco" },
  { uf: "PI", nome: "Piauí" },
  { uf: "RJ", nome: "Rio de Janeiro" },
  { uf: "RN", nome: "Rio Grande do Norte" },
  { uf: "RS", nome: "Rio Grande do Sul" },
  { uf: "RO", nome: "Rondônia" },
  { uf: "RR", nome: "Roraima" },
  { uf: "SC", nome: "Santa Catarina" },
  { uf: "SP", nome: "São Paulo" },
  { uf: "SE", nome: "Sergipe" },
  { uf: "TO", nome: "Tocantins" },
];

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
}

interface ConfiguracaoFiscal {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  codigoMunicipio: string;
  regimeTributario: string;
  ambienteSefaz: string;
  serieNfe: string;
  serieNfce: string;
  cscNfce: string;
  idTokenNfce: string;
  ativo: boolean;
  certificadoNome: string;
  senhaCertificado: string;
}

const defaultConfigFiscal: ConfiguracaoFiscal = {
  cnpj: "",
  razaoSocial: "",
  nomeFantasia: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  cep: "",
  logradouro: "",
  numero: "",
  bairro: "",
  municipio: "",
  uf: "",
  codigoMunicipio: "",
  regimeTributario: "",
  ambienteSefaz: "homologacao",
  serieNfe: "1",
  serieNfce: "1",
  cscNfce: "",
  idTokenNfce: "",
  ativo: false,
  certificadoNome: "",
  senhaCertificado: "",
};

interface RegraAutomacao {
  id: string;
  tenantId: string;
  nome: string;
  tipo: string;
  condicao?: {
    campo?: string;
    operador?: string;
    valor?: string | number;
    threshold_percentual?: number;
    dias_inativo?: number;
    habilitado?: boolean;
  };
  acao?: {
    tipo: string;
    parametros?: {
      enviar_alerta?: boolean;
      notificar_whatsapp?: boolean;
      criar_tarefa?: boolean;
    };
  };
  ativo: boolean;
  prioridade: number;
  createdAt: string;
}

interface RegraFormData {
  nome: string;
  tipo: string;
  descricao: string;
  condicao: {
    threshold_percentual?: number;
    dias_inativo?: number;
    habilitado?: boolean;
  };
  acao: {
    enviar_alerta: boolean;
    notificar_whatsapp: boolean;
    criar_tarefa: boolean;
  };
  prioridade: number;
  ativo: boolean;
}

const defaultRegraForm: RegraFormData = {
  nome: "",
  tipo: "",
  descricao: "",
  condicao: {
    threshold_percentual: 20,
    dias_inativo: 7,
    habilitado: true,
  },
  acao: {
    enviar_alerta: true,
    notificar_whatsapp: false,
    criar_tarefa: false,
  },
  prioridade: 5,
  ativo: true,
};

const TIPOS_REGRA = [
  { value: "ESTOQUE_BAIXO", label: "Estoque Baixo", categoria: "estoque" },
  { value: "CRM_FOLLOW_UP", label: "Follow-up CRM", categoria: "crm" },
  { value: "AUTO_DISPATCH", label: "Despacho Automático", categoria: "despacho" },
  { value: "PROMO_ANIVERSARIO", label: "Promoção Aniversário", categoria: "crm" },
];

function getTipoCategoria(tipo: string): string {
  const found = TIPOS_REGRA.find(t => t.value === tipo);
  return found?.categoria || "outro";
}

function getTipoLabel(tipo: string): string {
  const found = TIPOS_REGRA.find(t => t.value === tipo);
  return found?.label || tipo;
}

function getCategoriaBadgeColor(categoria: string): string {
  switch (categoria) {
    case "estoque": return "bg-orange-100 text-orange-800";
    case "crm": return "bg-blue-100 text-blue-800";
    case "despacho": return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

export default function Configuracoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [configFiscal, setConfigFiscal] = useState<ConfiguracaoFiscal>(defaultConfigFiscal);
  const [certificadoFile, setCertificadoFile] = useState<File | null>(null);
  const [cnpjError, setCnpjError] = useState("");
  
  const [regraDialogOpen, setRegraDialogOpen] = useState(false);
  const [editingRegra, setEditingRegra] = useState<RegraAutomacao | null>(null);
  const [regraForm, setRegraForm] = useState<RegraFormData>(defaultRegraForm);

  const { data: tenant } = useQuery({
    queryKey: ["tenant", "me"],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/me`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.tenantId,
  });

  const { data: configFiscalData, isLoading: isLoadingFiscal } = useQuery({
    queryKey: ["configuracao-fiscal"],
    queryFn: async () => {
      const res = await fetch("/api/configuracao-fiscal", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Falha ao carregar configuração fiscal");
      }
      return res.json();
    },
    enabled: !!user?.tenantId,
  });

  const { data: regrasAutomacao = [], isLoading: isLoadingRegras } = useQuery<RegraAutomacao[]>({
    queryKey: ["regras-automacao"],
    queryFn: async () => {
      const res = await fetch("/api/regras-automacao", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar regras de automação");
      return res.json();
    },
    enabled: !!user?.tenantId,
  });

  useEffect(() => {
    if (configFiscalData) {
      setConfigFiscal({ ...defaultConfigFiscal, ...configFiscalData });
    }
  }, [configFiscalData]);

  const generateKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/n8n/generate-api-key", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao gerar API Key");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
      toast({
        title: "API Key Gerada",
        description: "Nova chave gerada com sucesso. Guarde-a em local seguro.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível gerar a API Key",
        variant: "destructive",
      });
    },
  });

  const saveConfigFiscalMutation = useMutation({
    mutationFn: async (data: ConfiguracaoFiscal) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (key !== "certificadoNome") {
          formData.append(key, String(value));
        }
      });
      if (certificadoFile) {
        formData.append("certificado", certificadoFile);
      }
      
      const res = await fetch("/api/configuracao-fiscal", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Falha ao salvar configuração fiscal");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracao-fiscal"] });
      toast({
        title: "Sucesso",
        description: "Configuração fiscal salva com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar a configuração fiscal",
        variant: "destructive",
      });
    },
  });

  const createRegraMutation = useMutation({
    mutationFn: async (data: RegraFormData) => {
      const payload = {
        nome: data.nome,
        tipo: data.tipo,
        condicao: data.condicao,
        acao: {
          tipo: data.tipo,
          parametros: data.acao,
        },
        prioridade: data.prioridade,
        ativo: data.ativo,
      };
      const res = await fetch("/api/regras-automacao", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Falha ao criar regra");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras-automacao"] });
      setRegraDialogOpen(false);
      setRegraForm(defaultRegraForm);
      toast({
        title: "Sucesso",
        description: "Regra de automação criada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a regra",
        variant: "destructive",
      });
    },
  });

  const updateRegraMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RegraFormData }) => {
      const payload = {
        nome: data.nome,
        tipo: data.tipo,
        condicao: data.condicao,
        acao: {
          tipo: data.tipo,
          parametros: data.acao,
        },
        prioridade: data.prioridade,
        ativo: data.ativo,
      };
      const res = await fetch(`/api/regras-automacao/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Falha ao atualizar regra");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras-automacao"] });
      setRegraDialogOpen(false);
      setEditingRegra(null);
      setRegraForm(defaultRegraForm);
      toast({
        title: "Sucesso",
        description: "Regra de automação atualizada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar a regra",
        variant: "destructive",
      });
    },
  });

  const deleteRegraMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/regras-automacao/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao excluir regra");
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras-automacao"] });
      toast({
        title: "Sucesso",
        description: "Regra de automação excluída com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a regra",
        variant: "destructive",
      });
    },
  });

  const toggleRegraAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const res = await fetch(`/api/regras-automacao/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras-automacao"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status da regra",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copiado!",
      description: "API Key copiada para a área de transferência",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCNPJChange = (value: string) => {
    const formatted = formatCNPJ(value);
    setConfigFiscal(prev => ({ ...prev, cnpj: formatted }));
    if (formatted.replace(/\D/g, "").length === 14) {
      if (!validateCNPJ(formatted)) {
        setCnpjError("CNPJ inválido");
      } else {
        setCnpjError("");
      }
    } else {
      setCnpjError("");
    }
  };

  const handleCEPChange = (value: string) => {
    const formatted = formatCEP(value);
    setConfigFiscal(prev => ({ ...prev, cep: formatted }));
  };

  const handleCertificadoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".pfx")) {
        toast({
          title: "Arquivo inválido",
          description: "Por favor, selecione um arquivo .pfx",
          variant: "destructive",
        });
        return;
      }
      setCertificadoFile(file);
      setConfigFiscal(prev => ({ ...prev, certificadoNome: file.name }));
    }
  };

  const handleSaveConfigFiscal = () => {
    if (configFiscal.cnpj && !validateCNPJ(configFiscal.cnpj)) {
      toast({
        title: "Erro de validação",
        description: "CNPJ inválido. Verifique o número informado.",
        variant: "destructive",
      });
      return;
    }
    saveConfigFiscalMutation.mutate(configFiscal);
  };

  const handleOpenRegraDialog = (regra?: RegraAutomacao) => {
    if (regra) {
      setEditingRegra(regra);
      setRegraForm({
        nome: regra.nome,
        tipo: regra.tipo,
        descricao: "",
        condicao: {
          threshold_percentual: regra.condicao?.threshold_percentual ?? 20,
          dias_inativo: regra.condicao?.dias_inativo ?? 7,
          habilitado: regra.condicao?.habilitado ?? true,
        },
        acao: {
          enviar_alerta: regra.acao?.parametros?.enviar_alerta ?? true,
          notificar_whatsapp: regra.acao?.parametros?.notificar_whatsapp ?? false,
          criar_tarefa: regra.acao?.parametros?.criar_tarefa ?? false,
        },
        prioridade: regra.prioridade ?? 5,
        ativo: regra.ativo,
      });
    } else {
      setEditingRegra(null);
      setRegraForm(defaultRegraForm);
    }
    setRegraDialogOpen(true);
  };

  const handleSaveRegra = () => {
    if (!regraForm.nome.trim()) {
      toast({
        title: "Erro de validação",
        description: "Nome da regra é obrigatório",
        variant: "destructive",
      });
      return;
    }
    if (!regraForm.tipo) {
      toast({
        title: "Erro de validação",
        description: "Tipo da regra é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (editingRegra) {
      updateRegraMutation.mutate({ id: editingRegra.id, data: regraForm });
    } else {
      createRegraMutation.mutate(regraForm);
    }
  };

  const webhookUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/api/webhook/n8n/pedido`
    : "/api/webhook/n8n/pedido";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-bold flex items-center gap-3" data-testid="text-title">
            <Settings className="h-8 w-8 text-primary" />
            Configurações
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as configurações da sua pizzaria
          </p>
        </div>

        <Tabs defaultValue="n8n" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="n8n" data-testid="tab-n8n">
              <Webhook className="h-4 w-4 mr-2" />
              Integração N8N
            </TabsTrigger>
            <TabsTrigger value="fiscal" data-testid="tab-fiscal">
              <FileText className="h-4 w-4 mr-2" />
              Integração Fiscal
            </TabsTrigger>
            <TabsTrigger value="automacoes" data-testid="tab-automacoes">
              <Zap className="h-4 w-4 mr-2" />
              Automações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="n8n" className="mt-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Integração N8N
                  </CardTitle>
                  <CardDescription>
                    Configure a integração com o N8N para automação de pedidos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        value={tenant?.apiKeyN8n || "Nenhuma API Key configurada"}
                        readOnly
                        className="font-mono"
                        data-testid="input-api-key"
                      />
                      {tenant?.apiKeyN8n && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(tenant.apiKeyN8n)}
                          data-testid="button-copy-key"
                        >
                          {copied ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use esta chave no header X-API-Key das requisições do N8N
                    </p>
                  </div>

                  <Button
                    onClick={() => generateKeyMutation.mutate()}
                    disabled={generateKeyMutation.isPending}
                    data-testid="button-generate-key"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${generateKeyMutation.isPending ? 'animate-spin' : ''}`} />
                    {tenant?.apiKeyN8n ? "Gerar Nova API Key" : "Gerar API Key"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-5 w-5" />
                    Webhook URL
                  </CardTitle>
                  <CardDescription>
                    Use esta URL no N8N para enviar pedidos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>URL do Webhook de Pedidos</Label>
                    <div className="flex gap-2">
                      <Input
                        value={webhookUrl}
                        readOnly
                        className="font-mono text-sm"
                        data-testid="input-webhook-url"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(webhookUrl);
                          toast({
                            title: "Copiado!",
                            description: "URL copiada para a área de transferência",
                          });
                        }}
                        data-testid="button-copy-webhook"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Como configurar no N8N:</h4>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Crie um novo workflow no N8N</li>
                      <li>Adicione um nó HTTP Request</li>
                      <li>Configure o método como POST</li>
                      <li>Cole a URL do webhook acima</li>
                      <li>Adicione o header: X-API-Key com sua API Key</li>
                      <li>Configure o body com os dados do pedido</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Informações da Franquia</CardTitle>
                  <CardDescription>
                    Dados da sua franquia no sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-muted-foreground">Nome da Franquia</span>
                      <span className="font-medium">{tenant?.nome || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-muted-foreground">Status</span>
                      <span className={`font-medium ${tenant?.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                        {tenant?.status === 'active' ? 'Ativa' : tenant?.status || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-muted-foreground">ID do Tenant</span>
                      <span className="font-mono text-sm">{user?.tenantId || "—"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="fiscal" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Configuração SEFAZ
                </CardTitle>
                <CardDescription>
                  Configure os dados fiscais para emissão de NFe/NFCe
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingFiscal ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Accordion type="multiple" defaultValue={["empresa", "endereco", "fiscal", "certificado"]} className="w-full">
                    <AccordionItem value="empresa">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Dados da Empresa
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="cnpj">CNPJ *</Label>
                              <Input
                                id="cnpj"
                                value={configFiscal.cnpj}
                                onChange={(e) => handleCNPJChange(e.target.value)}
                                placeholder="00.000.000/0000-00"
                                className={cnpjError ? "border-red-500" : ""}
                                data-testid="input-cnpj"
                              />
                              {cnpjError && (
                                <p className="text-xs text-red-500">{cnpjError}</p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="razaoSocial">Razão Social *</Label>
                              <Input
                                id="razaoSocial"
                                value={configFiscal.razaoSocial}
                                onChange={(e) => setConfigFiscal(prev => ({ ...prev, razaoSocial: e.target.value }))}
                                placeholder="Razão Social da Empresa"
                                data-testid="input-razao-social"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                              <Input
                                id="nomeFantasia"
                                value={configFiscal.nomeFantasia}
                                onChange={(e) => setConfigFiscal(prev => ({ ...prev, nomeFantasia: e.target.value }))}
                                placeholder="Nome Fantasia"
                                data-testid="input-nome-fantasia"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="inscricaoEstadual">Inscrição Estadual</Label>
                              <Input
                                id="inscricaoEstadual"
                                value={configFiscal.inscricaoEstadual}
                                onChange={(e) => setConfigFiscal(prev => ({ ...prev, inscricaoEstadual: e.target.value }))}
                                placeholder="Inscrição Estadual"
                                data-testid="input-ie"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="inscricaoMunicipal">Inscrição Municipal</Label>
                              <Input
                                id="inscricaoMunicipal"
                                value={configFiscal.inscricaoMunicipal}
                                onChange={(e) => setConfigFiscal(prev => ({ ...prev, inscricaoMunicipal: e.target.value }))}
                                placeholder="Inscrição Municipal"
                                data-testid="input-im"
                              />
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="endereco">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Endereço
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="cep">CEP</Label>
                              <Input
                                id="cep"
                                value={configFiscal.cep}
                                onChange={(e) => handleCEPChange(e.target.value)}
                                placeholder="00000-000"
                                data-testid="input-cep"
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor="logradouro">Logradouro</Label>
                              <Input
                                id="logradouro"
                                value={configFiscal.logradouro}
                                onChange={(e) => setConfigFiscal(prev => ({ ...prev, logradouro: e.target.value }))}
                                placeholder="Rua, Avenida, etc."
                                data-testid="input-logradouro"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="numero">Número</Label>
                              <Input
                                id="numero"
                                value={configFiscal.numero}
                                onChange={(e) => setConfigFiscal(prev => ({ ...prev, numero: e.target.value }))}
                                placeholder="Nº"
                                data-testid="input-numero"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="bairro">Bairro</Label>
                              <Input
                                id="bairro"
                                value={configFiscal.bairro}
                                onChange={(e) => setConfigFiscal(prev => ({ ...prev, bairro: e.target.value }))}
                                placeholder="Bairro"
                                data-testid="input-bairro"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="municipio">Município</Label>
                              <Input
                                id="municipio"
                                value={configFiscal.municipio}
                                onChange={(e) => setConfigFiscal(prev => ({ ...prev, municipio: e.target.value }))}
                                placeholder="Município"
                                data-testid="input-municipio"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="uf">UF</Label>
                              <Select
                                value={configFiscal.uf}
                                onValueChange={(value) => setConfigFiscal(prev => ({ ...prev, uf: value }))}
                              >
                                <SelectTrigger id="uf" data-testid="select-uf">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  {ESTADOS_BR.map(estado => (
                                    <SelectItem key={estado.uf} value={estado.uf}>
                                      {estado.uf} - {estado.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="codigoMunicipio">Código IBGE do Município</Label>
                            <Input
                              id="codigoMunicipio"
                              value={configFiscal.codigoMunicipio}
                              onChange={(e) => setConfigFiscal(prev => ({ ...prev, codigoMunicipio: e.target.value }))}
                              placeholder="Código IBGE"
                              data-testid="input-codigo-municipio"
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="fiscal">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Configurações Fiscais
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="regimeTributario">Regime Tributário</Label>
                              <Select
                                value={configFiscal.regimeTributario}
                                onValueChange={(value) => setConfigFiscal(prev => ({ ...prev, regimeTributario: value }))}
                              >
                                <SelectTrigger id="regimeTributario" data-testid="select-regime">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">Simples Nacional</SelectItem>
                                  <SelectItem value="2">Simples Nacional - Excesso</SelectItem>
                                  <SelectItem value="3">Regime Normal</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="ambienteSefaz">Ambiente SEFAZ</Label>
                              <Select
                                value={configFiscal.ambienteSefaz}
                                onValueChange={(value) => setConfigFiscal(prev => ({ ...prev, ambienteSefaz: value }))}
                              >
                                <SelectTrigger id="ambienteSefaz" data-testid="select-ambiente">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="homologacao">Homologação (Testes)</SelectItem>
                                  <SelectItem value="producao">Produção</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="serieNfe">Série NFe</Label>
                              <Input
                                id="serieNfe"
                                value={configFiscal.serieNfe}
                                onChange={(e) => setConfigFiscal(prev => ({ ...prev, serieNfe: e.target.value }))}
                                placeholder="1"
                                data-testid="input-serie-nfe"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="serieNfce">Série NFCe</Label>
                              <Input
                                id="serieNfce"
                                value={configFiscal.serieNfce}
                                onChange={(e) => setConfigFiscal(prev => ({ ...prev, serieNfce: e.target.value }))}
                                placeholder="1"
                                data-testid="input-serie-nfce"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="cscNfce">CSC NFCe</Label>
                              <Input
                                id="cscNfce"
                                type="password"
                                value={configFiscal.cscNfce}
                                onChange={(e) => setConfigFiscal(prev => ({ ...prev, cscNfce: e.target.value }))}
                                placeholder="Código de Segurança"
                                data-testid="input-csc"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="idTokenNfce">ID Token NFCe</Label>
                              <Input
                                id="idTokenNfce"
                                value={configFiscal.idTokenNfce}
                                onChange={(e) => setConfigFiscal(prev => ({ ...prev, idTokenNfce: e.target.value }))}
                                placeholder="ID do Token"
                                data-testid="input-id-token"
                              />
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="certificado">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Certificado Digital
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="certificado">Certificado A1 (.pfx)</Label>
                              <div className="flex gap-2">
                                <Input
                                  id="certificado"
                                  type="file"
                                  accept=".pfx"
                                  onChange={handleCertificadoChange}
                                  className="hidden"
                                  data-testid="input-certificado-file"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => document.getElementById('certificado')?.click()}
                                  className="w-full"
                                  data-testid="button-upload-certificado"
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  {configFiscal.certificadoNome || "Selecionar certificado"}
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="senhaCertificado">Senha do Certificado</Label>
                              <Input
                                id="senhaCertificado"
                                type="password"
                                value={configFiscal.senhaCertificado}
                                onChange={(e) => setConfigFiscal(prev => ({ ...prev, senhaCertificado: e.target.value }))}
                                placeholder="Senha do certificado"
                                data-testid="input-senha-certificado"
                              />
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="ativo"
                              checked={configFiscal.ativo}
                              onCheckedChange={(checked) => setConfigFiscal(prev => ({ ...prev, ativo: checked }))}
                              data-testid="switch-fiscal-ativo"
                            />
                            <Label htmlFor="ativo">Habilitar emissão fiscal</Label>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}

                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={handleSaveConfigFiscal}
                    disabled={saveConfigFiscalMutation.isPending}
                    data-testid="button-save-fiscal"
                  >
                    <Save className={`h-4 w-4 mr-2 ${saveConfigFiscalMutation.isPending ? 'animate-spin' : ''}`} />
                    Salvar Configurações Fiscais
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automacoes" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Regras de Automação
                    </CardTitle>
                    <CardDescription>
                      Configure regras automáticas para estoque, CRM e despacho
                    </CardDescription>
                  </div>
                  <Button onClick={() => handleOpenRegraDialog()} data-testid="button-nova-regra">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Regra
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingRegras ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : regrasAutomacao.length === 0 ? (
                  <div className="text-center py-12">
                    <Zap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium text-muted-foreground mb-2">
                      Nenhuma regra configurada
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Crie sua primeira regra de automação para otimizar suas operações
                    </p>
                    <Button onClick={() => handleOpenRegraDialog()} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Criar primeira regra
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {regrasAutomacao.map((regra) => {
                      const categoria = getTipoCategoria(regra.tipo);
                      return (
                        <div
                          key={regra.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                          data-testid={`regra-item-${regra.id}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-medium">{regra.nome}</h4>
                              <Badge className={getCategoriaBadgeColor(categoria)}>
                                {categoria}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {getTipoLabel(regra.tipo)} • Prioridade: {regra.prioridade}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={regra.ativo}
                                onCheckedChange={(checked) => 
                                  toggleRegraAtivoMutation.mutate({ id: regra.id, ativo: checked })
                                }
                                data-testid={`switch-ativo-${regra.id}`}
                              />
                              <Label className="text-sm text-muted-foreground">
                                {regra.ativo ? "Ativa" : "Inativa"}
                              </Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenRegraDialog(regra)}
                                data-testid={`button-edit-${regra.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    data-testid={`button-delete-${regra.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir Regra</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir a regra "{regra.nome}"? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteRegraMutation.mutate(regra.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={regraDialogOpen} onOpenChange={setRegraDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRegra ? "Editar Regra de Automação" : "Nova Regra de Automação"}
            </DialogTitle>
            <DialogDescription>
              Configure os parâmetros da regra de automação
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="regra-nome">Nome da Regra *</Label>
                <Input
                  id="regra-nome"
                  value={regraForm.nome}
                  onChange={(e) => setRegraForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Alerta de estoque baixo"
                  data-testid="input-regra-nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="regra-tipo">Tipo *</Label>
                <Select
                  value={regraForm.tipo}
                  onValueChange={(value) => setRegraForm(prev => ({ ...prev, tipo: value }))}
                >
                  <SelectTrigger id="regra-tipo" data-testid="select-regra-tipo">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_REGRA.map(tipo => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="regra-descricao">Descrição</Label>
              <Textarea
                id="regra-descricao"
                value={regraForm.descricao}
                onChange={(e) => setRegraForm(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descreva o objetivo desta regra..."
                rows={3}
                data-testid="textarea-regra-descricao"
              />
            </div>

            {regraForm.tipo && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h4 className="font-medium">Condições</h4>
                
                {regraForm.tipo === "ESTOQUE_BAIXO" && (
                  <div className="space-y-4">
                    <Label>Threshold Percentual: {regraForm.condicao.threshold_percentual}%</Label>
                    <Slider
                      value={[regraForm.condicao.threshold_percentual || 20]}
                      onValueChange={([value]) => 
                        setRegraForm(prev => ({ 
                          ...prev, 
                          condicao: { ...prev.condicao, threshold_percentual: value }
                        }))
                      }
                      max={100}
                      min={0}
                      step={5}
                      data-testid="slider-threshold"
                    />
                    <p className="text-xs text-muted-foreground">
                      Alerta quando o estoque estiver abaixo de {regraForm.condicao.threshold_percentual}% do nível mínimo
                    </p>
                  </div>
                )}

                {regraForm.tipo === "CRM_FOLLOW_UP" && (
                  <div className="space-y-2">
                    <Label htmlFor="dias-inativo">Dias de Inatividade</Label>
                    <Input
                      id="dias-inativo"
                      type="number"
                      min={1}
                      max={365}
                      value={regraForm.condicao.dias_inativo || 7}
                      onChange={(e) => 
                        setRegraForm(prev => ({ 
                          ...prev, 
                          condicao: { ...prev.condicao, dias_inativo: parseInt(e.target.value) || 7 }
                        }))
                      }
                      data-testid="input-dias-inativo"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ativar follow-up quando o cliente estiver inativo por {regraForm.condicao.dias_inativo} dias
                    </p>
                  </div>
                )}

                {regraForm.tipo === "AUTO_DISPATCH" && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="dispatch-habilitado"
                      checked={regraForm.condicao.habilitado ?? true}
                      onCheckedChange={(checked) => 
                        setRegraForm(prev => ({ 
                          ...prev, 
                          condicao: { ...prev.condicao, habilitado: checked }
                        }))
                      }
                      data-testid="switch-dispatch-habilitado"
                    />
                    <Label htmlFor="dispatch-habilitado">Habilitar despacho automático</Label>
                  </div>
                )}

                {regraForm.tipo === "PROMO_ANIVERSARIO" && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="promo-habilitado"
                      checked={regraForm.condicao.habilitado ?? true}
                      onCheckedChange={(checked) => 
                        setRegraForm(prev => ({ 
                          ...prev, 
                          condicao: { ...prev.condicao, habilitado: checked }
                        }))
                      }
                      data-testid="switch-promo-habilitado"
                    />
                    <Label htmlFor="promo-habilitado">Habilitar promoção de aniversário</Label>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h4 className="font-medium">Ações</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enviar-alerta"
                    checked={regraForm.acao.enviar_alerta}
                    onCheckedChange={(checked) => 
                      setRegraForm(prev => ({ 
                        ...prev, 
                        acao: { ...prev.acao, enviar_alerta: checked }
                      }))
                    }
                    data-testid="switch-enviar-alerta"
                  />
                  <Label htmlFor="enviar-alerta">Enviar Alerta</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="notificar-whatsapp"
                    checked={regraForm.acao.notificar_whatsapp}
                    onCheckedChange={(checked) => 
                      setRegraForm(prev => ({ 
                        ...prev, 
                        acao: { ...prev.acao, notificar_whatsapp: checked }
                      }))
                    }
                    data-testid="switch-notificar-whatsapp"
                  />
                  <Label htmlFor="notificar-whatsapp">Notificar WhatsApp</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="criar-tarefa"
                    checked={regraForm.acao.criar_tarefa}
                    onCheckedChange={(checked) => 
                      setRegraForm(prev => ({ 
                        ...prev, 
                        acao: { ...prev.acao, criar_tarefa: checked }
                      }))
                    }
                    data-testid="switch-criar-tarefa"
                  />
                  <Label htmlFor="criar-tarefa">Criar Tarefa</Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridade: {regraForm.prioridade}</Label>
                <Slider
                  value={[regraForm.prioridade]}
                  onValueChange={([value]) => setRegraForm(prev => ({ ...prev, prioridade: value }))}
                  max={10}
                  min={1}
                  step={1}
                  data-testid="slider-prioridade"
                />
                <p className="text-xs text-muted-foreground">
                  1 = menor prioridade, 10 = maior prioridade
                </p>
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="regra-ativo"
                  checked={regraForm.ativo}
                  onCheckedChange={(checked) => setRegraForm(prev => ({ ...prev, ativo: checked }))}
                  data-testid="switch-regra-ativo"
                />
                <Label htmlFor="regra-ativo">Regra ativa</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRegraDialogOpen(false);
                setEditingRegra(null);
                setRegraForm(defaultRegraForm);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveRegra}
              disabled={createRegraMutation.isPending || updateRegraMutation.isPending}
              data-testid="button-salvar-regra"
            >
              {(createRegraMutation.isPending || updateRegraMutation.isPending) && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingRegra ? "Atualizar Regra" : "Criar Regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
