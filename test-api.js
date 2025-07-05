// Teste simples para verificar erros
const testAPI = async () => {
  try {
    // Teste de busca primeiro
    const searchResponse = await fetch('/api/twitter-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'test' })
    });
    
    console.log('Search response status:', searchResponse.status);
    const searchData = await searchResponse.json();
    console.log('Search data:', searchData);
    
    // Se a busca funcionar, teste o like
    if (searchData.tweets && searchData.tweets.length > 0) {
      const firstTweet = searchData.tweets[0];
      console.log('Testing like on tweet:', firstTweet.id);
      
      const likeResponse = await fetch('/api/twitter-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'like', 
          tweetId: firstTweet.id 
        })
      });
      
      console.log('Like response status:', likeResponse.status);
      const likeData = await likeResponse.json();
      console.log('Like data:', likeData);
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
};

// Executar quando a página carregar
if (typeof window !== 'undefined') {
  window.testAPI = testAPI;
  console.log('Para testar, execute: testAPI()');
}
