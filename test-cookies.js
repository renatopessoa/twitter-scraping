import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join } from 'path';

async function testTwitterCookies() {
  console.log('🔍 Testando cookies do Twitter...\n');
  
  try {
    // Carregar cookies
    const cookiesPath = join(process.cwd(), 'twitter-cookies.json');
    const cookiesData = readFileSync(cookiesPath, 'utf-8');
    const cookies = JSON.parse(cookiesData);
    
    console.log(`✅ Cookies carregados: ${cookies.length} cookies encontrados`);
    
    // Listar nomes dos cookies
    const cookieNames = cookies.map(c => c.name);
    console.log(`📋 Cookies disponíveis: ${cookieNames.join(', ')}\n`);
    
    // Inicializar navegador
    const browser = await chromium.launch({
      headless: false, // Modo visível para debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    // Adicionar cookies
    await context.addCookies(cookies);
    console.log('🍪 Cookies adicionados ao contexto do navegador');
    
    // Navegar para Twitter
    console.log('🌐 Navegando para Twitter...');
    await page.goto('https://twitter.com', { 
      waitUntil: 'networkidle', 
      timeout: 30000 
    });
    
    // Aguardar carregamento
    await page.waitForTimeout(5000);
    
    // Verificar se está logado
    const checks = [
      { name: 'Botão de perfil', selector: '[data-testid="SideNav_AccountSwitcher_Button"]' },
      { name: 'Link do perfil', selector: '[data-testid="AppTabBar_Profile_Link"]' },
      { name: 'Coluna principal', selector: '[data-testid="primaryColumn"]' },
      { name: 'Página inicial', selector: '[aria-label="Página inicial"]' },
      { name: 'Tweet', selector: '[data-testid="tweet"]' },
      { name: 'Campo de login', selector: 'input[name="text"]' }
    ];
    
    console.log('\n🔍 Verificando indicadores de login:');
    
    for (const check of checks) {
      try {
        const isVisible = await page.locator(check.selector).isVisible();
        const status = isVisible ? '✅' : '❌';
        console.log(`${status} ${check.name}: ${isVisible ? 'Encontrado' : 'Não encontrado'}`);
      } catch {
        console.log(`❌ ${check.name}: Erro ao verificar`);
      }
    }
    
    // Verificar URL atual
    const currentUrl = page.url();
    console.log(`\n📍 URL atual: ${currentUrl}`);
    
    // Verificar se foi redirecionado para login
    const isLoginPage = currentUrl.includes('/login') || 
                       currentUrl.includes('/i/flow/login') ||
                       await page.locator('input[name="text"]').isVisible();
    
    if (isLoginPage) {
      console.log('❌ RESULTADO: Redirecionado para página de login - Cookies inválidos ou expirados');
    } else {
      console.log('✅ RESULTADO: Login parece estar funcionando');
    }
    
    console.log('\n⏳ Aguardando 10 segundos para você verificar manualmente...');
    await page.waitForTimeout(10000);
    
    await browser.close();
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar teste
testTwitterCookies().catch(console.error);
