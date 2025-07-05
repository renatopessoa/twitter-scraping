/**
 * Sistema Avançado de Detecção de Sessões do Twitter
 * 
 * Este sistema detecta automaticamente sessões ativas do Twitter
 * e extrai cookies válidos sem necessidade de intervenção manual.
 */

import { chromium } from 'playwright';
import fs from 'fs';

class TwitterSessionDetector {
  constructor() {
    this.browser = null;
    this.detectedSessions = [];
    this.config = {
      headless: true,
      timeout: 15000,
      maxRetries: 3,
      outputFile: 'twitter-cookies-multi.json',
      backupFile: 'twitter-cookies-backup.json',
      scanProfile: {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'pt-BR'
      }
    };
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
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
   * Detecta sessões ativas do Twitter em diferentes contextos
   */
  async detectActiveSessions() {
    this.log('info', '🔍 Iniciando detecção de sessões ativas...');
    
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
      // Estratégia 1: Verificar contexto persistente
      await this.scanPersistentContext();
      
      // Estratégia 2: Detectar sessões através de redirecionamentos
      await this.scanRedirectPatterns();
      
      // Estratégia 3: Analisar cookies de domínio
      await this.scanDomainCookies();
      
      // Estratégia 4: Verificar storage local
      await this.scanLocalStorage();
      
      // Validar e processar sessões detectadas
      await this.validateDetectedSessions();
      
      // Salvar configuração multi-conta
      await this.saveMultiAccountConfig();
      
      return this.detectedSessions;
      
    } catch (error) {
      this.log('error', `Erro na detecção: ${error.message}`);
      throw error;
    } finally {
      await this.browser?.close();
    }
  }

  /**
   * Escaneia contexto persistente do navegador
   */
  async scanPersistentContext() {
    this.log('info', '📊 Escaneando contexto persistente...');
    
    const context = await this.browser.newContext({
      ...this.config.scanProfile,
      acceptDownloads: false,
      ignoreHTTPSErrors: true
    });

    try {
      const page = await context.newPage();
      
      // Evitar detecção de bot
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });

      // Navegar para Twitter
      await page.goto('https://twitter.com', { 
        waitUntil: 'networkidle',
        timeout: this.config.timeout 
      });

      // Aguardar carregamento
      await page.waitForTimeout(3000);

      // Detectar se está logado
      const isLoggedIn = await this.detectLoginStatus(page);
      
      if (isLoggedIn) {
        this.log('success', '✅ Sessão ativa detectada no contexto persistente');
        
        const sessionData = await this.extractSessionData(page, context);
        this.detectedSessions.push(sessionData);
      } else {
        this.log('info', '❌ Nenhuma sessão ativa no contexto persistente');
      }

    } catch (error) {
      this.log('error', `Erro no contexto persistente: ${error.message}`);
    } finally {
      await context.close();
    }
  }

  /**
   * Detecta padrões de redirecionamento que indicam login
   */
  async scanRedirectPatterns() {
    this.log('info', '🔄 Escaneando padrões de redirecionamento...');
    
    const testUrls = [
      'https://twitter.com/home',
      'https://twitter.com/notifications',
      'https://twitter.com/messages',
      'https://twitter.com/settings/profile'
    ];

    for (const url of testUrls) {
      const context = await this.browser.newContext(this.config.scanProfile);
      
      try {
        const page = await context.newPage();
        
        await page.goto(url, { 
          waitUntil: 'networkidle',
          timeout: this.config.timeout 
        });

        // Se não redirecionou para login, significa que está logado
        if (!page.url().includes('/login') && !page.url().includes('/i/flow/login')) {
          this.log('success', `✅ Sessão detectada via redirecionamento: ${url}`);
          
          const sessionData = await this.extractSessionData(page, context);
          
          // Evitar duplicatas
          if (!this.detectedSessions.some(s => s.username === sessionData.username)) {
            this.detectedSessions.push(sessionData);
          }
        }

      } catch (error) {
        this.log('debug', `Erro ao testar ${url}: ${error.message}`);
      } finally {
        await context.close();
      }
    }
  }

  /**
   * Escaneia cookies de domínio para detectar sessões
   */
  async scanDomainCookies() {
    this.log('info', '🍪 Escaneando cookies de domínio...');
    
    const context = await this.browser.newContext(this.config.scanProfile);
    
    try {
      const page = await context.newPage();
      
      // Visitar domínios do Twitter
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
            this.log('success', `✅ Cookies de autenticação encontrados em ${domain}`);
            
            // Tentar extrair dados da sessão
            const sessionData = await this.extractSessionFromCookies(page, context);
            
            if (sessionData && !this.detectedSessions.some(s => s.username === sessionData.username)) {
              this.detectedSessions.push(sessionData);
            }
          }
          
        } catch (error) {
          this.log('debug', `Erro ao escanear ${domain}: ${error.message}`);
        }
      }
      
    } catch (error) {
      this.log('error', `Erro no escaneamento de cookies: ${error.message}`);
    } finally {
      await context.close();
    }
  }

  /**
   * Escaneia storage local para detectar dados de sessão
   */
  async scanLocalStorage() {
    this.log('info', '💾 Escaneando storage local...');
    
    const context = await this.browser.newContext(this.config.scanProfile);
    
    try {
      const page = await context.newPage();
      
      await page.goto('https://twitter.com', { timeout: this.config.timeout });
      await page.waitForTimeout(2000);
      
      // Verificar localStorage
      const localStorageData = await page.evaluate(() => {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('twitter') || key.includes('auth') || key.includes('user'))) {
            data[key] = localStorage.getItem(key);
          }
        }
        return data;
      });
      
      // Verificar sessionStorage
      const sessionStorageData = await page.evaluate(() => {
        const data = {};
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && (key.includes('twitter') || key.includes('auth') || key.includes('user'))) {
            data[key] = sessionStorage.getItem(key);
          }
        }
        return data;
      });
      
      if (Object.keys(localStorageData).length > 0 || Object.keys(sessionStorageData).length > 0) {
        this.log('success', '✅ Dados de sessão encontrados no storage local');
        this.log('debug', `LocalStorage: ${Object.keys(localStorageData).length} itens`);
        this.log('debug', `SessionStorage: ${Object.keys(sessionStorageData).length} itens`);
      }
      
    } catch (error) {
      this.log('error', `Erro no escaneamento de storage: ${error.message}`);
    } finally {
      await context.close();
    }
  }

  /**
   * Detecta se o usuário está logado na página
   */
  async detectLoginStatus(page) {
    const loginIndicators = [
      // Indicadores de usuário logado
      '[data-testid="SideNav_AccountSwitcher_Button"]',
      '[data-testid="AppTabBar_Profile_Link"]',
      '[aria-label="Profile"]',
      '[data-testid="primaryColumn"]',
      '[data-testid="tweet"]',
      '[data-testid="tweetButtonInline"]'
    ];
    
    const loginPageIndicators = [
      // Indicadores de página de login
      '[data-testid="LoginForm_Login_Button"]',
      '[data-testid="login-button"]',
      'input[name="text"]',
      'input[name="password"]'
    ];
    
    try {
      // Verificar se há indicadores de login
      for (const selector of loginPageIndicators) {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
          return false; // Está na página de login
        }
      }
      
      // Verificar se há indicadores de usuário logado
      for (const selector of loginIndicators) {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
          return true; // Está logado
        }
      }
      
      return false;
      
    } catch (error) {
      this.log('debug', `Erro na detecção de login: ${error.message}`);
      return false;
    }
  }

  /**
   * Extrai dados da sessão ativa
   */
  async extractSessionData(page, context) {
    try {
      this.log('info', '📋 Extraindo dados da sessão...');
      
      const sessionData = {
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
        
        // Extrair nome
        const nameInput = page.locator('[data-testid="displayNameInput"]').first();
        if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          const name = await nameInput.inputValue();
          if (name) sessionData.name = name;
        }
        
        // Extrair username
        const usernameInput = page.locator('[data-testid="usernameInput"]').first();
        if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          const username = await usernameInput.inputValue();
          if (username) sessionData.username = username;
        }
        
      } catch (error) {
        this.log('debug', `Erro ao extrair dados do perfil: ${error.message}`);
      }
      
      // Tentar extrair métricas do perfil público
      if (sessionData.username !== 'usuario_detectado') {
        try {
          await page.goto(`https://twitter.com/${sessionData.username}`, { timeout: this.config.timeout });
          await page.waitForTimeout(2000);
          
          // Métricas básicas
          const followingText = await page.locator('[href$="/following"] span').first().textContent().catch(() => '0');
          const followersText = await page.locator('[href$="/followers"] span').first().textContent().catch(() => '0');
          
          sessionData.metrics.following = this.parseMetricNumber(followingText);
          sessionData.metrics.followers = this.parseMetricNumber(followersText);
          
        } catch (error) {
          this.log('debug', `Erro ao extrair métricas: ${error.message}`);
        }
      }
      
      this.log('success', `✅ Dados extraídos: ${sessionData.name} (@${sessionData.username})`);
      return sessionData;
      
    } catch (error) {
      this.log('error', `Erro na extração de dados: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extrai dados da sessão a partir de cookies
   */
  async extractSessionFromCookies(page, context) {
    try {
      // Tentar navegar para uma página protegida
      await page.goto('https://twitter.com/home', { timeout: this.config.timeout });
      await page.waitForTimeout(2000);
      
      if (await this.detectLoginStatus(page)) {
        return await this.extractSessionData(page, context);
      }
      
      return null;
      
    } catch (error) {
      this.log('debug', `Erro ao extrair sessão de cookies: ${error.message}`);
      return null;
    }
  }

  /**
   * Valida sessões detectadas
   */
  async validateDetectedSessions() {
    this.log('info', '🔍 Validando sessões detectadas...');
    
    const validSessions = [];
    
    for (const session of this.detectedSessions) {
      try {
        const isValid = await this.validateSession(session);
        if (isValid) {
          validSessions.push(session);
          this.log('success', `✅ Sessão válida: ${session.name} (@${session.username})`);
        } else {
          this.log('warning', `⚠️ Sessão inválida: ${session.name}`);
        }
      } catch (error) {
        this.log('error', `Erro ao validar sessão ${session.name}: ${error.message}`);
      }
    }
    
    this.detectedSessions = validSessions;
    this.log('info', `🎯 ${validSessions.length} sessões válidas encontradas`);
  }

  /**
   * Valida uma sessão específica
   */
  async validateSession(session) {
    const context = await this.browser.newContext(this.config.scanProfile);
    
    try {
      // Aplicar cookies da sessão
      await context.addCookies(session.cookies);
      
      const page = await context.newPage();
      
      // Tentar acessar uma página protegida
      await page.goto('https://twitter.com/home', { timeout: this.config.timeout });
      await page.waitForTimeout(2000);
      
      // Verificar se está logado
      return await this.detectLoginStatus(page);
      
    } catch (error) {
      this.log('debug', `Erro na validação: ${error.message}`);
      return false;
    } finally {
      await context.close();
    }
  }

  /**
   * Salva configuração multi-conta
   */
  async saveMultiAccountConfig() {
    try {
      if (this.detectedSessions.length === 0) {
        this.log('warning', '⚠️ Nenhuma sessão válida para salvar');
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
        accounts: this.detectedSessions,
        detectedAutomatically: true,
        lastDetection: new Date().toISOString(),
        totalAccounts: this.detectedSessions.length
      };
      
      fs.writeFileSync(this.config.outputFile, JSON.stringify(config, null, 2));
      this.log('success', `✅ Configuração salva: ${this.config.outputFile}`);
      
      // Relatório final
      this.generateReport();
      
    } catch (error) {
      this.log('error', `Erro ao salvar configuração: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gera relatório da detecção
   */
  generateReport() {
    console.log('\n🎯 RELATÓRIO DE DETECÇÃO AUTOMÁTICA');
    console.log('='.repeat(50));
    console.log(`📊 Sessões detectadas: ${this.detectedSessions.length}`);
    console.log(`📁 Arquivo de configuração: ${this.config.outputFile}`);
    console.log(`🔒 Backup disponível: ${this.config.backupFile}`);
    
    if (this.detectedSessions.length > 0) {
      console.log('\n👥 CONTAS DETECTADAS:');
      this.detectedSessions.forEach((session, index) => {
        console.log(`${index + 1}. ${session.name} (@${session.username})`);
        console.log(`   Cookies: ${session.cookies.length}`);
        console.log(`   Seguidores: ${session.metrics.followers}`);
        console.log(`   Seguindo: ${session.metrics.following}`);
      });
      
      console.log('\n🎉 DETECÇÃO CONCLUÍDA COM SUCESSO!');
      console.log('As contas detectadas podem ser usadas no sistema multi-conta.');
    } else {
      console.log('\n⚠️ NENHUMA SESSÃO ATIVA DETECTADA');
      console.log('Certifique-se de estar logado no Twitter e tente novamente.');
    }
  }

  /**
   * Converte texto de métrica em número
   */
  parseMetricNumber(text) {
    if (!text || typeof text !== 'string') return 0;
    
    const cleanText = text.replace(/[^\d.KMB]/gi, '');
    const number = parseFloat(cleanText);
    
    if (isNaN(number)) return 0;
    
    if (cleanText.includes('K')) return Math.floor(number * 1000);
    if (cleanText.includes('M')) return Math.floor(number * 1000000);
    if (cleanText.includes('B')) return Math.floor(number * 1000000000);
    
    return Math.floor(number);
  }
}

/**
 * Interface de linha de comando
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('\n🔍 SISTEMA DE DETECÇÃO AUTOMÁTICA DE SESSÕES');
    console.log('='.repeat(50));
    console.log('Detecta automaticamente sessões ativas do Twitter e');
    console.log('extrai cookies para uso no sistema multi-conta.');
    console.log('\nUso: node twitter-session-detector.js [opções]');
    console.log('\nOpções:');
    console.log('  --visible     Executar com interface visual');
    console.log('  --headless    Executar sem interface visual (padrão)');
    console.log('  --timeout N   Timeout em segundos (padrão: 15)');
    console.log('  --help        Mostrar esta ajuda');
    return;
  }
  
  const detector = new TwitterSessionDetector();
  
  // Configurar opções
  if (args.includes('--visible')) {
    detector.config.headless = false;
    console.log('👁️ Modo visual ativado');
  }
  
  const timeoutIndex = args.indexOf('--timeout');
  if (timeoutIndex !== -1 && args[timeoutIndex + 1]) {
    detector.config.timeout = parseInt(args[timeoutIndex + 1]) * 1000;
    console.log(`⏱️ Timeout configurado: ${detector.config.timeout}ms`);
  }
  
  try {
    console.log('\n🚀 Iniciando detecção automática...');
    const sessions = await detector.detectActiveSessions();
    
    if (sessions.length > 0) {
      console.log(`\n✅ ${sessions.length} sessões detectadas e configuradas!`);
      process.exit(0);
    } else {
      console.log('\n❌ Nenhuma sessão detectada.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`\n💥 Erro fatal: ${error.message}`);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}

export default TwitterSessionDetector;
