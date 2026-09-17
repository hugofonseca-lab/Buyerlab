export const brl = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export const moeda = (valor: number, currency: "BRL" | "USD") =>
  valor.toLocaleString("pt-BR", { style: "currency", currency, maximumFractionDigits: 2 });

export const toneladas = (valor: number) => `${numero(valor)} t`;

export const dataCurta = (valor: string) =>
  new Date(`${valor}T12:00:00`).toLocaleDateString("pt-BR");

export const numero = (valor: number) => valor.toLocaleString("pt-BR");

export const rotuloPerfil: Record<string, string> = {
  colaborativo: "Colaborativo",
  analitico: "Analítico",
  dominante: "Dominante",
  defensivo: "Defensivo",
  aleatorio: "Aleatório",
};

export const rotuloModo: Record<string, string> = {
  treinamento: "Treinamento",
  avaliacao: "Avaliação",
};

export const rotuloDificuldade: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export const rotuloUrgencia: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export const rotuloRisco: Record<string, string> = {
  baixo: "Baixo",
  moderado: "Moderado",
  alto: "Alto",
};

export const rotuloResultado: Record<string, string> = {
  acordo: "Acordo fechado",
  acordo_fragil: "Acordo frágil",
  impasse: "Impasse",
  encerrado: "Negociação encerrada sem proposta",
};

export const rotuloAcao: Record<string, string> = {
  pergunta_aberta: "pergunta aberta",
  diagnostico: "diagnóstico",
  uso_de_dados: "uso de dados",
  ancoragem: "ancoragem",
  demanda: "demanda",
  proposta: "proposta",
  concessao_unilateral: "concessão unilateral",
  troca_condicional: "troca condicional",
  ameaca: "ameaça",
  empatia: "empatia",
  reformulacao: "escuta e reformulação",
  resumo: "resumo",
  fechamento: "tentativa de fechamento",
  antietico: "solicitação antiética",
  extracao_de_sistema: "tentativa de extrair dados ocultos",
  neutro: "fala neutra",
};
