import type { BuyerActionTag } from "../domain/types";
import type { StoredRun } from "./model";
import { contextFor } from "./aluminum.server";

/** Redação mock baseada no assunto; nunca decide preço, aceite ou revelações. */
export function mockDialogue(stored: StoredRun, tags: BuyerActionTag[]): string {
  const { rules } = contextFor(stored);
  const buyer = [...stored.mensagens].reverse().find((m) => m.autor === "comprador");
  const text = (buyer?.texto ?? "").toLocaleLowerCase("pt-BR");
  const can = (id: keyof typeof rules.disclosures) => stored.disclosures.includes(id);
  const topics: string[] = [];
  if (/qualidade|defeito|otif|sla|garantia|cr[eé]dito/.test(text))
    topics.push(
      "Reconheço as falhas de entrega e qualidade registradas no dossiê. Precisamos definir metas, responsáveis e como acompanhar a correção." +
        (can("operations")
          ? ` ${rules.disclosures.operations}`
          : " Podemos discutir essas proteções no pacote final."),
    );
  if (/capacidade|estoque|lead time|log[ií]stic|atraso|continuidade|prioridade/.test(text))
    topics.push(
      "Para proteger a linha, precisamos alinhar a programação de entregas à previsão de consumo. Prioridade e estoque de segurança precisam constar do pacote; não são uma garantia automática de entrega.",
    );
  if (/pagamento|caixa|contrato|volume/.test(text) && can("interests"))
    topics.push(
      `${rules.disclosures.interests} Qual compromisso a Orion consegue manter durante a vigência?`,
    );
  if (/forecast|previsibilidade|previs[aã]o|custo/.test(text) && can("forecast"))
    topics.push(
      `${rules.disclosures.forecast} Precisamos combinar uma janela estável e como tratar mudanças fora dela.`,
    );
  if (tags.includes("troca_condicional"))
    topics.unshift(
      "Vou considerar a troca como um pacote: a posição pública depende das contrapartidas indicadas, ainda sujeitas à confirmação final.",
    );
  else if (
    tags.includes("proposta") ||
    tags.includes("ancoragem") ||
    /pre[çc]o|desconto/.test(text)
  )
    topics.unshift(
      "Entendo sua referência de preço. Uma redução isolada não basta: precisamos relacioná-la a prazo, volume, forecast e pagamento, conforme a posição pública atual.",
    );
  else if (tags.includes("concessao_unilateral"))
    topics.unshift(
      "Registrei o compromisso oferecido. Ele não significa uma redução automática da nossa posição; explicite o que espera receber em troca.",
    );
  if (tags.includes("fechamento") || tags.includes("resumo"))
    topics.push(
      "Consolide os termos em Estruturar proposta, incluindo as proteções operacionais. O acordo só será confirmado após a validação do pacote completo.",
    );
  if (!topics.length) {
    if (tags.includes("pergunta_aberta") || tags.includes("diagnostico"))
      topics.push(
        can("interests")
          ? `${rules.disclosures.interests} Qual desses pontos você quer aprofundar?`
          : "Podemos detalhar entrega, qualidade ou condições comerciais. Qual é a sua principal dúvida?",
      );
    else if (tags.includes("empatia") || tags.includes("reformulacao"))
      topics.push(
        "O reconhecimento das responsabilidades dos dois lados ajuda. Vamos transformar esse entendimento em compromissos verificáveis de fornecimento e planejamento.",
      );
    else
      topics.push(
        "Para avançar, preciso de uma proposta concreta ou de uma pergunta sobre o fornecimento. Podemos começar por entrega, qualidade ou pelas condições comerciais.",
      );
  }
  const event = stored.estadoPublico.eventos.find((e) => e.turno === stored.estadoPublico.turno);
  return [
    ...topics,
    ...(event
      ? [`A atualização «${event.titulo}» também precisa entrar na análise do pacote.`]
      : []),
  ].join("\n\n");
}
