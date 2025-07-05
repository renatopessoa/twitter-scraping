/**
 * Teste da Funcionalidade de Varredura Automática
 * 
 * Este script testa todas as funcionalidades de detecção
 * automática de sessões do Twitter.
 */

const TwitterSessionDetector = require('./twitter-session-detector');
const fs = require('fs');

async function testSessionDetection() {
  console.log('🧪 TESTE DE VARREDURA AUTOMÁTICA');
  console.log('='.repeat(50));
  
  const detector = new TwitterSessionDetector({
    headless: true,
    timeout: 10000
  });
  
  console.log('1. Testando detecção automática...');
  
  try {
    const sessions = await detector.detectActiveSessions();
    
    console.log(`✅ Teste concluído: ${sessions.length} sessões detectadas`);
    
    if (sessions.length > 0) {
      console.log('\n📊 SESSÕES DETECTADAS:');
      sessions.forEach((session, index) => {
        console.log(`${index + 1}. ${session.name} (@${session.username})`);
        console.log(`   Cookies: ${session.cookies.length}`);
        console.log(`   Seguidores: ${session.metrics.followers}`);
        console.log(`   Seguindo: ${session.metrics.following}`);
        console.log();
      });
    } else {
      console.log('\n⚠️  Nenhuma sessão detectada automaticamente');
      console.log('Certifique-se de estar logado no Twitter e tente novamente.');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

async function testAPIEndpoint() {
  console.log('\n🌐 TESTE DE API ENDPOINT');
  console.log('='.repeat(50));
  
  try {
    const response = await fetch('http://localhost:3000/api/session-detector', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'detect-sessions',
        options: {
          headless: true,
          timeout: 10000
        }
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API funcionando corretamente');
      console.log(`📊 Resposta: ${data.message}`);
      console.log(`👥 Sessões: ${data.totalDetected || 0}`);
    } else {
      console.log('❌ Erro na API:', data.error);
    }
    
  } catch {
    console.log('⚠️  Servidor não está rodando');
    console.log('Execute: npm run dev');
  }
}

async function testCookieValidation() {
  console.log('\n🍪 TESTE DE VALIDAÇÃO DE COOKIES');
  console.log('='.repeat(50));
  
  try {
    const configExists = fs.existsSync('./twitter-cookies-multi.json');
    
    if (configExists) {
      const config = JSON.parse(fs.readFileSync('./twitter-cookies-multi.json', 'utf-8'));
      
      console.log('✅ Arquivo de configuração encontrado');
      console.log(`📱 Contas configuradas: ${config.accounts?.length || 0}`);
      
      if (config.accounts && config.accounts.length > 0) {
        console.log('\n👥 CONTAS CONFIGURADAS:');
        config.accounts.forEach((account, index) => {
          console.log(`${index + 1}. ${account.name} (@${account.username})`);
          console.log(`   Cookies: ${account.cookies?.length || 0}`);
          console.log(`   Seguidores: ${account.metrics?.followers || 0}`);
        });
      }
      
    } else {
      console.log('⚠️  Arquivo de configuração não encontrado');
      console.log('Execute: npm run detect:auto');
    }
    
  } catch (error) {
    console.log('❌ Erro ao ler configuração:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 INICIANDO TESTES DE VARREDURA AUTOMÁTICA');
  console.log('='.repeat(60));
  
  await testSessionDetection();
  await testAPIEndpoint();
  await testCookieValidation();
  
  console.log('\n🎉 TESTES CONCLUÍDOS');
  console.log('='.repeat(60));
  console.log('📖 Consulte VARREDURA-AUTOMATICA.md para mais informações');
  console.log('🔧 Use npm run detect:auto para detecção automática');
  console.log('🌐 Use npm run dev para iniciar o servidor');
}

// Executar testes
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testSessionDetection,
  testAPIEndpoint,
  testCookieValidation
};
