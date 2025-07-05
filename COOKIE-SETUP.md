# 🔧 Guia Completo para Configurar Cookies do X (Twitter)

## 📋 Problema Comum

Se você está recebendo o erro "Não foi possível fazer login no Twitter", isso significa que os cookies não estão válidos ou completos.

## 🛠️ Solução Passo a Passo

### 1. **Fazer Login no X (Twitter)**

1. Abra o navegador (Chrome recomendado)
2. Acesse [https://x.com](https://x.com) (novo domínio do Twitter)
3. Faça login com suas credenciais
4. Certifique-se de que está logado corretamente

### 2. **Abrir Ferramentas de Desenvolvedor**

1. Pressione `F12` ou `Ctrl+Shift+I` (Windows/Linux) ou `Cmd+Option+I` (Mac)
2. Vá para a aba **Application** (Chrome) ou **Storage** (Firefox)

### 3. **Encontrar os Cookies**

1. No painel esquerdo, clique em **Cookies**
2. Clique em **https://x.com** (o novo domínio)
3. Você verá uma lista de cookies

### 4. **Copiar os Cookies Essenciais**

Copie os seguintes cookies (se existirem):

#### **Cookies Obrigatórios:**

- `auth_token` - Token de autenticação principal
- `ct0` - Token CSRF
- `twid` - ID do usuário

#### **Cookies Opcionais (mas recomendados):**

- `att` - Token de autenticação adicional
- `kdt` - Token de dados do usuário
- `remember_checked_on` - Lembrar login

### 5. **Formato Correto para o Arquivo**

Substitua o conteúdo do arquivo `twitter-cookies.json` pelo seguinte formato:

```json
[
  {
    "name": "auth_token",
    "value": "SEU_VALOR_AQUI",
    "domain": ".x.com",
    "path": "/",
    "secure": true,
    "httpOnly": true,
    "sameSite": "None"
  },
  {
    "name": "ct0",
    "value": "SEU_VALOR_AQUI",
    "domain": ".x.com",
    "path": "/",
    "secure": true,
    "httpOnly": false,
    "sameSite": "Lax"
  },
  {
    "name": "twid",
    "value": "SEU_VALOR_AQUI",
    "domain": ".x.com",
    "path": "/",
    "secure": true,
    "httpOnly": false,
    "sameSite": "Lax"
  }
]
```

## 🔍 Verificação

Após configurar os cookies:

1. Salve o arquivo
2. Teste a aplicação
3. Se ainda não funcionar, verifique se:
   - Os cookies estão corretos
   - Você está logado no X (Twitter)
   - Os cookies não expiraram

## ⚠️ Importante

- Cookies do X (Twitter) expiram periodicamente
- Nunca compartilhe seus cookies publicamente
- Se os cookies pararem de funcionar, repita o processo
- O Twitter agora usa o domínio x.com

## 🆘 Problemas Comuns

### "Redirecionado para página de login"

- Seus cookies expiraram
- Refaça o login no X (Twitter)
- Extraia novos cookies

### "Timeout" ou "Elemento não encontrado"

- X (Twitter) pode ter mudado a estrutura
- Tente com uma busca mais específica
- Verifique se há tweets para o termo buscado

### "Não foi possível fazer login"

- Cookies incompletos ou inválidos
- Certifique-se de copiar o `auth_token` correto
- Verifique se está logado no X (Twitter)

## 💡 Dicas Extras

1. Use sempre cookies recentes (copiados há pouco tempo)
2. Mantenha-se logado no X (Twitter) enquanto usa a aplicação
3. Se possível, use navegador privado para evitar conflitos
4. Cookies funcionam melhor se copiados do mesmo navegador/dispositivo
5. **IMPORTANTE**: Use o domínio x.com, não twitter.com
