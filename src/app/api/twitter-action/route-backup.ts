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
    const { query, action, tweetId } = body;

    // Se é uma ação específica em um tweet
    if (action && tweetId) {
      return await handleTweetAction(action, tweetId);
    }

    // Buscar tweets (comportamento padrão)
    return await searchTweets(query);
  } catch (error) {
    console.error("Erro geral:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

async function searchTweets(query: string) {
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

    // Navegar para a página de busca do Twitter/X ordenada por engajamento
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(query.trim())}&src=typed_query&f=top`;
    console.log(`Navegando para: ${searchUrl}`);
    
    try {
      await page.goto(searchUrl, { 
        waitUntil: "domcontentloaded", 
        timeout: 20000 
      });
    } catch {
      console.log("Tentando navegação mais simples...");
      await page.goto(searchUrl, { 
        timeout: 15000 
      });
    }

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

    // Coletar informações dos tweets
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

    const tweets = tweetsData as Tweet[];

    await browser.close();

    // Ordenar por engajamento total (maior para menor)
    const sortedTweets = tweets
      .filter(tweet => tweet.content !== 'Conteúdo não disponível')
      .sort((a, b) => b.engagement.total - a.engagement.total)
      .slice(0, 10);

    return NextResponse.json(
      { 
        message: `Encontrados ${sortedTweets.length} tweets com mais engajamento`,
        tweets: sortedTweets,
        query: query.trim()
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

async function handleTweetAction(action: string, tweetId: string) {
  console.log(`Iniciando ação: ${action} no tweet: ${tweetId}`);
  
  // Implementar ações específicas em tweets (like, retweet)
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

    // Estratégia 1: Tentar múltiplas URLs do tweet
    const possibleUrls = [
      `https://x.com/i/web/status/${tweetId}`,
      `https://twitter.com/i/web/status/${tweetId}`,
      `https://x.com/status/${tweetId}`,
      `https://twitter.com/status/${tweetId}`
    ];

    let tweetFound = false;
    
    for (const tweetUrl of possibleUrls) {
      console.log(`Tentando URL: ${tweetUrl}`);
      
      try {
        await page.goto(tweetUrl, { 
          waitUntil: "domcontentloaded", 
          timeout: 10000 
        });

        await page.waitForTimeout(2000);

        // Verificar se o tweet carregou
        const tweetExists = await page.locator('[data-testid="tweet"]').isVisible();
        
        if (tweetExists) {
          console.log(`Tweet encontrado em: ${tweetUrl}`);
          tweetFound = true;
          break;
        }
      } catch (error) {
        console.log(`Falha ao carregar ${tweetUrl}:`, error);
        continue;
      }
    }

    // Estratégia 2: Buscar o tweet via busca do Twitter
    if (!tweetFound) {
      console.log("Tentando encontrar tweet via busca...");
      
      await page.goto('https://x.com/home', { timeout: 10000 });
      await page.waitForTimeout(2000);
      
      // Fazer uma busca pelo ID do tweet
      const searchUrl = `https://x.com/search?q=${tweetId}&src=typed_query`;
      await page.goto(searchUrl, { timeout: 10000 });
      await page.waitForTimeout(3000);
      
      // Procurar pelo tweet nos resultados
      const tweetInResults = page.locator(`[href*="/status/${tweetId}"]`).first();
      if (await tweetInResults.isVisible()) {
        await tweetInResults.click();
        await page.waitForTimeout(2000);
        tweetFound = true;
        console.log("Tweet encontrado via busca");
      }
    }

    if (!tweetFound) {
      throw new Error(`Tweet com ID ${tweetId} não foi encontrado em nenhuma das estratégias`);
    }

    // Executar a ação
    let actionSuccess = false;
    
    if (action === 'like') {
      try {
        const likeButton = page.locator('[data-testid="like"]').first();
        await likeButton.waitFor({ state: 'visible', timeout: 5000 });
        await likeButton.click();
        await page.waitForTimeout(1000);
        actionSuccess = true;
        console.log('Like executado com sucesso');
      } catch (error) {
        console.log('Erro ao executar like:', error);
        throw new Error("Não foi possível encontrar ou clicar no botão de like");
      }
    } else if (action === 'retweet') {
      try {
        const retweetButton = page.locator('[data-testid="retweet"]').first();
        await retweetButton.waitFor({ state: 'visible', timeout: 5000 });
        await retweetButton.click();
        await page.waitForTimeout(1000);
        
        // Procurar e clicar no botão de confirmar retweet
        const confirmButton = page.locator('[data-testid="retweetConfirm"]');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
          await page.waitForTimeout(1000);
        }
        actionSuccess = true;
        console.log('Retweet executado com sucesso');
      } catch (error) {
        console.log('Erro ao executar retweet:', error);
        throw new Error("Não foi possível encontrar ou clicar no botão de retweet");
      }
    }

    await browser.close();

    if (actionSuccess) {
      return NextResponse.json(
        { message: `${action === 'like' ? 'Like' : 'Retweet'} realizado com sucesso!` },
        { status: 200 }
      );
    } else {
      throw new Error("Ação não foi executada");
    }

    return NextResponse.json(
      { message: `${action === 'like' ? 'Like' : 'Retweet'} realizado com sucesso!` },
      { status: 200 }
    );

  } catch (error) {
    await browser.close();
    console.error(`Erro ao executar ${action}:`, error);
    return NextResponse.json(
      { error: `Erro ao executar ${action}: ${error instanceof Error ? error.message : "Erro desconhecido"}` },
      { status: 500 }
    );
  }
}

/*
INSTRUÇÕES PARA CONFIGURAR twitter-cookies.json:

1. Faça login no Twitter no seu navegador
2. Abra as ferramentas de desenvolvedor (F12)
3. Vá para a aba "Application" ou "Storage"
4. Clique em "Cookies" e selecione "https://twitter.com"
5. Copie todos os cookies importantes (especialmente auth_token, ct0, twid)
6. Crie um arquivo twitter-cookies.json na raiz do projeto com este formato:

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

IMPORTANTE: Adicione twitter-cookies.json ao .gitignore para não versioná-lo!
*/
