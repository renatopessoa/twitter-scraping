#!/usr/bin/env node

/**
 * Teste avançado com abordagem mais robusta
 */

import { chromium } from 'playwright';
import fs from 'fs';

async function advancedCookieTest() {
  console.log('🧪 TESTE AVANÇADO DE COOKIES');
  console.log('='.repeat(40));
  
  // Carregar cookies
  const cookies = JSON.parse(fs.readFileSync('twitter-cookies.json', 'utf-8'));
  console.log(`📋 Carregados ${cookies.length} cookies`);
  
  const browser = await chromium.launch({
    headless: false, // Visível para debug
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext();
    await context.addCookies(cookies);
    
    const page = await context.newPage();
    
    console.log('🌐 Acessando Twitter...');
    await page.goto('https://x.com/home', { timeout: 30000 });
    await page.waitForTimeout(5000);
    
    console.log(`📍 URL atual: ${page.url()}`);
    
    // Verificar se há indicadores de login na página
    const pageContent = await page.content();
    
    // Verificar se há sinais de estar logado
    const loginSignals = [
      'data-testid="SideNav_AccountSwitcher_Button"',
      'data-testid="AppTabBar_Profile_Link"',
      'data-testid="primaryColumn"',
      'data-testid="tweet"',
      'aria-label="Profile"',
      'data-testid="UserName"',
      'data-testid="composerTextarea"'
    ];
    
    console.log('\n🔍 Verificando sinais de login...');
    let foundSignals = 0;
    
    for (const signal of loginSignals) {
      if (pageContent.includes(signal)) {
        console.log(`✅ Encontrado: ${signal}`);
        foundSignals++;
      }
    }
    
    console.log(`\n📊 Sinais encontrados: ${foundSignals}/${loginSignals.length}`);
    
    // Verificar se há sinais de página de login
    const loginPageSignals = [
      'data-testid="LoginForm_Login_Button"',
      'data-testid="login-button"',
      'name="text"',
      'name="password"',
      'Entrar no X'
    ];
    
    console.log('\n🔍 Verificando sinais de página de login...');
    let loginPageFound = 0;
    
    for (const signal of loginPageSignals) {
      if (pageContent.includes(signal)) {
        console.log(`❌ Sinal de login encontrado: ${signal}`);
        loginPageFound++;
      }
    }
    
    if (loginPageFound > 0) {
      console.log('\n❌ RESULTADO: Você está na página de login - cookies não funcionaram');
    } else if (foundSignals >= 2) {
      console.log('\n✅ RESULTADO: Você está logado - cookies funcionaram!');
      
      // Tentar extrair informações específicas
      console.log('\n📋 Extraindo informações...');
      
      try {
        const title = await page.title();
        console.log(`📄 Título da página: ${title}`);
      } catch {
        console.log('📄 Não foi possível extrair título');
      }
      
      // Aguardar um pouco para carregar
      await page.waitForTimeout(3000);
      
      // Tentar encontrar elementos específicos
      try {
        const nav = await page.locator('nav').first();
        if (await nav.isVisible()) {
          console.log('🧭 Menu de navegação encontrado');
        }
      } catch {
        console.log('🧭 Menu de navegação não encontrado');
      }
      
      try {
        const sidebar = await page.locator('[data-testid="sidebarColumn"]').first();
        if (await sidebar.isVisible()) {
          console.log('📱 Sidebar encontrada');
        }
      } catch {
        console.log('📱 Sidebar não encontrada');
      }
      
    } else {
      console.log('\n⚠️ RESULTADO: Estado incerto - poucos sinais detectados');
    }
    
    console.log('\n⏳ Deixando navegador aberto por 10 segundos para você verificar...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  } finally {
    await browser.close();
  }
}

// Executar teste
advancedCookieTest().catch(console.error);
