import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Key, Webhook, Copy, RefreshCw, CheckCircle } from "lucide-react";

export default function Configuracoes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: tenant } = useQuery({
    queryKey: ["tenant", "me"],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/me`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.tenantId,
  });

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copiado!",
      description: "API Key copiada para a área de transferência",
    });
    setTimeout(() => setCopied(false), 2000);
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
      </div>
    </DashboardLayout>
  );
}
