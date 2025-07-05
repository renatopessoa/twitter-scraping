# 🔧 Correção de Timeout - Sistema de Busca do Twitter

## ❌ Problema Identificado

**Erro Original:**

```
Erro: Erro durante a busca: page.waitForSelector: Timeout 15000ms exceeded.
Call log: - waiting for locator('article[data-testid="tweet"]') to be visible
```

**Causas do Problema:**

1. **Timeout muito baixo** (15 segundos)
2. **Seletores desatualizados** do Twitter
3. **Estratégia de detecção única** sem fallbacks
4. **User-Agent básico** causando bloqueios

## ✅ Correções Implementadas

### 🔄 **1. Múltiplos Seletores com Fallback**

**Antes:**

```typescript
await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 });
```

**Depois:**

```typescript
const tweetSelectors = [
  'article[data-testid="tweet"]',
  'article[data-testid="tweetish"]',
  'article[role="article"]',
  '[data-testid="cellInnerDiv"]',
  '.css-1dbjc4n[data-testid="tweet"]',
  'div[data-testid="tweet"]',
];

// Tenta cada seletor até encontrar tweets
for (const selector of tweetSelectors) {
  try {
    await page.waitForSelector(selector, { timeout: 10000 });
    const count = await page.locator(selector).count();
    if (count > 0) {
      usedSelector = selector;
      tweetsFound = true;
      break;
    }
  } catch {
    continue; // Tenta próximo seletor
  }
}
```

### ⏱️ **2. Timeout Aumentado e Inteligente**

**Melhorias:**

- **Timeout principal:** 15s → 30s
- **Timeout por seletor:** 10s cada
- **Aguarda adicional:** 10s se nenhum seletor funcionar
- **Fallback final:** Seletores mais genéricos

### 🎭 **3. User-Agent e Contexto Melhorados**

**Antes:**

```typescript
const context = await browser.newContext();
```

**Depois:**

```typescript
const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  viewport: { width: 1920, height: 1080 },
});
```

### 🔍 **4. Extração de Dados Robusta**

**Melhorias na Extração:**

```typescript
// ID do Tweet - Múltiplas tentativas
let tweetId = null;

// Tentativa 1: Link direto
const tweetLink = tweet.querySelector('a[href*="/status/"]');
if (tweetLink) {
  tweetId = tweetLink.href.split("/status/")[1].split("?")[0];
}

// Tentativa 2: Atributos do elemento
if (!tweetId) {
  const tweetIdAttr = tweet.getAttribute("aria-labelledby");
  if (tweetIdAttr) {
    tweetId = tweetIdAttr.split("-").pop();
  }
}

// Tentativa 3: Busca na árvore DOM
if (!tweetId) {
  const allLinks = tweet.querySelectorAll('a[href*="/status/"]');
  for (const link of allLinks) {
    const href = link.getAttribute("href");
    if (href && href.includes("/status/")) {
      tweetId = href.split("/status/")[1].split("?")[0];
      break;
    }
  }
}
```

### 📊 **5. Debug e Monitoramento**

**Informações de Debug Adicionadas:**

```typescript
return NextResponse.json({
  tweets,
  query,
  sortBy,
  total: tweets.length,
  accounts_available: config.accounts.length,
  search_account: searchAccount.name,
  debug: {
    selector_used: usedSelector, // Qual seletor funcionou
    total_found: tweets.length, // Quantos tweets encontrados
    url: currentUrl, // URL atual da página
    error: errorMessage, // Mensagens de erro da página
  },
});
```

### 🔄 **6. Estratégia de Fallback Completa**

**Sequência de Tentativas:**

1. **Seletores Primários** (data-testid específicos)
2. **Seletores Secundários** (role e CSS)
3. **Aguarda Adicional** (10s extra)
4. **Seletores Genéricos** (article, div genéricos)
5. **Captura de Screenshot** (para debug)
6. **Retorno Gracioso** (com informações de debug)

## 🧪 Como Testar as Correções

### **Teste Automatizado:**

```bash
# Executar teste específico de timeout
npm run test:timeout

# Teste geral do sistema
npm run test

# Teste multi-conta
npm run test:multi
```

### **Teste Manual via Interface:**

1. **Inicie a aplicação:**

   ```bash
   npm run dev
   ```

2. **Acesse:** `http://localhost:3000`

3. **Digite uma busca** (ex: "javascript", "react", "typescript")

4. **Clique em "Buscar Tweets"**

5. **Observe os logs** no terminal para ver qual seletor foi usado

### **Teste via API Direta:**

```bash
curl -X POST http://localhost:3000/api/twitter-action \
  -H "Content-Type: application/json" \
  -d '{"query":"javascript","sortBy":"recent"}'
```

## 📋 Indicadores de Sucesso

### ✅ **Busca Funcionando:**

```
✅ Encontrados X elementos com seletor: article[data-testid="tweet"]
✅ Encontrados X tweets válidos
```

### ⚠️ **Fallback Ativado:**

```
❌ Seletor article[data-testid="tweet"] não funcionou
✅ Fallback: encontrados X elementos com: article[role="article"]
```

### 🔍 **Debug Information:**

```json
{
  "debug": {
    "selector_used": "article[data-testid=\"tweet\"]",
    "total_found": 5,
    "url": "https://twitter.com/search?q=javascript&f=live"
  }
}
```

## 🚨 Troubleshooting

### **Se ainda ocorrerem timeouts:**

1. **Verifique as contas:**

   ```bash
   # Validar sessões existentes
   npm run validate:sessions

   # Detectar novas sessões
   npm run detect:auto
   ```

2. **Teste com timeout maior:**

   - Modifique o timeout no código para 45s ou 60s
   - Teste com modo visual: `npm run detect:visual`

3. **Verifique logs detalhados:**

   - Os logs mostrarão qual seletor está sendo testado
   - Capturas de tela são salvas em caso de erro

4. **Teste com diferentes queries:**
   - Termos simples: "javascript", "react"
   - Termos populares geralmente funcionam melhor

### **Se nenhum tweet for encontrado:**

1. **Verifique autenticação:**

   - Cookies podem ter expirado
   - Refaça login no Twitter
   - Execute `npm run detect:auto`

2. **Teste busca manual:**

   - Acesse Twitter no navegador
   - Faça a mesma busca manualmente
   - Verifique se há resultados

3. **Verifique rate limiting:**
   - Twitter pode estar limitando requests
   - Aguarde alguns minutos entre tentativas

## 🎯 Resultados Esperados

### **Antes da Correção:**

- ❌ Timeout após 15 segundos
- ❌ Falha total se seletor não funcionasse
- ❌ Sem informações de debug
- ❌ User-Agent básico causando bloqueios

### **Após a Correção:**

- ✅ Múltiplas tentativas de seletores
- ✅ Timeout inteligente e aumentado
- ✅ Fallbacks automáticos
- ✅ Informações detalhadas de debug
- ✅ User-Agent melhorado
- ✅ Capturas de tela para debug

## 🎉 Conclusão

As correções implementadas resolvem o problema de timeout através de:

1. **🔄 Redundância:** Múltiplos seletores como backup
2. **⏱️ Timeouts Inteligentes:** Mais tempo e estratégia escalonada
3. **🎭 Naturalidade:** User-Agent e viewport realistas
4. **🔍 Debug:** Informações detalhadas para troubleshooting
5. **🛡️ Robustez:** Fallbacks gracosos em caso de falha

**O sistema agora é muito mais resiliente a mudanças na interface do Twitter!** 🚀

---

_Correções implementadas: Janeiro 2024_  
_Status: ✅ RESOLVIDO_  
_Versão: 3.1.0 - Timeout Corrigido_
