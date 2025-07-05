# Twitter Scraping Automation - Guia Completo

## 📋 Visão Geral

Esta aplicação Next.js 15 automatiza ações no Twitter/X sem usar a API oficial, utilizando Playwright para web scraping. Permite buscar tweets por termo/hashtag, visualizar os 10 tweets com mais engajamento, e interagir com eles diretamente pela interface.

## 🚀 Funcionalidades

### ✅ Funcionalidades Implementadas

- **Busca Inteligente**: Busca tweets por palavra-chave ou hashtag
- **Ordenação por Engajamento**: Classifica tweets por engajamento total (likes + retweets + comentários)
- **Interação Direta**: Curtir e retweetar tweets pela interface
- **Interface Moderna**: Design responsivo com tema escuro
- **Feedback Visual**: Estados de loading, indicadores de sucesso/erro
- **Autenticação por Cookies**: Sistema de login via cookies salvos
- **Scraping Robusto**: Múltiplos métodos de extração de dados

### 🎯 Melhorias Recentes

1. **Estados de Loading**: Botões individuais mostram loading durante ações
2. **Melhor Feedback**: Mensagens de erro/sucesso mais claras
3. **Scraping Aprimorado**: Múltiplos métodos para capturar métricas
4. **Interface Refinada**: Botão limpar resultados, animações suaves
5. **Tratamento de Erros**: Handling robusto de timeouts e falhas
6. **URLs Corretas**: Navegação direta para tweets específicos

## 🛠️ Tecnologias

- **Next.js 15** com App Router
- **TypeScript** para tipagem estática
- **Tailwind CSS** para estilização
- **Playwright** para automação de navegador
- **React 19** para interface reativa

## 📦 Instalação

```bash
# Clonar o repositório
git clone [URL_DO_REPOSITORIO]

# Instalar dependências
npm install

# Instalar navegadores do Playwright
npx playwright install chromium

# Iniciar o servidor de desenvolvimento
npm run dev
```

## ⚙️ Configuração

### 1. Configurar Cookies do Twitter

Para que a aplicação funcione, você precisa configurar os cookies de autenticação:

1. Faça login no Twitter/X no seu navegador
2. Abra as ferramentas de desenvolvedor (F12)
3. Vá para "Application" > "Cookies" > "https://x.com"
4. Copie os cookies importantes
5. Crie o arquivo `twitter-cookies.json` na raiz do projeto

Exemplo de `twitter-cookies.json`:
```json
[
  {
    "name": "auth_token",
    "value": "SEU_AUTH_TOKEN_AQUI",
    "domain": ".x.com",
    "path": "/",
    "secure": true,
    "httpOnly": true,
    "sameSite": "None"
  },
  {
    "name": "ct0",
    "value": "SEU_CT0_AQUI",
    "domain": ".x.com",
    "path": "/",
    "secure": true,
    "httpOnly": false,
    "sameSite": "Lax"
  },
  {
    "name": "twid",
    "value": "SEU_TWID_AQUI",
    "domain": ".x.com",
    "path": "/",
    "secure": true,
    "httpOnly": false,
    "sameSite": "Lax"
  }
]
```

### 2. Configurar .gitignore

Certifique-se de que o arquivo `twitter-cookies.json` está no `.gitignore`:

```gitignore
# Cookies do Twitter (dados sensíveis)
twitter-cookies.json

# Outros arquivos
.env
.env.local
.env.production.local
.env.development.local
```

## 🖥️ Como Usar

### 1. Interface Principal

1. **Buscar Tweets**: Digite um termo de busca (palavra-chave, hashtag, etc.)
2. **Visualizar Resultados**: Veja os 10 tweets com mais engajamento
3. **Interagir**: Clique em "Curtir" ou "Retweet" para interagir
4. **Limpar**: Use o botão "Limpar resultados" para nova busca

### 2. Funcionalidades da Interface

- **Indicadores de Loading**: Botões mostram "..." durante ações
- **Feedback em Tempo Real**: Status atualizado conforme ações
- **Métricas Visuais**: Exibição clara de likes, retweets, comentários
- **Links Diretos**: Acesso direto aos tweets no X.com

### 3. Estados dos Botões

- **Curtir**: 🤍 (não curtido) / 💖 (curtido)
- **Retweet**: 🔄 (normal) / 🔄 (retweetado, em verde)
- **Loading**: Botões ficam desabilitados com "..."

## 🔧 Arquitetura

### Frontend (`src/app/page.tsx`)
- Interface React com estado gerenciado via hooks
- Componentes responsivos com Tailwind CSS
- Gerenciamento de loading states individual
- Feedback visual para todas as ações

### Backend (`src/app/api/twitter-action/route.ts`)
- API Route para automação com Playwright
- Busca e ordenação de tweets por engajamento
- Execução de ações (like/retweet) em tweets específicos
- Tratamento robusto de erros e timeouts

### Scraping Strategy
- Múltiplos seletores para máxima compatibilidade
- Fallbacks para diferentes layouts do X.com
- Extração inteligente de métricas numéricas
- Detecção automática de estados (curtido/retweetado)

## 🚨 Limitações e Considerações

### Limitações Técnicas
- Depende da estrutura HTML do X.com (pode quebrar com mudanças)
- Requer cookies válidos e não expirados
- Limitado pelas proteções anti-bot do X.com
- Performance dependente da velocidade da conexão

### Limitações de Uso
- Não deve ser usado para spam ou atividades maliciosas
- Respeite os termos de uso do X.com
- Use com moderação para evitar bloqueios
- Mantenha cookies seguros e privados

### Considerações Éticas
- Use apenas para contas próprias
- Respeite a privacidade dos usuários
- Não automatize ações excessivas
- Considere impacto na experiência de outros usuários

## 🛡️ Segurança

### Proteção de Dados
- Cookies nunca são versionados (gitignore)
- Execução em navegador headless isolado
- Limpeza automática de recursos do navegador
- Validação de entrada para prevenir ataques

### Boas Práticas
- Mantenha cookies atualizados
- Use HTTPS apenas
- Monitore logs para detectar problemas
- Mantenha dependências atualizadas

## 📊 Monitoramento

### Logs de Debug
- Navegação de URLs no console
- Erros de scraping detalhados
- Status de autenticação
- Métricas de performance

### Métricas de Sucesso
- Taxa de sucesso de busca
- Precisão na extração de dados
- Sucesso nas ações de interação
- Tempos de resposta

## 🔄 Manutenção

### Atualizações Regulares
- Verificar seletores CSS do X.com
- Atualizar dependências do projeto
- Renovar cookies quando necessário
- Testar funcionalidades regularmente

### Troubleshooting
- Verificar se cookies estão válidos
- Confirmar se X.com não mudou layout
- Checar conectividade de rede
- Revisar logs de erro para debugging

## 📝 Changelog

### v1.2.0 (Atual)
- ✅ Estados de loading individuais para botões
- ✅ Melhor feedback visual com animações
- ✅ Scraping mais robusto com múltiplos métodos
- ✅ Botão para limpar resultados
- ✅ Tratamento aprimorado de erros
- ✅ Interface refinada com indicadores visuais

### v1.1.0
- ✅ Busca e ordenação por engajamento
- ✅ Interação com tweets (like/retweet)
- ✅ Interface com tema escuro
- ✅ Autenticação por cookies

### v1.0.0
- ✅ Estrutura inicial do projeto
- ✅ Configuração do Playwright
- ✅ Interface básica de busca

## 🤝 Contribuição

Para contribuir com o projeto:

1. Fork o repositório
2. Crie uma branch para sua feature
3. Faça commit das mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto é para fins educacionais e de pesquisa. Use com responsabilidade e respeite os termos de uso do X.com.

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs no console
2. Confirme se os cookies estão válidos
3. Teste com diferentes termos de busca
4. Verifique a conectividade de rede

---

**Desenvolvido com ❤️ usando Next.js 15 e Playwright**
