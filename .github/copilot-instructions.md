# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Projeto: Twitter Scraping Automation

Este é um projeto Next.js 15 com TypeScript que automatiza ações no Twitter usando Playwright para web scraping sem usar a API oficial do Twitter.

### Tecnologias Utilizadas

- **Framework**: Next.js 15 (App Router)
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS
- **Automação**: Playwright
- **Runtime**: Node.js

### Arquitetura

- **Frontend**: `app/page.tsx` - Interface do usuário com tema escuro
- **Backend**: `app/api/twitter-action/route.ts` - API Route para automação
- **Autenticação**: Cookies salvos em `twitter-cookies.json`

### Regras de Desenvolvimento

1. Use sempre TypeScript com tipagem estrita
2. Mantenha o tema escuro (dark mode) com Tailwind CSS
3. Use Playwright para automação de navegador em modo headless
4. Implemente tratamento de erros robusto
5. Use async/await para operações assíncronas
6. Mantenha o código limpo e bem documentado

### Padrões de Código

- Use arrow functions para componentes React
- Implemente loading states nos componentes
- Use try/catch para tratamento de erros
- Mantenha separação clara entre frontend e backend
- Use seletores data-testid para elementos do Twitter
