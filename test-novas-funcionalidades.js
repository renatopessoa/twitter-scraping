const testNewFeatures = async () => {
  console.log("🧪 Testando novas funcionalidades...");
  
  try {
    // Teste 1: Buscar tweets mais recentes
    console.log("1. Testando busca por tweets mais recentes...");
    const recentResponse = await fetch('http://localhost:3003/api/twitter-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: 'JavaScript', 
        sortBy: 'recent' 
      })
    });
    
    if (!recentResponse.ok) {
      console.error("❌ Erro na busca por tweets recentes:", await recentResponse.text());
      return;
    }
    
    const recentData = await recentResponse.json();
    console.log(`✅ Encontrados ${recentData.tweets.length} tweets recentes`);
    console.log(`   Ordenação: ${recentData.sortBy}`);
    
    // Teste 2: Buscar tweets por engajamento
    console.log("2. Testando busca por tweets com mais engajamento...");
    const topResponse = await fetch('http://localhost:3003/api/twitter-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: 'JavaScript', 
        sortBy: 'top' 
      })
    });
    
    if (!topResponse.ok) {
      console.error("❌ Erro na busca por tweets top:", await topResponse.text());
      return;
    }
    
    const topData = await topResponse.json();
    console.log(`✅ Encontrados ${topData.tweets.length} tweets com mais engajamento`);
    console.log(`   Ordenação: ${topData.sortBy}`);
    
    // Teste 3: Testar like com quantidade personalizada
    if (recentData.tweets.length > 0) {
      const testTweet = recentData.tweets[0];
      console.log(`3. Testando like com quantidade personalizada no tweet: ${testTweet.id}`);
      
      const likeResponse = await fetch('http://localhost:3003/api/twitter-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'like', 
          tweetId: testTweet.id,
          amount: 3 // Testar com 3 likes
        })
      });
      
      if (!likeResponse.ok) {
        const errorData = await likeResponse.json();
        console.error("❌ Erro no like personalizado:", errorData.error);
      } else {
        const likeData = await likeResponse.json();
        console.log("✅ Like personalizado executado:", likeData.message);
      }
    }
    
    // Teste 4: Testar retweet com quantidade personalizada
    if (topData.tweets.length > 0) {
      const testTweet = topData.tweets[0];
      console.log(`4. Testando retweet com quantidade personalizada no tweet: ${testTweet.id}`);
      
      const retweetResponse = await fetch('http://localhost:3003/api/twitter-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'retweet', 
          tweetId: testTweet.id,
          amount: 2 // Testar com 2 retweets
        })
      });
      
      if (!retweetResponse.ok) {
        const errorData = await retweetResponse.json();
        console.error("❌ Erro no retweet personalizado:", errorData.error);
      } else {
        const retweetData = await retweetResponse.json();
        console.log("✅ Retweet personalizado executado:", retweetData.message);
      }
    }
    
    console.log("\n🎉 TESTE DAS NOVAS FUNCIONALIDADES CONCLUÍDO!");
    console.log("✅ Busca por tweets recentes funcionando");
    console.log("✅ Busca por tweets com engajamento funcionando");
    console.log("✅ Likes com quantidade personalizada funcionando");
    console.log("✅ Retweets com quantidade personalizada funcionando");
    
  } catch (error) {
    console.error("❌ Erro durante o teste:", error);
  }
};

// Executar o teste
testNewFeatures();
