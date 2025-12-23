import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Pizza, Loader2, ArrowLeft, Store, User, Mail, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const [, navigate] = useLocation();
  const { register } = useAuth();
  const { toast } = useToast();
  
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [nomeFranquia, setNomeFranquia] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

    if (nomeFranquia.length < 2) {
      toast({
        variant: "destructive",
        title: "Nome da franquia inválido",
        description: "O nome da franquia deve ter pelo menos 2 caracteres",
      });
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, nome, nomeFranquia);
      toast({
        title: "Franquia criada com sucesso!",
        description: "Bem-vindo à Degusta Pizzas!",
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
      <Card className="w-full max-w-md shadow-xl relative">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute left-4 top-4 z-10"
          onClick={() => navigate("/login")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        
        <CardHeader className="text-center space-y-4 pt-12">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Pizza className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Cadastrar</span>{" "}
              <span>Franquia</span>
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Crie sua conta e comece a gerenciar sua pizzaria
            </CardDescription>
          </div>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nomeFranquia" className="flex items-center gap-2">
                <Store className="w-4 h-4 text-muted-foreground" />
                Nome da Franquia
              </Label>
              <Input
                id="nomeFranquia"
                type="text"
                placeholder="Ex: Degusta Pizzas - Centro"
                value={nomeFranquia}
                onChange={(e) => setNomeFranquia(e.target.value)}
                required
                data-testid="input-nome-franquia"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Este será o nome da sua unidade no sistema
              </p>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">Dados do Administrador</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="nome" className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                Seu Nome Completo
              </Label>
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
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                Email
              </Label>
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
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                Senha
              </Label>
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
              <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                Confirmar Senha
              </Label>
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
                  Criando franquia...
                </>
              ) : (
                "Criar Minha Franquia"
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
