import type { PublicScenarioBlueprint } from "./types";
import { offerDefaults } from "./offer-defaults";

/** Cenário único e profundo do MVP. Todos os dados são fictícios. */
export const orionNexa: PublicScenarioBlueprint = {
  ofertaInicialComprador: offerDefaults,
  id: "orion-nexa-k17",
  versao: "2.0.0",
  titulo: "Renovação de contrato — Módulo K-17",
  brief: {
    compradora: "Orion Equipamentos",
    fornecedor: "Nexa Componentes",
    componente: "Módulo K-17",
    contexto: [
      "A Orion Equipamentos monta equipamentos industriais e consome 10.000 unidades mensais do Módulo K-17, um componente crítico de linha.",
      "A Nexa Componentes é a fonte única homologada do K-17 há quatro anos e responde por parte relevante da capacidade instalada da própria fábrica dela.",
      "O contrato vigente está próximo do vencimento e a Nexa comunicou reajuste de 18%, elevando o preço unitário de R$ 100,00 para R$ 118,00.",
      "As duas empresas têm responsabilidades no histórico recente: houve atrasos e falhas de qualidade da Nexa, e também alterações tardias de previsão feitas pela Orion.",
    ],
    contrato: [
      { rotulo: "Preço unitário atual", valor: "R$ 100,00" },
      { rotulo: "Proposta da Nexa", valor: "R$ 118,00 (+18%)" },
      { rotulo: "Demanda mensal", valor: "10.000 unidades" },
      { rotulo: "Prazo de pagamento", valor: "45 dias" },
      { rotulo: "Lead time atual", valor: "14 dias" },
      { rotulo: "Meta contratual de OTIF", valor: "95%" },
      { rotulo: "Meta de defeitos", valor: "1,0%" },
    ],
    mercado: [
      { rotulo: "Custo mensal atual", valor: "R$ 1.000.000,00" },
      { rotulo: "Custo mensal na proposta", valor: "R$ 1.180.000,00" },
      { rotulo: "Impacto autorizado máximo", valor: "R$ 1.070.000,00" },
      { rotulo: "Estoque disponível", valor: "≈ 12 dias" },
      { rotulo: "Parada de linha", valor: "R$ 250.000,00 por dia" },
    ],
    historico: [
      "Relacionamento de quatro anos, sem ruptura de fornecimento, mas com desgaste nos últimos oito meses.",
      "A Nexa relata custos maiores de insumos importados e retrabalho causado por mudanças de forecast da Orion.",
      "A Orion registrou dois atrasos relevantes e um lote com índice de defeitos acima da meta no último trimestre.",
      "Nenhuma reunião estruturada de melhoria foi realizada até agora.",
    ],
    desempenho: [
      { rotulo: "OTIF (3 meses)", valor: "91%", meta: "95%", status: "abaixo" },
      { rotulo: "Índice de defeitos", valor: "1,8%", meta: "1,0%", status: "abaixo" },
      { rotulo: "Lead time", valor: "14 dias", meta: "14 dias", status: "ok" },
      { rotulo: "Rupturas de fornecimento", valor: "0", meta: "0", status: "ok" },
    ],
    riscos: [
      "Estoque de aproximadamente 12 dias: uma interrupção curta já compromete a linha.",
      "Fornecedor alternativo exigiria 45 dias para qualificação.",
      "Após qualificado, o alternativo cobriria inicialmente apenas 30% da demanda.",
      "Ameaçar troca imediata de fornecedor não é uma alternativa crível no prazo.",
      "Um acordo apenas de preço, sem qualidade e continuidade, mantém o risco operacional.",
    ],
  },
  mandato: {
    objetivo:
      "Renovar o fornecimento do Módulo K-17 protegendo continuidade, qualidade e custo, com preço efetivo de no máximo R$ 107,00 por unidade.",
    precoAtual: 100,
    precoProposto: 118,
    limitePrecoEfetivo: 107,
    demandaMensal: 10000,
    diasEstoque: 12,
    impactoParadaDia: 250000,
    diasQualificacaoAlternativo: 45,
    coberturaAlternativoInicial: 0.3,
    prioridades: [
      "Preço efetivo de até R$ 107,00 por unidade.",
      "Nenhuma interrupção de fornecimento nos próximos 90 dias.",
      "OTIF contratual de 95% com créditos por descumprimento.",
      "Índice de defeitos de no máximo 1,0% com plano de melhoria.",
      "Redução de lead time e estoque de segurança para proteger a linha.",
      "Prazo contratual que dê previsibilidade a ambos os lados.",
    ],
  },
  variaveis: [
    {
      id: "preco",
      rotulo: "Preço unitário",
      descricao: "Base do custo mensal de R$ 10.000 unidades.",
    },
    { id: "volume", rotulo: "Volume mínimo", descricao: "Compromisso mensal de compra." },
    {
      id: "duracao",
      rotulo: "Prazo contratual",
      descricao: "12 a 18 meses dão previsibilidade ao fornecedor.",
    },
    {
      id: "forecast",
      rotulo: "Forecast e janela congelada",
      descricao: "Reduz retrabalho e custo do fornecedor.",
    },
    { id: "leadtime", rotulo: "Lead time", descricao: "Prazo de entrega em dias." },
    { id: "estoque", rotulo: "Estoque de segurança", descricao: "Proteção contra ruptura." },
    {
      id: "prioridade",
      rotulo: "Prioridade de produção",
      descricao: "Posição na fila da fábrica do fornecedor.",
    },
    {
      id: "pagamento",
      rotulo: "Prazo de pagamento",
      descricao: "Caixa: encurtar é uma moeda de troca.",
    },
    { id: "otif", rotulo: "OTIF e SLA", descricao: "Meta de entrega no prazo e completa." },
    { id: "defeitos", rotulo: "Limite de defeitos", descricao: "Meta de qualidade." },
    {
      id: "creditos",
      rotulo: "Créditos por descumprimento",
      descricao: "Consequência financeira do SLA.",
    },
    { id: "garantia", rotulo: "Garantia", descricao: "Cobertura estendida do componente." },
    { id: "melhoria", rotulo: "Plano de melhoria", descricao: "Ações com prazo e responsável." },
    { id: "revisoes", rotulo: "Revisões periódicas", descricao: "Governança do contrato." },
    {
      id: "contingencia",
      rotulo: "Plano de contingência",
      descricao: "O que fazer se algo falhar.",
    },
    {
      id: "segundafonte",
      rotulo: "Segunda fonte gradual",
      descricao: "Qualificação progressiva sem ruptura.",
    },
  ],
  pesos: {
    valorComercial: 20,
    continuidade: 15,
    qualidadeRisco: 15,
    condicoesFechamento: 10,
    diagnostico: 10,
    estrategia: 10,
    concessoes: 8,
    comunicacao: 6,
    eticaProcesso: 6,
  },
};

export const AVISO_EDUCACIONAL =
  "O BuyerLab é uma simulação educacional baseada em modelos simplificados de comportamento. Seus resultados não substituem análise profissional nem preveem integralmente o comportamento humano.";
