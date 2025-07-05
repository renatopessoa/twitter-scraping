#!/usr/bin/env node

/**
 * Detector Avançado de Sessões do Twitter
 * 
 * Este script detecta automaticamente sessões ativas do Twitter
 * e extrai cookies válidos do navegador do usuário.
 */

import { chromium } from 'playwright';
import fs from 'fs';

class TwitterSessionDetector {
  constructor(options = {}) {
    this.config = {
      headless: options.headless !== false, // Padrão: true
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      outputFile: 'twitter-cookies-multi.json',
      backupFile: 'twitter-cookies-backup.json',
      ...options
    };
    
    this.browser = null;
    this.detectedSessions = [];
    this.validatedSessions = [];
  }

  log(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      error: '\x1b[31m',
      warning: '\x1b[33m',
      debug: '\x1b[35m',
      reset: '\x1b[0m'
    };
    
    console.log(`${colors[level]}[${timestamp}] ${message}${colors.reset}`);
  }

  /**
   * Detecta sessões ativas do Twitter
   */
  async detectActiveSessions() {
    this.log('info', '🔍 Iniciando detecção de sessões ativas do Twitter...');
    
    try {
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
          '--no-default-browser-check',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows'
        ]
      });

      // Método 1: Verificar cookies existentes
      await this.checkExistingCookies();
      
      // Método 2: Escanear contexto do navegador
      await this.scanBrowserContext();
      
      // Método 3: Verificar sessões em diferentes domínios
      await this.checkDomainSessions();
      
      // Método 4: Tentar acesso direto às páginas protegidas
      await this.checkProtectedPages();
      
      // Validar sessões detectadas
      await this.validateDetectedSessions();
      
      return this.validatedSessions;
      
    } catch (error) {
      this.log('error', `Erro na detecção: ${error.message}`);
      throw error;
    } finally {
      await this.browser?.close();
    }
  }

  /**
   * Verifica cookies existentes nos arquivos
   */
  async checkExistingCookies() {
    this.log('info', '📋 Verificando cookies existentes...');
    
    const cookieFiles = [
      'twitter-cookies.json',
      'twitter-cookies-multi.json',
      'twitter-cookies-auto-extracted.json'
    ];
    
    for (const file of cookieFiles) {
      try {
        if (fs.existsSync(file)) {
          const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
          
          if (Array.isArray(content)) {
            // Arquivo de cookies simples
            if (content.length > 0) {
              this.log('info', `Encontrados ${content.length} cookies em ${file}`);
              await this.validateCookieSet(content, `Cookies de ${file}`);
            }
          } else if (content.accounts && Array.isArray(content.accounts)) {
            // Arquivo multi-conta
            this.log('info', `Encontradas ${content.accounts.length} contas em ${file}`);
            for (const account of content.accounts) {
              await this.validateCookieSet(account.cookies, account.name);
            }
          }
        }
      } catch (error) {
        this.log('warning', `Erro ao verificar ${file}: ${error.message}`);
      }
    }
  }

  /**
   * Escanea contexto do navegador
   */
  async scanBrowserContext() {
    this.log('info', '🌐 Escaneando contexto do navegador...');
    
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'pt-BR'
    });

    try {
      const page = await context.newPage();
      
      // Ir para Twitter
      await page.goto('https://twitter.com', { 
        waitUntil: 'networkidle',
        timeout: this.config.timeout 
      });

      await page.waitForTimeout(3000);

      // Verificar se está logado
      const isLoggedIn = await this.detectLoginStatus(page);
      
      if (isLoggedIn) {
        this.log('success', '✅ Sessão ativa detectada!');
        
        // Extrair dados da sessão
        const sessionData = await this.extractSessionData(page, context);
        this.detectedSessions.push(sessionData);
      } else {
        this.log('warning', '❌ Nenhuma sessão ativa detectada no contexto padrão');
      }

    } catch (error) {
      this.log('error', `Erro no escaneamento: ${error.message}`);
    } finally {
      await context.close();
    }
  }

  /**
   * Verifica sessões em diferentes domínios
   */
  async checkDomainSessions() {
    this.log('info', '🔄 Verificando sessões em diferentes domínios...');
    
    const domains = [
      'https://twitter.com',
      'https://x.com',
      'https://mobile.twitter.com'
    ];
    
    for (const domain of domains) {
      try {
        const context = await this.browser.newContext();
        const page = await context.newPage();
        
        await page.goto(domain, { timeout: this.config.timeout });
        await page.waitForTimeout(2000);
        
        const cookies = await context.cookies();
        const authCookies = cookies.filter(c => 
          ['auth_token', 'ct0', 'twid'].includes(c.name) && 
          c.value && c.value.length > 10
        );
        
        if (authCookies.length >= 2) {
          this.log('success', `✅ Cookies de autenticação encontrados em ${domain}`);
          
          // Validar se os cookies funcionam
          await this.validateCookieSet(cookies, `Sessão de ${domain}`);
        }
        
        await context.close();
        
      } catch (error) {
        this.log('warning', `Erro ao verificar ${domain}: ${error.message}`);
      }
    }
  }

  /**
   * Verifica acesso a páginas protegidas
   */
  async checkProtectedPages() {
    this.log('info', '🔐 Verificando acesso a páginas protegidas...');
    
    const protectedPages = [
      'https://twitter.com/home',
      'https://twitter.com/notifications',
      'https://twitter.com/messages',
      'https://twitter.com/settings/profile'
    ];
    
    const context = await this.browser.newContext();
    
    try {
      for (const url of protectedPages) {
        try {
          const page = await context.newPage();
          
          await page.goto(url, { timeout: this.config.timeout });
          await page.waitForTimeout(2000);
          
          // Verificar se foi redirecionado para login
          const currentUrl = page.url();
          const isOnLoginPage = currentUrl.includes('/login') || 
                              currentUrl.includes('/i/flow/login') ||
                              await page.locator('[data-testid="login-button"]').isVisible().catch(() => false);
          
          if (!isOnLoginPage) {
            this.log('success', `✅ Acesso autorizado a ${url}`);
            
            // Extrair cookies desta sessão
            const cookies = await context.cookies();
            await this.validateCookieSet(cookies, `Sessão de ${url}`);
          }
          
          await page.close();
          
        } catch (error) {
          this.log('warning', `Erro ao verificar ${url}: ${error.message}`);
        }
      }
    } finally {
      await context.close();
    }
  }

  /**
   * Detecta status de login
   */
  async detectLoginStatus(page) {
    const loginIndicators = [
      '[data-testid="SideNav_AccountSwitcher_Button"]',
      '[data-testid="AppTabBar_Profile_Link"]',
      '[aria-label="Profile"]',
      '[data-testid="primaryColumn"]',
      '[data-testid="sidebarColumn"]',
      '[data-testid="tweet"]'
    ];
    
    const loginPageIndicators = [
      '[data-testid="LoginForm_Login_Button"]',
      '[data-testid="login-button"]',
      'input[name="text"]',
      'input[name="password"]',
      '[data-testid="loginButton"]'
    ];
    
    try {
      // Verificar se há indicadores de página de login
      for (const selector of loginPageIndicators) {
        if (await page.locator(selector).isVisible({ timeout: 1000 }).catch(() => false)) {
          return false;
        }
      }
      
      // Verificar se há indicadores de usuário logado
      for (const selector of loginIndicators) {
        if (await page.locator(selector).isVisible({ timeout: 3000 }).catch(() => false)) {
          return true;
        }
      }
      
      return false;
      
    } catch (error) {
      this.log('debug', `Erro na detecção de login: ${error.message}`);
      return false;
    }
  }

  /**
   * Extrai dados da sessão
   */
  async extractSessionData(page, context) {
    try {
      const sessionData = {
        name: 'Sessão Detectada',
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
      
      // Tentar extrair username
      try {
        const usernameElement = await page.locator('[data-testid="UserName"]').first();
        if (await usernameElement.isVisible({ timeout: 3000 })) {
          const username = await usernameElement.textContent();
          if (username) {
            sessionData.username = username.replace('@', '');
            sessionData.name = `Conta: ${username}`;
          }
        }
      } catch {
        this.log('debug', 'Não foi possível extrair username');
      }
      
      return sessionData;
      
    } catch (error) {
      this.log('error', `Erro ao extrair dados da sessão: ${error.message}`);
      throw error;
    }
  }

  /**
   * Valida um conjunto de cookies
   */
  async validateCookieSet(cookies, sessionName) {
    try {
      const context = await this.browser.newContext();
      
      // Adicionar cookies ao contexto
      await context.addCookies(cookies);
      
      const page = await context.newPage();
      
      // Tentar acessar uma página protegida
      await page.goto('https://twitter.com/home', { timeout: this.config.timeout });
      await page.waitForTimeout(3000);
      
      // Verificar se está logado
      const isLoggedIn = await this.detectLoginStatus(page);
      
      if (isLoggedIn) {
        this.log('success', `✅ Cookies válidos para: ${sessionName}`);
        
        // Extrair dados adicionais
        const sessionData = await this.extractSessionData(page, context);
        sessionData.name = sessionName;
        
        // Verificar se já existe uma sessão similar
        const existingSession = this.validatedSessions.find(s => 
          s.username === sessionData.username || 
          s.name === sessionData.name
        );
        
        if (!existingSession) {
          this.validatedSessions.push(sessionData);
        }
      } else {
        this.log('warning', `❌ Cookies inválidos para: ${sessionName}`);
      }
      
      await context.close();
      
    } catch (error) {
      this.log('error', `Erro ao validar cookies de ${sessionName}: ${error.message}`);
    }
  }

  /**
   * Valida todas as sessões detectadas
   */
  async validateDetectedSessions() {
    this.log('info', '🔍 Validando sessões detectadas...');
    
    for (const session of this.detectedSessions) {
      await this.validateCookieSet(session.cookies, session.name);
    }
  }

  /**
   * Salva as sessões detectadas
   */
  async saveDetectedSessions() {
    if (this.validatedSessions.length === 0) {
      this.log('warning', 'Nenhuma sessão válida encontrada para salvar');
      return;
    }
    
    // Backup da configuração existente
    if (fs.existsSync(this.config.outputFile)) {
      const backup = fs.readFileSync(this.config.outputFile, 'utf-8');
      fs.writeFileSync(this.config.backupFile, backup);
      this.log('info', `📋 Backup criado: ${this.config.backupFile}`);
    }
    
    // Criar nova configuração
    const config = {
      accounts: this.validatedSessions,
      detectedAutomatically: true,
      lastDetection: new Date().toISOString(),
      totalAccounts: this.validatedSessions.length,
      detectionMethod: 'automatic-scanner'
    };
    
    fs.writeFileSync(this.config.outputFile, JSON.stringify(config, null, 2));
    this.log('success', `✅ Configuração salva: ${this.config.outputFile}`);
    
    // Salvar também no formato simples para compatibilidade
    if (this.validatedSessions.length === 1) {
      fs.writeFileSync('twitter-cookies.json', JSON.stringify(this.validatedSessions[0].cookies, null, 2));
      this.log('success', '✅ Cookies salvos no formato simples: twitter-cookies.json');
    }
  }

  /**
   * Gera relatório de detecção
   */
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RELATÓRIO DE DETECÇÃO DE SESSÕES');
    console.log('='.repeat(60));
    
    if (this.validatedSessions.length === 0) {
      console.log('❌ Nenhuma sessão ativa detectada');
      console.log('\n💡 SOLUÇÕES POSSÍVEIS:');
      console.log('1. Abra o Twitter no navegador e faça login');
      console.log('2. Mantenha a sessão ativa (não feche o navegador)');
      console.log('3. Execute o script novamente');
      console.log('4. Verifique se não há bloqueios de cookies');
      return;
    }
    
    console.log(`✅ ${this.validatedSessions.length} sessões válidas detectadas:`);
    
    this.validatedSessions.forEach((session, index) => {
      console.log(`\n📱 Sessão ${index + 1}:`);
      console.log(`   Nome: ${session.name}`);
      console.log(`   Username: ${session.username}`);
      console.log(`   Cookies: ${session.cookies.length} cookies`);
      console.log(`   Extraído em: ${new Date(session.extractedAt).toLocaleString()}`);
    });
    
    console.log('\n✅ Configuração salva com sucesso!');
    console.log('💻 Agora você pode usar a aplicação normalmente.');
  }
}

// Função principal
async function main() {
  console.log('🔍 DETECTOR DE SESSÕES DO TWITTER');
  console.log('='.repeat(50));
  
  const detector = new TwitterSessionDetector({
    headless: true, // Mude para false para ver o navegador
    timeout: 30000
  });
  
  try {
    await detector.detectActiveSessions();
    
    await detector.saveDetectedSessions();
    detector.generateReport();
    
  } catch (error) {
    console.error('❌ Erro na detecção:', error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default TwitterSessionDetector;
