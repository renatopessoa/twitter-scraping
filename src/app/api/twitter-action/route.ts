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

interface BatchAction {
  tweetId: string;
  action: 'like' | 'retweet';
  amount?: number;
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
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });
    
    await context.addCookies(searchAccount.cookies);
    
    const page = await context.newPage();

    // Construir URL de busca com ordenação
    const searchQuery = encodeURIComponent(query);
    const sortParam = sortBy === "recent" ? "&f=live" : "&f=top";
    const searchUrl = `https://twitter.com/search?q=${searchQuery}${sortParam}&src=typed_query`;
    
    console.log(`🔍 Buscando tweets: "${query}" (ordenação: ${sortBy})`);
    console.log(`🔗 URL: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Aguardar os tweets carregarem - usar múltiplos seletores como fallback
    console.log('🔍 Aguardando tweets carregarem...');
    
    const tweetSelectors = [
      'article[data-testid="tweet"]',
      'article[data-testid="tweetish"]',
      'article[role="article"]',
      '[data-testid="cellInnerDiv"]',
      '.css-1dbjc4n[data-testid="tweet"]',
      'div[data-testid="tweet"]'
    ];

    let tweetsFound = false;
    let usedSelector = '';

    for (const selector of tweetSelectors) {
      try {
        console.log(`🔍 Tentando seletor: ${selector}`);
        await page.waitForSelector(selector, { timeout: 10000 });
        
        const count = await page.locator(selector).count();
        if (count > 0) {
          console.log(`✅ Encontrados ${count} elementos com seletor: ${selector}`);
          tweetsFound = true;
          usedSelector = selector;
          break;
        }
      } catch (error) {
        console.log(`❌ Seletor ${selector} não funcionou:`, (error as Error).message);
        continue;
      }
    }

    if (!tweetsFound) {
      console.log('⚠️ Nenhum tweet encontrado com seletores padrão, tentando aguardar mais...');
      await page.waitForTimeout(10000);
      
      // Tentar novamente com seletores mais genéricos
      const fallbackSelectors = [
        'article',
        '[role="article"]',
        'div[data-testid*="tweet"]',
        '.tweet',
        '[data-testid="primaryColumn"] > div > div'
      ];

      for (const selector of fallbackSelectors) {
        try {
          const count = await page.locator(selector).count();
          if (count > 0) {
            console.log(`✅ Fallback: encontrados ${count} elementos com: ${selector}`);
            usedSelector = selector;
            tweetsFound = true;
            break;
          }
        } catch {
          continue;
        }
      }
    }

    if (!tweetsFound) {
      console.log('❌ Nenhum tweet encontrado após todas as tentativas');
      
      // Capturar screenshot para debug
      await page.screenshot({ path: 'debug-no-tweets.png' });
      
      // Tentar verificar se está na página correta
      const currentUrl = page.url();
      console.log(`📍 URL atual: ${currentUrl}`);
      
      // Verificar se há mensagem de erro
      const errorMessage = await page.locator('[data-testid="error-detail"]').textContent().catch(() => null);
      if (errorMessage) {
        console.log(`⚠️ Mensagem de erro na página: ${errorMessage}`);
      }
      
      return NextResponse.json({
        tweets: [],
        query,
        sortBy,
        total: 0,
        accounts_available: config.accounts.length,
        search_account: searchAccount.name,
        debug: {
          url: currentUrl,
          error: errorMessage,
          note: 'Nenhum tweet encontrado - verifique se a busca é válida'
        }
      });
    }

    // Extrair informações dos tweets
    console.log(`🔍 Extraindo dados dos tweets com seletor: ${usedSelector}`);
    
    const tweets = await page.evaluate((selector) => {
      const tweetElements = document.querySelectorAll(selector);
      const results = [];

      console.log(`Processando ${tweetElements.length} elementos encontrados`);

      for (let i = 0; i < Math.min(tweetElements.length, 10); i++) {
        const tweet = tweetElements[i];
        
        try {
          // Extrair ID do tweet - múltiplas tentativas
          let tweetId = null;
          
          // Tentativa 1: Link direto
          const tweetLink = tweet.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
          if (tweetLink) {
            tweetId = tweetLink.href.split('/status/')[1].split('?')[0].split('/')[0];
          }
          
          // Tentativa 2: Atributos do elemento
          if (!tweetId) {
            const tweetIdAttr = tweet.getAttribute('aria-labelledby');
            if (tweetIdAttr) {
              tweetId = tweetIdAttr.split('-').pop();
            }
          }
          
          // Tentativa 3: URL na árvore do DOM
          if (!tweetId) {
            const allLinks = tweet.querySelectorAll('a[href*="/status/"]');
            for (const link of allLinks) {
              const href = link.getAttribute('href');
              if (href && href.includes('/status/')) {
                tweetId = href.split('/status/')[1].split('?')[0].split('/')[0];
                break;
              }
            }
          }
          
          if (!tweetId || tweetId.length < 10) {
            console.log(`Tweet ${i + 1}: ID não encontrado`);
            continue;
          }

          // Extrair autor - múltiplas tentativas
          let author = "Autor desconhecido";
          
          const authorSelectors = [
            '[data-testid="User-Name"]',
            '[data-testid="User-Names"]',
            '.css-1dbjc4n[data-testid="User-Name"]',
            '[data-testid="tweet"] [dir="ltr"] span',
            'div[data-testid="User-Name"] span',
            'a[role="link"] span'
          ];

          for (const authorSelector of authorSelectors) {
            const authorElement = tweet.querySelector(authorSelector);
            if (authorElement && authorElement.textContent) {
              author = authorElement.textContent.trim();
              break;
            }
          }

          // Extrair conteúdo - múltiplas tentativas
          let content = "Conteúdo não disponível";
          
          const contentSelectors = [
            '[data-testid="tweetText"]',
            '[data-testid="tweet-text"]',
            '.css-901oao[data-testid="tweetText"]',
            'div[data-testid="tweetText"] span',
            'div[lang] span',
            '.tweet-text'
          ];

          for (const contentSelector of contentSelectors) {
            const contentElement = tweet.querySelector(contentSelector);
            if (contentElement && contentElement.textContent) {
              content = contentElement.textContent.trim();
              break;
            }
          }

          // Extrair métricas de engajamento
          const extractNumber = (text: string | null | undefined): number => {
            if (!text) return 0;
            const cleaned = text.replace(/[^\d.KMB]/gi, '');
            const number = parseFloat(cleaned);
            if (isNaN(number)) return 0;
            
            if (cleaned.includes('K')) return Math.floor(number * 1000);
            if (cleaned.includes('M')) return Math.floor(number * 1000000);
            if (cleaned.includes('B')) return Math.floor(number * 1000000000);
            return Math.floor(number);
          };

          const metricSelectors = {
            like: ['[data-testid="like"]', '[data-testid="unlike"]', 'button[data-testid*="like"]'],
            retweet: ['[data-testid="retweet"]', '[data-testid="unretweet"]', 'button[data-testid*="retweet"]'],
            reply: ['[data-testid="reply"]', 'button[data-testid*="reply"]']
          };

          let likes = 0, retweets = 0, comments = 0;
          let isLiked = false, isRetweeted = false;

          // Extrair likes
          for (const selector of metricSelectors.like) {
            const element = tweet.querySelector(selector);
            if (element) {
              likes = extractNumber(element.textContent);
              isLiked = element.getAttribute('data-testid') === 'unlike';
              break;
            }
          }

          // Extrair retweets
          for (const selector of metricSelectors.retweet) {
            const element = tweet.querySelector(selector);
            if (element) {
              retweets = extractNumber(element.textContent);
              isRetweeted = element.getAttribute('data-testid') === 'unretweet';
              break;
            }
          }

          // Extrair comments
          for (const selector of metricSelectors.reply) {
            const element = tweet.querySelector(selector);
            if (element) {
              comments = extractNumber(element.textContent);
              break;
            }
          }

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
          
          console.log(`Tweet ${i + 1}: ${author} - ${content.substring(0, 50)}...`);
        } catch (error) {
          console.error(`Erro ao processar tweet ${i + 1}:`, error);
        }
      }

      return results;
    }, usedSelector);

    // Ordenar tweets se necessário
    if (sortBy === "top") {
      tweets.sort((a, b) => b.engagement.total - a.engagement.total);
    }

    console.log(`✅ Encontrados ${tweets.length} tweets válidos`);

    return NextResponse.json({
      tweets,
      query,
      sortBy,
      total: tweets.length,
      accounts_available: config.accounts.length,
      search_account: searchAccount.name,
      debug: {
        selector_used: usedSelector,
        total_found: tweets.length
      }
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
