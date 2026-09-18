# Cotações externas

Treinamentos novos de alumínio consultam o mercado no servidor. A PTAX é a taxa de venda USD/BRL do Banco Central, última publicação nos sete dias anteriores. O painel mostra a data efetiva: fim de semana e ausência de publicação não são apresentados como cotação do dia.

## Fontes

- [Banco Central — PTAX](https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/aplicacao): público, sem chave. `CotacaoDolarPeriodo`, ordenação decrescente e uma observação.
- **Índice de produção**: IBGE SIDRA, tabela 8888 (PIM-PF, base 2022=100), variável 12606, categoria 129333 ("3.24 Metalurgia") — mede a atividade do setor que produz o próprio material negociado, não a indústria geral. Público, sem chave. Série mensal; a checagem de desatualização usa 100 dias.
- **Alumínio**, em ordem de prioridade:
  1. [Alpha Vantage](https://www.alphavantage.co/documentation/#aluminum) (`ALPHA_VANTAGE_API_KEY`): mesma fonte e chave do painel "Indicadores de mercado" abaixo, para as duas telas nunca mostrarem cotações diferentes. Série mensal (FMI); a checagem de desatualização usa 100 dias em vez de 7, porque dado mensal naturalmente tem semanas de defasagem.
  2. [Metals.Dev](https://metals.dev/docs) (`METALS_DEV_API_KEY`): usado só se não houver chave do Alpha Vantage. `latest`, USD, `mt`, campo `metals.aluminum`.
  3. [Croncopia](https://croncopia.com/): agregador público sem chave, último recurso. Na verificação de 16/09/2026, seu último dado era de 18/07/2026 e foi rejeitado por desatualização — não garante cotação diária nem é LME oficial.

## Configuração

Em `.env`, use `BUYERLAB_MARKET_PROVIDER=live` (padrão). Para ensaios offline, `static`. Configure `ALPHA_VANTAGE_API_KEY` e/ou `METALS_DEV_API_KEY` e reinicie o servidor. Nunca envie a chave no chat, URL da aplicação ou variável `VITE_`.

Timeout de cinco segundos por fonte, consultas paralelas e deduplicadas. Cache em memória de um dia (falhas são consultadas novamente após cinco minutos) — PTAX fica fixa após publicada e o alumínio do Alpha Vantage e o índice de metalurgia do IBGE são mensais, então um cache mais curto só gastaria a cota diária de 25 requisições da chave gratuita do Alpha Vantage. Mudança de dia em Brasília também invalida o cache. Cada fonte falha independentemente: a última referência real conhecida é preservada com sua data; na ausência dela, usa-se valor explicitamente SIMULADO. Uma falha ou dado desatualizado, data futura, moeda/unidade inválida ou valor fora da faixa econômica suportada é sinalizada no painel. Não há polling por turno.

Faixas suportadas pela fórmula atual: USD/BRL 2,50–7,50 e alumínio 1.200–3.600 USD/t. Ampliá-las exige revisar o blueprint e os testes; o sistema não ajusta silenciosamente uma cotação real.

## Reprodutibilidade

O snapshot público, com valores, datas, fontes e hash, fica persistido dentro da execução no Postgres. Retomar ou repetir a mesma seed mantém esse snapshot. Nova variação de treinamento consulta o provedor novamente, respeitando o cache. Criar manualmente outra execução com o mesmo texto de seed em outro dia pode usar mercado diferente: a reprodução completa exige seed, configuração, versões **e snapshot**.

Avaliações padronizadas usam o snapshot estático para manter comparabilidade. Relatórios de treinamento com dados externos são agrupados também pelo hash do mercado. Execuções existentes não são atualizadas retroativamente.

O preço de uma chapa continua sendo uma construção educacional com prêmio de conversão, liga, condições e frete. A cotação do alumínio primário não é preço de compra real da chapa 7075-T6.

## Validação

`tests/live-market.test.ts` cobre moedas/unidades, fontes inválidas, datas antigas/futuras, cache, concorrência, fallback, ausência de chave na saída e reprodução do cenário. A suíte automatizada usa `BUYERLAB_MARKET_PROVIDER=static`, sem dependência de rede. A consulta real de PTAX em 16/09/2026 retornou **5,1527 BRL/USD**, com data de publicação 16/09/2026. Alumínio diário continua dependente de fonte pública atualizada ou chave própria do conector opcional.

## Painel "Indicadores de mercado" do dossiê

Independente do benchmark acima, a home pública (`/`) e o topo do dossiê (`/preparacao/:runId`) exibem `src/components/buyerlab/market-indicators-panel.tsx`, alimentado por `GET /api/market-indicators` (`src/server/market-indicators.server.ts`): PTAX, alumínio, produção industrial geral e países fornecedores. Não influencia o motor de negociação nem a pontuação; é apenas contexto informativo.

### Fontes

- **PTAX** (compra/venda): Banco Central — Olinda, `CotacaoDolarDia`, público, sem chave. Fim de semana/feriado sem publicação: o serviço tenta até 10 dias anteriores até achar a última cotação publicada.
- **Alumínio**: [Alpha Vantage](https://www.alphavantage.co/documentation/#aluminum), `function=ALUMINUM`, série mensal (FMI). Exige chave gratuita própria em `ALPHA_VANTAGE_API_KEY` (tier gratuito: 25 requisições/dia, 5/min — nunca commitar a chave). Sem chave, o indicador aparece como **SIMULADO**. Uma única chamada devolve o valor atual e o histórico mensal usado na projeção, por isso o cache é diário (evita estourar a cota).
- **Produção industrial**: IBGE SIDRA, tabela **8888** (Pesquisa Industrial Mensal — Produção Física, PIM-PF, base 2022=100), variável **12606** ("Número-índice"), classificação `544` categoria `129314` ("1 Indústria geral"), território `N1[1]` (Brasil). Pública, sem chave. Este é o índice **geral** (todos os setores); não confundir com o índice de **Metalurgia** (categoria `129333`) usado no benchmark do motor de negociação — ver seção acima. O IBGE reformulou a PIM-PF em 2021/2022; se a tabela for descontinuada ou os IDs mudarem, atualize as constantes `SIDRA_TABLE`/`SIDRA_VARIABLE`/`SIDRA_CLASSIFICATION` em `market-indicators.server.ts` e este documento.
- **Países fornecedores**: [MDIC Comex Stat](https://comexstat.mdic.gov.br/pt/geral), importação por país da NCM `7606.12.90` (chapas de ligas de alumínio). Pública, sem chave. Conta países distintos que exportaram esse material para o Brasil no mês mais recente; mostra a lista completa de países na interface. É um proxy de diversificação/concentração da cadeia de fornecimento, não uma contagem de empresas (dado por empresa não é público em estatísticas de comércio exterior).

### Cache, fallback e projeção

Cache diário em memória por instância do processo; falhas de qualquer fonte são retentadas após 5 minutos. Cada fonte falha de forma independente: se uma cair, as outras três continuam atualizando normalmente. Ao falhar, o indicador preserva o último valor real conhecido (marcado como desatualizado) ou, sem histórico algum, usa um valor simulado — a tela nunca quebra. O endpoint sempre responde 200 com um campo `warnings` listando o que falhou.

A projeção de tendência (`linearProjection` em `market-indicators.server.ts`) é uma regressão linear simples sobre até 12 meses de histórico, extrapolada para os 3 meses seguintes. A interface rotula isso explicitamente como "estimativa baseada em tendência histórica", não uma previsão oficial de mercado.

### Validação

`tests/market-indicators.test.ts` cobre o parsing de cada fonte (PTAX com fallback de dia útil, Alpha Vantage, SIDRA, Comex Stat), a queda para simulado sem `ALPHA_VANTAGE_API_KEY`, a preservação de cache por indicador após falha e a regressão linear de projeção.
