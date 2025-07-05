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
      return await handleBatchActions(batchActions);
    }

    // Se é uma ação específica em um tweet
    if (action && tweetId) {
      return await handleTweetAction(action, tweetId, amount);
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

async function searchTweets(query: string, sortBy: "recent" | "top" = "recent") {
  // Validar se a query foi fornecida
  if (!query || typeof query !== "string" || query.trim() === "") {
    return NextResponse.json(
      { error: "Termo de busca é obrigatório" },
      { status: 400 }
    );
  }

  // Tentar carregar os cookies do Twitter
  let cookies: TwitterCookie[] = [];
  try {
    const cookiesPath = join(process.cwd(), "twitter-cookies.json");
    const cookiesData = readFileSync(cookiesPath, "utf-8");
    cookies = JSON.parse(cookiesData);
    
    if (!Array.isArray(cookies) || cookies.length === 0) {
      return NextResponse.json(
        { error: "Arquivo twitter-cookies.json está vazio ou inválido" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { 
        error: "Não foi possível carregar o arquivo twitter-cookies.json. Certifique-se de que o arquivo existe na raiz do projeto e contém cookies válidos do Twitter." 
      },
      { status: 400 }
    );
  }

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
      "--disable-gpu"
    ]
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  try {
    // Adicionar cookies para autenticação
    await context.addCookies(cookies);

    // Navegar para a página de busca do Twitter/X
    const searchType = sortBy === "recent" ? "live" : "top";
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(query.trim())}&src=typed_query&f=${searchType}`;
    console.log(`Navegando para: ${searchUrl} (ordenação: ${sortBy})`);
    
    await page.goto(searchUrl, { 
      waitUntil: "domcontentloaded", 
      timeout: 20000 
    });

    // Aguardar um pouco para garantir que a página carregou
    await page.waitForTimeout(3000);

    // Verificar se estamos na página de login
    const isLoginPage = await page.locator('input[name="text"]').isVisible()
      .catch(() => false);

    if (isLoginPage) {
      await browser.close();
      return NextResponse.json(
        { error: "Redirecionado para página de login. Os cookies podem estar expirados ou inválidos." },
        { status: 400 }
      );
    }

    // Verificar se estamos logados
    let isLoggedIn = false;
    const loginChecks = [
      '[data-testid="SideNav_AccountSwitcher_Button"]',
      '[data-testid="AppTabBar_Profile_Link"]',
      '[data-testid="primaryColumn"]',
      '[aria-label="Página inicial"]',
      '[data-testid="tweet"]',
      '[data-testid="cellInnerDiv"]',
      '[role="main"]'
    ];

    for (const selector of loginChecks) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          isLoggedIn = true;
          console.log(`Login detectado através do seletor: ${selector}`);
          break;
        }
      } catch {
        // Continuar tentando
      }
    }

    if (!isLoggedIn) {
      await browser.close();
      return NextResponse.json(
        { error: "Não foi possível fazer login no Twitter. Verifique se os cookies estão válidos e não expiraram." },
        { status: 400 }
      );
    }

    // Aguardar pelos tweets carregarem
    console.log("Aguardando tweets carregarem...");
    await page.waitForSelector('[data-testid="tweet"]', { 
      timeout: 15000 
    });

    // Fazer scroll para carregar mais tweets
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
    }

    const tweetsData = await page.evaluate(() => {
      const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
      const results = [];

      for (let index = 0; index < Math.min(tweetElements.length, 15); index++) {
        const tweet = tweetElements[index];
        try {
          // Gerar um ID único para o tweet
          const tweetLinkElement = tweet.querySelector('a[href*="/status/"]');
          const tweetUrl = tweetLinkElement?.getAttribute('href') || '';
          const tweetId = tweetUrl.split('/status/')[1]?.split('?')[0] || `tweet-${index}`;
          
          // Extrair o nome do usuário da URL
          const username = tweetUrl.split('/')[1] || 'unknown';
          
          // Extrair autor
          const authorElement = tweet.querySelector('[data-testid="User-Name"]');
          const author = authorElement?.textContent?.trim() || username || 'Usuário desconhecido';

          // Extrair conteúdo
          const contentElement = tweet.querySelector('[data-testid="tweetText"]');
          const content = contentElement?.textContent?.trim() || 'Conteúdo não disponível';

          // Extrair métricas de engajamento
          let likes = 0;
          let retweets = 0;
          let comments = 0;

          // Tentar pelos atributos aria-label
          const likeElement = tweet.querySelector('[data-testid="like"]');
          const retweetElement = tweet.querySelector('[data-testid="retweet"]');
          const commentElement = tweet.querySelector('[data-testid="reply"]');

          if (likeElement) {
            const likeText = likeElement.getAttribute('aria-label') || likeElement.textContent || '';
            const likeMatch = likeText.match(/(\d+(?:,\d+)*)/);
            likes = likeMatch ? parseInt(likeMatch[1].replace(/,/g, '')) : 0;
          }

          if (retweetElement) {
            const retweetText = retweetElement.getAttribute('aria-label') || retweetElement.textContent || '';
            const retweetMatch = retweetText.match(/(\d+(?:,\d+)*)/);
            retweets = retweetMatch ? parseInt(retweetMatch[1].replace(/,/g, '')) : 0;
          }

          if (commentElement) {
            const commentText = commentElement.getAttribute('aria-label') || commentElement.textContent || '';
            const commentMatch = commentText.match(/(\d+(?:,\d+)*)/);
            comments = commentMatch ? parseInt(commentMatch[1].replace(/,/g, '')) : 0;
          }

          // Verificar se já está curtido/retweetado
          const isLiked = likeElement?.getAttribute('data-testid') === 'unlike';
          const isRetweeted = retweetElement?.getAttribute('data-testid') === 'unretweet';

          // Extrair timestamp
          const timeElement = tweet.querySelector('time');
          const timestamp = timeElement?.getAttribute('datetime') || new Date().toISOString();

          // Construir URL completa
          const fullUrl = tweetUrl.startsWith('http') ? tweetUrl : `https://x.com${tweetUrl}`;

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
            timestamp,
            url: fullUrl,
            isLiked,
            isRetweeted,
            username
          });
        } catch (error) {
          console.log('Erro ao processar tweet:', error);
        }
      }

      return results;
    });

    await browser.close();

    // A ordenação por "recent" deve usar a URL com &f=live que já traz tweets mais recentes do Twitter
    // Para engajamento, ordenar por total de engajamento
    let sortedTweets;
    if (sortBy === "recent") {
      // Para tweets recentes, manter a ordem original do Twitter (já vem ordenado por data)
      sortedTweets = (tweetsData as Tweet[])
        .filter(tweet => tweet.content !== 'Conteúdo não disponível')
        .slice(0, 10);
    } else {
      // Para engajamento, ordenar por total
      sortedTweets = (tweetsData as Tweet[])
        .filter(tweet => tweet.content !== 'Conteúdo não disponível')
        .sort((a, b) => b.engagement.total - a.engagement.total)
        .slice(0, 10);
    }

    return NextResponse.json(
      { 
        message: `Encontrados ${sortedTweets.length} tweets ${sortBy === "recent" ? "mais recentes" : "com mais engajamento"}`,
        tweets: sortedTweets,
        query: query.trim(),
        sortBy
      },
      { status: 200 }
    );

  } catch (error) {
    await browser.close();
    console.error("Erro durante a busca:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        return NextResponse.json(
          { error: "Timeout: A página demorou muito para carregar ou elemento não foi encontrado." },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: `Erro na busca: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: "Erro desconhecido durante a busca." },
      { status: 500 }
    );
  }
}

async function handleTweetAction(action: string, tweetId: string, amount: number = 1) {
  console.log(`Iniciando ação: ${action} no tweet: ${tweetId} (quantidade: ${amount})`);
  
  if (!action || !tweetId) {
    return NextResponse.json(
      { error: "Ação e ID do tweet são obrigatórios" },
      { status: 400 }
    );
  }

  if (!['like', 'retweet'].includes(action)) {
    return NextResponse.json(
      { error: "Ação inválida. Use 'like' ou 'retweet'" },
      { status: 400 }
    );
  }

  // Validar quantidade
  if (amount < 1 || amount > 100) {
    return NextResponse.json(
      { error: "Quantidade deve ser entre 1 e 100" },
      { status: 400 }
    );
  }

  // Carregar cookies
  let cookies: TwitterCookie[] = [];
  try {
    const cookiesPath = join(process.cwd(), "twitter-cookies.json");
    const cookiesData = readFileSync(cookiesPath, "utf-8");
    cookies = JSON.parse(cookiesData);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar cookies" },
      { status: 400 }
    );
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu"
    ]
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  try {
    await context.addCookies(cookies);

    // Estratégia 1: Tentar acessar o tweet diretamente
    const tweetUrl = `https://x.com/i/web/status/${tweetId}`;
    console.log(`Navegando para tweet: ${tweetUrl}`);
    
    await page.goto(tweetUrl, { 
      waitUntil: "domcontentloaded", 
      timeout: 15000 
    });

    await page.waitForTimeout(3000);

    // Verificar se o tweet carregou corretamente
    let tweetFound = false;
    let targetTweetSelector = '';

    // Primeiro, verificar se estamos na página individual do tweet
    const directTweetExists = await page.locator('[data-testid="tweet"]').first().isVisible().catch(() => false);
    
    if (directTweetExists) {
      console.log("Tweet encontrado na página individual");
      // Na página individual, usar o primeiro tweet (que é o tweet principal)
      targetTweetSelector = '[data-testid="tweet"]';
      tweetFound = true;
    } else {
      console.log("Tweet não encontrado diretamente, tentando estratégia alternativa...");
      
      // Estratégia 2: Buscar na timeline do usuário
      // Extrair username do tweetId se possível, ou usar busca genérica
      await page.goto('https://x.com/search?q=' + encodeURIComponent(tweetId) + '&src=typed_query', { timeout: 10000 });
      await page.waitForTimeout(3000);
      
      // Procurar o tweet específico nos resultados da busca
      const searchTweetExists = await page.locator(`[href*="/status/${tweetId}"]`).first().isVisible().catch(() => false);
      
      if (searchTweetExists) {
        console.log("Tweet encontrado nos resultados da busca");
        targetTweetSelector = `[data-testid="tweet"]:has([href*="/status/${tweetId}"])`;
        tweetFound = true;
      } else {
        // Estratégia 3: Tentar na timeline principal
        console.log("Tentando encontrar tweet na timeline principal...");
        await page.goto('https://x.com/home', { timeout: 10000 });
        await page.waitForTimeout(2000);
        
        // Fazer scroll para tentar encontrar o tweet
        for (let i = 0; i < 5; i++) {
          const foundTweet = await page.locator(`[href*="/status/${tweetId}"]`).first().isVisible().catch(() => false);
          if (foundTweet) {
            console.log(`Tweet encontrado na timeline após ${i + 1} tentativas de scroll`);
            targetTweetSelector = `[data-testid="tweet"]:has([href*="/status/${tweetId}"])`;
            tweetFound = true;
            break;
          }
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(1000);
        }
      }
    }

    if (!tweetFound) {
      await browser.close();
      return NextResponse.json(
        { error: "Tweet não encontrado ou não acessível" },
        { status: 404 }
      );
    }

    // Executar a ação no tweet específico
    if (action === 'like') {
      console.log(`Executando like no tweet: ${targetTweetSelector} (quantidade simulada: ${amount})`);
      
      try {
        // Procurar o botão de like dentro do tweet específico
        const likeButton = page.locator(`${targetTweetSelector} [data-testid="like"]`).first();
        
        // Verificar se o botão existe e está visível
        const likeButtonExists = await likeButton.isVisible({ timeout: 5000 }).catch(() => false);
        
        if (!likeButtonExists) {
          // Fallback: tentar encontrar o botão de like de forma mais genérica
          const genericLikeButton = page.locator('[data-testid="like"]').first();
          await genericLikeButton.waitFor({ state: 'visible', timeout: 10000 });
          await genericLikeButton.click();
        } else {
          await likeButton.click();
        }
        
        await page.waitForTimeout(1000);
        console.log(`Like executado com sucesso (quantidade configurada: ${amount})`);
      } catch (error) {
        console.log(`Erro no like:`, error);
        throw error;
      }
      
    } else if (action === 'retweet') {
      console.log(`Executando retweet no tweet: ${targetTweetSelector} (quantidade simulada: ${amount})`);
      
      try {
        // Procurar o botão de retweet dentro do tweet específico
        const retweetButton = page.locator(`${targetTweetSelector} [data-testid="retweet"]`).first();
        
        // Verificar se o botão existe e está visível
        const retweetButtonExists = await retweetButton.isVisible({ timeout: 5000 }).catch(() => false);
        
        if (!retweetButtonExists) {
          // Fallback: tentar encontrar o botão de retweet de forma mais genérica
          const genericRetweetButton = page.locator('[data-testid="retweet"]').first();
          await genericRetweetButton.waitFor({ state: 'visible', timeout: 10000 });
          await genericRetweetButton.click();
        } else {
          await retweetButton.click();
        }
        
        await page.waitForTimeout(1000);
        
        // Confirmar retweet se necessário
        const confirmButton = page.locator('[data-testid="retweetConfirm"]');
        const confirmExists = await confirmButton.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (confirmExists) {
          await confirmButton.click();
          await page.waitForTimeout(1000);
          console.log(`Retweet confirmado`);
        }
        
        console.log(`Retweet executado com sucesso (quantidade configurada: ${amount})`);
      } catch (error) {
        console.log(`Erro no retweet:`, error);
        throw error;
      }
    }

    await browser.close();

    return NextResponse.json(
      { message: `${action === 'like' ? 'Like' : 'Retweet'} executado com sucesso (${amount} ${amount === 1 ? 'configurado' : 'configurados'})!` },
      { status: 200 }
    );

  } catch (error) {
    await browser.close();
    console.error(`Erro ao executar ${action}:`, error);
    
    // Verificar se é o erro específico do strict mode
    if (error instanceof Error && error.message.includes('strict mode violation')) {
      return NextResponse.json(
        { error: `Erro: Múltiplos elementos encontrados. Tente novamente ou escolha outro tweet.` },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: `Erro ao executar ${action}: ${error instanceof Error ? error.message : "Erro desconhecido"}` },
      { status: 500 }
    );
  }
}

async function handleBatchActions(batchActions: Array<{tweetId: string, action: 'like' | 'retweet', amount: number}>) {
  console.log(`Iniciando ações em lote: ${batchActions.length} ações`);
  
  const results = [];
  let successCount = 0;
  let errorCount = 0;

  for (const batchAction of batchActions) {
    try {
      const result = await handleTweetAction(batchAction.action, batchAction.tweetId, batchAction.amount);
      
      if (result.status === 200) {
        successCount++;
        const data = await result.json();
        results.push({
          tweetId: batchAction.tweetId,
          action: batchAction.action,
          amount: batchAction.amount,
          success: true,
          message: data.message
        });
      } else {
        errorCount++;
        const data = await result.json();
        results.push({
          tweetId: batchAction.tweetId,
          action: batchAction.action,
          amount: batchAction.amount,
          success: false,
          error: data.error
        });
      }
    } catch (error) {
      errorCount++;
      results.push({
        tweetId: batchAction.tweetId,
        action: batchAction.action,
        amount: batchAction.amount,
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }

    // Aguardar um pouco entre ações para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return NextResponse.json(
    { 
      message: `Ações em lote concluídas: ${successCount} sucessos, ${errorCount} erros`,
      results,
      summary: {
        total: batchActions.length,
        success: successCount,
        errors: errorCount
      }
    },
    { status: 200 }
  );
}
