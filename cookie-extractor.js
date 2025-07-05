/**
 * Sistema de Extração Automática de Cookies do Twitter
 * 
 * Este script automatiza a coleta de cookies de múltiplas contas do Twitter
 * usando Playwright para simular login e extrair cookies automaticamente.
 */

const { chromium } = require('playwright');
const fs = require('fs');

// Configurações
const CONFIG = {
  headless: false, // Modo visual para ver o processo
  timeout: 30000,  // 30 segundos timeout
  cookiesFile: 'twitter-cookies-multi.json',
  backupFile: 'twitter-cookies-multi.backup.json'
};

// Cores para console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log('green', `✅ ${message}`);
}

function logError(message) {
  log('red', `❌ ${message}`);
}

function logWarning(message) {
  log('yellow', `⚠️  ${message}`);
}

function logInfo(message) {
  log('cyan', `ℹ️  ${message}`);
}

function logStep(message) {
  log('magenta', `🔄 ${message}`);
}

/**
 * Extrai cookies essenciais do Twitter
 */
async function extractTwitterCookies(page) {
  try {
    const cookies = await page.context().cookies();
    
    // Filtrar apenas cookies essenciais do Twitter
    const essentialCookies = cookies.filter(cookie => {
      const isTwitterDomain = cookie.domain.includes('twitter.com') || cookie.domain.includes('x.com');
      const isEssential = ['auth_token', 'ct0', 'twid'].includes(cookie.name);
      return isTwitterDomain && isEssential;
    });

    // Normalizar domínio para .twitter.com
    const normalizedCookies = essentialCookies.map(cookie => ({
      ...cookie,
      domain: '.twitter.com',
      expires: cookie.expires === -1 ? undefined : cookie.expires
    }));

    return normalizedCookies;
  } catch (error) {
    throw new Error(`Erro ao extrair cookies: ${error.message}`);
  }
}

/**
 * Detecta se o usuário está logado no Twitter
 */
async function isLoggedIn(page) {
  try {
    // Aguardar carregamento da página
    await page.waitForTimeout(3000);
    
    // Verificar se há elementos que indicam login
    const loginIndicators = [
      '[data-testid="SideNav_AccountSwitcher_Button"]',
      '[data-testid="AppTabBar_Profile_Link"]',
      '[aria-label="Profile"]',
      '[data-testid="primaryColumn"]'
    ];
    
    for (const selector of loginIndicators) {
      const element = await page.locator(selector).first();
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
 * Extrai informações do usuário logado
 */
async function extractUserInfo(page) {
  try {
    // Tentar extrair nome e username
    let name = 'Conta Desconhecida';
    let username = 'unknown';
    
    try {
      // Ir para página de perfil
      await page.goto('https://twitter.com/settings/profile');
      await page.waitForTimeout(2000);
      
      // Extrair nome
      const nameElement = page.locator('[data-testid="displayNameInput"]').first();
      if (await nameElement.isVisible({ timeout: 3000 }).catch(() => false)) {
        const nameValue = await nameElement.inputValue();
        if (nameValue) name = nameValue;
      }
      
      // Extrair username
      const usernameElement = page.locator('[data-testid="usernameInput"]').first();
      if (await usernameElement.isVisible({ timeout: 3000 }).catch(() => false)) {
        const usernameValue = await usernameElement.inputValue();
        if (usernameValue) username = usernameValue;
      }
    } catch (error) {
      logWarning(`Não foi possível extrair informações do usuário: ${error.message}`);
    }
    
    return { name, username };
  } catch (error) {
    logWarning(`Erro ao extrair informações do usuário: ${error.message}`);
    return { name: 'Conta Desconhecida', username: 'unknown' };
  }
}

/**
 * Processa uma conta individual
 */
async function processAccount(browser, accountNumber) {
  logStep(`Processando Conta ${accountNumber}`);
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navegar para Twitter
    logInfo('Navegando para Twitter...');
    await page.goto('https://twitter.com');
    await page.waitForTimeout(3000);
    
    // Verificar se já está logado
    if (await isLoggedIn(page)) {
      logSuccess('Usuário já está logado!');
      
      // Extrair informações do usuário
      const userInfo = await extractUserInfo(page);
      
      // Extrair cookies
      const cookies = await extractTwitterCookies(page);
      
      if (cookies.length === 0) {
        throw new Error('Nenhum cookie essencial encontrado');
      }
      
      logSuccess(`Cookies extraídos: ${cookies.map(c => c.name).join(', ')}`);
      
      return {
        name: userInfo.name,
        username: userInfo.username,
        cookies: cookies,
        status: 'success'
      };
      
    } else {
      logWarning('Usuário não está logado');
      
      // Aguardar o usuário fazer login manualmente
      console.log('\n🔐 INSTRUÇÕES PARA LOGIN:');
      console.log('1. Uma janela do navegador será aberta');
      console.log('2. Faça login na sua conta do Twitter');
      console.log('3. Aguarde a extração automática dos cookies');
      console.log('4. O processo continuará automaticamente\n');
      
      // Aguardar login do usuário
      logStep('Aguardando login do usuário...');
      
      // Verificar login a cada 5 segundos por até 5 minutos
      const maxAttempts = 60; // 5 minutos
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        await page.waitForTimeout(5000);
        attempts++;
        
        if (await isLoggedIn(page)) {
          logSuccess('Login detectado!');
          
          // Extrair informações do usuário
          const userInfo = await extractUserInfo(page);
          
          // Extrair cookies
          const cookies = await extractTwitterCookies(page);
          
          if (cookies.length === 0) {
            throw new Error('Nenhum cookie essencial encontrado após login');
          }
          
          logSuccess(`Cookies extraídos: ${cookies.map(c => c.name).join(', ')}`);
          
          return {
            name: userInfo.name,
            username: userInfo.username,
            cookies: cookies,
            status: 'success'
          };
        }
        
        if (attempts % 12 === 0) { // A cada minuto
          logInfo(`Aguardando login... (${Math.floor(attempts/12)} min)`);
        }
      }
      
      throw new Error('Timeout aguardando login do usuário');
    }
    
  } catch (error) {
    logError(`Erro ao processar conta: ${error.message}`);
    return {
      name: `Conta ${accountNumber}`,
      username: 'error',
      cookies: [],
      status: 'error',
      error: error.message
    };
  } finally {
    await context.close();
  }
}

/**
 * Salva configuração multi-conta
 */
function saveMultiAccountConfig(accounts) {
  try {
    // Fazer backup se arquivo existir
    if (fs.existsSync(CONFIG.cookiesFile)) {
      fs.copyFileSync(CONFIG.cookiesFile, CONFIG.backupFile);
      logInfo(`Backup criado: ${CONFIG.backupFile}`);
    }
    
    const config = {
      accounts: accounts.filter(account => account.status === 'success'),
      extracted_at: new Date().toISOString(),
      total_accounts: accounts.length,
      successful_accounts: accounts.filter(account => account.status === 'success').length
    };
    
    fs.writeFileSync(CONFIG.cookiesFile, JSON.stringify(config, null, 2));
    logSuccess(`Configuração salva em: ${CONFIG.cookiesFile}`);
    
    return config;
  } catch (error) {
    throw new Error(`Erro ao salvar configuração: ${error.message}`);
  }
}

/**
 * Função principal de extração
 */
async function extractMultiAccountCookies(numberOfAccounts = 1) {
  console.log('\n🤖 EXTRAÇÃO AUTOMÁTICA DE COOKIES DO TWITTER');
  console.log('='.repeat(60));
  
  logInfo(`Configurado para extrair ${numberOfAccounts} conta(s)`);
  logWarning('Certifique-se de ter as contas prontas para login');
  
  const browser = await chromium.launch({
    headless: CONFIG.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  
  const extractedAccounts = [];
  
  try {
    for (let i = 1; i <= numberOfAccounts; i++) {
      console.log(`\n${'='.repeat(40)}`);
      logStep(`PROCESSANDO CONTA ${i}/${numberOfAccounts}`);
      console.log(`${'='.repeat(40)}`);
      
      const account = await processAccount(browser, i);
      extractedAccounts.push(account);
      
      if (account.status === 'success') {
        logSuccess(`Conta ${i} processada com sucesso!`);
      } else {
        logError(`Falha ao processar conta ${i}: ${account.error}`);
      }
      
      // Aguardar antes da próxima conta (exceto na última)
      if (i < numberOfAccounts) {
        logInfo('Aguardando antes da próxima conta...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Salvar configuração
    const config = saveMultiAccountConfig(extractedAccounts);
    
    // Relatório final
    console.log('\n📊 RELATÓRIO FINAL');
    console.log('='.repeat(50));
    
    extractedAccounts.forEach((account, index) => {
      const status = account.status === 'success' ? '✅' : '❌';
      console.log(`${status} Conta ${index + 1}: ${account.name} (@${account.username})`);
      if (account.status === 'success') {
        console.log(`    Cookies: ${account.cookies.length} extraídos`);
      } else {
        console.log(`    Erro: ${account.error}`);
      }
    });
    
    console.log(`\n📈 Taxa de Sucesso: ${config.successful_accounts}/${config.total_accounts} (${(config.successful_accounts/config.total_accounts*100).toFixed(1)}%)`);
    
    if (config.successful_accounts > 0) {
      logSuccess('🎉 Extração concluída com sucesso!');
      logInfo(`Arquivo gerado: ${CONFIG.cookiesFile}`);
      logInfo('Agora você pode usar o sistema multi-conta!');
    } else {
      logError('🚫 Nenhuma conta foi processada com sucesso');
    }
    
  } catch (error) {
    logError(`Erro durante extração: ${error.message}`);
  } finally {
    await browser.close();
  }
  
  return extractedAccounts;
}

/**
 * Interface de linha de comando
 */
async function main() {
  const args = process.argv.slice(2);
  const numberOfAccounts = args[0] ? parseInt(args[0]) : 1;
  
  if (isNaN(numberOfAccounts) || numberOfAccounts < 1 || numberOfAccounts > 10) {
    console.log('❌ Número de contas inválido (1-10)');
    console.log('Uso: node cookie-extractor.js [número_de_contas]');
    console.log('Exemplo: node cookie-extractor.js 3');
    process.exit(1);
  }
  
  try {
    await extractMultiAccountCookies(numberOfAccounts);
  } catch (error) {
    logError(`Erro fatal: ${error.message}`);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = {
  extractMultiAccountCookies,
  extractTwitterCookies,
  isLoggedIn,
  extractUserInfo
};
