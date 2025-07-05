import { NextRequest, NextResponse } from "next/server";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

interface TwitterCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

interface DetectedSession {
  name: string;
  username: string;
  extractedAt: string;
  cookies: TwitterCookie[];
  metrics: {
    followers: number;
    following: number;
    verified: boolean;
  };
}

interface SessionDetectionOptions {
  headless?: boolean;
  timeout?: number;
  maxRetries?: number;
}

interface DetectorConfig {
  headless: boolean;
  timeout: number;
  maxRetries: number;
  scanProfile: {
    userAgent: string;
    viewport: { width: number; height: number };
    locale: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, options = {} } = body;

    if (action === "detect-sessions") {
      return await handleSessionDetection(options);
    }

    if (action === "validate-sessions") {
      return await handleSessionValidation();
    }

    return NextResponse.json(
      { error: "Ação não reconhecida" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Erro na detecção de sessões:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

async function handleSessionDetection(options: SessionDetectionOptions): Promise<NextResponse> {
  console.log("🔍 Iniciando detecção automática de sessões...");
  
  const detector = new TwitterSessionDetector(options);
  
  try {
    const sessions = await detector.detectActiveSessions();
    
    if (sessions.length > 0) {
      // Salvar configuração
      await saveMultiAccountConfig(sessions);
      
      return NextResponse.json({
        success: true,
        message: `${sessions.length} sessões detectadas e configuradas com sucesso!`,
        sessions: sessions,
        totalDetected: sessions.length
      });
    } else {
      return NextResponse.json({
        success: false,
        message: "Nenhuma sessão ativa detectada. Certifique-se de estar logado no Twitter.",
        sessions: [],
        totalDetected: 0
      });
    }
  } catch (error) {
    console.error("Erro na detecção:", error);
    return NextResponse.json(
      { 
        error: `Erro na detecção: ${error instanceof Error ? error.message : "Erro desconhecido"}` 
      },
      { status: 500 }
    );
  }
}

async function handleSessionValidation(): Promise<NextResponse> {
  console.log("🔍 Validando sessões existentes...");
  
  try {
    const configPath = join(process.cwd(), "twitter-cookies-multi.json");
    
    if (!existsSync(configPath)) {
      return NextResponse.json({
        success: false,
        message: "Nenhuma configuração de contas encontrada",
        sessions: [],
        totalDetected: 0
      });
    }
    
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    
    if (!config.accounts || !Array.isArray(config.accounts)) {
      return NextResponse.json({
        success: false,
        message: "Configuração inválida",
        sessions: [],
        totalDetected: 0
      });
    }
    
    const validator = new TwitterSessionDetector();
    const validSessions = [];
    
    for (const account of config.accounts) {
      try {
        const isValid = await validator.validateSession(account);
        if (isValid) {
          validSessions.push(account);
        }
      } catch (error) {
        console.error(`Erro ao validar conta ${account.name}:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `${validSessions.length} de ${config.accounts.length} sessões válidas`,
      sessions: validSessions,
      totalDetected: validSessions.length,
      totalOriginal: config.accounts.length
    });
    
  } catch (error) {
    console.error("Erro na validação:", error);
    return NextResponse.json(
      { 
        error: `Erro na validação: ${error instanceof Error ? error.message : "Erro desconhecido"}` 
      },
      { status: 500 }
    );
  }
}

async function saveMultiAccountConfig(sessions: DetectedSession[]) {
  const configPath = join(process.cwd(), "twitter-cookies-multi.json");
  const backupPath = join(process.cwd(), "twitter-cookies-multi.backup.json");
  
  // Backup da configuração existente
  if (existsSync(configPath)) {
    const backup = readFileSync(configPath, "utf-8");
    writeFileSync(backupPath, backup);
    console.log("📋 Backup da configuração criado");
  }
  
  // Criar nova configuração
  const config = {
    accounts: sessions,
    detectedAutomatically: true,
    lastDetection: new Date().toISOString(),
    totalAccounts: sessions.length
  };
  
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("✅ Configuração salva com sucesso");
}

class TwitterSessionDetector {
  private browser: Browser | null = null;
  private detectedSessions: DetectedSession[] = [];
  private config: DetectorConfig;

  constructor(options: SessionDetectionOptions = {}) {
    this.config = {
      headless: options.headless !== false, // Padrão: true
      timeout: options.timeout || 15000,
      maxRetries: options.maxRetries || 3,
      scanProfile: {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'pt-BR'
      }
    };
  }

  async detectActiveSessions(): Promise<DetectedSession[]> {
    console.log("🔍 Iniciando detecção de sessões ativas...");
    
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check'
      ]
    });

    try {
      await this.scanPersistentContext();
      await this.scanRedirectPatterns();
      await this.scanDomainCookies();
      await this.validateDetectedSessions();
      
      return this.detectedSessions;
      
    } catch (error) {
      console.error("Erro na detecção:", error);
      throw error;
    } finally {
      await this.browser?.close();
    }
  }

  async scanPersistentContext() {
    console.log("📊 Escaneando contexto persistente...");
    
    if (!this.browser) {
      throw new Error("Browser não inicializado");
    }
    
    const context = await this.browser.newContext({
      ...this.config.scanProfile,
      acceptDownloads: false,
      ignoreHTTPSErrors: true
    });

    try {
      const page = await context.newPage();
      
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });

      await page.goto('https://twitter.com', { 
        waitUntil: 'networkidle',
        timeout: this.config.timeout 
      });

      await page.waitForTimeout(3000);

      const isLoggedIn = await this.detectLoginStatus(page);
      
      if (isLoggedIn) {
        console.log("✅ Sessão ativa detectada no contexto persistente");
        
        const sessionData = await this.extractSessionData(page, context);
        this.detectedSessions.push(sessionData);
      } else {
        console.log("❌ Nenhuma sessão ativa no contexto persistente");
      }

    } catch (error) {
      console.error("Erro no contexto persistente:", error);
    } finally {
      await context.close();
    }
  }

  async scanRedirectPatterns() {
    console.log("🔄 Escaneando padrões de redirecionamento...");
    
    const testUrls = [
      'https://twitter.com/home',
      'https://twitter.com/notifications',
      'https://twitter.com/messages'
    ];

    for (const url of testUrls) {
      if (!this.browser) {
        throw new Error("Browser não inicializado");
      }
      
      const context = await this.browser.newContext(this.config.scanProfile);
      
      try {
        const page = await context.newPage();
        
        await page.goto(url, { 
          waitUntil: 'networkidle',
          timeout: this.config.timeout 
        });

        if (!page.url().includes('/login') && !page.url().includes('/i/flow/login')) {
          console.log(`✅ Sessão detectada via redirecionamento: ${url}`);
          
          const sessionData = await this.extractSessionData(page, context);
          
          if (!this.detectedSessions.some(s => s.username === sessionData.username)) {
            this.detectedSessions.push(sessionData);
          }
        }

      } catch (error) {
        console.log(`Erro ao testar ${url}:`, error);
      } finally {
        await context.close();
      }
    }
  }

  async scanDomainCookies() {
    console.log("🍪 Escaneando cookies de domínio...");
    
    if (!this.browser) {
      throw new Error("Browser não inicializado");
    }
    
    const context = await this.browser.newContext(this.config.scanProfile);
    
    try {
      const page = await context.newPage();
      
      const domains = ['https://twitter.com', 'https://x.com'];
      
      for (const domain of domains) {
        try {
          await page.goto(domain, { timeout: this.config.timeout });
          await page.waitForTimeout(2000);
          
          const cookies = await context.cookies();
          const authCookies = cookies.filter(c => 
            ['auth_token', 'ct0', 'twid'].includes(c.name) && 
            c.value && c.value.length > 10
          );
          
          if (authCookies.length >= 2) {
            console.log(`✅ Cookies de autenticação encontrados em ${domain}`);
            
            const sessionData = await this.extractSessionFromCookies(page, context);
            
            if (sessionData && !this.detectedSessions.some(s => s.username === sessionData.username)) {
              this.detectedSessions.push(sessionData);
            }
          }
          
        } catch (error) {
          console.log(`Erro ao escanear ${domain}:`, error);
        }
      }
      
    } catch (error) {
      console.error("Erro no escaneamento de cookies:", error);
    } finally {
      await context.close();
    }
  }

  async detectLoginStatus(page: Page): Promise<boolean> {
    const loginIndicators = [
      '[data-testid="SideNav_AccountSwitcher_Button"]',
      '[data-testid="AppTabBar_Profile_Link"]',
      '[aria-label="Profile"]',
      '[data-testid="primaryColumn"]'
    ];
    
    const loginPageIndicators = [
      '[data-testid="LoginForm_Login_Button"]',
      '[data-testid="login-button"]',
      'input[name="text"]',
      'input[name="password"]'
    ];
    
    try {
      // Verificar se há indicadores de página de login
      for (const selector of loginPageIndicators) {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
          return false;
        }
      }
      
      // Verificar se há indicadores de usuário logado
      for (const selector of loginIndicators) {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
          return true;
        }
      }
      
      return false;
      
    } catch (error) {
      console.log("Erro na detecção de login:", error);
      return false;
    }
  }

  async extractSessionData(page: Page, context: BrowserContext): Promise<DetectedSession> {
    try {
      console.log("📋 Extraindo dados da sessão...");
      
      const sessionData: DetectedSession = {
        name: 'Usuário Detectado',
        username: 'usuario_detectado',
        extractedAt: new Date().toISOString(),
        cookies: [],
        metrics: {
          followers: 0,
          following: 0,
          verified: false
        }
      };
      
      // Extrair cookies
      const cookies = await context.cookies();
      sessionData.cookies = cookies.filter(c => 
        ['auth_token', 'ct0', 'twid', 'kdt', 'auth_multi', 'personalization_id', 'guest_id'].includes(c.name)
      );
      
      // Tentar extrair dados do perfil
      try {
        await page.goto('https://twitter.com/settings/profile', { 
          timeout: this.config.timeout,
          waitUntil: 'networkidle' 
        });
        
        await page.waitForTimeout(2000);
        
        const nameInput = page.locator('[data-testid="displayNameInput"]').first();
        if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          const name = await nameInput.inputValue();
          if (name) sessionData.name = name;
        }
        
        const usernameInput = page.locator('[data-testid="usernameInput"]').first();
        if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          const username = await usernameInput.inputValue();
          if (username) sessionData.username = username;
        }
        
      } catch (error) {
        console.log("Erro ao extrair dados do perfil:", error);
      }
      
      console.log(`✅ Dados extraídos: ${sessionData.name} (@${sessionData.username})`);
      return sessionData;
      
    } catch (error) {
      console.error("Erro na extração de dados:", error);
      throw error;
    }
  }

  async extractSessionFromCookies(page: Page, context: BrowserContext): Promise<DetectedSession | null> {
    try {
      await page.goto('https://twitter.com/home', { timeout: this.config.timeout });
      await page.waitForTimeout(2000);
      
      if (await this.detectLoginStatus(page)) {
        return await this.extractSessionData(page, context);
      }
      
      return null;
      
    } catch (error) {
      console.log("Erro ao extrair sessão de cookies:", error);
      return null;
    }
  }

  async validateDetectedSessions() {
    console.log("🔍 Validando sessões detectadas...");
    
    const validSessions = [];
    
    for (const session of this.detectedSessions) {
      try {
        const isValid = await this.validateSession(session);
        if (isValid) {
          validSessions.push(session);
          console.log(`✅ Sessão válida: ${session.name} (@${session.username})`);
        } else {
          console.log(`⚠️ Sessão inválida: ${session.name}`);
        }
      } catch (error) {
        console.error(`Erro ao validar sessão ${session.name}:`, error);
      }
    }
    
    this.detectedSessions = validSessions;
    console.log(`🎯 ${validSessions.length} sessões válidas encontradas`);
  }

  async validateSession(session: DetectedSession): Promise<boolean> {
    if (!this.browser) {
      throw new Error("Browser não inicializado");
    }
    
    const context = await this.browser.newContext(this.config.scanProfile);
    
    try {
      await context.addCookies(session.cookies);
      
      const page = await context.newPage();
      
      await page.goto('https://twitter.com/home', { timeout: this.config.timeout });
      await page.waitForTimeout(2000);
      
      return await this.detectLoginStatus(page);
      
    } catch (error) {
      console.log("Erro na validação:", error);
      return false;
    } finally {
      await context.close();
    }
  }
}
