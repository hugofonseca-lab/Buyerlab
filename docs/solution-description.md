# BuyerLab — descrição da solução

## Escopo atual: chapas de alumínio

O fluxo principal gera compras de 5052-H32, 6061-T6 e 7075-T6 com quantidades, estoque e três fornecedores variáveis por seed. Permite uma troca justificada, calcula TCO e melhor resultado viável no servidor e acompanha progresso em grupos comparáveis. Mercado estático é explicitamente fictício. A avaliação mantém 60 pontos objetivos e 40 qualitativos por evidências. Veja [arquitetura, fórmulas e demonstração](aluminum.md). O K-17 descrito adiante permanece como cenário legado para compatibilidade.

## Problema e público

Compradores corporativos precisam negociar preço, continuidade, qualidade e relacionamento sob pressão. Treinamentos passivos oferecem poucas oportunidades de praticar e receber feedback observável. Público: compradores em onboarding, profissionais preparando negociações, gestores de capacitação e instrutores.

## Solução

Uma simulação conversacional com um fornecedor fictício, limites comerciais consistentes e diagnóstico por evidências. Princípio: um cenário profundo, uma simulação realista e um feedback que ensina. Sem cadastro obrigatório.

## Cenário e funcionalidades

Orion Equipamentos compra 10.000 Módulos K-17/mês da Nexa Componentes. Preço atual R$100; proposta inicial R$118; mandato efetivo R$107. Estoque 12 dias; impacto de parada estimado em R$250 mil/dia; alternativa em 45 dias, cobrindo inicialmente 30%. Pagamento atual 45 dias; lead time 14; OTIF 91% com meta 95%; defeitos 1,8% com meta 1%. Problemas de fornecedor e mudanças tardias de forecast do comprador compõem o conflito.

Briefing, dossiê, notas privadas, negociação, oferta pública, eventos, proposta estruturada, avaliação, relatório compartilhável/imprimível, mesma seed e nova variação. Treinamento permite variações; avaliação controla condições e oculta dicas; instrutor configura link de início.

## Arquitetura e IA

TanStack Start/React/TypeScript estrito, preservando frontend Lovable. API Node/Nitro, banco SQLite e migrations. Camadas separadas: blueprint, state engine, supplier actor, evaluator e coach. O servidor decide limites, estados, sorteios, viabilidade e pontos objetivos. OpenAI Responses API com SDK oficial e Structured Outputs faz atuação verbal e avaliação qualitativa. Mock mantém fluxo sem API. Chaves apenas no servidor. Uma chamada por turno e uma no encerramento controlam custo.

Sete estados emocionais, quatro perfis, matriz de transição, degraus e eventos condicionais combinam racionalidade e emoção. PRNG por seed e registros de sorteios permitem auditoria estrutural. Respostas da IA não podem criar descontos; o motor anexa termos autorizados.

## Avaliação e aprendizagem

60 pontos objetivos: valor, continuidade, qualidade e condições. 40 qualitativos: diagnóstico, estratégia, reciprocidade, comunicação e ética. Evidências referenciam mensagens reais, com trechos literais validados. Fallback é provisório. Melhor resultado viável calculado por enumeração, perda de oportunidade e razão do acordo/impasse. Coach entrega forças, prioridades, erros e próxima ação.

## Acessibilidade

Layout responsivo, navegação por teclado, foco visível, labels, erros textuais com alertas, transcript anunciado, redução de movimento e impressão. Testes em desktop/celular complementam inspeção; não se declara certificação formal WCAG.

## Viabilidade e execução

Um cenário, sem serviços pagos obrigatórios, sem login complexo. Node com disco persistente oferece execução local simples. SQLite é adequado à demonstração em uma instância; escala serverless requer adaptador Postgres/Supabase ou equivalente. Instalar Node 22.16+ e Bun, executar `bun install --frozen-lockfile`, copiar `.env.example`, `bun run dev --port 8080`. Para produção local: `bun run build` e `bun run start`. Veja README.

## Critérios do edital

| Critério              | Evidência na solução                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Criatividade/inovação | racionalidade + emoção, perfis, eventos condicionais, seed, feedback híbrido e oportunidade calculada |
| Qualidade técnica     | contratos estritos, API autorizada, validação, persistência, testes, fallback e documentação          |
| Viabilidade           | cenário único, banco simples, mock, ausência de login, chamadas limitadas                             |
| Aplicabilidade        | onboarding, prática antes de negociação, diagnóstico e capacitação contínua                           |

## ODS

- ODS 4: prática e feedback apoiam educação e desenvolvimento profissional.
- ODS 9: experimentação e arquitetura auditável aplicadas a processos corporativos.
- ODS 10: acesso sem cadastro e demonstração sem API paga reduzem barreiras de treinamento.

Essas são contribuições pretendidas; o MVP não mediu impacto social causal.

## Limitações e evolução

Comportamento simplificado, heurísticas de classificação, avaliação qualitativa sujeita a erros, modelo financeiro sem monetização de todas as contrapartidas. Sessão depende do cookie, um processo Node, disco persistente, sem painel completo de gestão ou retenção. API real precisa ser validada com credenciais. Evoluções: calibração pedagógica com especialistas, estudos de aprendizagem, adaptador distribuído, governança de retenção e melhores recursos do instrutor. Sem novos cenários, voz, avatar, ranking, certificados ou integrações ERP no MVP.

O BuyerLab é uma simulação educacional baseada em modelos simplificados de comportamento. Seus resultados não substituem análise profissional nem preveem integralmente o comportamento humano.

## Organização da entrega

Build revisável até 17/09/2026 às 17h; orientação às 18h; conclusão interna no dia 17; submissão prevista em 18/09 às 07h, conforme prazo informado pelo proponente. Este trabalho não realiza submissão, envio de documentos, gravação/publicação de vídeo ou commit.
