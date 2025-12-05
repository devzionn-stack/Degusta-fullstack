import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Brain,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Smile,
  Meh,
  Frown,
  Plus,
  RefreshCw,
  BarChart3
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";

interface Feedback {
  id: string;
  tenantId: string;
  pedidoId: string | null;
  clienteId: string | null;
  texto: string;
  sentimento: number;
  topicos: string[];
  createdAt: string;
}

interface SentimentSummary {
  sentimentoMedio: number;
  totalFeedbacks: number;
}

interface TopicoCritico {
  topico: string;
  ocorrencias: number;
}

const SENTIMENT_COLORS = {
  positivo: "#22c55e",
  neutro: "#f59e0b",
  negativo: "#ef4444",
};

const TOPIC_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#06b6d4", "#84cc16"];

export default function Inteligencia() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newFeedback, setNewFeedback] = useState({
    texto: "",
    sentimento: 3,
    topicos: "",
  });

  const { data: feedbacks = [], isLoading: loadingFeedbacks } = useQuery<Feedback[]>({
    queryKey: ["inteligencia", "feedbacks"],
    queryFn: async () => {
      const res = await fetch("/api/inteligencia/feedbacks", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar feedbacks");
      return res.json();
    },
  });

  const { data: summary, isLoading: loadingSummary } = useQuery<SentimentSummary>({
    queryKey: ["inteligencia", "sentiment-summary"],
    queryFn: async () => {
      const res = await fetch("/api/inteligencia/sentiment-summary", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar resumo de sentimento");
      return res.json();
    },
  });

  const { data: topicos = [], isLoading: loadingTopicos } = useQuery<TopicoCritico[]>({
    queryKey: ["inteligencia", "topicos-criticos"],
    queryFn: async () => {
      const res = await fetch("/api/inteligencia/topicos-criticos?limit=6", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar tópicos críticos");
      return res.json();
    },
  });

  const addFeedbackMutation = useMutation({
    mutationFn: async (data: { texto: string; sentimento: number; topicos: string[] }) => {
      const res = await fetch("/api/inteligencia/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao adicionar feedback");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inteligencia"] });
      toast({ title: "Feedback adicionado com sucesso!" });
      setIsAddDialogOpen(false);
      setNewFeedback({ texto: "", sentimento: 3, topicos: "" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar feedback", variant: "destructive" });
    },
  });

  const handleAddFeedback = () => {
    if (!newFeedback.texto.trim()) {
      toast({ title: "Texto do feedback é obrigatório", variant: "destructive" });
      return;
    }
    
    const topicosArray = newFeedback.topicos
      .split(",")
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    addFeedbackMutation.mutate({
      texto: newFeedback.texto,
      sentimento: newFeedback.sentimento,
      topicos: topicosArray,
    });
  };

  const getSentimentIcon = (score: number) => {
    if (score >= 4) return <Smile className="h-5 w-5 text-green-500" />;
    if (score >= 2) return <Meh className="h-5 w-5 text-amber-500" />;
    return <Frown className="h-5 w-5 text-red-500" />;
  };

  const getSentimentLabel = (score: number) => {
    if (score >= 4) return "Positivo";
    if (score >= 2) return "Neutro";
    return "Negativo";
  };

  const getSentimentColor = (score: number) => {
    if (score >= 4) return "bg-green-100 text-green-800";
    if (score >= 2) return "bg-amber-100 text-amber-800";
    return "bg-red-100 text-red-800";
  };

  const sentimentDistribution = feedbacks.reduce(
    (acc, fb) => {
      if (fb.sentimento >= 4) acc.positivo++;
      else if (fb.sentimento >= 2) acc.neutro++;
      else acc.negativo++;
      return acc;
    },
    { positivo: 0, neutro: 0, negativo: 0 }
  );

  const sentimentChartData = [
    { name: "Positivo", value: sentimentDistribution.positivo, color: SENTIMENT_COLORS.positivo },
    { name: "Neutro", value: sentimentDistribution.neutro, color: SENTIMENT_COLORS.neutro },
    { name: "Negativo", value: sentimentDistribution.negativo, color: SENTIMENT_COLORS.negativo },
  ].filter(d => d.value > 0);

  const topicosChartData = topicos.map((t, i) => ({
    name: t.topico,
    ocorrencias: t.ocorrencias,
    fill: TOPIC_COLORS[i % TOPIC_COLORS.length],
  }));

  const avgSentiment = summary?.sentimentoMedio ?? 0;
  const totalFeedbacks = summary?.totalFeedbacks ?? 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Brain className="h-6 w-6 text-purple-600" />
              Inteligência de Negócio
            </h1>
            <p className="text-gray-500 mt-1">
              Análise de feedbacks e insights sobre clientes
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-feedback">
                <Plus className="h-4 w-4 mr-2" />
                Novo Feedback
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Feedback</DialogTitle>
                <DialogDescription>
                  Registre um novo feedback de cliente para análise
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="texto">Texto do Feedback</Label>
                  <Textarea
                    id="texto"
                    data-testid="input-feedback-texto"
                    placeholder="Digite o feedback do cliente..."
                    value={newFeedback.texto}
                    onChange={(e) => setNewFeedback({ ...newFeedback, texto: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sentimento">Sentimento (1-5)</Label>
                  <Select
                    value={newFeedback.sentimento.toString()}
                    onValueChange={(v) => setNewFeedback({ ...newFeedback, sentimento: parseInt(v) })}
                  >
                    <SelectTrigger data-testid="select-feedback-sentimento">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Muito Negativo</SelectItem>
                      <SelectItem value="2">2 - Negativo</SelectItem>
                      <SelectItem value="3">3 - Neutro</SelectItem>
                      <SelectItem value="4">4 - Positivo</SelectItem>
                      <SelectItem value="5">5 - Muito Positivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="topicos">Tópicos (separados por vírgula)</Label>
                  <Input
                    id="topicos"
                    data-testid="input-feedback-topicos"
                    placeholder="Ex: entrega, qualidade, atendimento"
                    value={newFeedback.topicos}
                    onChange={(e) => setNewFeedback({ ...newFeedback, topicos: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAddFeedback}
                  disabled={addFeedbackMutation.isPending}
                  data-testid="button-submit-feedback"
                >
                  {addFeedbackMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Feedbacks</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-feedbacks">
                {totalFeedbacks}
              </div>
              <p className="text-xs text-muted-foreground">
                Feedbacks coletados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sentimento Médio</CardTitle>
              {avgSentiment >= 3 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" data-testid="text-avg-sentiment">
                  {avgSentiment.toFixed(1)}
                </span>
                <span className="text-gray-400">/ 5.0</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pontuação média de satisfação
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Feedbacks Negativos</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-negative-feedbacks">
                {sentimentDistribution.negativo}
              </div>
              <p className="text-xs text-muted-foreground">
                Requerem atenção imediata
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Distribuição de Sentimentos
              </CardTitle>
              <CardDescription>
                Proporção de feedbacks por nível de satisfação
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sentimentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sentimentChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {sentimentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  Nenhum feedback cadastrado ainda
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Tópicos Mais Mencionados
              </CardTitle>
              <CardDescription>
                Assuntos mais frequentes nos feedbacks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topicosChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topicosChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="ocorrencias" name="Menções" radius={[0, 4, 4, 0]}>
                      {topicosChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">
                  Nenhum tópico registrado ainda
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Feedbacks Recentes</CardTitle>
            <CardDescription>
              Últimos feedbacks de clientes recebidos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingFeedbacks ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : feedbacks.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Texto</TableHead>
                    <TableHead>Sentimento</TableHead>
                    <TableHead>Tópicos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedbacks.slice(0, 10).map((feedback) => (
                    <TableRow key={feedback.id} data-testid={`row-feedback-${feedback.id}`}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(feedback.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {feedback.texto}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSentimentIcon(feedback.sentimento)}
                          <Badge className={getSentimentColor(feedback.sentimento)}>
                            {getSentimentLabel(feedback.sentimento)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(feedback.topicos as string[])?.map((topico, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {topico}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum feedback cadastrado ainda.</p>
                <p className="text-sm">Clique em "Novo Feedback" para adicionar o primeiro.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
