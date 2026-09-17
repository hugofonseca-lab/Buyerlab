# Segurança e privacidade

Alumínio: configurações privadas de candidatos ficam no servidor. A troca valida candidato, turno, idempotência e limite de uma por execução. O ator recebe somente a conversa do fornecedor ativo; eventos são associados ao fornecedor de origem. Histórico e suas consultas exigem o cookie proprietário. Snapshot de mercado é fictício e versionado; detalhes em [Alumínio](aluminum.md).

- Sessão: token criptográfico de 256 bits; cookie HttpOnly, SameSite=Strict, Secure em HTTPS, 30 dias; hash no banco.
- Autorização: consultas incluem proprietário. Conhecer UUID não dá acesso.
- Banco: SQLite exclusivo do servidor, fora de assets. Não suporta RLS; autorização é aplicada na API. Nenhuma leitura pública de estados, regras privadas ou sorteios.
- Compartilhamento: ação explícita cria token de 256 bits, hash armazenado, validade de sete dias. Só relatório, sem notas ou conversa completa. Os trechos de evidência fazem parte do relatório compartilhado.
- CSRF: POST exige JSON e Origin igual à aplicação. Respostas `no-store`, relatório sem indexação/referrer.
- Entrada: Zod estrito, mensagens 2.000 caracteres, notas 8.000, corpo 16 KiB, turnos 8/10/12. Rate limit persistente: 300 solicitações globais/minuto, 60 por sessão/minuto.
- Idempotência: UUID + hash do corpo, resposta gravada junto ao estado. Turno esperado protege múltiplas abas.
- IA: chave/modelo somente servidor; contexto limitado, `store:false`, timeout e uma repetição. Não solicita nem armazena cadeia de raciocínio.
- Prompt injection: pedidos de prompt, mínimo, administrador, nota e quebra de regras recebem recusa antes da API. Valores privados não são enviados ao modelo.
- Saída: Structured Outputs, comparação da oferta e allowlist. Valores comerciais anexados pelo motor. React renderiza texto sem executar HTML/scripts da conversa.

## Operação e limites

Não versionar `.env`, `.data`, cookies, tokens ou logs. HTTPS e permissões de disco restritas. Uma instância Node com volume persistente. Administrador do servidor consegue ler transcrições/notas no banco: “privado” significa isolado de outros participantes e do compartilhamento, não criptografado contra o operador.

Expiração do acesso não apaga registros. Retenção, exclusão individual, revogação antecipada de links, antiabuso distribuído e backup automatizado exigem evolução antes de uso público amplo. Não inserir informações reais/proprietárias.

Testes cobrem ataques solicitados, schema inválido, timeout, fallback, sessões, CSRF, tamanho, limites e compartilhamento. Isso não equivale a auditoria completa. A integração real OpenAI requer chave e modelo válidos; não foi exercitada com credenciais reais neste ambiente. A integração Gemini foi validada com uma chave real (`gemini-3.1-flash-lite`): negociação completa (mensagens, finalização e avaliação), com fallback automático para mock observado em picos de indisponibilidade/limite de taxa da conta gratuita — nunca quebrou a execução.
