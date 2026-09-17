$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Write-Host 'Crie um token GitHub com acesso somente ao repositorio BuyerLab.'
Write-Host 'Cole o token no campo oculto abaixo. Nao o envie no chat.'
$secureToken = Read-Host 'Token GitHub' -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
    $githubToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
    if ([string]::IsNullOrWhiteSpace($githubToken)) { throw 'Token vazio.' }
    $githubToken = $githubToken.Trim()
    if ($githubToken -notmatch '^(github_pat_|ghp_)[A-Za-z0-9_]+$') {
        throw 'Formato inesperado. Copie o token completo diretamente do GitHub, sem aspas, asteriscos, espacos ou barras invertidas. Cole com Ctrl+Shift+V ou botao direito no terminal.'
    }
    $headers = @{ Authorization = "Bearer $githubToken"; Accept = 'application/vnd.github+json'; 'User-Agent' = 'BuyerLab-MCP-Setup' }
    try {
        $account = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $headers -TimeoutSec 20
    } catch {
        # Nunca imprimir a excecao original, cabecalhos ou corpo da requisicao.
        $response = $_.Exception.Response
        $statusCode = if ($null -ne $response) { [int]$response.StatusCode } else { 0 }
        switch ($statusCode) {
            401 { throw 'GitHub respondeu HTTP 401: token recusado. Ele pode estar incompleto, expirado ou revogado. Copie novamente um token valido diretamente do GitHub.' }
            403 { throw 'GitHub respondeu HTTP 403: acesso bloqueado por permissao, politica da conta/organizacao ou limite de requisicoes. Verifique as restricoes do token no GitHub.' }
            429 { throw 'GitHub respondeu HTTP 429: limite de requisicoes. Aguarde antes de tentar novamente.' }
            0 { throw 'Sem resposta HTTP do GitHub: verifique internet, proxy, VPN, firewall ou certificado TLS e tente novamente. O token ainda nao foi validado.' }
            default { throw "GitHub respondeu HTTP ${statusCode}. A validacao nao foi concluida. Informe apenas este codigo de erro, nunca o token." }
        }
    }
    # Persistido no ambiente do usuario Windows, nao em arquivos do repositorio.
    # Variaveis de ambiente nao sao um cofre criptografado.
    [Environment]::SetEnvironmentVariable('GITHUB_PAT_TOKEN', $githubToken, 'User')
    Write-Host "Token validado para $($account.login). Feche completamente o VS Code e abra novamente."
    Write-Host 'A validacao da conta nao comprova acesso ao repositorio; isso sera verificado pelo MCP.'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
    $githubToken = $null
    $headers = $null
    $secureToken.Dispose()
}
