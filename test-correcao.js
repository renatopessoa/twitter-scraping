const testTweetAction = async () => {
  console.log("🧪 Testando correção do erro strict mode...");
  
  try {
    // Primeiro, buscar alguns tweets
    console.log("1. Buscando tweets...");
    const searchResponse = await fetch('http://localhost:3003/api/twitter-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'JavaScript' })
    });
    
    if (!searchResponse.ok) {
      console.error("❌ Erro na busca:", await searchResponse.text());
      return;
    }
    
    const searchData = await searchResponse.json();
    console.log(`✅ Encontrados ${searchData.tweets.length} tweets`);
    
    if (searchData.tweets.length === 0) {
      console.log("⚠️  Nenhum tweet encontrado para testar");
      return;
    }
    
    // Testar like no primeiro tweet
    const firstTweet = searchData.tweets[0];
    console.log(`2. Testando like no tweet: ${firstTweet.id}`);
    console.log(`   Autor: ${firstTweet.author}`);
    console.log(`   Conteúdo: ${firstTweet.content.substring(0, 50)}...`);
    
    const likeResponse = await fetch('http://localhost:3003/api/twitter-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        action: 'like', 
        tweetId: firstTweet.id 
      })
    });
    
    if (!likeResponse.ok) {
      const errorData = await likeResponse.json();
      console.error("❌ Erro no like:", errorData.error);
      
      // Verificar se é o erro específico de strict mode
      if (errorData.error.includes('strict mode violation')) {
        console.error("🚨 ERRO DE STRICT MODE AINDA PRESENTE!");
        return;
      }
      
      if (errorData.error.includes('Múltiplos elementos')) {
        console.log("⚠️  Erro tratado corretamente - múltiplos elementos detectados");
        return;
      }
      
      return;
    }
    
    const likeData = await likeResponse.json();
    console.log("✅ Like executado com sucesso:", likeData.message);
    
    // Testar retweet no segundo tweet (se existir)
    if (searchData.tweets.length > 1) {
      const secondTweet = searchData.tweets[1];
      console.log(`3. Testando retweet no tweet: ${secondTweet.id}`);
      
      const retweetResponse = await fetch('http://localhost:3003/api/twitter-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'retweet', 
          tweetId: secondTweet.id 
        })
      });
      
      if (!retweetResponse.ok) {
        const errorData = await retweetResponse.json();
        console.error("❌ Erro no retweet:", errorData.error);
        return;
      }
      
      const retweetData = await retweetResponse.json();
      console.log("✅ Retweet executado com sucesso:", retweetData.message);
    }
    
    console.log("\n🎉 TESTE CONCLUÍDO COM SUCESSO!");
    console.log("✅ Erro de strict mode foi corrigido!");
    
  } catch (error) {
    console.error("❌ Erro durante o teste:", error);
  }
};

// Executar o teste
testTweetAction();
