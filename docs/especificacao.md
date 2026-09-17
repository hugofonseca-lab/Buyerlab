# Especificação resumida do BuyerLab

> Documento histórico do protótipo Lovable. As seções sobre persistência local e backend futuro foram substituídas pela implementação v2 descrita em [architecture.md](architecture.md), [scoring.md](scoring.md) e [security.md](security.md). Estado privado agora existe somente no servidor; o frontend usa ApiSimulationProvider.

## Objetivo

Preparar compradores corporativos para negociar melhor antes da mesa real, combinando um cenário profundo, comportamento de fornecedor consistente e diagnóstico baseado em evidências.

## Cenário do MVP

A Orion Equipamentos consome 10.000 unidades mensais do Módulo K-17, fornecido pela Nexa Componentes. O preço vigente é R$ 100,00 e a Nexa propõe R$ 118,00. A Orion possui limite efetivo de R$ 107,00, estoque para cerca de 12 dias e risco de parada de R$ 250 mil por dia. A segunda fonte levaria 45 dias para ser qualificada e cobriria inicialmente 30% da demanda.

## Módulos

- Apresentação e configuração sem login.
- Dossiê com mandato, contrato, desempenho e riscos.
- Sala de negociação com chat, proposta pública, eventos e notas privadas.
- Proposta final estruturada.
- Diagnóstico de 100 pontos: 60 determinísticos e 40 qualitativos por evidências.
- Repetição da mesma seed, nova variação, link e impressão.

## Motor mock

O motor usa PRNG determinístico por seed, quatro perfis, sete estados privados de 0 a 100, classificador heurístico de movimentos do comprador, escada de concessões e eventos com pré-requisitos. A probabilidade jamais ultrapassa os limites comerciais. Pedidos para revelar prompt, estado ou preço secreto são recusados.

## Contratos

Os contratos `ScenarioBlueprint`, `SupplierPrivateConfig`, `SimulationRun`, `PublicNegotiationState`, `PrivateNegotiationState`, `NegotiationMessage`, `StructuredFinalOffer` e `EvaluationReport` ficam separados da apresentação. O contrato `SimulationProvider` permite substituir o mock por uma API sem reescrever as telas.

## Privacidade e evolução

Na versão 2, os dados fictícios são persistidos no SQLite do servidor. Configuração e estado privado não são enviados ao frontend. Sessão por cookie HttpOnly controla acesso; relatórios usam tokens próprios. A implementação local do protótipo foi substituída, mantendo as telas. Nenhuma chave secreta é utilizada pelo frontend.
