import { Link } from "wouter";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowRight, 
  ChefHat, 
  MapPin, 
  MessageSquareText, 
  Zap, 
  Shield, 
  BarChart3,
  Flame
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Logo size="md" />
          <Link href="/login">
            <Button data-testid="button-login-header">
              Acessar Sistema
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/10 pointer-events-none" />
        <div className="absolute -right-32 top-1/3 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-32 bottom-0 w-[400px] h-[400px] rounded-full bg-secondary/10 blur-3xl pointer-events-none" />
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-8">
              <Flame className="w-4 h-4" />
              Plataforma Multi-Tenancy
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
              Gestão de Franquias de{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-primary">
                Pizzaria 5.0
              </span>
              <br />
              <span className="text-3xl md:text-4xl lg:text-5xl font-semibold text-muted-foreground">
                Otimização Preditiva e IA
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              A plataforma Multi-Tenancy que transforma sua rede em uma 
              <span className="text-foreground font-medium"> operação de alta performance</span>. 
              Integração completa de KDS, Logística e Inteligência Artificial.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="text-lg px-8 h-14 shadow-lg shadow-primary/25" data-testid="button-cta-hero">
                  Acessar Sistema
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-lg px-8 h-14" data-testid="button-demo">
                Solicitar Demo
              </Button>
            </div>

            <div className="mt-16 flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <span>Dados Isolados por Franquia</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-secondary" />
                <span>Tempo Real</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-accent" />
                <span>Analytics Avançado</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Funcionalidades que{" "}
              <span className="text-primary">Transformam</span> sua Operação
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tecnologia de ponta para maximizar eficiência, reduzir custos e encantar clientes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50" data-testid="card-feature-kds">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/20 to-transparent rounded-bl-full" />
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <ChefHat className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">KDS Inteligente</h3>
                <p className="text-muted-foreground mb-4">
                  Sistema de Display para Cozinha com looping de produção, 
                  tempo dinâmico de preparo (DPT) e otimização de fila baseada em IA.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Controle de etapas de produção
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Alertas sonoros e visuais
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Machine Learning para tempos
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-2 hover:border-secondary/50" data-testid="card-feature-geo">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-secondary/20 to-transparent rounded-bl-full" />
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-secondary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <MapPin className="h-7 w-7 text-secondary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Logística Geo-IA</h3>
                <p className="text-muted-foreground mb-4">
                  Rastreamento em tempo real, ETA preditivo com tráfego, 
                  geofencing automático e alertas proativos ao cliente.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    Google Maps integrado
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    Seleção ótima de motoboy
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    WhatsApp automático
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-2 hover:border-accent/50" data-testid="card-feature-ai">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-accent/20 to-transparent rounded-bl-full" />
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-accent/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <MessageSquareText className="h-7 w-7 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold mb-3">Agente de Dados Conversacional</h3>
                <p className="text-muted-foreground mb-4">
                  Assistente de IA que responde perguntas sobre sua operação, 
                  executa ações e fornece insights em linguagem natural.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Consultas financeiras
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Gestão de estoque por voz
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Relatórios instantâneos
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-24 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">99.9%</div>
                <div className="text-sm text-muted-foreground">Uptime Garantido</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold text-secondary mb-2">-40%</div>
                <div className="text-sm text-muted-foreground">Tempo de Entrega</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">+25%</div>
                <div className="text-sm text-muted-foreground">Satisfação Cliente</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold text-secondary mb-2">24/7</div>
                <div className="text-sm text-muted-foreground">Monitoramento IA</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para Revolucionar sua Rede?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Junte-se às pizzarias que já operam com inteligência artificial e automação de ponta
          </p>
          <Link href="/login">
            <Button 
              size="lg" 
              variant="secondary" 
              className="text-lg px-8 h-14"
              data-testid="button-cta-footer"
            >
              Começar Agora
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-8 bg-muted/50 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Logo size="sm" />
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Degusta Pizzas. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
