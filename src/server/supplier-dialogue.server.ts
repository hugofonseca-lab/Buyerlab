import type { BuyerActionTag } from "../domain/types";
import type { StoredRun } from "./model";
import { contextFor } from "./aluminum.server";
import { createRng, pick } from "../lib/prng";

/** Redação mock baseada no assunto; nunca decide preço, aceite ou revelações. */
export function mockDialogue(stored: StoredRun, tags: BuyerActionTag[]): string {
  const { rules } = contextFor(stored);
  const buyer = [...stored.mensagens].reverse().find((m) => m.autor === "comprador");
  const text = (buyer?.texto ?? "").toLocaleLowerCase("pt-BR");
  const can = (id: keyof typeof rules.disclosures) => stored.disclosures.includes(id);
  // Varia a redação por turno (mesma seed reproduz o mesmo texto; turnos diferentes não repetem
  // a mesma frase), para o fallback mock não soar como um roteiro fixo quando a IA real cai.
  const rng = createRng(stored.run.seed, `mockdialogo-${stored.estadoPublico.turno}`);
  const one = (variants: readonly string[]) => pick(rng, variants);
  const topics: string[] = [];
  if (/qualidade|defeito|otif|sla|garantia|cr[eé]dito/.test(text))
    topics.push(
      one([
        "Reconheço as falhas de entrega e qualidade registradas no dossiê. Precisamos definir metas, responsáveis e como acompanhar a correção.",
        "Sobre qualidade e garantia: sei que há histórico a corrigir, e quero tratar isso com metas claras e responsáveis definidos, não só com uma promessa genérica.",
      ]) +
        (can("operations")
          ? ` ${rules.disclosures.operations}`
          : " Podemos discutir essas proteções no pacote final."),
    );
  if (/capacidade|estoque|lead time|log[ií]stic|atraso|continuidade|prioridade/.test(text))
    topics.push(
      one([
        "Para proteger a linha, precisamos alinhar a programação de entregas à previsão de consumo. Prioridade e estoque de segurança precisam constar do pacote; não são uma garantia automática de entrega.",
        "Capacidade e continuidade dependem de programação combinada com antecedência; prioridade de atendimento é algo que negociamos dentro do pacote, não um compromisso automático à parte.",
      ]),
    );
  if (/pagamento|caixa|contrato|volume/.test(text) && can("interests"))
    topics.push(
      `${rules.disclosures.interests} ` +
        one([
          "Qual compromisso a Orion consegue manter durante a vigência?",
          "Isso te ajuda a entender por que priorizamos previsibilidade — qual é o compromisso que vocês conseguem sustentar durante a vigência?",
        ]),
    );
  if (/forecast|previsibilidade|previs[aã]o|custo/.test(text) && can("forecast"))
    topics.push(
      `${rules.disclosures.forecast} ` +
        one([
          "Precisamos combinar uma janela estável e como tratar mudanças fora dela.",
          "O que eu preciso de vocês é uma janela de previsão estável, e um acordo claro de como lidamos com mudanças fora dela.",
        ]),
    );
  if (tags.includes("troca_condicional"))
    topics.unshift(
      one([
        "Vou considerar a troca como um pacote: a posição pública depende das contrapartidas indicadas, ainda sujeitas à confirmação final.",
        "Entendi a troca que você propõe. Vou tratar isso como pacote fechado: a posição pública reflete as contrapartidas, mas ainda sujeita à confirmação final.",
      ]),
    );
  else if (
    tags.includes("proposta") ||
    tags.includes("ancoragem") ||
    /pre[çc]o|desconto/.test(text)
  )
    topics.unshift(
      one([
        "Entendo sua referência de preço. Uma redução isolada não basta: precisamos relacioná-la a prazo, volume, forecast e pagamento, conforme a posição pública atual.",
        "Registrei o valor de referência que você trouxe. Preço isolado não fecha nada por aqui: ele precisa vir junto com prazo, volume, forecast e pagamento, como está na posição pública.",
      ]),
    );
  else if (tags.includes("concessao_unilateral"))
    topics.unshift(
      one([
        "Registrei o compromisso oferecido. Ele não significa uma redução automática da nossa posição; explicite o que espera receber em troca.",
        "Anotei o que você está dispondo a ceder. Isso sozinho não move nossa posição — me diga concretamente o que você espera em troca.",
      ]),
    );
  if (tags.includes("fechamento") || tags.includes("resumo"))
    topics.push(
      one([
        "Consolide os termos em Estruturar proposta, incluindo as proteções operacionais. O acordo só será confirmado após a validação do pacote completo.",
        "Podemos ir para o fechamento, mas registre os termos em Estruturar proposta com as proteções operacionais incluídas — só confirmamos depois de validar o pacote inteiro.",
      ]),
    );
  if (!topics.length) {
    if (tags.includes("pergunta_aberta") || tags.includes("diagnostico"))
      topics.push(
        can("interests")
          ? `${rules.disclosures.interests} ` +
              one([
                "Qual desses pontos você quer aprofundar?",
                "Por onde você quer que a gente comece?",
              ])
          : one([
              "Podemos detalhar entrega, qualidade ou condições comerciais. Qual é a sua principal dúvida?",
              "Posso falar sobre entrega, qualidade ou condições comerciais — qual desses te preocupa mais agora?",
            ]),
      );
    else if (tags.includes("empatia") || tags.includes("reformulacao"))
      topics.push(
        one([
          "O reconhecimento das responsabilidades dos dois lados ajuda. Vamos transformar esse entendimento em compromissos verificáveis de fornecimento e planejamento.",
          "Fico feliz que estejamos na mesma página sobre isso. Vamos transformar esse entendimento em compromissos que dá para verificar, não só boa vontade.",
        ]),
      );
    else
      topics.push(
        one([
          "Para avançar, preciso de uma proposta concreta ou de uma pergunta sobre o fornecimento. Podemos começar por entrega, qualidade ou pelas condições comerciais.",
          "Ainda não tenho algo concreto para responder — me traga uma proposta ou uma pergunta específica sobre entrega, qualidade ou condições comerciais.",
        ]),
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
