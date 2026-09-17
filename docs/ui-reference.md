# Referência da interface

Referência usada: [BuyerLab no GitHub, commit 383fb1d](https://github.com/lukinhabaia/buyerlab-simulator/tree/383fb1d70b3a7821c1171f819da301dab3244892), atualização do Lovable consultada em 16/09/2026.

Foram recuperados os componentes e a organização desta versão: home, navegação, dossiê com abas, cartões de mercado e fornecedores, chat com painel lateral, diálogo de troca, proposta, diagnóstico, filtros do histórico e curva de aprendizado.

`src/simulation/lovable-view.ts` adapta exclusivamente os dados públicos do servidor aos contratos de apresentação em `src/domain/lovable-ui.ts`. `use-lovable-run.ts` conserva a API persistente. `lovable-history.ts` filtra tentativas e impede curvas com grupos incompatíveis. O servidor continua responsável por preços, estado, acordo e notas. As telas legadas ficam em `src/components/buyerlab/legacy/`.

Textos operacionais refletem a implementação real: armazenamento no servidor, cotação fictícia, preços em BRL, avaliação provisória quando houver fallback e compartilhamento por token. Dados comerciais são os da instância; não se copiam preços, fornecedores demonstrativos ou histórico inventado da referência.

## Conferência

Após a integração de cotações solicitada em 16/09/2026, o painel de mercado acrescenta data, fonte, links e avisos por indicador. Essa alteração intencional não existe no commit de referência; a aba de mercado é validada funcionalmente em `e2e/aluminum.spec.ts`, e não por igualdade de imagem com aquele commit.

`e2e/lovable-reference.spec.ts` compara capturas com uma cópia isolada da referência, servida localmente. A home é comparada integralmente. Dossiê e chat recebem os mesmos dados públicos nos dois frontends; a explicação operacional das notas é mascarada na comparação do chat porque o mecanismo de armazenamento difere. Nenhum estado privado é usado nessa preparação.

```powershell
$env:LOVABLE_REFERENCE_URL = 'http://127.0.0.1:8081'
bun run build
bun run test:e2e
```

Sem `LOVABLE_REFERENCE_URL`, apenas as comparações com a referência externa ficam desabilitadas; os testes funcionais continuam ativos. A comparação usa a mesma versão do navegador e o mesmo viewport, em desktop e celular. A home exige capturas idênticas. As telas dinâmicas exigem dimensões idênticas e toleram até 0,005% de pixels diferentes para suavização isolada de caracteres.

## Testar o novo fluxo

Inicie com `bun run dev --port 8080`. A configuração segue o layout do GitHub e o material é escolhido pela seed. Para fixar uma liga na demonstração, abra:

`http://localhost:8080/configurar?cenario=aluminum&material=6061-T6&perfil=colaborativo&dif=iniciante&urgencia=baixa&seed=AL-DEMO`

No dossiê, use as abas **Contexto de mercado** e **Fornecedores**. No chat, **Avaliar outro fornecedor** abre o diálogo com alternativas e justificativa. A proposta e o diagnóstico continuam persistidos no servidor.
