#!/usr/bin/env node

/**
 * Teste Completo da Aplicação Twitter Scraping
 * 
 * Este script testa todas as funcionalidades da aplicação:
 * 1. Busca de tweets com diferentes ordenações
 * 2. Ações individuais (like/retweet)
 * 3. Ações em lote
 * 4. Tratamento de erros
 * 5. Validação de entrada
 */

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

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log('bright', `📋 ${title}`);
  console.log('='.repeat(60));
}

function logTest(testName) {
  log('cyan', `🧪 Testando: ${testName}`);
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

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    return { response, data };
  } catch (error) {
    throw new Error(`Erro na requisição: ${error.message}`);
  }
}

const fs = require('fs');

async function testServerHealth() {
  logSection('TESTE DE SAÚDE DO SERVIDOR');
  
  try {
    logTest('Verificando se servidor está rodando');
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
    logWarning('Certifique-se de que o servidor está rodando com: npm run dev');
    return false;
  }
}

async function testSearchTweets() {
  logSection('TESTE DE BUSCA DE TWEETS');
  
  const testCases = [
    { query: 'Next.js', sortBy: 'recent', description: 'Busca básica - mais recentes' },
    { query: 'React', sortBy: 'top', description: 'Busca básica - mais engajamento' },
    { query: '', sortBy: 'recent', description: 'Busca vazia (deve falhar)', shouldFail: true },
    { query: 'Test Query 123', sortBy: 'recent', description: 'Busca com query específica' }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    logTest(testCase.description);
    
    try {
      const { response, data } = await makeRequest(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          query: testCase.query,
          sortBy: testCase.sortBy
        })
      });
      
      if (testCase.shouldFail) {
        if (!response.ok) {
          logSuccess(`Falha esperada: ${data.error}`);
          results.push({ ...testCase, status: 'success', error: data.error });
        } else {
          logError('Deveria ter falhado mas passou');
          results.push({ ...testCase, status: 'unexpected_success' });
        }
      } else {
        if (response.ok && data.tweets && Array.isArray(data.tweets)) {
          logSuccess(`Encontrados ${data.tweets.length} tweets`);
          results.push({ 
            ...testCase, 
            status: 'success', 
            tweetsFound: data.tweets.length,
            tweets: data.tweets.slice(0, 2) // Salvar apenas 2 tweets para testes de ação
          });
        } else {
          logError(`Falha inesperada: ${data.error || 'Resposta inválida'}`);
          results.push({ ...testCase, status: 'error', error: data.error });
        }
      }
    } catch (error) {
      logError(`Erro durante o teste: ${error.message}`);
      results.push({ ...testCase, status: 'error', error: error.message });
    }
    
    // Aguardar um pouco entre requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

async function testIndividualActions(searchResults) {
  logSection('TESTE DE AÇÕES INDIVIDUAIS');
  
  // Encontrar tweets válidos dos resultados de busca
  const validTweets = [];
  for (const result of searchResults) {
    if (result.tweets && result.tweets.length > 0) {
      validTweets.push(...result.tweets);
    }
  }
  
  if (validTweets.length === 0) {
    logWarning('Nenhum tweet encontrado para testar ações individuais');
    return [];
  }
  
  logSuccess(`Encontrados ${validTweets.length} tweets para testar ações`);
  
  const results = [];
  
  // Testar algumas ações
  const testCases = [
    { action: 'like', amount: 1 },
    { action: 'retweet', amount: 1 },
    { action: 'invalid_action', amount: 1, shouldFail: true }
  ];
  
  for (let i = 0; i < Math.min(testCases.length, validTweets.length); i++) {
    const testCase = testCases[i];
    const tweet = validTweets[i];
    
    logTest(`${testCase.action} no tweet: ${tweet.content.substring(0, 50)}...`);
    
    try {
      const { response, data } = await makeRequest(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: testCase.action,
          tweetId: tweet.id,
          amount: testCase.amount
        })
      });
      
      if (testCase.shouldFail) {
        if (!response.ok) {
          logSuccess(`Falha esperada: ${data.error}`);
          results.push({ ...testCase, status: 'success', error: data.error });
        } else {
          logError('Deveria ter falhado mas passou');
          results.push({ ...testCase, status: 'unexpected_success' });
        }
      } else {
        if (response.ok) {
          logSuccess(`Ação executada: ${data.message}`);
          results.push({ ...testCase, status: 'success', message: data.message });
        } else {
          logError(`Falha: ${data.error}`);
          results.push({ ...testCase, status: 'error', error: data.error });
        }
      }
    } catch (error) {
      logError(`Erro durante ação: ${error.message}`);
      results.push({ ...testCase, status: 'error', error: error.message });
    }
    
    // Aguardar entre ações
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return results;
}

async function testBatchActions(searchResults) {
  logSection('TESTE DE AÇÕES EM LOTE');
  
  // Encontrar tweets válidos
  const validTweets = [];
  for (const result of searchResults) {
    if (result.tweets && result.tweets.length > 0) {
      validTweets.push(...result.tweets.slice(0, 2)); // Máximo 2 tweets por busca
    }
  }
  
  if (validTweets.length === 0) {
    logWarning('Nenhum tweet encontrado para testar ações em lote');
    return [];
  }
  
  logSuccess(`Encontrados ${validTweets.length} tweets para testar ações em lote`);
  
  const results = [];
  
  // Criar ações em lote
  const batchActions = [];
  for (let i = 0; i < Math.min(3, validTweets.length); i++) {
    const tweet = validTweets[i];
    
    batchActions.push({
      tweetId: tweet.id,
      action: 'like',
      amount: 1
    });
    
    if (i < 2) { // Adicionar retweet para alguns tweets
      batchActions.push({
        tweetId: tweet.id,
        action: 'retweet',
        amount: 1
      });
    }
  }
  
  logTest(`Executando ${batchActions.length} ações em lote`);
  
  try {
    const { response, data } = await makeRequest(API_URL, {
      method: 'POST',
      body: JSON.stringify({ batchActions })
    });
    
    if (response.ok) {
      logSuccess(`Lote executado: ${data.message}`);
      logSuccess(`Sucessos: ${data.summary.success}/${data.summary.total}`);
      
      if (data.results && Array.isArray(data.results)) {
        for (const result of data.results) {
          if (result.success) {
            logSuccess(`  ✓ ${result.action} no tweet ${result.tweetId}`);
          } else {
            logError(`  ✗ ${result.action} no tweet ${result.tweetId}: ${result.error}`);
          }
        }
      }
      
      results.push({
        status: 'success',
        message: data.message,
        summary: data.summary,
        results: data.results
      });
    } else {
      logError(`Falha no lote: ${data.error}`);
      results.push({ status: 'error', error: data.error });
    }
  } catch (error) {
    logError(`Erro durante lote: ${error.message}`);
    results.push({ status: 'error', error: error.message });
  }
  
  return results;
}

async function testErrorHandling() {
  logSection('TESTE DE TRATAMENTO DE ERROS');
  
  const testCases = [
    {
      name: 'Requisição sem body',
      data: undefined,
      method: 'POST'
    },
    {
      name: 'Requisição com JSON inválido',
      data: 'invalid json',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      name: 'Método não suportado',
      data: { query: 'test' },
      method: 'GET'
    }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    logTest(testCase.name);
    
    try {
      const options = {
        method: testCase.method,
        headers: testCase.headers || { 'Content-Type': 'application/json' }
      };
      
      if (testCase.data !== undefined) {
        options.body = typeof testCase.data === 'string' ? testCase.data : JSON.stringify(testCase.data);
      }
      
      const { response, data } = await makeRequest(API_URL, options);
      
      if (!response.ok) {
        logSuccess(`Erro tratado corretamente: ${data.error || response.status}`);
        results.push({ ...testCase, status: 'success', error: data.error });
      } else {
        logWarning('Deveria ter falhado mas passou');
        results.push({ ...testCase, status: 'unexpected_success' });
      }
    } catch (error) {
      logSuccess(`Erro capturado: ${error.message}`);
      results.push({ ...testCase, status: 'success', error: error.message });
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

function generateReport(allResults) {
  logSection('RELATÓRIO FINAL');
  
  const report = {
    timestamp: new Date().toISOString(),
    total_tests: 0,
    passed_tests: 0,
    failed_tests: 0,
    categories: {}
  };
  
  for (const [category, results] of Object.entries(allResults)) {
    if (!results || !Array.isArray(results)) continue;
    
    const categoryReport = {
      total: results.length,
      passed: 0,
      failed: 0,
      details: results
    };
    
    for (const result of results) {
      if (result.status === 'success') {
        categoryReport.passed++;
      } else {
        categoryReport.failed++;
      }
    }
    
    report.categories[category] = categoryReport;
    report.total_tests += categoryReport.total;
    report.passed_tests += categoryReport.passed;
    report.failed_tests += categoryReport.failed;
  }
  
  // Exibir relatório
  log('bright', `📊 RESUMO GERAL`);
  log('green', `✅ Testes Aprovados: ${report.passed_tests}`);
  log('red', `❌ Testes Falharam: ${report.failed_tests}`);
  log('blue', `📋 Total de Testes: ${report.total_tests}`);
  
  const successRate = report.total_tests > 0 ? (report.passed_tests / report.total_tests * 100).toFixed(1) : 0;
  log('cyan', `📈 Taxa de Sucesso: ${successRate}%`);
  
  console.log('\n📋 DETALHES POR CATEGORIA:');
  for (const [category, categoryReport] of Object.entries(report.categories)) {
    const categorySuccessRate = categoryReport.total > 0 ? (categoryReport.passed / categoryReport.total * 100).toFixed(1) : 0;
    console.log(`\n${category.toUpperCase().replace('_', ' ')}:`);
    console.log(`  ✅ Passou: ${categoryReport.passed}/${categoryReport.total} (${categorySuccessRate}%)`);
    
    if (categoryReport.failed > 0) {
      console.log(`  ❌ Falhou: ${categoryReport.failed}`);
    }
  }
  
  return report;
}

async function main() {
  console.log('\n🚀 INICIANDO TESTES COMPLETOS DA APLICAÇÃO TWITTER SCRAPING\n');
  
  // Verificar se o servidor está rodando
  const serverOk = await testServerHealth();
  if (!serverOk) {
    logError('Servidor não está funcionando. Abortando testes.');
    process.exit(1);
  }
  
  const allResults = {};
  
  try {
    // Executar todos os testes
    allResults.search = await testSearchTweets();
    allResults.individual_actions = await testIndividualActions(allResults.search);
    allResults.batch_actions = await testBatchActions(allResults.search);
    allResults.error_handling = await testErrorHandling();
    
    // Gerar relatório final
    const report = generateReport(allResults);
    
    // Salvar relatório em arquivo
    const reportPath = './test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    logSuccess(`Relatório salvo em: ${reportPath}`);
    
    // Determinar código de saída
    const exitCode = report.failed_tests > 0 ? 1 : 0;
    
    if (exitCode === 0) {
      logSuccess('🎉 TODOS OS TESTES PASSARAM!');
    } else {
      logWarning(`⚠️  ALGUNS TESTES FALHARAM (${report.failed_tests}/${report.total_tests})`);
    }
    
    process.exit(exitCode);
    
  } catch (error) {
    logError(`Erro durante execução dos testes: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = {
  testServerHealth,
  testSearchTweets,
  testIndividualActions,
  testBatchActions,
  testErrorHandling,
  generateReport
};
