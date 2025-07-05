const fs = require('fs');

// Configuração
const BASE_URL = 'http://localhost:3006';
const API_URL = `${BASE_URL}/api/twitter-action`;

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

function logMultiAccount(message) {
  log('magenta', `🔄 ${message}`);
}

async function testMultiAccountConfig() {
  console.log('\n📋 TESTE DE CONFIGURAÇÃO MULTI-CONTA');
  console.log('='.repeat(50));
  
  try {
    // Verificar arquivo de configuração
    const configData = fs.readFileSync('./twitter-cookies-multi.json', 'utf8');
    const config = JSON.parse(configData);
    
    logSuccess(`Arquivo de configuração carregado`);
    logInfo(`Contas configuradas: ${config.accounts.length}`);
    
    config.accounts.forEach((account, index) => {
      logMultiAccount(`${index + 1}. ${account.name} (${account.username})`);
      logInfo(`   - Cookies: ${account.cookies.length}`);
    });
    
    return config;
  } catch (error) {
    logError(`Erro ao carregar configuração: ${error.message}`);
    return null;
  }
}

async function testServerHealth() {
  console.log('\n📋 TESTE DE SAÚDE DO SERVIDOR');
  console.log('='.repeat(50));
  
  try {
    const response = await fetch(BASE_URL);
    if (response.ok) {
      logSuccess('Servidor está funcionando');
      return true;
    } else {
      logError(`Servidor retornou status ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Não foi possível conectar ao servidor: ${error.message}`);
    logWarning('Certifique-se de que o servidor está rodando em http://localhost:3006');
    return false;
  }
}

async function testMultiAccountSearch() {
  console.log('\n📋 TESTE DE BUSCA COM SISTEMA MULTI-CONTA');
  console.log('='.repeat(50));
  
  const testQueries = [
    { query: 'JavaScript', sortBy: 'recent', desc: 'Busca JavaScript (recentes)' },
    { query: 'React', sortBy: 'top', desc: 'Busca React (engajamento)' }
  ];
  
  const results = [];
  
  for (const testCase of testQueries) {
    console.log(`\n🧪 ${testCase.desc}`);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: testCase.query,
          sortBy: testCase.sortBy
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.tweets) {
        logSuccess(`Encontrados ${data.tweets.length} tweets`);
        
        if (data.accounts_available) {
          logMultiAccount(`Contas disponíveis: ${data.accounts_available}`);
        }
        
        if (data.search_account) {
          logMultiAccount(`Conta usada na busca: ${data.search_account}`);
        }
        
        results.push({
          ...testCase,
          status: 'success',
          tweets: data.tweets.slice(0, 2), // Salvar 2 tweets para testes
          accounts_available: data.accounts_available
        });
      } else {
        logError(`Falha: ${data.error || 'Resposta inválida'}`);
        results.push({ ...testCase, status: 'error', error: data.error });
      }
    } catch (error) {
      logError(`Erro: ${error.message}`);
      results.push({ ...testCase, status: 'error', error: error.message });
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

async function testMultiAccountActions(searchResults) {
  console.log('\n📋 TESTE DE AÇÕES COM MÚLTIPLAS CONTAS');
  console.log('='.repeat(50));
  
  // Coletar tweets válidos
  const validTweets = [];
  searchResults.forEach(result => {
    if (result.tweets && result.tweets.length > 0) {
      validTweets.push(...result.tweets);
    }
  });
  
  if (validTweets.length === 0) {
    logWarning('Nenhum tweet encontrado para testar ações');
    return [];
  }
  
  logInfo(`Encontrados ${validTweets.length} tweets para testar`);
  
  const results = [];
  
  // Testar ações individuais
  for (let i = 0; i < Math.min(2, validTweets.length); i++) {
    const tweet = validTweets[i];
    const action = i % 2 === 0 ? 'like' : 'retweet';
    
    console.log(`\n🧪 ${action.toUpperCase()} no tweet: ${tweet.content.substring(0, 50)}...`);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action,
          tweetId: tweet.id,
          amount: 1
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        logSuccess(`${data.message}`);
        
        if (data.account) {
          logMultiAccount(`Executado pela conta: ${data.account}`);
        }
        
        results.push({ 
          tweet: tweet.id, 
          action, 
          status: 'success', 
          account: data.account 
        });
      } else {
        logError(`${data.error}`);
        results.push({ tweet: tweet.id, action, status: 'error', error: data.error });
      }
    } catch (error) {
      logError(`Erro: ${error.message}`);
      results.push({ tweet: tweet.id, action, status: 'error', error: error.message });
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  return results;
}

async function testMultiAccountBatch(searchResults) {
  console.log('\n📋 TESTE DE LOTE COM MÚLTIPLAS CONTAS');
  console.log('='.repeat(50));
  
  // Coletar tweets válidos
  const validTweets = [];
  searchResults.forEach(result => {
    if (result.tweets && result.tweets.length > 0) {
      validTweets.push(...result.tweets.slice(0, 1)); // 1 tweet por resultado
    }
  });
  
  if (validTweets.length === 0) {
    logWarning('Nenhum tweet encontrado para testar lote');
    return [];
  }
  
  logInfo(`Testando lote com ${validTweets.length} tweets`);
  
  // Criar ações em lote
  const batchActions = [];
  validTweets.forEach((tweet, index) => {
    batchActions.push({
      tweetId: tweet.id,
      action: index % 2 === 0 ? 'like' : 'retweet',
      amount: 1
    });
  });
  
  console.log(`\n🧪 Executando ${batchActions.length} ações em lote`);
  logMultiAccount('Ações serão distribuídas entre as contas disponíveis');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchActions })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      logSuccess(`${data.message}`);
      
      if (data.summary) {
        logMultiAccount(`Sucessos: ${data.summary.success}/${data.summary.total}`);
        logMultiAccount(`Contas utilizadas: ${data.summary.accounts_used}`);
      }
      
      if (data.results && Array.isArray(data.results)) {
        console.log('\n📊 DETALHES DAS AÇÕES:');
        data.results.forEach((result, index) => {
          const status = result.success ? '✅' : '❌';
          const account = result.account || 'N/A';
          const action = result.action.toUpperCase();
          console.log(`${status} Ação ${index + 1}: ${action} - Conta: ${account}`);
        });
      }
      
      return [{ 
        status: 'success', 
        summary: data.summary, 
        accounts_used: data.summary?.accounts_used || 0
      }];
    } else {
      logError(`${data.error}`);
      return [{ status: 'error', error: data.error }];
    }
  } catch (error) {
    logError(`Erro: ${error.message}`);
    return [{ status: 'error', error: error.message }];
  }
}

async function main() {
  console.log('\n🚀 TESTE COMPLETO DO SISTEMA MULTI-CONTA');
  console.log('='.repeat(60));
  
  // Verificar configuração multi-conta
  const config = await testMultiAccountConfig();
  if (!config) {
    console.log('\n❌ Não foi possível carregar configuração multi-conta');
    process.exit(1);
  }
  
  // Verificar saúde do servidor
  const serverOk = await testServerHealth();
  if (!serverOk) {
    process.exit(1);
  }
  
  let totalTests = 0;
  let passedTests = 0;
  
  try {
    // Teste de busca
    const searchResults = await testMultiAccountSearch();
    totalTests += searchResults.length;
    passedTests += searchResults.filter(r => r.status === 'success').length;
    
    // Teste de ações individuais
    const actionResults = await testMultiAccountActions(searchResults);
    totalTests += actionResults.length;
    passedTests += actionResults.filter(r => r.status === 'success').length;
    
    // Teste de lote
    const batchResults = await testMultiAccountBatch(searchResults);
    totalTests += batchResults.length;
    passedTests += batchResults.filter(r => r.status === 'success').length;
    
    // Relatório final
    console.log('\n📊 RELATÓRIO FINAL - SISTEMA MULTI-CONTA');
    console.log('='.repeat(60));
    logSuccess(`Testes Aprovados: ${passedTests}`);
    logError(`Testes Falharam: ${totalTests - passedTests}`);
    logInfo(`Total de Testes: ${totalTests}`);
    logMultiAccount(`Contas Configuradas: ${config.accounts.length}`);
    
    const successRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0;
    log('bright', `📈 Taxa de Sucesso: ${successRate}%`);
    
    // Salvar relatório
    const report = {
      timestamp: new Date().toISOString(),
      system: 'multi-account',
      accounts_configured: config.accounts.length,
      total_tests: totalTests,
      passed_tests: passedTests,
      failed_tests: totalTests - passedTests,
      success_rate: successRate,
      results: {
        search: searchResults,
        actions: actionResults,
        batch: batchResults
      }
    };
    
    fs.writeFileSync('./test-multi-account-report.json', JSON.stringify(report, null, 2));
    logSuccess('Relatório salvo em: test-multi-account-report.json');
    
    if (passedTests === totalTests) {
      console.log('\n🎉 TODOS OS TESTES PASSARAM!');
      console.log('🔄 SISTEMA MULTI-CONTA FUNCIONANDO PERFEITAMENTE!');
      process.exit(0);
    } else {
      console.log(`\n⚠️  ALGUNS TESTES FALHARAM (${totalTests - passedTests}/${totalTests})`);
      console.log('🔄 SISTEMA MULTI-CONTA PARCIALMENTE FUNCIONAL');
      process.exit(1);
    }
    
  } catch (error) {
    logError(`Erro durante testes: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
