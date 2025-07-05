#!/usr/bin/env node

/**
 * Extrator Manual de Cookies do Twitter
 * 
 * Este script abre o navegador para você fazer login manualmente
 * e então extrai os cookies automaticamente.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function extractTwitterCookiesManually() {
  console.log('🔍 EXTRATOR MANUAL DE COOKIES DO TWITTER');
  console.log('='.repeat(50));
  console.log('Este script vai abrir o navegador para você fazer login.');
  console.log('Depois de fazer login, pressione ENTER para extrair os cookies.');
  console.log('');
  
  const browser = await chromium.launch({
    headless: false, // Navegador visível
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security'
    ]
  });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    
    // Ir para Twitter
    console.log('🌐 Abrindo Twitter...');
    await page.goto('https://twitter.com/login', { timeout: 30000 });
    
    console.log('');
    console.log('📋 INSTRUÇÕES:');
    console.log('1. Faça login na sua conta do Twitter');
    console.log('2. Aguarde a página carregar completamente');
    console.log('3. Pressione ENTER aqui no terminal');
    console.log('');
    
    await question('Pressione ENTER quando estiver logado... ');
    
    console.log('🔍 Verificando status do login...');
    
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
        if (await page.locator(selector).isVisible({ timeout: 5000 })) {
          isLoggedIn = true;
          console.log(`✅ Login confirmado: ${selector}`);
          break;
        }
      } catch {
        // Continuar tentando
      }
    }
    
    if (!isLoggedIn) {
      console.log('❌ Login não detectado. Certifique-se de estar logado.');
      
      await question('Pressione ENTER para tentar novamente... ');
      
      // Tentar novamente
      for (const selector of loginIndicators) {
        try {
          if (await page.locator(selector).isVisible({ timeout: 5000 })) {
            isLoggedIn = true;
            console.log(`✅ Login confirmado: ${selector}`);
            break;
          }
        } catch {
          // Continuar tentando
        }
      }
    }
    
    if (isLoggedIn) {
      console.log('✅ Login confirmado! Extraindo cookies...');
      
      // Ir para página principal para garantir cookies completos
      await page.goto('https://twitter.com/home', { timeout: 30000 });
      await page.waitForTimeout(3000);
      
      // Extrair cookies
      const cookies = await context.cookies();
      
      // Filtrar cookies importantes
      const importantCookies = cookies.filter(c => 
        ['auth_token', 'ct0', 'twid', 'kdt', 'auth_multi', 'personalization_id', 'guest_id', '_twitter_sess'].includes(c.name)
      );
      
      console.log(`📋 Extraídos ${importantCookies.length} cookies importantes`);
      
      // Tentar extrair informações do usuário
      let username = 'usuario_desconhecido';
      let displayName = 'Usuário';
      
      try {
        const usernameElement = await page.locator('[data-testid="UserName"]').first();
        if (await usernameElement.isVisible({ timeout: 5000 })) {
          const usernameText = await usernameElement.textContent();
          if (usernameText) {
            username = usernameText.replace('@', '');
            displayName = `@${username}`;
          }
        }
      } catch {
        console.log('ℹ️ Não foi possível extrair username');
      }
      
      // Salvar cookies no formato simples
      fs.writeFileSync('twitter-cookies.json', JSON.stringify(cookies, null, 2));
      console.log('✅ Cookies salvos em: twitter-cookies.json');
      
      // Criar sessão para formato multi-conta
      const sessionData = {
        name: displayName,
        username: username,
        extractedAt: new Date().toISOString(),
        cookies: cookies,
        extractedManually: true,
        metrics: {
          followers: 0,
          following: 0,
          verified: false
        }
      };
      
      // Salvar configuração multi-conta
      const multiConfig = {
        accounts: [sessionData],
        detectedAutomatically: false,
        extractedManually: true,
        lastExtraction: new Date().toISOString(),
        totalAccounts: 1
      };
      
      fs.writeFileSync('twitter-cookies-multi.json', JSON.stringify(multiConfig, null, 2));
      console.log('✅ Configuração multi-conta salva: twitter-cookies-multi.json');
      
      // Testar os cookies extraídos
      console.log('🧪 Testando cookies extraídos...');
      
      const testContext = await browser.newContext();
      await testContext.addCookies(cookies);
      
      const testPage = await testContext.newPage();
      await testPage.goto('https://twitter.com/home', { timeout: 30000 });
      await testPage.waitForTimeout(3000);
      
      let testSuccess = false;
      
      for (const selector of loginIndicators) {
        try {
          if (await testPage.locator(selector).isVisible({ timeout: 3000 })) {
            testSuccess = true;
            break;
          }
        } catch {
          // Continuar tentando
        }
      }
      
      if (testSuccess) {
        console.log('✅ Teste bem-sucedido! Cookies funcionando corretamente.');
      } else {
        console.log('⚠️ Aviso: Cookies extraídos mas teste falhou.');
      }
      
      await testContext.close();
      
      console.log('');
      console.log('='.repeat(50));
      console.log('✅ EXTRAÇÃO CONCLUÍDA COM SUCESSO!');
      console.log('');
      console.log('📁 Arquivos criados:');
      console.log('   - twitter-cookies.json (formato simples)');
      console.log('   - twitter-cookies-multi.json (formato multi-conta)');
      console.log('');
      console.log('💻 Agora você pode usar a aplicação normalmente.');
      console.log('🔄 Execute: npm run dev');
      
    } else {
      console.log('❌ Não foi possível confirmar o login.');
      console.log('');
      console.log('💡 SOLUÇÕES:');
      console.log('1. Certifique-se de estar logado no Twitter');
      console.log('2. Aguarde a página carregar completamente');
      console.log('3. Execute o script novamente');
    }
    
  } catch (error) {
    console.error('❌ Erro na extração:', error.message);
  } finally {
    await browser.close();
    rl.close();
  }
}

// Executar extração manual
extractTwitterCookiesManually().catch(console.error);
