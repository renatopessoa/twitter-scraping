/**
 * Teste de Correção de Timeout - Sistema de Busca
 * 
 * Este script testa a correção do problema de timeout
 * durante a busca de tweets.
 */

async function testSearchFix() {
  console.log('🔧 TESTE DE CORREÇÃO - TIMEOUT DE BUSCA');
  console.log('='.repeat(50));
  
  const testQueries = [
    'javascript',
    'typescript',
    'nextjs',
    'react',
    'nodejs'
  ];
  
  for (const query of testQueries) {
    console.log(`\n🔍 Testando busca: "${query}"`);
    
    try {
      const response = await fetch('http://localhost:3000/api/twitter-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query,
          sortBy: 'recent'
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ Busca bem-sucedida para "${query}"`);
        console.log(`📊 Tweets encontrados: ${data.tweets?.length || 0}`);
        console.log(`🔧 Seletor usado: ${data.debug?.selector_used || 'N/A'}`);
        console.log(`📱 Conta utilizada: ${data.search_account || 'N/A'}`);
        
        if (data.tweets && data.tweets.length > 0) {
          console.log(`📝 Primeiro tweet: ${data.tweets[0].author} - ${data.tweets[0].content.substring(0, 100)}...`);
        }
      } else {
        console.log(`❌ Erro na busca para "${query}":`, data.error);
        
        if (data.debug) {
          console.log(`🔍 Debug info:`, data.debug);
        }
      }
      
    } catch (error) {
      console.log(`💥 Erro de conexão para "${query}":`, error.message);
    }
    
    // Aguardar entre testes para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🎯 RESULTADO DO TESTE');
  console.log('='.repeat(50));
  console.log('Se você viu "✅ Busca bem-sucedida" para pelo menos uma query,');
  console.log('a correção do timeout está funcionando!');
  console.log('\nSe ainda houver erros, verifique:');
  console.log('1. Se o servidor está rodando (npm run dev)');
  console.log('2. Se há contas configuradas em twitter-cookies-multi.json');
  console.log('3. Se as contas estão autenticadas no Twitter');
}

async function testWithDebugMode() {
  console.log('\n🐛 TESTE EM MODO DEBUG');
  console.log('='.repeat(50));
  
  try {
    const response = await fetch('http://localhost:3000/api/twitter-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'test javascript react',
        sortBy: 'recent'
      })
    });
    
    const data = await response.json();
    
    console.log('📊 Resposta completa da API:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.log('❌ Erro no teste debug:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 INICIANDO TESTES DE CORREÇÃO DE TIMEOUT');
  console.log('='.repeat(60));
  
  // Verificar se servidor está rodando
  try {
    await fetch('http://localhost:3000/api/twitter-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' })
    });
    
    console.log('✅ Servidor está rodando');
    
  } catch {
    console.log('❌ Servidor não está rodando!');
    console.log('Execute: npm run dev');
    return;
  }
  
  await testSearchFix();
  await testWithDebugMode();
  
  console.log('\n🎉 TESTES CONCLUÍDOS');
  console.log('='.repeat(60));
  console.log('📖 Se ainda houver problemas, consulte os logs acima');
  console.log('🔧 A correção implementa múltiplos seletores como fallback');
  console.log('⏱️ O timeout foi aumentado para 30 segundos');
  console.log('🌐 User-Agent foi melhorado para evitar detecção');
}

// Executar testes
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testSearchFix,
  testWithDebugMode
};
