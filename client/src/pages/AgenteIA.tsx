import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Bot, User, Sparkles, AlertCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: Array<{ name: string; result: any }>;
  timestamp: Date;
}

interface ChatResponse {
  resposta: string;
  toolsUsed: Array<{ name: string; result: any }>;
}

export default function AgenteIA() {
  const { user } = useAuth();
  const [mensagem, setMensagem] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Olá! Sou o assistente inteligente da Degusta Pizzas. Estou aqui para facilitar sua gestão - basta perguntar em linguagem simples! Posso te ajudar com: vendas do dia, estoque baixo, entregas em andamento, ou qualquer dúvida sobre sua operação. Como posso ajudar?",
      timestamp: new Date(),
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasAccess =
    user?.role === "tenant_admin" || user?.role === "super_admin";

  const chatMutation = useMutation({
    mutationFn: async (mensagem: string): Promise<ChatResponse> => {
      const historico = messages
        .filter((m) => m.id !== "welcome")
        .slice(-10)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await fetch("/api/agente-ia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mensagem, historico }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao processar mensagem");
      }

      return response.json();
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.resposta,
        toolsUsed: data.toolsUsed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error: Error) => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Desculpe, ocorreu um erro: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensagem.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: mensagem,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    chatMutation.mutate(mensagem);
    setMensagem("");
    inputRef.current?.focus();
  };

  const formatToolName = (name: string): string => {
    const toolNames: Record<string, string> = {
      getFaturamentoSemana: "Faturamento da Semana",
      getEstoqueIngrediente: "Consulta de Estoque",
      listarEstoqueBaixo: "Estoque Baixo",
      getMotoboysAtivos: "Motoboys Ativos",
      getTempoMedioEntrega: "Tempo Médio de Entrega",
      getPedidosHoje: "Pedidos de Hoje",
      atualizarEstoqueIngrediente: "Atualizar Estoque",
      cancelarMotoboy: "Cancelar Motoboy",
    };
    return toolNames[name] || name;
  };

  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <h2 className="text-xl font-semibold">Acesso Restrito</h2>
                <p className="text-muted-foreground">
                  Apenas administradores podem acessar o Agente de IA. Entre em
                  contato com seu administrador para solicitar acesso.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-120px)]">
        <Card className="flex flex-col flex-1">
          <CardHeader className="flex-shrink-0 border-b">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Assistente Inteligente Degusta
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Pergunte sobre vendas, estoque, entregas ou qualquer dúvida da sua operação
            </p>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 p-0">
            <ScrollArea
              ref={scrollRef}
              className="flex-1 p-4"
              data-testid="chat-messages"
            >
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                    data-testid={`message-${message.id}`}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </p>
                      {message.toolsUsed && message.toolsUsed.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <p className="text-xs opacity-70 mb-1">
                            Dados consultados:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {message.toolsUsed.map((tool, idx) => (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="text-xs"
                              >
                                {formatToolName(tool.name)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-xs opacity-50 mt-1">
                        {message.timestamp.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {message.role === "user" && (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-secondary">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex gap-3 justify-start">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Processando...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="flex-shrink-0 p-4 border-t">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Ex: Quanto vendemos hoje? / Qual ingrediente está acabando?"
                  disabled={chatMutation.isPending}
                  data-testid="input-message"
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={chatMutation.isPending || !mensagem.trim()}
                  data-testid="button-send"
                >
                  {chatMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() =>
                    setMensagem("Qual foi o faturamento da semana?")
                  }
                  data-testid="quick-faturamento"
                >
                  Faturamento da semana
                </Badge>
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() =>
                    setMensagem("Quais ingredientes estão com estoque baixo?")
                  }
                  data-testid="quick-estoque"
                >
                  Estoque baixo
                </Badge>
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() =>
                    setMensagem("Quantos motoboys estão ativos agora?")
                  }
                  data-testid="quick-motoboys"
                >
                  Motoboys ativos
                </Badge>
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => setMensagem("Como estão os pedidos de hoje?")}
                  data-testid="quick-pedidos"
                >
                  Pedidos de hoje
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
