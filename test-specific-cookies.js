#!/usr/bin/env node

/**
 * Teste específico para os cookies extraídos da conta @_renatopessoa_
 */

import { chromium } from 'playwright';
import fs from 'fs';

async function testSpecificCookies() {
  console.log('🔍 TESTE ESPECÍFICO DOS COOKIES EXTRAÍDOS');
  console.log('='.repeat(50));
  
  // Carregar cookies
  const cookies = JSON.parse(fs.readFileSync('twitter-cookies.json', 'utf-8'));
  console.log(`📋 Carregados ${cookies.length} cookies`);
  
  // Mostrar cookies importantes
  const importantCookies = cookies.filter(c => 
    ['auth_token', 'ct0', 'twid'].includes(c.name)
  );
  
  console.log('\n🔑 Cookies importantes encontrados:');
  importantCookies.forEach(cookie => {
    console.log(`  - ${cookie.name}: ${cookie.value.substring(0, 20)}... (${cookie.domain})`);
  });
  
  if (importantCookies.length < 2) {
    console.log('❌ Cookies importantes insuficientes!');
    return;
  }
  
  // Testar com navegador
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext();
    
    // Adicionar cookies
    console.log('\n🍪 Adicionando cookies ao contexto...');
    await context.addCookies(cookies);
    
    const page = await context.newPage();
    
    // Tentar diferentes URLs
    const testUrls = [
      'https://x.com/home',
      'https://twitter.com/home',
      'https://x.com/notifications',
      'https://twitter.com/notifications'
    ];
    
    for (const url of testUrls) {
      console.log(`\n🌐 Testando: ${url}`);
      
      try {
        await page.goto(url, { timeout: 20000 });
        await page.waitForTimeout(3000);
        
        const currentUrl = page.url();
        console.log(`   URL atual: ${currentUrl}`);
        
        // Verificar se foi redirecionado para login
        if (currentUrl.includes('/login') || currentUrl.includes('/i/flow/login')) {
          console.log('   ❌ Redirecionado para login');
          continue;
        }
        
        // Verificar indicadores de login
        const loginIndicators = [
          '[data-testid="SideNav_AccountSwitcher_Button"]',
          '[data-testid="AppTabBar_Profile_Link"]',
          '[data-testid="primaryColumn"]',
          '[data-testid="tweet"]'
        ];
        
        let foundIndicator = false;
        
        for (const selector of loginIndicators) {
          try {
            if (await page.locator(selector).isVisible({ timeout: 5000 })) {
              console.log(`   ✅ Login confirmado: ${selector}`);
              foundIndicator = true;
              break;
            }
          } catch {
            // Continuar tentando
          }
        }
        
        if (foundIndicator) {
          console.log('   🎉 SUCESSO! Cookies funcionando');
          
          // Tentar extrair informações do usuário
          try {
            const username = await page.locator('[data-testid="UserName"]').first().textContent({ timeout: 5000 });
            if (username) {
              console.log(`   👤 Usuário detectado: ${username}`);
            }
          } catch {
            console.log('   ℹ️ Não foi possível extrair username');
          }
          
          // Tentar ver tweets
          try {
            const tweets = await page.locator('[data-testid="tweet"]').count();
            console.log(`   📱 Tweets visíveis: ${tweets}`);
          } catch {
            console.log('   ℹ️ Não foi possível contar tweets');
          }
          
          break;
        } else {
          console.log('   ❌ Nenhum indicador de login encontrado');
        }
        
      } catch (error) {
        console.log(`   ❌ Erro: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  } finally {
    await browser.close();
  }
}

// Executar teste
testSpecificCookies().catch(console.error);
