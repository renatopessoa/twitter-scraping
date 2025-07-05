/**
 * Sistema de Varredura Automática em Massa do Twitter
 * 
 * Este script faz varredura automática do Twitter para coletar:
 * - Cookies de sessão
 * - Informações de contas
 * - Dados de engajamento
 * - Padrões de comportamento
 */

const { chromium } = require('playwright');
const fs = require('fs');

// Configurações avançadas
const SCAN_CONFIG = {
  headless: true,
  timeout: 20000,
  maxConcurrentTabs: 3,
  scanDepth: 10,
  outputFile: 'twitter-scan-results.json',
  cookiesFile: 'twitter-cookies-auto-extracted.json'
};

// URLs e padrões para varredura
const SCAN_PATTERNS = {
  loginPages: [
    'https://twitter.com/login',
    'https://twitter.com/i/flow/login'
  ],
  publicPages: [
    'https://twitter.com/explore',
    'https://twitter.com/home',
    'https://twitter.com/search'
  ],
  cookiePatterns: ['auth_token', 'ct0', 'twid', 'kdt', 'auth_multi']
};

class TwitterAutoScanner {
  constructor() {
    this.browser = null;
    this.results = {
      scannedSessions: [],
      extractedCookies: [],
      accountData: [],
      scanMetrics: {
        startTime: new Date().toISOString(),
        totalPages: 0,
        successfulExtractions: 0,
        errors: []
      }
    };
  }

  log(level, message) {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      error: '\x1b[31m',
      warning: '\x1b[33m',
      reset: '\x1b[0m'
    };
    
    console.log(`${colors[level]}[${level.toUpperCase()}] ${message}${colors.reset}`);
  }

  /**
   * Inicia varredura automática
   */
  async startAutoScan() {
    this.log('info', '🔍 Iniciando varredura automática do Twitter');
    
    this.browser = await chromium.launch({
      headless: SCAN_CONFIG.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions'
      ]
    });

    try {
      // Varredura de sessões existentes
      await this.scanExistingSessions();
      
      // Varredura de padrões de login
      await this.scanLoginPatterns();
      
      // Análise de dados coletados
      await this.analyzeCollectedData();
      
      // Salvar resultados
      await this.saveResults();
      
    } catch (error) {
      this.log('error', `Erro durante varredura: ${error.message}`);
    } finally {
      await this.browser.close();
    }
  }

  /**
   * Varre sessões existentes no navegador
   */
  async scanExistingSessions() {
    this.log('info', '📊 Escaneando sessões existentes...');
    
    const context = await this.browser.newContext();
    const page = await context.newPage();
    
    try {
      // Verificar dados salvos do navegador
      await page.goto('https://twitter.com');
      await page.waitForTimeout(3000);
      
      // Extrair cookies existentes
      const cookies = await context.cookies();
      const twitterCookies = cookies.filter(c => 
        c.domain.includes('twitter.com') || c.domain.includes('x.com')
      );
      
      if (twitterCookies.length > 0) {
        this.log('success', `Encontrados ${twitterCookies.length} cookies existentes`);
        this.results.extractedCookies.push(...twitterCookies);
      }
      
      // Verificar se há sessão ativa
      const isLoggedIn = await this.checkActiveSession(page);
      if (isLoggedIn) {
        const accountData = await this.extractAccountData(page);
        this.results.accountData.push(accountData);
        this.results.scanMetrics.successfulExtractions++;
      }
      
    } catch (error) {
      this.log('error', `Erro ao escanear sessões: ${error.message}`);
      this.results.scanMetrics.errors.push(error.message);
    } finally {
      await context.close();
    }
  }

  /**
   * Varre padrões de login automático
   */
  async scanLoginPatterns() {
    this.log('info', '🔐 Escaneando padrões de login...');
    
    for (const loginUrl of SCAN_PATTERNS.loginPages) {
      const context = await this.browser.newContext();
      const page = await context.newPage();
      
      try {
        await page.goto(loginUrl);
        await page.waitForTimeout(2000);
        
        // Analisar formulários de login
        const loginForms = await page.locator('form').count();
        const inputFields = await page.locator('input[type="text"], input[type="password"], input[type="email"]').count();
        
        this.log('info', `${loginUrl}: ${loginForms} formulários, ${inputFields} campos`);
        
        // Verificar se há auto-login (cookies válidos)
        const redirected = page.url() !== loginUrl;
        if (redirected) {
          this.log('success', 'Auto-login detectado!');
          const accountData = await this.extractAccountData(page);
          this.results.accountData.push(accountData);
        }
        
        this.results.scanMetrics.totalPages++;
        
      } catch (error) {
        this.log('error', `Erro ao escanear ${loginUrl}: ${error.message}`);
      } finally {
        await context.close();
      }
    }
  }

  /**
   * Verifica se há sessão ativa
   */
  async checkActiveSession(page) {
    try {
      const indicators = [
        '[data-testid="SideNav_AccountSwitcher_Button"]',
        '[data-testid="AppTabBar_Profile_Link"]',
        '[aria-label="Profile"]'
      ];
      
      for (const selector of indicators) {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
          return true;
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Extrai dados da conta ativa
   */
  async extractAccountData(page) {
    try {
      // Ir para página de configurações para extrair mais dados
      await page.goto('https://twitter.com/settings/profile', { timeout: 10000 });
      await page.waitForTimeout(2000);
      
      const accountData = {
        extractedAt: new Date().toISOString(),
        name: 'Desconhecido',
        username: 'unknown',
        verified: false,
        followers: 0,
        following: 0,
        location: ''
      };
      
      // Extrair nome
      try {
        const nameInput = page.locator('[data-testid="displayNameInput"]').first();
        if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          accountData.name = await nameInput.inputValue() || 'Desconhecido';
        }
      } catch {}
      
      // Extrair username
      try {
        const usernameInput = page.locator('[data-testid="usernameInput"]').first();
        if (await usernameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          accountData.username = await usernameInput.inputValue() || 'unknown';
        }
      } catch {}
      
      // Ir para perfil público para extrair métricas
      if (accountData.username !== 'unknown') {
        try {
          await page.goto(`https://twitter.com/${accountData.username}`, { timeout: 10000 });
          await page.waitForTimeout(2000);
          
          // Extrair métricas básicas
          const followingText = await page.locator('[href$="/following"] span').first().textContent().catch(() => '0');
          const followersText = await page.locator('[href$="/verified_followers"] span, [href$="/followers"] span').first().textContent().catch(() => '0');
          
          accountData.following = this.parseNumber(followingText);
          accountData.followers = this.parseNumber(followersText);
          
        } catch {}
      }
      
      this.log('success', `Dados extraídos: ${accountData.name} (@${accountData.username})`);
      return accountData;
      
    } catch (error) {
      this.log('error', `Erro ao extrair dados da conta: ${error.message}`);
      return {
        extractedAt: new Date().toISOString(),
        name: 'Erro na extração',
        username: 'error',
        error: error.message
      };
    }
  }

  /**
   * Converte texto em número (ex: "1.2K" -> 1200)
   */
  parseNumber(text) {
    if (!text) return 0;
    
    const cleanText = text.replace(/[^\d.KMB]/gi, '');
    const number = parseFloat(cleanText);
    
    if (cleanText.includes('K')) return Math.floor(number * 1000);
    if (cleanText.includes('M')) return Math.floor(number * 1000000);
    if (cleanText.includes('B')) return Math.floor(number * 1000000000);
    
    return Math.floor(number) || 0;
  }

  /**
   * Analisa dados coletados
   */
  async analyzeCollectedData() {
    this.log('info', '📈 Analisando dados coletados...');
    
    const analysis = {
      totalCookies: this.results.extractedCookies.length,
      validSessions: this.results.accountData.length,
      cookieTypes: {},
      accountSummary: {
        totalAccounts: this.results.accountData.length,
        verifiedAccounts: 0,
        totalFollowers: 0,
        averageFollowers: 0
      }
    };
    
    // Analisar tipos de cookies
    this.results.extractedCookies.forEach(cookie => {
      analysis.cookieTypes[cookie.name] = (analysis.cookieTypes[cookie.name] || 0) + 1;
    });
    
    // Analisar contas
    this.results.accountData.forEach(account => {
      if (account.verified) analysis.accountSummary.verifiedAccounts++;
      analysis.accountSummary.totalFollowers += account.followers || 0;
    });
    
    if (analysis.accountSummary.totalAccounts > 0) {
      analysis.accountSummary.averageFollowers = Math.floor(
        analysis.accountSummary.totalFollowers / analysis.accountSummary.totalAccounts
      );
    }
    
    this.results.analysis = analysis;
    
    this.log('success', `Análise concluída: ${analysis.validSessions} sessões válidas`);
  }

  /**
   * Salva resultados da varredura
   */
  async saveResults() {
    try {
      // Salvar resultados completos
      this.results.scanMetrics.endTime = new Date().toISOString();
      this.results.scanMetrics.duration = Date.now() - new Date(this.results.scanMetrics.startTime).getTime();
      
      fs.writeFileSync(SCAN_CONFIG.outputFile, JSON.stringify(this.results, null, 2));
      this.log('success', `Resultados salvos em: ${SCAN_CONFIG.outputFile}`);
      
      // Salvar cookies em formato compatível
      if (this.results.extractedCookies.length > 0 && this.results.accountData.length > 0) {
        const multiAccountConfig = {
          accounts: this.results.accountData.map((account, index) => ({
            name: account.name || `Conta ${index + 1}`,
            username: account.username || `usuario${index + 1}`,
            cookies: this.results.extractedCookies.filter(cookie => 
              SCAN_PATTERNS.cookiePatterns.includes(cookie.name)
            )
          })),
          extracted_automatically: true,
          extraction_date: new Date().toISOString()
        };
        
        fs.writeFileSync(SCAN_CONFIG.cookiesFile, JSON.stringify(multiAccountConfig, null, 2));
        this.log('success', `Cookies salvos em: ${SCAN_CONFIG.cookiesFile}`);
      }
      
      // Relatório final
      this.printFinalReport();
      
    } catch (error) {
      this.log('error', `Erro ao salvar resultados: ${error.message}`);
    }
  }

  /**
   * Imprime relatório final
   */
  printFinalReport() {
    console.log('\n🎯 RELATÓRIO DE VARREDURA AUTOMÁTICA');
    console.log('='.repeat(50));
    
    console.log(`📊 Páginas escaneadas: ${this.results.scanMetrics.totalPages}`);
    console.log(`🔐 Cookies extraídos: ${this.results.extractedCookies.length}`);
    console.log(`👤 Contas detectadas: ${this.results.accountData.length}`);
    console.log(`✅ Extrações bem-sucedidas: ${this.results.scanMetrics.successfulExtractions}`);
    console.log(`❌ Erros encontrados: ${this.results.scanMetrics.errors.length}`);
    
    if (this.results.analysis) {
      console.log('\n📈 ANÁLISE DOS DADOS:');
      console.log(`Cookie mais comum: ${Object.keys(this.results.analysis.cookieTypes)[0] || 'N/A'}`);
      console.log(`Seguidores médios: ${this.results.analysis.accountSummary.averageFollowers}`);
    }
    
    console.log('\n📁 ARQUIVOS GERADOS:');
    console.log(`- ${SCAN_CONFIG.outputFile} (dados completos)`);
    if (fs.existsSync(SCAN_CONFIG.cookiesFile)) {
      console.log(`- ${SCAN_CONFIG.cookiesFile} (cookies para uso)`);
    }
    
    if (this.results.accountData.length > 0) {
      console.log('\n🎉 VARREDURA CONCLUÍDA COM SUCESSO!');
      console.log('Você pode usar os cookies extraídos no sistema multi-conta.');
    } else {
      console.log('\n⚠️  NENHUMA SESSÃO ATIVA DETECTADA');
      console.log('Faça login no Twitter em seu navegador e execute novamente.');
    }
  }
}

/**
 * Interface de linha de comando
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('\n🔍 SISTEMA DE VARREDURA AUTOMÁTICA DO TWITTER');
    console.log('='.repeat(50));
    console.log('Este script faz varredura automática para extrair:');
    console.log('- Cookies de sessão do Twitter');
    console.log('- Informações de contas ativas');
    console.log('- Dados de engajamento');
    console.log('\nUso: node twitter-auto-scanner.js [opções]');
    console.log('\nOpções:');
    console.log('  --headless    Executar sem interface visual');
    console.log('  --visible     Executar com interface visual (padrão)');
    console.log('  --help        Mostrar esta ajuda');
    return;
  }
  
  // Configurar modo visual/headless
  if (args.includes('--headless')) {
    SCAN_CONFIG.headless = true;
    console.log('🔍 Modo headless ativado');
  } else if (args.includes('--visible')) {
    SCAN_CONFIG.headless = false;
    console.log('👁️  Modo visual ativado');
  }
  
  const scanner = new TwitterAutoScanner();
  
  try {
    await scanner.startAutoScan();
  } catch (error) {
    console.error(`❌ Erro fatal: ${error.message}`);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = TwitterAutoScanner;
