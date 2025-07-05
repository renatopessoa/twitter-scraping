const testBatchActions = async () => {
  console.log("🧪 Testando ações em lote...");
  
  try {
    // Primeiro, buscar alguns tweets
    console.log("1. Buscando tweets para configurar ações em lote...");
    const searchResponse = await fetch('http://localhost:3003/api/twitter-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: 'JavaScript', 
        sortBy: 'recent' 
      })
    });
    
    if (!searchResponse.ok) {
      console.error("❌ Erro na busca:", await searchResponse.text());
      return;
    }
    
    const searchData = await searchResponse.json();
    console.log(`✅ Encontrados ${searchData.tweets.length} tweets`);
    
    if (searchData.tweets.length < 2) {
      console.log("⚠️  Não há tweets suficientes para testar ações em lote");
      return;
    }
    
    // Testar ações em lote
    console.log("2. Testando ações em lote...");
    const batchActions = [
      {
        tweetId: searchData.tweets[0].id,
        action: 'like',
        amount: 2
      },
      {
        tweetId: searchData.tweets[0].id,
        action: 'retweet',
        amount: 1
      },
      {
        tweetId: searchData.tweets[1].id,
        action: 'like',
        amount: 3
      }
    ];
    
    console.log(`   Configurando ${batchActions.length} ações:`);
    batchActions.forEach((action, i) => {
      console.log(`   ${i + 1}. ${action.action} (${action.amount}x) no tweet ${action.tweetId}`);
    });
    
    const batchResponse = await fetch('http://localhost:3003/api/twitter-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ batchActions })
    });
    
    if (!batchResponse.ok) {
      const errorData = await batchResponse.json();
      console.error("❌ Erro nas ações em lote:", errorData.error);
      return;
    }
    
    const batchData = await batchResponse.json();
    console.log("✅ Ações em lote executadas:", batchData.message);
    console.log(`   Resumo: ${batchData.summary.success}/${batchData.summary.total} sucessos`);
    
    // Mostrar resultados detalhados
    console.log("📊 Resultados detalhados:");
    batchData.results.forEach((result, i) => {
      const status = result.success ? "✅" : "❌";
      console.log(`   ${i + 1}. ${status} ${result.action} (${result.amount}x) - ${result.success ? result.message : result.error}`);
    });
    
    console.log("\n🎉 TESTE DE AÇÕES EM LOTE CONCLUÍDO!");
    console.log("✅ Funcionalidade de envio em lote funcionando");
    
  } catch (error) {
    console.error("❌ Erro durante o teste:", error);
  }
};

// Executar o teste
testBatchActions();
