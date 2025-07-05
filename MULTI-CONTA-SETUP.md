# 🔧 Configuração Multi-Conta - Twitter Scraping

## 🎯 Visão Geral

O sistema agora suporta **múltiplas contas** do Twitter para executar ações de forma mais **natural e orgânica**. Cada like/retweet será executado por uma conta diferente, simulando engajamento real.

## 📋 Benefícios do Sistema Multi-Conta

### ✅ Vantagens

- **Engajamento Orgânico**: Ações vindas de contas diferentes
- **Redução de Detecção**: Menos chance de ser identificado como bot
- **Distribuição Inteligente**: Rotação automática entre contas
- **Escalabilidade**: Suporte para quantas contas quiser
- **Controle Total**: Escolha quais contas usar

### 🔒 Segurança

- **Rate Limiting**: Distribui ações entre contas
- **Delays Inteligentes**: Evita padrões suspeitos
- **Isolamento**: Cada conta opera independentemente

## 🚀 Como Configurar

### 1. Formato do Arquivo

Crie ou edite o arquivo `twitter-cookies-multi.json` na raiz do projeto:

```json
{
  "accounts": [
    {
      "name": "Conta Principal",
      "username": "usuario1",
      "cookies": [
        {
          "name": "auth_token",
          "value": "SEU_AUTH_TOKEN_CONTA_1",
          "domain": ".twitter.com",
          "path": "/",
          "secure": true,
          "httpOnly": true,
          "sameSite": "None"
        },
        {
          "name": "ct0",
          "value": "SEU_CT0_CONTA_1",
          "domain": ".twitter.com",
          "path": "/",
          "secure": true,
          "httpOnly": false,
          "sameSite": "Lax"
        },
        {
          "name": "twid",
          "value": "SEU_TWID_CONTA_1",
          "domain": ".twitter.com",
          "path": "/",
          "secure": true,
          "httpOnly": false,
          "sameSite": "Lax"
        }
      ]
    },
    {
      "name": "Conta Secundária",
      "username": "usuario2",
      "cookies": [
        {
          "name": "auth_token",
          "value": "SEU_AUTH_TOKEN_CONTA_2",
          "domain": ".twitter.com",
          "path": "/",
          "secure": true,
          "httpOnly": true,
          "sameSite": "None"
        },
        {
          "name": "ct0",
          "value": "SEU_CT0_CONTA_2",
          "domain": ".twitter.com",
          "path": "/",
          "secure": true,
          "httpOnly": false,
          "sameSite": "Lax"
        },
        {
          "name": "twid",
          "value": "SEU_TWID_CONTA_2",
          "domain": ".twitter.com",
          "path": "/",
          "secure": true,
          "httpOnly": false,
          "sameSite": "Lax"
        }
      ]
    }
  ]
}
```

### 2. Obter Cookies de Cada Conta

Para cada conta que você quer usar:

#### Passo 1: Login na Conta

1. Abra uma **janela anônima** ou **perfil separado** no navegador
2. Acesse [twitter.com](https://twitter.com)
3. Faça login com a conta desejada

#### Passo 2: Extrair Cookies

1. Pressione **F12** para abrir DevTools
2. Vá para **Application** → **Storage** → **Cookies**
3. Clique em **https://twitter.com**
4. Copie os valores dos cookies importantes:
   - `auth_token`
   - `ct0`
   - `twid`

#### Passo 3: Repetir para Todas as Contas

- Use janelas anônimas/perfis diferentes
- Mantenha cada conta separada
- Não faça login em múltiplas contas simultaneamente

## 🔧 Como Funciona

### 🎯 Distribuição de Ações

#### Ações Individuais

- **Seleção Aleatória**: Escolhe uma conta aleatória
- **Execução Única**: Uma ação por clique
- **Feedback Específico**: Mostra qual conta executou

#### Ações em Lote

- **Rotação Sequencial**: Distribui ações entre contas
- **Balanceamento**: Cada conta recebe aproximadamente o mesmo número de ações
- **Relatório Detalhado**: Mostra quais contas executaram cada ação

### 📊 Exemplo de Distribuição

Com 3 contas e 9 ações:

```
Ação 1: Conta A
Ação 2: Conta B
Ação 3: Conta C
Ação 4: Conta A
Ação 5: Conta B
Ação 6: Conta C
...
```

## 🛠️ Configuração Avançada

### 📁 Estrutura de Arquivos

```
twitter-scraping/
├── twitter-cookies.json           # Formato antigo (ainda suportado)
├── twitter-cookies-multi.json     # Formato novo (multi-conta)
├── twitter-cookies.example.json   # Exemplo formato antigo
└── src/
    └── app/
        └── api/
            └── twitter-action/
                ├── route.ts        # API principal (multi-conta)
                ├── route-single.ts # Backup (conta única)
                └── route-multi.ts  # Versão multi-conta
```

### 🔄 Fallback Automático

O sistema é inteligente:

1. **Primeiro**: Tenta carregar `twitter-cookies-multi.json`
2. **Fallback**: Se não encontrar, usa `twitter-cookies.json`
3. **Compatibilidade**: Funciona com formato antigo

### ⚙️ Configurações Avançadas

#### Timeouts e Delays

```typescript
// Delays entre ações (em milissegundos)
const DELAY_BETWEEN_ACTIONS = 2000; // 2 segundos
const DELAY_BETWEEN_ACCOUNTS = 3000; // 3 segundos
const PAGE_LOAD_TIMEOUT = 10000; // 10 segundos
```

#### Seletores Personalizados

```typescript
// Seletores para diferentes elementos
const SELECTORS = {
  like: '[data-testid="like"]',
  retweet: '[data-testid="retweet"]',
  loginCheck: '[data-testid="SideNav_AccountSwitcher_Button"]',
};
```

## 🔍 Monitoramento e Logs

### 📊 Logs Detalhados

O sistema agora mostra:

- **Qual conta** executou cada ação
- **Status de cada conta** (autenticada/erro)
- **Distribuição de ações** entre contas
- **Relatórios de performance**

### 🎯 Exemplo de Log

```
🚀 Iniciando processamento em lote com múltiplas contas: 6 ações
📱 Executando like no tweet 123 com conta: Conta Principal
✅ Like executado com sucesso pela conta Conta Principal
📱 Executando retweet no tweet 456 com conta: Conta Secundária
✅ Retweet executado com sucesso pela conta Conta Secundária
```

## 🧪 Testes e Validação

### 🔬 Testar Configuração

```bash
# Testar se todas as contas estão funcionando
npm run test

# Verificar relatório detalhado
cat test-report.json
```

### 🎯 Validação Manual

1. **Execute uma busca** para encontrar tweets
2. **Configure algumas ações** em diferentes tweets
3. **Use "Enviar Todas as Ações"**
4. **Verifique no Twitter** se as ações vieram de contas diferentes

## ⚠️ Importante

### 🔒 Segurança

- **Nunca compartilhe** os cookies das suas contas
- **Use contas secundárias** para automação
- **Mantenha backup** dos cookies importantes

### 📋 Limitações

- **Máximo recomendado**: 5-10 contas por projeto
- **Rate limiting**: Twitter pode limitar ações por IP
- **Manutenção**: Cookies podem expirar

### 🎯 Boas Práticas

- **Teste com poucas ações** primeiro
- **Monitor engajamento** real vs automatizado
- **Use delays apropriados** entre ações
- **Mantenha contas ativas** normalmente

## 🆘 Troubleshooting

### ❌ Problemas Comuns

#### "Não foi possível carregar configuração de contas"

- Verificar se `twitter-cookies-multi.json` existe
- Validar formato JSON com `cat twitter-cookies-multi.json | jq .`
- Verificar se há pelo menos uma conta configurada

#### "Não foi possível autenticar com a conta X"

- Cookies podem ter expirado
- Refazer login no navegador
- Copiar novos cookies

#### "Ações não estão sendo executadas"

- Verificar se cookies são válidos
- Testar login manual no navegador
- Verificar se Twitter não bloqueou as contas

### 🔧 Comandos Úteis

```bash
# Verificar formato JSON
cat twitter-cookies-multi.json | jq .

# Backup atual
cp twitter-cookies-multi.json twitter-cookies-multi.backup.json

# Testar aplicação
npm run dev

# Executar testes
npm run test
```

## 🎉 Conclusão

O sistema multi-conta transforma sua automação em algo muito mais **natural e eficiente**:

- ✅ **Engajamento orgânico** com múltiplas contas
- ✅ **Redução de detecção** por parte do Twitter
- ✅ **Escalabilidade** para quantas contas quiser
- ✅ **Compatibilidade** com formato antigo
- ✅ **Monitoramento detalhado** de cada ação

**Configure suas contas e aproveite a automação inteligente!** 🚀

---

_Documentação atualizada: Janeiro 2024_
_Versão: 2.0.0 - Multi-Conta_
