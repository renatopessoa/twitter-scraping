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

export async function POST(request: NextRequest) {
  try {
    // Validar se a query foi fornecida
    const body = await request.json();
    const { query } = body;

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

      // Navegar para a página de busca do Twitter
      const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(query.trim())}&src=typed_query&f=live`;
      console.log(`Navegando para: ${searchUrl}`);
      
      await page.goto(searchUrl, { 
        waitUntil: "networkidle", 
        timeout: 30000 
      });

      // Aguardar um pouco para garantir que a página carregou
      await page.waitForTimeout(3000);

      // Verificar se estamos logados (procurar por indicadores de usuário logado)
      const isLoggedIn = await page.locator('[data-testid="SideNav_AccountSwitcher_Button"]').isVisible()
        .catch(() => false);

      if (!isLoggedIn) {
        // Tentar outros seletores para verificar se está logado
        const isLoggedInAlt = await page.locator('[data-testid="primaryColumn"]').isVisible()
          .catch(() => false);
        
        if (!isLoggedInAlt) {
          await browser.close();
          return NextResponse.json(
            { error: "Não foi possível fazer login no Twitter. Verifique se os cookies estão válidos." },
            { status: 400 }
          );
        }
      }

      // Aguardar pelos tweets carregarem
      console.log("Aguardando tweets carregarem...");
      await page.waitForSelector('[data-testid="tweet"]', { 
        timeout: 15000 
      });

      // Localizar o primeiro tweet
      const firstTweet = page.locator('[data-testid="tweet"]').first();
      await firstTweet.waitFor({ state: "visible", timeout: 10000 });

      // Localizar o botão de curtir no primeiro tweet
      const likeButton = firstTweet.locator('[data-testid="like"]');
      await likeButton.waitFor({ state: "visible", timeout: 5000 });

      // Verificar se o tweet já foi curtido
      const isLiked = await likeButton.getAttribute("data-testid");
      if (isLiked && isLiked.includes("unlike")) {
        await browser.close();
        return NextResponse.json(
          { message: "O primeiro tweet da busca já estava curtido!" },
          { status: 200 }
        );
      }

      // Clicar no botão curtir
      console.log("Clicando no botão curtir...");
      await likeButton.click();

      // Aguardar um pouco para garantir que a ação foi processada
      await page.waitForTimeout(2000);

      // Verificar se o tweet foi curtido com sucesso
      const likeButtonAfter = firstTweet.locator('[data-testid="unlike"]');
      const wasLiked = await likeButtonAfter.isVisible().catch(() => false);

      await browser.close();

      if (wasLiked) {
        return NextResponse.json(
          { message: "Tweet curtido com sucesso!" },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          { message: "Tweet processado, mas não foi possível confirmar se foi curtido." },
          { status: 200 }
        );
      }

    } catch (error) {
      await browser.close();
      console.error("Erro durante a automação:", error);
      
      if (error instanceof Error) {
        if (error.message.includes("timeout")) {
          return NextResponse.json(
            { error: "Timeout: A página demorou muito para carregar ou elemento não foi encontrado." },
            { status: 500 }
          );
        }
        
        return NextResponse.json(
          { error: `Erro na automação: ${error.message}` },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: "Erro desconhecido durante a automação." },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("Erro geral:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
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
