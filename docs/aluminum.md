# Alumínio: domínio, comparação e avaliação

## Arquitetura

O frontend TanStack/Lovable permanece. `aluminum.server.ts` gera a instância e configurações privadas a partir de material, seed, dificuldade, urgência, versão e snapshot. `market.server.ts` valida snapshots; `live-market.server.ts` consulta fontes externas com timeout, cache e fallback identificado. `engine.server.ts` autoriza concessões e troca. `providers.server.ts` usa o SDK oficial OpenAI Responses com Structured Outputs; o mock mantém o fluxo disponível. `sourcing-score.server.ts` decide viabilidade, TCO e pontuação objetiva. `history.server.ts` agrupa progresso.

O ator recebe somente a conversa e o contexto do fornecedor ativo. Nunca decide concessões, mercado, seed, troca, acordo ou pontos objetivos. O avaliador qualitativo recebe evidências das conversas e a decisão de sourcing; o servidor valida IDs, trechos e limites. Não há chamada de mercado por turno.

## Geração reproduzível

Materiais: 5052-H32, 6061-T6 e 7075-T6. Compra de 8–35 t; demanda de 6–30 t/mês. Estoque: urgência alta 7–12 dias, média 13–21 e baixa 22–30. A data necessária deriva da data do snapshot e da cobertura. As exigências técnicas são simplificações fictícias do desenho da Orion, não especificações para compras reais.

Três candidatos: incumbente nacional mais previsível; importador de menor preço com entrega e homologação longas; alternativa nacional com certificação pendente e capacidade variável. Existe uma rota comercial viável com o incumbente. O importador não atende sozinho a urgência deste exercício: seu preço menor não implica decisão melhor.

O blueprint concentra regras comerciais no servidor. Alterações precisam incrementar a versão e repetir os testes. A mesma seed exige também os mesmos parâmetros e versões para reproduzir as condições estruturais; o texto da IA pode variar.

## Mercado e benchmark

Snapshot simulado v1, 16/09/2026: USD/BRL 5,20; alumínio 2.500 USD/t; índice industrial 105. Nenhum valor é apresentado como cotação oficial. URLs são nulas; fonte e status ficam visíveis. Hash SHA-256 verifica consistência do snapshot, não autenticidade de fonte externa.

Preço de referência = base × (1 + exposição cambial × variação cambial + exposição à commodity × variação da commodity + exposição industrial × variação industrial) + conversão + frete. Bases comparativas dos indicadores: 5,00; 2.400; 100. Exposições são definidas por material. Resultado limitado ao intervalo de 50%–200% da base. Meta é a referência; teto do comprador é 108% dela.

Treinamentos novos usam o provedor externo descrito em [market-data.md](market-data.md), com cache de um dia, fontes e datas por indicador. O snapshot estático acima permanece para avaliações, testes e fallback explicitamente identificado. Retry mantém o mercado original. A disponibilidade de alumínio diário sem chave não é garantida.

Desde a integração com o Alpha Vantage e o IBGE, os três indicadores do benchmark podem vir reais simultaneamente (`status: "real"` no snapshot): PTAX, alumínio (mesma fonte do painel de indicadores) e o índice de produção — este último agora é o PIM-PF de Metalurgia (categoria específica do setor que produz o material, não a indústria geral), com folga de defasagem de 100 dias por ser dado mensal.

## TCO e sourcing

TCO = preço autorizado × quantidade comprada + custo de troca + provisão cambial + estoque de segurança + parada sem cobertura.

- Provisão cambial = custo do material × exposição do fornecedor × estresse didático de 10%.
- Estoque negociado custa 1% do material e acrescenta três dias de cobertura.
- Chegada = lead time + homologação + 0,5 dia por turno transcorrido até a troca. O tempo de negociação só penaliza a decisão de troca neste modelo simplificado.
- Parada = dias sem cobertura × impacto diário da instância.
- Os cartões mostram estimativas iniciais sem estoque/parada; a prévia ativa e o relatório incluem esses componentes.

O benchmark enumera candidatos e degraus com contrapartidas excepcionais, considerando troca no início. Rejeita pacotes fora de capacidade, MOQ, orçamento, qualidade, prazo ou homologação. É uma referência de oportunidade, não uma concessão automaticamente disponível. A proposta real precisa respeitar a oferta atual autorizada e aceitação explícita.

Pontuação objetiva: valor 20, continuidade 15, qualidade/risco 15, condições 10. Sem acordo válido, a parcela objetiva é zero; a aprendizagem qualitativa pode pontuar. Trocar não gera bônus por si só. Os 40 pontos qualitativos existentes consideram diagnóstico, estratégia, reciprocidade, comunicação e ética com evidências. Não há nota adicional de sourcing somada aos 100.

## Contrato atual com o fornecedor

Cada instância gera, junto com os três candidatos, um contrato hipotético/mockado já vigente com o fornecedor incumbente (`generateSupplierContract` em `aluminum.server.ts`): categoria de compra, valor total, vigência, condição de reajuste (IPCA, câmbio ou índice de commodity, sorteada pela seed), SLA de entrega, histórico de pontualidade/qualidade e cláusula de rescisão/multa. Não é uma integração real com nenhum fornecedor — é dado do exercício, coerente com o material e com os atributos já gerados do fornecedor incumbente (lead time, OTIF, rejeição). Determinístico pela mesma seed; validado por `validateGenerated`.

## Persistência e segurança

`002_aluminum.sql` cria tabelas de materiais, templates, mercado, instâncias, candidatos e trocas, sem apagar dados antigos. `003_supplier_contracts.sql` acrescenta o contrato atual do fornecedor, vinculado à instância do cenário. A execução também guarda seu documento completo versionado. Instância, candidatos, contrato e mercado são inseridos uma vez; o estado de cada relação é independente.

GET `/api/simulations/:id/suppliers`, `/supplier-conversations`, `/contrato`, `/api/history`, `/api/history/summary` e `/api/history/:id` exigem a sessão proprietária. POST `/api/simulations` com `action: switch` exige idempotency-key, turno esperado, candidato válido e justificativa de 12–500 caracteres. Uma troca por execução. Configurações privadas nunca entram no snapshot público. Compartilhamento continua por token de relatório.

Histórico compara rubrica, dificuldade, modo, material, escala e avaliação IA/regras. Exibe média móvel das últimas três tentativas e só calcula evolução com pelo menos duas. É um indicador didático, não validação psicométrica nem prova causal de aprendizagem.

## Demonstração de até cinco minutos

1. 0:00–0:30: problema de compras, continuidade e preço aparente.
2. 0:30–1:15: configurar 6061-T6, iniciante, baixa urgência, seed AL-DEMO; conferir briefing e mercado fictício.
3. 1:15–2:30: comparar três candidatos; perguntar custos/capacidade; oferecer contrato, forecast e pagamento em troca de concessão.
4. 2:30–3:15: demonstrar uma troca justificada e seu impacto. Para uma execução focada em acordo, permanecer no incumbente e negociar seis turnos construtivos.
5. 3:15–4:15: revisar e aceitar explicitamente o pacote; mostrar TCO, evidências, oportunidade e nota híbrida (ou provisória no mock).
6. 4:15–5:00: histórico, retry da mesma seed, compartilhar/imprimir; concluir com aplicabilidade em onboarding e capacitação.

## Limitações

Dados e comportamento simplificados; sem mercado ao vivo, autenticação multidevice ou verificação documental real. SQLite exige um processo Node e disco persistente. Uso real da OpenAI depende de chave/modelo no servidor e não é garantido pelo teste mock. O BuyerLab é uma simulação educacional baseada em modelos simplificados de comportamento. Seus resultados não substituem análise profissional nem preveem integralmente o comportamento humano.
