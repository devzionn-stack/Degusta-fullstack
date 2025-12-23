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
  Flame,
  Target,
  TrendingUp,
  Building2,
  Code2,
  Megaphone
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Logo size="md" />
          <div className="flex items-center gap-4">
            <a href="#sobre" className="text-sm font-medium text-muted-foreground hover:text-foreground transition hidden md:block">
              Sobre Nós
            </a>
            <a href="#fundadores" className="text-sm font-medium text-muted-foreground hover:text-foreground transition hidden md:block">
              Fundadores
            </a>
            <a href="#vantagens" className="text-sm font-medium text-muted-foreground hover:text-foreground transition hidden md:block">
              Vantagens
            </a>
            <Link href="/login">
              <Button data-testid="button-login-header">
                Acessar Sistema
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
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
              Centro de Comando
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
              Bem-vindo ao{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-primary">
                Sistema
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-6 max-w-3xl mx-auto leading-relaxed">
              Se você chegou até aqui, saiba:<br />
              você não está entrando apenas em um painel.
            </p>
            
            <p className="text-lg text-foreground font-medium mb-10 max-w-2xl mx-auto">
              Está acessando o centro de comando de uma operação que nasceu para{" "}
              <span className="text-primary">crescer</span>,{" "}
              <span className="text-primary">resistir</span> e{" "}
              <span className="text-primary">dominar</span> seu espaço.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-3xl mx-auto mb-12">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border">
                <span className="text-2xl">🔥</span>
                <p className="font-semibold text-foreground">Onde gestão encontra tecnologia.</p>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border">
                <span className="text-2xl">🔥</span>
                <p className="font-semibold text-foreground">Onde visão vira processo.</p>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border">
                <span className="text-2xl">🔥</span>
                <p className="font-semibold text-foreground">Onde cada decisão constrói expansão.</p>
              </div>
            </div>

            <p className="text-2xl font-bold text-primary mb-10">Bem-vindo.</p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" className="text-lg px-8 h-14 shadow-lg shadow-primary/25" data-testid="button-cta-hero">
                  Acessar Sistema
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="sobre" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
                <span className="text-lg">🍕</span>
                Nossa História
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Onde a Visão Encontra o{" "}
                <span className="text-primary">Fogo</span>
              </h2>
            </div>

            <div className="prose prose-lg dark:prose-invert mx-auto text-left">
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Alguns negócios nascem de uma receita.<br />
                Outros nascem de uma <strong className="text-foreground">decisão</strong>.
              </p>
              
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Esta pizzaria não começou em um forno — começou em uma madrugada, quando um empresário, 
                pai de família, doutor em Odontologia, fundador de uma das maiores clínicas odontológicas 
                de São Paulo e dono de laboratório próprio, percebeu algo simples:
              </p>

              <blockquote className="text-2xl font-bold text-primary border-l-4 border-primary pl-6 my-8">
                Crescimento não aceita improviso.
              </blockquote>

              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Formado em Administração, Contabilidade e Odontologia, ele construiu sua trajetória 
                unindo ciência, gestão e execução extrema. Clínicas, laboratórios, equipes, processos. 
                Tudo precisava funcionar como um sistema vivo, preciso e escalável.
              </p>

              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Mas havia um novo desafio.
              </p>
              
              <p className="text-lg text-foreground font-semibold leading-relaxed mb-8">
                Criar uma pizzaria nascida para escalar, não para apenas sobreviver.
              </p>

              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Uma operação que unisse:
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8">
                <div className="text-center p-4 rounded-xl bg-background border">
                  <span className="text-3xl mb-2 block">🔥</span>
                  <p className="font-semibold">Produto forte</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-background border">
                  <span className="text-3xl mb-2 block">🧠</span>
                  <p className="font-semibold">Gestão inteligente</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-background border">
                  <span className="text-3xl mb-2 block">💻</span>
                  <p className="font-semibold">Tecnologia proprietária</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-background border">
                  <span className="text-3xl mb-2 block">🚀</span>
                  <p className="font-semibold">Expansão agressiva e controlada</p>
                </div>
              </div>

              <p className="text-xl text-center font-semibold text-foreground">
                Foi então que quatro mentes se alinharam.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="fundadores" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
                <span className="text-lg">👥</span>
                Equipe
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Quatro Pilares.{" "}
                <span className="text-primary">Um Sistema.</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50">
                <CardContent className="p-8">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <Building2 className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Gustavo</h3>
                  <p className="text-primary font-medium mb-4">Sistema Franqueador</p>
                  <p className="text-muted-foreground">
                    Assumiu o coração da operação: o sistema franqueador, os fluxos, o operacional 
                    que garante que cada unidade funcione como a primeira — ou melhor.
                  </p>
                </CardContent>
              </Card>

              <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 border-2 hover:border-secondary/50">
                <CardContent className="p-8">
                  <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-6">
                    <Code2 className="w-8 h-8 text-secondary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Rafael e Felipe</h3>
                  <p className="text-secondary font-medium mb-4">Engenheiros de Software</p>
                  <p className="text-muted-foreground">
                    Construíram o que não se compra pronto: um sistema de gestão próprio, 
                    com inteligência de decisão, proteção cibernética e visão estratégica em tempo real.
                    <span className="block mt-2 font-medium text-foreground">Aqui, dados não dormem. Eles decidem.</span>
                  </p>
                </CardContent>
              </Card>

              <Card className="overflow-hidden group hover:shadow-xl transition-all duration-300 border-2 hover:border-accent/50 md:col-span-2 md:max-w-md md:mx-auto">
                <CardContent className="p-8">
                  <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6">
                    <Megaphone className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Davi</h3>
                  <p className="text-amber-600 font-medium mb-4">Gestor de Tráfego</p>
                  <p className="text-muted-foreground">
                    Levou a marca para onde o público está: transformando atenção em demanda, 
                    cliques em pedidos e dados em crescimento previsível.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="text-center mt-12 p-8 rounded-2xl bg-muted/50 border">
              <p className="text-xl md:text-2xl font-semibold text-foreground">
                Quatro áreas. Quatro responsabilidades.{" "}
                <span className="text-primary">Um único objetivo: escala com controle.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Não é Sobre Pizza.{" "}
              <span className="text-primary">É Sobre Expansão.</span>
            </h2>
            
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              Cada pizza que sai do forno carrega mais do que sabor.
              Carrega processo, tecnologia, método e visão de longo prazo.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
              <div className="p-6 rounded-xl bg-background border hover:border-primary/50 transition">
                <Building2 className="w-8 h-8 text-primary mb-4" />
                <h4 className="font-bold mb-2">Operar como franquia</h4>
                <p className="text-sm text-muted-foreground">Sistema pronto para replicar em novas unidades</p>
              </div>
              <div className="p-6 rounded-xl bg-background border hover:border-primary/50 transition">
                <BarChart3 className="w-8 h-8 text-primary mb-4" />
                <h4 className="font-bold mb-2">Crescer com previsibilidade</h4>
                <p className="text-sm text-muted-foreground">Métricas claras para tomar decisões seguras</p>
              </div>
              <div className="p-6 rounded-xl bg-background border hover:border-primary/50 transition">
                <Target className="w-8 h-8 text-primary mb-4" />
                <h4 className="font-bold mb-2">Decisões baseadas em dados</h4>
                <p className="text-sm text-muted-foreground">Informação organizada para agir com confiança</p>
              </div>
              <div className="p-6 rounded-xl bg-background border hover:border-primary/50 transition">
                <Shield className="w-8 h-8 text-primary mb-4" />
                <h4 className="font-bold mb-2">Proteger informação e marca</h4>
                <p className="text-sm text-muted-foreground">Segurança para seus dados e receitas</p>
              </div>
              <div className="p-6 rounded-xl bg-background border hover:border-primary/50 transition">
                <TrendingUp className="w-8 h-8 text-primary mb-4" />
                <h4 className="font-bold mb-2">Expansão sem perder qualidade</h4>
                <p className="text-sm text-muted-foreground">Crescer mantendo o padrão que funciona</p>
              </div>
              <div className="p-6 rounded-xl bg-background border hover:border-primary/50 transition">
                <Zap className="w-8 h-8 text-primary mb-4" />
                <h4 className="font-bold mb-2">Agilidade operacional</h4>
                <p className="text-sm text-muted-foreground">Menos tempo no problema, mais tempo vendendo</p>
              </div>
            </div>

            <div className="mt-12 p-8 rounded-2xl bg-primary/5 border border-primary/20">
              <p className="text-lg text-muted-foreground mb-2">
                Enquanto muitos abrem portas, nós <strong className="text-foreground">abrimos sistemas</strong>.
              </p>
              <p className="text-xl font-semibold text-primary">
                Enquanto alguns vendem hoje, nós construímos cadeias de amanhã.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="vantagens" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              O que você ganha com a{" "}
              <span className="text-primary">plataforma</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Ferramentas simples de usar que fazem a diferença no dia a dia da sua operação
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50" data-testid="card-feature-kds">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/20 to-transparent rounded-bl-full" />
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <ChefHat className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Cozinha Organizada</h3>
                <p className="text-muted-foreground mb-4">
                  Uma tela que mostra todos os pedidos em ordem, com tempo de preparo e alertas 
                  para ninguém perder a hora. A cozinha sabe exatamente o que fazer.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Pedidos organizados por prioridade
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Aviso sonoro quando atrasar
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Tempo estimado automático
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
                <h3 className="text-xl font-bold mb-3">Entregas Sob Controle</h3>
                <p className="text-muted-foreground mb-4">
                  Veja onde cada motoboy está no mapa. O sistema escolhe o melhor entregador 
                  e avisa o cliente automaticamente quando a pizza está chegando.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    Mapa em tempo real
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    Escolhe o entregador mais próximo
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    Cliente recebe aviso no WhatsApp
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
                <h3 className="text-xl font-bold mb-3">Assistente Inteligente</h3>
                <p className="text-muted-foreground mb-4">
                  Pergunte qualquer coisa sobre sua loja em linguagem simples. 
                  "Quanto vendemos hoje?" ou "Qual ingrediente está acabando?" — ele responde na hora.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Responde perguntas sobre vendas
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Avisa sobre estoque baixo
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Gera relatórios na hora
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
                <div className="text-sm text-muted-foreground">Sistema Sempre Online</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold text-secondary mb-2">-40%</div>
                <div className="text-sm text-muted-foreground">Tempo de Entrega</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">+25%</div>
                <div className="text-sm text-muted-foreground">Clientes Satisfeitos</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold text-secondary mb-2">24/7</div>
                <div className="text-sm text-muted-foreground">Suporte Disponível</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para entrar no Sistema?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Acesse agora e comece a gerenciar sua operação com as ferramentas certas
          </p>
          <Link href="/login">
            <Button 
              size="lg" 
              variant="secondary" 
              className="text-lg px-8 h-14"
              data-testid="button-cta-footer"
            >
              Acessar Sistema
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
