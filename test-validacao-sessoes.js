import fetch from 'node-fetch';

/**
 * Teste para validação de sessões e busca robusta
 */
async function testSessionValidation() {
  console.log("🧪 Iniciando teste de validação de sessões...");
  
  try {
    console.log("\n🔍 Testando busca com validação de sessão...");
    
    const response = await fetch('http://localhost:3000/api/twitter-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '_renatopessoa_',
        sortBy: 'recent'
      })
    });
    
    const result = await response.json();
    
    console.log("\n📊 Resultado da busca:");
    console.log(`Status: ${response.status}`);
    console.log(`Success: ${response.ok}`);
    
    if (response.ok) {
      console.log("✅ Busca realizada com sucesso!");
      console.log(`🔍 Tweets encontrados: ${result.total || 0}`);
      console.log(`👤 Conta usada: ${result.search_account}`);
      console.log(`📋 Contas disponíveis: ${result.accounts_available}`);
      
      if (result.tweets && result.tweets.length > 0) {
        console.log("\n📝 Primeiros tweets:");
        result.tweets.slice(0, 3).forEach((tweet, index) => {
          console.log(`${index + 1}. ${tweet.author} - ${tweet.text?.substring(0, 100)}...`);
        });
      }
    } else {
      console.log("❌ Erro na busca:");
      console.log(`Erro: ${result.error}`);
      console.log(`Detalhes: ${result.details}`);
      console.log(`Ação sugerida: ${result.suggested_action}`);
      
      if (result.available_accounts) {
        console.log(`Contas disponíveis: ${result.available_accounts.join(', ')}`);
      }
      
      if (result.currentUrl) {
        console.log(`URL atual: ${result.currentUrl}`);
      }
    }
    
  } catch (error) {
    console.error("❌ Erro no teste:", error.message);
  }
}

/**
 * Teste para verificar detecção automática de sessões
 */
async function testSessionDetection() {
  console.log("\n🔍 Testando detecção automática de sessões...");
  
  try {
    const response = await fetch('http://localhost:3000/api/session-detector', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'detect-sessions',
        options: {
          headless: true,
          timeout: 10000,
          maxRetries: 1
        }
      })
    });
    
    const result = await response.json();
    
    console.log("📊 Resultado da detecção:");
    console.log(`Status: ${response.status}`);
    console.log(`Success: ${result.success}`);
    console.log(`Message: ${result.message}`);
    console.log(`Sessões detectadas: ${result.totalDetected || 0}`);
    
    if (result.sessions && result.sessions.length > 0) {
      console.log("\n👤 Sessões encontradas:");
      result.sessions.forEach((session, index) => {
        console.log(`${index + 1}. ${session.name} (@${session.username})`);
      });
    }
    
  } catch (error) {
    console.error("❌ Erro na detecção:", error.message);
  }
}

/**
 * Função principal
 */
async function main() {
  console.log("🚀 TESTE DE VALIDAÇÃO DE SESSÕES E BUSCA ROBUSTA");
  console.log("=".repeat(55));
  
  // Teste 1: Validação de sessões na busca
  await testSessionValidation();
  
  // Teste 2: Detecção automática (se disponível)
  await testSessionDetection();
  
  console.log("\n✅ Testes concluídos!");
  console.log("\n💡 Dicas:");
  console.log("- Se houver erro 401, use o detector de sessões");
  console.log("- Se nenhuma sessão for detectada, faça login no Twitter");
  console.log("- Use npm run detect:auto para detectar sessões automaticamente");
}

// Executar se chamado diretamente
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}

export { testSessionValidation, testSessionDetection };
