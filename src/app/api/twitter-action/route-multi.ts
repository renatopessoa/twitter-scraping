import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { join } from "path";

interface TwitterCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

interface TwitterAccount {
  name: string;
  username: string;
  cookies: TwitterCookie[];
}

interface MultiAccountConfig {
  accounts: TwitterAccount[];
}

interface Tweet {
  id: string;
  author: string;
  content: string;
  engagement: {
    likes: number;
    retweets: number;
    comments: number;
    total: number;
  };
  timestamp: string;
  url: string;
  isLiked: boolean;
  isRetweeted: boolean;
  username?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, action, tweetId, sortBy, amount, batchActions } = body;

    // Se é uma ação em lote (múltiplos tweets)
    if (batchActions && Array.isArray(batchActions)) {
      return await handleBatchActionsMultiAccount(batchActions);
    }

    // Se é uma ação específica em um tweet
    if (action && tweetId) {
      return await handleTweetActionMultiAccount(action, tweetId, amount);
    }

    // Buscar tweets (comportamento padrão)
    return await searchTweets(query, sortBy);
  } catch (error) {
    console.error("Erro geral:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

async function loadMultiAccountConfig(): Promise<MultiAccountConfig> {
  try {
    const configPath = join(process.cwd(), "twitter-cookies-multi.json");
    const configData = readFileSync(configPath, "utf-8");
    const config = JSON.parse(configData);
    
    if (!config.accounts || !Array.isArray(config.accounts) || config.accounts.length === 0) {
      throw new Error("Nenhuma conta encontrada no arquivo de configuração");
    }
    
    return config;
  } catch {
    // Fallback para formato antigo
    try {
      const cookiesPath = join(process.cwd(), "twitter-cookies.json");
      const cookiesData = readFileSync(cookiesPath, "utf-8");
      const cookies = JSON.parse(cookiesData);
      
      return {
        accounts: [{
          name: "Conta Única",
          username: "usuario1",
          cookies: cookies
        }]
      };
    } catch {
      throw new Error("Não foi possível carregar configuração de contas");
    }
  }
}

interface BatchAction {
  tweetId: string;
  action: 'like' | 'retweet';
  amount?: number;
}

async function handleBatchActionsMultiAccount(batchActions: BatchAction[]) {
  console.log(`🚀 Iniciando processamento em lote com múltiplas contas: ${batchActions.length} ações`);
  
  const config = await loadMultiAccountConfig();
  const results = [];
  let successCount = 0;
  
  // Distribuir ações entre as contas disponíveis
  for (let i = 0; i < batchActions.length; i++) {
    const action = batchActions[i];
    const accountIndex = i % config.accounts.length; // Rotacionar entre contas
    const account = config.accounts[accountIndex];
    
    console.log(`📱 Executando ${action.action} no tweet ${action.tweetId} com conta: ${account.name}`);
    
    try {
      const result = await executeTweetActionWithAccount(
        action.action,
        action.tweetId,
        action.amount || 1,
        account
      );
      
      results.push({
        tweetId: action.tweetId,
        action: action.action,
        amount: action.amount || 1,
        account: account.name,
        success: result.success,
        message: result.message
      });
      
      if (result.success) {
        successCount++;
      }
      
      // Delay entre ações para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Erro na ação ${action.action} (conta: ${account.name}):`, error);
      results.push({
        tweetId: action.tweetId,
        action: action.action,
        amount: action.amount || 1,
        account: account.name,
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  }
  
  return NextResponse.json({
    message: `Ações em lote concluídas: ${successCount} sucessos, ${batchActions.length - successCount} erros`,
    summary: {
      total: batchActions.length,
      success: successCount,
      failed: batchActions.length - successCount,
      accounts_used: config.accounts.length
    },
    results
  });
}

async function handleTweetActionMultiAccount(action: string, tweetId: string, amount: number = 1) {
  console.log(`🎯 Executando ação individual: ${action} no tweet ${tweetId} com quantidade ${amount}`);
  
  const config = await loadMultiAccountConfig();
  
  // Para ações individuais, escolher uma conta aleatória
  const randomIndex = Math.floor(Math.random() * config.accounts.length);
  const selectedAccount = config.accounts[randomIndex];
  
  console.log(`📱 Conta selecionada: ${selectedAccount.name}`);
  
  try {
    const result = await executeTweetActionWithAccount(action, tweetId, amount, selectedAccount);
    
    if (result.success) {
      return NextResponse.json({
        message: `${action === 'like' ? 'Like' : 'Retweet'} executado com sucesso pela conta ${selectedAccount.name} (${amount} configurado)!`,
        account: selectedAccount.name,
        amount: amount
      });
    } else {
      return NextResponse.json(
        { error: `Falha na execução pela conta ${selectedAccount.name}: ${result.message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`❌ Erro na ação ${action} (conta: ${selectedAccount.name}):`, error);
    return NextResponse.json(
      { error: `Erro ao executar ${action} com conta ${selectedAccount.name}: ${error instanceof Error ? error.message : "Erro desconhecido"}` },
      { status: 500 }
    );
  }
}

async function executeTweetActionWithAccount(
  action: string,
  tweetId: string,
  amount: number,
  account: TwitterAccount
): Promise<{ success: boolean; message: string }> {
  
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu"
    ]
  });

  try {
    const context = await browser.newContext();
    
    // Configurar cookies da conta específica
    await context.addCookies(account.cookies);
    
    const page = await context.newPage();
    
    // Navegar para o tweet específico
    const tweetUrl = `https://twitter.com/i/web/status/${tweetId}`;
    console.log(`🔗 Navegando para: ${tweetUrl} (conta: ${account.name})`);
    
    await page.goto(tweetUrl);
    await page.waitForTimeout(3000);
    
    // Verificar se está logado
    const isLoggedIn = await page.locator('[data-testid="SideNav_AccountSwitcher_Button"]').isVisible();
    if (!isLoggedIn) {
      throw new Error(`Não foi possível autenticar com a conta ${account.name}`);
    }
    
    let selector: string;
    let actionName: string;
    
    if (action === 'like') {
      selector = '[data-testid="like"]';
      actionName = 'Like';
    } else if (action === 'retweet') {
      selector = '[data-testid="retweet"]';
      actionName = 'Retweet';
    } else {
      throw new Error(`Ação não suportada: ${action}`);
    }
    
    // Aguardar o botão aparecer
    await page.waitForSelector(selector, { timeout: 10000 });
    
    // Verificar se já executou a ação
    const button = page.locator(selector).first();
    const isActive = await button.getAttribute('data-testid');
    
    if (action === 'like' && isActive === 'unlike') {
      console.log(`⚠️ Tweet já foi curtido pela conta ${account.name}`);
      return { success: true, message: `Tweet já curtido pela conta ${account.name}` };
    }
    
    if (action === 'retweet' && isActive === 'unretweet') {
      console.log(`⚠️ Tweet já foi retweetado pela conta ${account.name}`);
      return { success: true, message: `Tweet já retweetado pela conta ${account.name}` };
    }
    
    // Executar a ação
    await button.click();
    
    // Para retweet, confirmar no modal
    if (action === 'retweet') {
      await page.waitForTimeout(1000);
      const retweetConfirm = page.locator('[data-testid="retweetConfirm"]');
      if (await retweetConfirm.isVisible()) {
        await retweetConfirm.click();
      }
    }
    
    await page.waitForTimeout(2000);
    
    console.log(`✅ ${actionName} executado com sucesso pela conta ${account.name}`);
    return { success: true, message: `${actionName} executado com sucesso pela conta ${account.name}` };
    
  } catch (error) {
    console.error(`❌ Erro ao executar ${action} com conta ${account.name}:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function searchTweets(query: string, sortBy: "recent" | "top" = "recent") {
  // Validar se a query foi fornecida
  if (!query || typeof query !== "string" || query.trim() === "") {
    return NextResponse.json(
      { error: "Termo de busca é obrigatório" },
      { status: 400 }
    );
  }

  // Usar a primeira conta disponível para busca
  const config = await loadMultiAccountConfig();
  const searchAccount = config.accounts[0];

  // Inicializar o navegador
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu"
    ]
  });

  try {
    const context = await browser.newContext();
    await context.addCookies(searchAccount.cookies);
    
    const page = await context.newPage();

    // Construir URL de busca com ordenação
    const searchQuery = encodeURIComponent(query);
    const sortParam = sortBy === "recent" ? "&f=live" : "&f=top";
    const searchUrl = `https://twitter.com/search?q=${searchQuery}${sortParam}&src=typed_query`;
    
    console.log(`🔍 Buscando tweets: "${query}" (ordenação: ${sortBy})`);
    console.log(`🔗 URL: ${searchUrl}`);

    await page.goto(searchUrl);
    await page.waitForTimeout(5000);

    // Aguardar os tweets carregarem
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 });

    // Extrair informações dos tweets
    const tweets = await page.evaluate(() => {
      const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
      const results = [];

      for (let i = 0; i < Math.min(tweetElements.length, 10); i++) {
        const tweet = tweetElements[i];
        
        try {
          // Extrair ID do tweet
          const tweetLink = tweet.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
          const tweetId = tweetLink ? tweetLink.href.split('/status/')[1].split('?')[0] : null;
          
          if (!tweetId) continue;

          // Extrair autor
          const authorElement = tweet.querySelector('[data-testid="User-Name"]');
          const author = authorElement ? authorElement.textContent?.trim() : "Autor desconhecido";

          // Extrair conteúdo
          const contentElement = tweet.querySelector('[data-testid="tweetText"]');
          const content = contentElement ? contentElement.textContent?.trim() : "Conteúdo não disponível";

          // Extrair métricas de engajamento
          const likeButton = tweet.querySelector('[data-testid="like"]');
          const retweetButton = tweet.querySelector('[data-testid="retweet"]');
          const commentButton = tweet.querySelector('[data-testid="reply"]');

          const likes = parseInt(likeButton?.textContent?.trim() || '0') || 0;
          const retweets = parseInt(retweetButton?.textContent?.trim() || '0') || 0;
          const comments = parseInt(commentButton?.textContent?.trim() || '0') || 0;

          // Verificar se já foi curtido/retweetado
          const isLiked = likeButton?.getAttribute('data-testid') === 'unlike';
          const isRetweeted = retweetButton?.getAttribute('data-testid') === 'unretweet';

          results.push({
            id: tweetId,
            author,
            content,
            engagement: {
              likes,
              retweets,
              comments,
              total: likes + retweets + comments
            },
            timestamp: new Date().toISOString(),
            url: `https://x.com/i/web/status/${tweetId}`,
            isLiked,
            isRetweeted,
            username: author?.split('@')[1]?.split('·')[0] || author || "unknown"
          });
        } catch (error) {
          console.error('Erro ao processar tweet:', error);
        }
      }

      return results;
    });

    // Ordenar tweets se necessário
    if (sortBy === "top") {
      tweets.sort((a, b) => b.engagement.total - a.engagement.total);
    }

    console.log(`✅ Encontrados ${tweets.length} tweets`);

    return NextResponse.json({
      tweets,
      query,
      sortBy,
      total: tweets.length,
      accounts_available: config.accounts.length,
      search_account: searchAccount.name
    });

  } catch (error) {
    console.error("Erro durante a busca:", error);
    return NextResponse.json(
      { error: `Erro durante a busca: ${error instanceof Error ? error.message : "Erro desconhecido"}` },
      { status: 500 }
    );
  } finally {
    await browser.close();
  }
}
