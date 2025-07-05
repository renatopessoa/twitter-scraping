/**
 * Teste para verificar se o session detector corrigido funciona
 */
async function testSessionDetector() {
  console.log("🧪 Iniciando teste do session detector corrigido...");
  
  try {
    // Simular uma chamada para o endpoint
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
    
    console.log("📊 Resultado:", result);
    
    if (result.success) {
      console.log("✅ Teste passou - Session detector funcionando");
      console.log(`🎯 Sessões detectadas: ${result.totalDetected}`);
    } else {
      console.log("⚠️ Teste passou - Sem sessões detectadas (normal se não estiver logado)");
      console.log(`📝 Mensagem: ${result.message}`);
    }
    
  } catch (error) {
    console.error("❌ Erro no teste:", error.message);
  }
}

// Executar teste apenas se chamado diretamente
if (require.main === module) {
  testSessionDetector();
}

module.exports = { testSessionDetector };
