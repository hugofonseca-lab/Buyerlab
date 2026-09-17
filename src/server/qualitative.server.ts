import type { BuyerActionTag, CompetencyScore, NegotiationMessage } from "../domain/types";
import type { StoredRun } from "./model";
function evidence(messages: NegotiationMessage[], tags: BuyerActionTag[], interpretacao: string) {
  const found = messages.filter(
    (item) => item.autor === "comprador" && item.acoes?.some((tag) => tags.includes(tag)),
  );
  return found.map((item) => ({
    messageId: item.id,
    turno: item.turno,
    autor: item.autor,
    trecho: item.texto.slice(0, 180),
    interpretacao,
  }));
}

export function scoreQualitative(stored: StoredRun): CompetencyScore[] {
  const messages = stored.mensagens;
  const all = new Set(messages.flatMap((item) => item.acoes ?? []));
  const hasAny = (...tags: BuyerActionTag[]) => tags.some((tag) => all.has(tag));
  const points = (rules: Array<[boolean, number]>) =>
    rules.reduce((sum, [ok, value]) => sum + (ok ? value : 0), 0);
  const improper = all.has("extracao_de_sistema") || all.has("antietico");
  return [
    {
      id: "diagnostico",
      rotulo: "Diagnóstico e perguntas",
      maximo: 10,
      pontos: points([
        [all.has("pergunta_aberta"), 4],
        [all.has("diagnostico"), 4],
        [all.has("reformulacao"), 2],
      ]),
      comentario: all.has("diagnostico")
        ? "Explorou interesses antes de fechar posições."
        : "Faltou investigar interesses e restrições do fornecedor.",
      evidencias: evidence(
        messages,
        ["pergunta_aberta", "diagnostico", "reformulacao"],
        "Pergunta usada para revelar interesses ou confirmar entendimento.",
      ),
    },
    {
      id: "estrategia",
      rotulo: "Estratégia e preparação",
      maximo: 10,
      pontos: points([
        [all.has("uso_de_dados"), 5],
        [all.has("ancoragem"), 3],
        [all.has("resumo"), 2],
      ]),
      comentario: hasAny("uso_de_dados", "ancoragem")
        ? "Conectou a conversa ao mandato e a referências objetivas."
        : "Pouco uso do dossiê e de referências objetivas.",
      evidencias: evidence(
        messages,
        ["uso_de_dados", "ancoragem", "resumo"],
        "Uso observável de fatos, referência ou síntese estratégica.",
      ),
    },
    {
      id: "concessoes",
      rotulo: "Concessões e reciprocidade",
      maximo: 8,
      pontos: Math.max(
        0,
        points([[all.has("troca_condicional"), 8]]) - (all.has("concessao_unilateral") ? 3 : 0),
      ),
      comentario: all.has("troca_condicional")
        ? "Condicionou concessões a contrapartidas."
        : "Não transformou concessões em trocas recíprocas.",
      evidencias: evidence(
        messages,
        ["troca_condicional", "concessao_unilateral"],
        "Forma como uma concessão ou contrapartida foi apresentada.",
      ),
    },
    {
      id: "comunicacao",
      rotulo: "Comunicação e controle emocional",
      maximo: 6,
      pontos: Math.max(
        0,
        points([
          [all.has("empatia"), 3],
          [all.has("reformulacao"), 3],
        ]) - (all.has("ameaca") ? 4 : 0),
      ),
      comentario: all.has("ameaca")
        ? "A ameaça reduziu confiança e abertura."
        : hasAny("empatia", "reformulacao")
          ? "Há sinais observáveis de empatia ou reformulação na conversa."
          : "Sem evidência de empatia ou reformulação nesta conversa.",
      evidencias: evidence(
        messages,
        ["empatia", "reformulacao", "ameaca"],
        "Sinal observável de empatia, escuta ou pressão contraproducente.",
      ),
    },
    {
      id: "etica",
      rotulo: "Ética, processo e fechamento",
      maximo: 6,
      pontos: improper
        ? 0
        : points([
            [all.has("fechamento"), 3],
            [all.has("resumo"), 3],
          ]),
      comentario: improper
        ? "Tentou acessar informação confidencial ou imprópria."
        : hasAny("fechamento", "resumo")
          ? "Há evidência de síntese dos termos ou tentativa explícita de fechamento."
          : "Sem evidência de síntese dos termos ou confirmação do fechamento.",
      evidencias: evidence(
        messages,
        ["fechamento", "resumo", "antietico", "extracao_de_sistema"],
        "Comportamento observado no processo ou no fechamento.",
      ),
    },
  ];
}
