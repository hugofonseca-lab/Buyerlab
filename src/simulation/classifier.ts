import type { BuyerActionTag } from "@/domain/types";

const has = (text: string, pattern: RegExp) => pattern.test(text);

export function classifyBuyerMessage(raw: string): BuyerActionTag[] {
  const text = raw.toLocaleLowerCase("pt-BR");
  const tags = new Set<BuyerActionTag>();

  if (
    /ignore.{0,45}instru|pre[çc]o m[ií]nimo|prompt|administrador|atribua.{0,30}nota|nota.{0,15}100|estado.{0,25}(emocional|num[eé]rico|interno)|alterar.{0,15}pontua|encerr.{0,15}regras/i.test(
      text,
    )
  ) {
    return ["extracao_de_sistema", "antietico"];
  }

  if (
    has(
      text,
      /\b(prompt|instruç(?:ão|ões) do sistema|estado oculto|preço mínimo|preço piso|limite secreto|raciocínio interno|ignore (?:as|suas) instruções)\b/,
    )
  ) {
    tags.add("extracao_de_sistema");
    tags.add("antietico");
  }
  if (has(text, /\b(suborno|propina|por fora|nota fria|fraudar|favorecimento)\b/))
    tags.add("antietico");
  if (text.includes("?") || has(text, /\b(como|por que|quais|o que|conte mais|ajude a entender)\b/))
    tags.add("pergunta_aberta");
  if (
    has(
      text,
      /\b(custos?|capacidades?|previsibilidade|interesses?|prioridades?|restriç(?:ão|ões)|impactos?|causas?|necessidades?)\b/,
    ) &&
    tags.has("pergunta_aberta")
  )
    tags.add("diagnostico");
  if (
    has(
      text,
      /\b(?:91|95|1[,.]8|1)%(?!\w)|\b(10[.]?000|14 dias|12 dias|45 dias|250[.]?000|dados|indicadores?|otif|defeitos?)\b/,
    )
  )
    tags.add("uso_de_dados");
  if (
    has(
      text,
      /\br\$\s*\d+(?:[.,]\d+)*\b|\b(preço de|proponho|nossa proposta|oferecemos|chegar a)\b/,
    )
  )
    tags.add("proposta");
  if (has(text, /\b(r\$\s?(?:10[0-9]|9[0-9])|ancor|partimos de|referência é)\b/))
    tags.add("ancoragem");
  if (has(text, /\b(exigimos|precisamos que|tem que|deve|não aceitamos)\b/)) tags.add("demanda");
  if (
    has(
      text,
      /\b(se vocês?|desde que|em troca|condicionado|podemos .{0,35} se|mediante|como contrapartida)\b/,
    )
  )
    tags.add("troca_condicional");
  if (
    has(text, /\b(aceito|concedo|podemos dar|reduzo|abro mão)\b/) &&
    !tags.has("troca_condicional")
  )
    tags.add("concessao_unilateral");
  if (
    has(
      text,
      /\b(trocar fornecedor|encerrar|cancelar|última chance|ou então|processar|expor|ameaç)\b/,
    )
  )
    tags.add("ameaca");
  if (has(text, /\b(entendo|reconheço|compreendo|faz sentido|sei que|desafio de vocês)\b/))
    tags.add("empatia");
  if (has(text, /\b(se entendi|você está dizendo|pelo que ouvi|então, para vocês|corrija-me)\b/))
    tags.add("reformulacao");
  if (has(text, /\b(resumindo|em resumo|recapitulando|ficamos então|consolidando)\b/))
    tags.add("resumo");
  if (has(text, /\b(fechamos|podemos fechar|confirmam|aceitam|formalizar|acordo)\b/))
    tags.add("fechamento");

  return tags.size > 0 ? [...tags] : ["neutro"];
}

const ACCEPTANCE_PATTERN =
  /\b(aceito|aceitamos|aceita(?:da|do)?|concordo|concordamos|fechado)\b[^.?!\n]{0,40}\b(proposta|acordo|oferta|condiç(?:ão|ões)|termos|pacote|preço|valor)\b/;
const ACCEPTANCE_NEGATION =
  /\bn[ãa]o\b[^.?!\n]{0,20}\b(aceito|aceitamos|aceita(?:da|do)?|concordo|concordamos)\b/;

/**
 * Reconhece um aceite explícito e inequívoco do comprador ("aceito a proposta", "concordamos com
 * o acordo"...), distinto da tag "fechamento" (que só sinaliza intenção de encerrar/formalizar).
 * Usado em api.server.ts para encerrar o treinamento e gerar o relatório automaticamente a partir
 * da posição pública negociada — nunca a partir de uma alegação do fornecedor/IA.
 */
export function isExplicitAcceptance(raw: string): boolean {
  const text = raw.toLocaleLowerCase("pt-BR");
  return ACCEPTANCE_PATTERN.test(text) && !ACCEPTANCE_NEGATION.test(text);
}

export function extractRelevantCounterparts(raw: string): string[] {
  const text = raw.toLocaleLowerCase("pt-BR");
  const found: string[] = [];
  if (!/em troca|desde que|se voc|condicionado|mediante|contrapartida/.test(text)) return [];
  if (/\b(12|18|24) meses\b|prazo contratual|contrato longo/.test(text))
    found.push("prazo contratual");
  if (/volume mínimo|10[.]?000|volume garantido/.test(text)) found.push("volume mínimo");
  if (/forecast|previsão congelada|janela congelada/.test(text)) found.push("forecast congelado");
  if (/pagamento.{0,15}(15|30) dias|pagamento mais curto|antecipar pagamento/.test(text))
    found.push("pagamento em 30 dias");
  return [...new Set(found)];
}
