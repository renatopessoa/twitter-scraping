#!/usr/bin/env node

/**
 * Script rápido para testar cookies existentes do Twitter
 */

import { chromium } from 'playwright';
import fs from 'fs';

async function testTwitterCookies() {
  console.log('🔍 TESTANDO COOKIES DO TWITTER');
  console.log('='.repeat(40));
  
  // Verificar arquivos de cookies
  const cookieFiles = [
    'twitter-cookies.json',
    'twitter-cookies-multi.json'
  ];
  
  let cookiesToTest = [];
  
  for (const file of cookieFiles) {
    if (fs.existsSync(file)) {
      try {
        const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
        
        if (Array.isArray(content)) {
          cookiesToTest = content;
          console.log(`📋 Carregados ${content.length} cookies de ${file}`);
          break;
        } else if (content.accounts && Array.isArray(content.accounts)) {
          cookiesToTest = content.accounts[0]?.cookies || [];
          console.log(`📋 Carregados cookies da primeira conta em ${file}`);
          break;
        }
      } catch (error) {
        console.log(`❌ Erro ao ler ${file}: ${error.message}`);
      }
    }
  }
  
  if (cookiesToTest.length === 0) {
    console.log('❌ Nenhum cookie encontrado para testar');
    return;
  }
  
  console.log(`🧪 Testando ${cookiesToTest.length} cookies...`);
  
  // Testar cookies
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext();
    
    // Adicionar cookies
    await context.addCookies(cookiesToTest);
    
    const page = await context.newPage();
    
    // Testar acesso ao Twitter
    console.log('🌐 Acessando Twitter...');
    await page.goto('https://twitter.com/home', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Verificar se está logado
    const loginIndicators = [
      '[data-testid="SideNav_AccountSwitcher_Button"]',
      '[data-testid="AppTabBar_Profile_Link"]',
      '[data-testid="primaryColumn"]',
      '[data-testid="tweet"]'
    ];
    
    let isLoggedIn = false;
    
    for (const selector of loginIndicators) {
      try {
        if (await page.locator(selector).isVisible({ timeout: 3000 })) {
          isLoggedIn = true;
          console.log(`✅ Indicador de login encontrado: ${selector}`);
          break;
        }
      } catch {
        // Continuar tentando
      }
    }
    
    if (isLoggedIn) {
      console.log('✅ COOKIES VÁLIDOS - Sessão ativa detectada!');
      
      // Tentar extrair informações do usuário
      try {
        const username = await page.locator('[data-testid="UserName"]').first().textContent({ timeout: 5000 });
        if (username) {
          console.log(`👤 Usuário: ${username}`);
        }
      } catch {
        console.log('ℹ️ Não foi possível extrair username');
      }
      
    } else {
      console.log('❌ COOKIES INVÁLIDOS - Nenhuma sessão ativa');
      
      // Verificar se foi redirecionado para login
      const currentUrl = page.url();
      console.log(`🔗 URL atual: ${currentUrl}`);
      
      if (currentUrl.includes('/login') || currentUrl.includes('/i/flow/login')) {
        console.log('⚠️ Redirecionado para página de login');
      }
    }
    
  } catch (error) {
    console.log(`❌ Erro no teste: ${error.message}`);
  } finally {
    await browser.close();
  }
  
  console.log('\n💡 PRÓXIMOS PASSOS:');
  if (cookiesToTest.length === 0) {
    console.log('1. Execute: node detect-twitter-sessions.js');
    console.log('2. Certifique-se de estar logado no Twitter');
  } else {
    console.log('1. Faça login no Twitter manualmente');
    console.log('2. Execute: node detect-twitter-sessions.js');
    console.log('3. Tente novamente');
  }
}

// Executar teste
testTwitterCookies().catch(console.error);
