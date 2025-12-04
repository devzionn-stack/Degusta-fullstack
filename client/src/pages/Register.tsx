import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Pizza, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Tenant {
  id: string;
  nome: string;
}

export default function Register() {
  const [, navigate] = useLocation();
  const { register } = useAuth();
  const { toast } = useToast();
  
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tenantId, setTenantId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["tenants"],
    queryFn: async () => {
      const res = await fetch("/api/tenants");
      if (!res.ok) throw new Error("Erro ao buscar franquias");
      return res.json();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Senhas não coincidem",
        description: "Verifique se as senhas são iguais",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 6 caracteres",
      });
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, nome, tenantId || undefined);
      toast({
        title: "Conta criada!",
        description: "Bem-vindo ao Bella Napoli!",
      });
      navigate("/dashboard");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao criar conta",
        description: error instanceof Error ? error.message : "Tente novamente",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute left-4 top-4"
            onClick={() => navigate("/login")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Pizza className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-serif">Criar Conta</CardTitle>
            <CardDescription className="text-base mt-2">
              Junte-se à família Bella Napoli
            </CardDescription>
          </div>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                type="text"
                placeholder="Seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                data-testid="input-nome"
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tenant">Franquia (opcional)</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger className="h-11" data-testid="select-tenant">
                  <SelectValue placeholder="Selecione uma franquia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma franquia</SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repita sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                data-testid="input-confirm-password"
                className="h-11"
              />
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full h-11 text-base"
              disabled={isLoading}
              data-testid="button-register"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                "Criar conta"
              )}
            </Button>
            
            <p className="text-center text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto text-primary"
                onClick={() => navigate("/login")}
                data-testid="link-login"
              >
                Faça login
              </Button>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
