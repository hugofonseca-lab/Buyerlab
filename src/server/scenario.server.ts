import { orionNexa } from "../domain/scenario";
export const blueprint = {
  ...orionNexa,
  escada: [
    {
      preco: 118,
      requisito: "Proposta inicial",
      exigeArgumentoCrivel: false,
      exigeReciprocidade: false,
      contrapartidasMinimas: 0,
      confiancaMinima: 0,
    },
    {
      preco: 114,
      requisito: "Argumentos críveis e exploração de interesses",
      exigeArgumentoCrivel: true,
      exigeReciprocidade: false,
      contrapartidasMinimas: 0,
      confiancaMinima: 40,
    },
    {
      preco: 112,
      requisito: "Existe reciprocidade na mesa",
      exigeArgumentoCrivel: true,
      exigeReciprocidade: true,
      contrapartidasMinimas: 1,
      confiancaMinima: 45,
    },
    {
      preco: 109,
      requisito: "Uma contrapartida relevante formalizada",
      exigeArgumentoCrivel: true,
      exigeReciprocidade: true,
      contrapartidasMinimas: 2,
      confiancaMinima: 52,
    },
    {
      preco: 107,
      requisito: "Duas ou mais contrapartidas relevantes",
      exigeArgumentoCrivel: true,
      exigeReciprocidade: true,
      contrapartidasMinimas: 3,
      confiancaMinima: 60,
    },
    {
      preco: 105,
      requisito: "Pacote excepcionalmente favorável e coerente",
      exigeArgumentoCrivel: true,
      exigeReciprocidade: true,
      contrapartidasMinimas: 4,
      confiancaMinima: 70,
    },
  ],
  eventos: [
    {
      id: "restricao_capacidade",
      titulo: "Restrição adicional de capacidade",
      descricao:
        "A Nexa informa que uma célula de montagem entrou em manutenção corretiva e reduziu a capacidade disponível para o próximo mês.",
      probabilidade: 0.18,
      turnoMinimo: 3,
      prerequisito: "demora",
      efeito: "poder_fornecedor",
    },
    {
      id: "cliente_concorrente",
      titulo: "Outro cliente pede prioridade",
      descricao:
        "A Nexa menciona que outro cliente solicitou reserva de capacidade adicional e cobra uma definição de prazo.",
      probabilidade: 0.2,
      turnoMinimo: 4,
      prerequisito: "sem_avanco",
      efeito: "pressao",
    },
    {
      id: "atraso_logistico",
      titulo: "Atraso logístico",
      descricao:
        "Um embarque de insumo da Nexa atrasou dois dias, o que aperta o cronograma da próxima remessa.",
      probabilidade: 0.15,
      turnoMinimo: 3,
      prerequisito: "sempre",
      efeito: "pressao",
    },
    {
      id: "janela_diretoria",
      titulo: "Janela de aprovação da diretoria",
      descricao:
        "A diretoria da Nexa abriu uma janela curta para aprovar condições excepcionais, desde que o pacote esteja fechado.",
      probabilidade: 0.2,
      turnoMinimo: 5,
      prerequisito: "proximo_do_acordo",
      efeito: "abertura",
    },
    {
      id: "atualizacao_alternativo",
      titulo: "Atualização da segunda fonte",
      descricao:
        "Engenharia da Orion informa que a qualificação do fornecedor alternativo pode começar antes, mas a cobertura inicial segue em 30%.",
      probabilidade: 0.15,
      turnoMinimo: 4,
      prerequisito: "sempre",
      efeito: "informacao",
    },
  ],
};
