# Twitter Scraping Automation

Uma aplicação Next.js 15 com TypeScript que automatiza ações no Twitter usando Playwright para web scraping, sem usar a API oficial do Twitter.

## ✨ Características

- **Framework**: Next.js 15 (App Router)
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS (tema escuro)
- **Automação**: Playwright
- **🔥 NOVO**: Sistema Multi-Conta para engajamento orgânico
- **Funcionalidades**: Busca tweets, curtidas/retweets configuráveis, ações em lote

## 🚀 Instalação

1. Clone ou baixe o projeto
2. Instale as dependências:

   ```bash
   npm install
   ```

3. Instale o navegador Chromium para o Playwright:
   ```bash
   npx playwright install chromium
   ```

## ⚙️ Configuração dos Cookies

### 🔥 NOVO: Sistema Multi-Conta

Para máximo engajamento orgânico, configure múltiplas contas do Twitter:

#### Formato Multi-Conta (Recomendado)

Crie `twitter-cookies-multi.json`:

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
        }
        // ... outros cookies da conta 2
      ]
    }
  ]
}
```

**📋 Instruções detalhadas**: Veja `MULTI-CONTA-SETUP.md`

#### Formato Antigo (Ainda Suportado)

Para usar uma única conta:

### 1. Obter os Cookies

1. Acesse [twitter.com](https://twitter.com) e faça login
2. Abra as ferramentas de desenvolvedor (F12)
3. Vá para a aba **Application** (Chrome) ou **Storage** (Firefox)
4. Clique em **Cookies** → **https://twitter.com**
5. Copie os seguintes cookies importantes:
   - `auth_token`
   - `ct0`
   - `twid` u%

### 2. Criar o Arquivo de Cookies

1. Copie o arquivo `twitter-cookies.example.json` para `twitter-cookies.json`
2. Substitua os valores de exemplo pelos seus cookies reais:

```json
[
  {
    "name": "auth_token",
    "value": "SEU_AUTH_TOKEN_AQUI",
    "domain": ".twitter.com",
    "path": "/",
    "secure": true,
    "httpOnly": true,
    "sameSite": "None"
  },
  {
    "name": "ct0",
    "value": "SEU_CT0_AQUI",
    "domain": ".twitter.com",
    "path": "/",
    "secure": true,
    "httpOnly": false,
    "sameSite": "Lax"
  },
  {
    "name": "twid",
    "value": "SEU_TWID_AQUI",
    "domain": ".twitter.com",
    "path": "/",
    "secure": true,
    "httpOnly": false,
    "sameSite": "Lax"
  }
]
```

⚠️ **IMPORTANTE**: O arquivo `twitter-cookies.json` já está no `.gitignore` para não ser versionado.

## 🖥️ Executar a Aplicação

```bash
npm run dev
```

A aplicação estará disponível em [http://localhost:3000](http://localhost:3000)

## 📱 Como Usar

### 🔥 Sistema Multi-Conta Ativo

Quando configurado com múltiplas contas, a aplicação:

- 🎯 **Distribui ações** entre diferentes contas automaticamente
- 🔄 **Rotaciona contas** para simular engajamento orgânico
- 📊 **Mostra feedback** de qual conta executou cada ação
- 🚀 **Escala infinitamente** com quantas contas quiser

### Interface Principal

1. Acesse a aplicação web
2. Digite um termo de busca (palavra-chave, hashtag, etc.)
3. Escolha ordenação (recentes ou engajamento)
4. Configure quantidades de likes/retweets por tweet
5. Use "Enviar Todas as Ações" para processar em lote
6. Veja qual conta executou cada ação

### Indicadores na Interface

- **🔧 Sistema Multi-Conta Ativo**: Mostra quantas contas estão disponíveis
- **🎯 Conta executou ação**: Feedback específico por ação
- **📊 Relatório de lote**: Distribuição entre contas

## 🏗️ Arquitetura

```
src/
├── app/
│   ├── api/
│   │   └── twitter-action/
│   │       └── route.ts          # API Route para automação
│   ├── globals.css               # Estilos globais
│   ├── layout.tsx               # Layout da aplicação
│   └── page.tsx                 # Página principal (frontend)
├── twitter-cookies.example.json  # Exemplo de cookies
└── twitter-cookies.json         # Seus cookies (não versionado)
```

## 🔧 Funcionalidades Técnicas

- **Frontend**: Interface React com tema escuro
- **Backend**: API Route do Next.js com sistema multi-conta
- **Automação**: Playwright em modo headless
- **Autenticação**: Sistema multi-conta com rotação automática
- **Distribuição**: Ações distribuídas inteligentemente entre contas
- **Tratamento de Erros**: Robusto e informativo
- **Escalabilidade**: Suporte a quantas contas quiser

## 📋 Scripts Disponíveis

- `npm run dev` - Executa em modo desenvolvimento
- `npm run build` - Cria build de produção
- `npm run start` - Executa build de produção
- `npm run lint` - Executa linting do código
- `npm run test` - Executa testes da aplicação
- `npm run test:multi` - Testa sistema multi-conta

## ⚠️ Avisos Importantes

1. **Cookies**: Mantenha seus cookies seguros e não os compartilhe
2. **Rate Limiting**: O Twitter pode ter limites de ações por minuto
3. **Uso Responsável**: Use a ferramenta de forma ética e responsável
4. **Termos de Uso**: Respeite os termos de uso do Twitter

## 🛠️ Desenvolvimento

Este projeto usa:

- Next.js 15 com App Router
- TypeScript para tipagem estática
- Tailwind CSS para estilização
- Playwright para automação de navegador
- ESLint para qualidade do código

## 📄 Licença

Este projeto é apenas para fins educacionais e demonstrativos.
