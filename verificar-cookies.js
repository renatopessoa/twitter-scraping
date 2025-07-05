import fs from 'fs';
import { chromium } from 'playwright';

/**
 * Script para verificar e validar cookies do Twitter
 */

async function validateTwitterCookies() {
  console.log('🔍 VERIFICADOR DE COOKIES DO TWITTER');
  console.log('='.repeat(40));
  
  // Verificar se arquivo existe
  const configFile = 'twitter-cookies-multi.json';
  if (!fs.existsSync(configFile)) {
    console.log('❌ Arquivo twitter-cookies-multi.json não encontrado!');
    console.log('💡 Crie o arquivo seguindo o GUIA-COOKIES-EXPIRADOS.md');
    return;
  }
  
  // Carregar configuração
  let config;
  try {
    const configData = fs.readFileSync(configFile, 'utf-8');
    config = JSON.parse(configData);
  } catch (error) {
    console.log('❌ Erro ao ler arquivo de configuração:', error.message);
    return;
  }
  
  if (!config.accounts || !Array.isArray(config.accounts)) {
    console.log('❌ Formato inválido: propriedade "accounts" não encontrada');
    return;
  }
  
  console.log(`📊 Encontradas ${config.accounts.length} contas para validar`);
  
  // Inicializar navegador
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    for (let i = 0; i < config.accounts.length; i++) {
      const account = config.accounts[i];
      console.log(`\n🧪 Testando conta ${i + 1}: ${account.name}`);
      
      // Verificar estrutura básica
      if (!account.cookies || !Array.isArray(account.cookies)) {
        console.log('❌ Cookies não encontrados ou formato inválido');
        continue;
      }
      
      // Verificar cookies essenciais
      const authToken = account.cookies.find(c => c.name === 'auth_token');
      const ct0Token = account.cookies.find(c => c.name === 'ct0');
      
      if (!authToken) {
        console.log('❌ Cookie auth_token não encontrado (OBRIGATÓRIO)');
        continue;
      }
      
      if (!ct0Token) {
        console.log('⚠️ Cookie ct0 não encontrado (recomendado)');
      }
      
      console.log(`✅ Estrutura básica OK (${account.cookies.length} cookies)`);
      
      // Testar cookies no navegador
      const context = await browser.newContext();
      
      try {
        await context.addCookies(account.cookies);
        const page = await context.newPage();
        
        // Tentar acessar Twitter
        await page.goto('https://twitter.com/home', { 
          waitUntil: 'networkidle', 
          timeout: 15000 
        });
        
        // Verificar se foi redirecionado para login
        const currentUrl = page.url();
        if (currentUrl.includes('/login') || currentUrl.includes('/i/flow/login')) {
          console.log('❌ Cookies expirados - redirecionado para login');
          console.log(`📍 URL: ${currentUrl}`);
        } else {
          // Verificar se há indicadores de login
          const loginIndicators = [
            '[data-testid="SideNav_AccountSwitcher_Button"]',
            '[data-testid="AppTabBar_Profile_Link"]',
            '[aria-label="Profile"]'
          ];
          
          let isLoggedIn = false;
          for (const indicator of loginIndicators) {
            try {
              if (await page.locator(indicator).isVisible({ timeout: 3000 })) {
                isLoggedIn = true;
                break;
              }
            } catch {
              continue;
            }
          }
          
          if (isLoggedIn) {
            console.log('✅ Cookies válidos - usuário logado!');
            
            // Tentar extrair nome de usuário
            try {
              await page.waitForTimeout(2000);
              const userElements = await page.locator('[data-testid="UserName"]').count();
              if (userElements > 0) {
                const username = await page.locator('[data-testid="UserName"]').first().textContent();
                console.log(`👤 Usuário detectado: ${username}`);
              }
            } catch {
              // Ignorar erro de extração de username
            }
          } else {
            console.log('❌ Cookies inválidos - indicadores de login não encontrados');
          }
        }
        
      } catch (error) {
        console.log('❌ Erro ao testar cookies:', error.message);
      } finally {
        await context.close();
      }
    }
    
  } finally {
    await browser.close();
  }
  
  console.log('\n🎯 VERIFICAÇÃO CONCLUÍDA');
  console.log('='.repeat(40));
  console.log('💡 Se todos os cookies estão expirados:');
  console.log('   1. Faça login no Twitter no seu navegador');
  console.log('   2. Extraia novos cookies usando o guia');
  console.log('   3. Execute este script novamente para validar');
}

// Função para mostrar exemplo de cookies válidos
function showCookieExample() {
  console.log('\n📋 EXEMPLO DE COOKIES VÁLIDOS:');
  console.log('='.repeat(40));
  
  const example = {
    accounts: [
      {
        name: "Minha Conta Principal",
        username: "meu_usuario",
        cookies: [
          {
            name: "auth_token",
            value: "1234567890abcdef...", // Token real seria muito maior
            domain: ".twitter.com",
            path: "/",
            expires: 1767225600,
            httpOnly: true,
            secure: true,
            sameSite: "None"
          },
          {
            name: "ct0",
            value: "abcdef1234567890...", // Token real seria diferente
            domain: ".twitter.com", 
            path: "/",
            expires: 1767225600,
            httpOnly: false,
            secure: true,
            sameSite: "Lax"
          }
        ]
      }
    ]
  };
  
  console.log(JSON.stringify(example, null, 2));
  console.log('\n⚠️ Substitua os valores de exemplo pelos seus cookies reais!');
}

// Interface de linha de comando
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('\n🔍 VERIFICADOR DE COOKIES DO TWITTER');
    console.log('='.repeat(40));
    console.log('Este script valida se os cookies do Twitter estão funcionando.');
    console.log('\nUso: node verificar-cookies.js [opções]');
    console.log('\nOpções:');
    console.log('  --example     Mostrar exemplo de cookies válidos');
    console.log('  --help        Mostrar esta ajuda');
    return;
  }
  
  if (args.includes('--example')) {
    showCookieExample();
    return;
  }
  
  try {
    await validateTwitterCookies();
  } catch (error) {
    console.error('❌ Erro fatal:', error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}

export { validateTwitterCookies };
