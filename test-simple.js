const fs = require('fs');

// Configuração
const BASE_URL = 'http://localhost:3005';
const API_URL = `${BASE_URL}/api/twitter-action`;

// Cores para console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
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
    logWarning('Certifique-se de que o servidor está rodando em http://localhost:3005');
    return false;
  }
}

async function testSearchTweets() {
  console.log('\n📋 TESTE DE BUSCA DE TWEETS');
  console.log('='.repeat(50));
  
  const queries = [
    { query: 'Next.js', sortBy: 'recent', desc: 'Busca: Next.js (mais recentes)' },
    { query: 'React', sortBy: 'top', desc: 'Busca: React (mais engajamento)' },
    { query: '', sortBy: 'recent', desc: 'Busca vazia (deve falhar)', shouldFail: true }
  ];
  
  const results = [];
  
  for (const testCase of queries) {
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
      
      if (testCase.shouldFail) {
        if (!response.ok) {
          logSuccess(`Erro esperado: ${data.error}`);
          results.push({ ...testCase, status: 'success' });
        } else {
          logError('Deveria ter falhado mas passou');
          results.push({ ...testCase, status: 'error' });
        }
      } else {
        if (response.ok && data.tweets) {
          logSuccess(`Encontrados ${data.tweets.length} tweets`);
          results.push({
            ...testCase,
            status: 'success',
            tweets: data.tweets.slice(0, 2) // Salvar 2 tweets para outros testes
          });
        } else {
          logError(`Falha: ${data.error || 'Resposta inválida'}`);
          results.push({ ...testCase, status: 'error' });
        }
      }
    } catch (error) {
      logError(`Erro: ${error.message}`);
      results.push({ ...testCase, status: 'error' });
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

async function testIndividualActions(searchResults) {
  console.log('\n📋 TESTE DE AÇÕES INDIVIDUAIS');
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
  
  const testCases = [
    { action: 'like', amount: 1 },
    { action: 'retweet', amount: 1 }
  ];
  
  const results = [];
  
  for (let i = 0; i < Math.min(testCases.length, validTweets.length); i++) {
    const testCase = testCases[i];
    const tweet = validTweets[i];
    
    console.log(`\n🧪 ${testCase.action.toUpperCase()} no tweet: ${tweet.content.substring(0, 50)}...`);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: testCase.action,
          tweetId: tweet.id,
          amount: testCase.amount
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        logSuccess(`${data.message}`);
        results.push({ ...testCase, status: 'success' });
      } else {
        logError(`${data.error}`);
        results.push({ ...testCase, status: 'error' });
      }
    } catch (error) {
      logError(`Erro: ${error.message}`);
      results.push({ ...testCase, status: 'error' });
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return results;
}

async function testBatchActions(searchResults) {
  console.log('\n📋 TESTE DE AÇÕES EM LOTE');
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
  validTweets.forEach(tweet => {
    batchActions.push({
      tweetId: tweet.id,
      action: 'like',
      amount: 1
    });
  });
  
  console.log(`\n🧪 Executando ${batchActions.length} ações em lote`);
  
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
        logSuccess(`Sucessos: ${data.summary.success}/${data.summary.total}`);
      }
      return [{ status: 'success', summary: data.summary }];
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
  console.log('\n🚀 TESTE COMPLETO DA APLICAÇÃO TWITTER SCRAPING');
  console.log('='.repeat(60));
  
  // Teste de saúde do servidor
  const serverOk = await testServerHealth();
  if (!serverOk) {
    process.exit(1);
  }
  
  let totalTests = 0;
  let passedTests = 0;
  
  try {
    // Teste de busca
    const searchResults = await testSearchTweets();
    totalTests += searchResults.length;
    passedTests += searchResults.filter(r => r.status === 'success').length;
    
    // Teste de ações individuais
    const actionResults = await testIndividualActions(searchResults);
    totalTests += actionResults.length;
    passedTests += actionResults.filter(r => r.status === 'success').length;
    
    // Teste de lote
    const batchResults = await testBatchActions(searchResults);
    totalTests += batchResults.length;
    passedTests += batchResults.filter(r => r.status === 'success').length;
    
    // Relatório final
    console.log('\n📊 RELATÓRIO FINAL');
    console.log('='.repeat(50));
    logSuccess(`Testes Aprovados: ${passedTests}`);
    logError(`Testes Falharam: ${totalTests - passedTests}`);
    logInfo(`Total de Testes: ${totalTests}`);
    
    const successRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0;
    log('bright', `📈 Taxa de Sucesso: ${successRate}%`);
    
    // Salvar relatório
    const report = {
      timestamp: new Date().toISOString(),
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
    
    fs.writeFileSync('./test-report.json', JSON.stringify(report, null, 2));
    logSuccess('Relatório salvo em: test-report.json');
    
    if (passedTests === totalTests) {
      console.log('\n🎉 TODOS OS TESTES PASSARAM!');
      process.exit(0);
    } else {
      console.log(`\n⚠️  ALGUNS TESTES FALHARAM (${totalTests - passedTests}/${totalTests})`);
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
