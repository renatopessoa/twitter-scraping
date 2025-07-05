"use client";

import { useState } from "react";

interface Tweet {
  id: string;
  author: string;
  content: string;
  engagement: {
    likes: number;
    retweets: number;
    comments: number;
    total: number;
  };
  timestamp: string;
  url: string;
  isLiked: boolean;
  isRetweeted: boolean;
  username?: string;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "top">("recent");
  const [status, setStatus] = useState("Pronto");
  const [isLoading, setIsLoading] = useState(false);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingActions, setLoadingActions] = useState<{ [key: string]: boolean }>({});
  const [customLikes, setCustomLikes] = useState<{ [key: string]: number }>({});
  const [customRetweets, setCustomRetweets] = useState<{ [key: string]: number }>({});
  const [showCustomInputs, setShowCustomInputs] = useState<{ [key: string]: boolean }>({});
  const [accountsInfo, setAccountsInfo] = useState<{ total: number; available: string[] }>({ total: 0, available: [] });
  const [sessionDetector, setSessionDetector] = useState<{
    isDetecting: boolean;
    showDetector: boolean;
    lastDetection: string | null;
    detectionResults: { name: string; username: string; metrics: { followers: number; following: number; verified: boolean } }[];
  }>({
    isDetecting: false,
    showDetector: false,
    lastDetection: null,
    detectionResults: []
  });
  const [sessionStatus, setSessionStatus] = useState<{
    isValidating: boolean;
    isValid: boolean | null;
    message: string;
    username: string | null;
    needsNewSession: boolean;
  }>({
    isValidating: false,
    isValid: null,
    message: "",
    username: null,
    needsNewSession: false
  });

  const clearResults = () => {
    setTweets([]);
    setSearchQuery("");
    setStatus("Pronto");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      setStatus("Erro: Por favor, insira um termo de busca");
      return;
    }

    setIsLoading(true);
    setStatus("Buscando tweets...");
    setTweets([]);

    try {
      const response = await fetch("/api/twitter-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: query.trim(), sortBy }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(data.message || "Busca concluída!");
        setTweets(data.tweets || []);
        setSearchQuery(data.query || query.trim());

        // Atualizar informações das contas
        if (data.accounts_available) {
          setAccountsInfo({
            total: data.accounts_available,
            available: data.search_account ? [data.search_account] : []
          });
        }
      } else {
        setStatus(`Erro: ${data.error || "Algo deu errado"}`);
      }
    } catch (error) {
      setStatus(`Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTweetAction = async (action: 'like' | 'retweet', tweetId: string, tweetIndex: number) => {
    const actionKey = `${action}-${tweetIndex}`;
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }));

    // Obter quantidade personalizada se definida
    const customAmount = action === 'like'
      ? customLikes[tweetId] || 1
      : customRetweets[tweetId] || 1;

    try {
      const response = await fetch("/api/twitter-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          tweetId,
          amount: customAmount
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Atualizar o estado local do tweet
        setTweets(prevTweets => {
          const newTweets = [...prevTweets];
          if (action === 'like') {
            newTweets[tweetIndex].isLiked = !newTweets[tweetIndex].isLiked;
            newTweets[tweetIndex].engagement.likes += newTweets[tweetIndex].isLiked ? customAmount : -customAmount;
          } else if (action === 'retweet') {
            newTweets[tweetIndex].isRetweeted = !newTweets[tweetIndex].isRetweeted;
            newTweets[tweetIndex].engagement.retweets += newTweets[tweetIndex].isRetweeted ? customAmount : -customAmount;
          }
          newTweets[tweetIndex].engagement.total =
            newTweets[tweetIndex].engagement.likes +
            newTweets[tweetIndex].engagement.retweets +
            newTweets[tweetIndex].engagement.comments;
          return newTweets;
        });

        setStatus(data.message);
      } else {
        setStatus(`Erro: ${data.error}`);
      }
    } catch (error) {
      setStatus(`Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleBatchActions = async () => {
    // Coletar todas as ações configuradas
    const batchActions = [];

    for (const tweet of tweets) {
      const likesAmount = customLikes[tweet.id];
      const retweetsAmount = customRetweets[tweet.id];

      if (likesAmount && likesAmount > 0) {
        batchActions.push({
          tweetId: tweet.id,
          action: 'like' as const,
          amount: likesAmount
        });
      }

      if (retweetsAmount && retweetsAmount > 0) {
        batchActions.push({
          tweetId: tweet.id,
          action: 'retweet' as const,
          amount: retweetsAmount
        });
      }
    }

    if (batchActions.length === 0) {
      setStatus("Nenhuma ação configurada. Configure quantidades nos tweets antes de enviar.");
      return;
    }

    setLoadingActions(prev => ({ ...prev, 'batch': true }));
    setStatus(`Executando ${batchActions.length} ações em lote...`);

    try {
      const response = await fetch("/api/twitter-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ batchActions }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(`${data.message} - ${data.summary.success}/${data.summary.total} sucessos`);

        // Atualizar estado local dos tweets baseado nos resultados
        setTweets(prevTweets => {
          const newTweets = [...prevTweets];

          for (const result of data.results) {
            if (result.success) {
              const tweetIndex = newTweets.findIndex(t => t.id === result.tweetId);
              if (tweetIndex !== -1) {
                if (result.action === 'like') {
                  newTweets[tweetIndex].isLiked = true;
                  newTweets[tweetIndex].engagement.likes += result.amount;
                } else if (result.action === 'retweet') {
                  newTweets[tweetIndex].isRetweeted = true;
                  newTweets[tweetIndex].engagement.retweets += result.amount;
                }
                newTweets[tweetIndex].engagement.total =
                  newTweets[tweetIndex].engagement.likes +
                  newTweets[tweetIndex].engagement.retweets +
                  newTweets[tweetIndex].engagement.comments;
              }
            }
          }

          return newTweets;
        });

        // Limpar configurações após sucesso
        setCustomLikes({});
        setCustomRetweets({});
        setShowCustomInputs({});

      } else {
        setStatus(`Erro: ${data.error}`);
      }
    } catch (error) {
      setStatus(`Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    } finally {
      setLoadingActions(prev => ({ ...prev, 'batch': false }));
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDetectSessions = async () => {
    setSessionDetector(prev => ({ ...prev, isDetecting: true }));
    setStatus("🔍 Detectando sessões ativas do Twitter...");

    try {
      const response = await fetch("/api/session-detector", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "detect-sessions",
          options: {
            headless: true,
            timeout: 15000
          }
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(data.message);
        setSessionDetector(prev => ({
          ...prev,
          isDetecting: false,
          lastDetection: new Date().toISOString(),
          detectionResults: data.sessions || []
        }));

        // Atualizar informações das contas
        if (data.totalDetected > 0) {
          setAccountsInfo({
            total: data.totalDetected,
            available: data.sessions.map((s: { name: string; username: string }) => s.name)
          });
        }
      } else {
        setStatus(`Erro na detecção: ${data.error}`);
        setSessionDetector(prev => ({ ...prev, isDetecting: false }));
      }
    } catch (error) {
      setStatus(`Erro na detecção: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
      setSessionDetector(prev => ({ ...prev, isDetecting: false }));
    }
  };

  const handleValidateSessions = async () => {
    setSessionDetector(prev => ({ ...prev, isDetecting: true }));
    setStatus("🔍 Validando sessões existentes...");

    try {
      const response = await fetch("/api/session-detector", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "validate-sessions"
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(data.message);
        setSessionDetector(prev => ({
          ...prev,
          isDetecting: false,
          lastDetection: new Date().toISOString(),
          detectionResults: data.sessions || []
        }));

        // Atualizar informações das contas
        if (data.totalDetected > 0) {
          setAccountsInfo({
            total: data.totalDetected,
            available: data.sessions.map((s: { name: string; username: string }) => s.name)
          });
        }
      } else {
        setStatus(`Erro na validação: ${data.error}`);
        setSessionDetector(prev => ({ ...prev, isDetecting: false }));
      }
    } catch (error) {
      setStatus(`Erro na validação: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
      setSessionDetector(prev => ({ ...prev, isDetecting: false }));
    }
  };

  const validateSession = async () => {
    setSessionStatus({ ...sessionStatus, isValidating: true });

    try {
      const response = await fetch('/api/session-detector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'quick-validate' })
      });

      const data = await response.json();

      if (data.success) {
        setSessionStatus({
          isValidating: false,
          isValid: true,
          message: data.message,
          username: data.username,
          needsNewSession: false
        });
      } else {
        setSessionStatus({
          isValidating: false,
          isValid: false,
          message: data.message,
          username: null,
          needsNewSession: data.needsNewSession || false
        });
      }
    } catch (error) {
      setSessionStatus({
        isValidating: false,
        isValid: false,
        message: "Erro ao validar sessão",
        username: null,
        needsNewSession: true
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Twitter Engagement Analyzer
            </h1>
            <p className="text-gray-300 text-lg">
              Encontre os tweets com mais engajamento e interaja com eles
            </p>
          </div>

          {/* Search Form */}
          <div className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="query"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Termo de Busca
                </label>
                <input
                  type="text"
                  id="query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Digite uma palavra-chave, hashtag ou termo..."
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 transition-colors"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label
                  htmlFor="sortBy"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Ordenar por
                </label>
                <select
                  id="sortBy"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "recent" | "top")}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white transition-colors"
                  disabled={isLoading}
                >
                  <option value="recent">Tweets mais recentes</option>
                  <option value="top">Tweets com mais engajamento</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 relative"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Buscando tweets...
                  </div>
                ) : (
                  "Buscar Tweets"
                )}
              </button>
            </form>

            {/* Status Display */}
            <div className="mt-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Status:</h3>
              <p className={`text-sm font-mono ${status.startsWith("Erro")
                ? "text-red-400"
                : status.includes("sucesso") || status.includes("concluída")
                  ? "text-green-400"
                  : "text-gray-300"
                }`}>
                {status}
              </p>
            </div>

            {/* Session Detector */}
            <div className="mt-4 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-purple-400">🔍 Detecção Automática de Sessões</h3>
                <button
                  onClick={() => setSessionDetector(prev => ({ ...prev, showDetector: !prev.showDetector }))}
                  className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
                >
                  {sessionDetector.showDetector ? "Ocultar" : "Mostrar"}
                </button>
              </div>

              {sessionDetector.showDetector && (
                <div className="space-y-3">
                  <div className="text-sm text-purple-300">
                    <p>🤖 Detecta automaticamente sessões ativas do Twitter</p>
                    <p>⚡ Extrai cookies válidos sem intervenção manual</p>
                    <p>🔄 Configura múltiplas contas automaticamente</p>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={handleDetectSessions}
                      disabled={sessionDetector.isDetecting}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      {sessionDetector.isDetecting ? "Detectando..." : "🔍 Detectar Sessões"}
                    </button>

                    <button
                      onClick={handleValidateSessions}
                      disabled={sessionDetector.isDetecting}
                      className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      {sessionDetector.isDetecting ? "Validando..." : "✅ Validar Existentes"}
                    </button>
                  </div>

                  {sessionDetector.lastDetection && (
                    <div className="text-xs text-gray-400">
                      Última detecção: {formatDate(sessionDetector.lastDetection)}
                    </div>
                  )}

                  {sessionDetector.detectionResults.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-700 rounded-lg">
                      <h4 className="text-sm font-medium text-green-400 mb-2">
                        🎉 Sessões Detectadas ({sessionDetector.detectionResults.length})
                      </h4>
                      <div className="space-y-2">
                        {sessionDetector.detectionResults.map((session, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <div className="text-gray-300">
                              <span className="font-medium">{session.name}</span>
                              <span className="text-gray-400 ml-2">(@{session.username})</span>
                            </div>
                            <div className="text-gray-400 text-xs">
                              👥 {session.metrics.followers} • 🔄 {session.metrics.following}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Session Validation Panel */}
            <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-yellow-400">🔐 Validação de Sessão</h3>
                <button
                  onClick={validateSession}
                  disabled={sessionStatus.isValidating}
                  className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  {sessionStatus.isValidating ? "Validando..." : "🔍 Validar Sessão"}
                </button>
              </div>

              {sessionStatus.isValid !== null && (
                <div className={`p-3 rounded-lg ${sessionStatus.isValid ? 'bg-green-900/30 border border-green-500/50' : 'bg-red-900/30 border border-red-500/50'}`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`text-sm font-medium ${sessionStatus.isValid ? 'text-green-400' : 'text-red-400'}`}>
                      {sessionStatus.isValid ? '✅ Sessão Válida' : '❌ Sessão Inválida'}
                    </span>
                    {sessionStatus.username && (
                      <span className="text-sm text-gray-300">
                        • @{sessionStatus.username}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm ${sessionStatus.isValid ? 'text-green-300' : 'text-red-300'}`}>
                    {sessionStatus.message}
                  </p>

                  {sessionStatus.needsNewSession && (
                    <div className="mt-3 p-3 bg-gray-700 rounded-lg">
                      <p className="text-sm font-medium text-orange-400 mb-2">💡 Instruções para resolver:</p>
                      <div className="text-sm text-gray-300 space-y-1">
                        <p>1. Abra o terminal no diretório do projeto</p>
                        <p>2. Execute: <code className="bg-gray-800 px-2 py-1 rounded text-yellow-400">node extract-cookies-manual.js</code></p>
                        <p>3. Faça login no Twitter quando o navegador abrir</p>
                        <p>4. Volte aqui e clique em &quot;Validar Sessão&quot; novamente</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Accounts Info Display */}
            {accountsInfo.total > 0 && (
              <div className="mt-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                <h3 className="text-sm font-medium text-green-400 mb-2">🔧 Sistema Multi-Conta Ativo:</h3>
                <div className="text-sm text-green-300">
                  <p>📱 <strong>{accountsInfo.total}</strong> contas disponíveis</p>
                  <p>🔄 Ações serão distribuídas entre as contas</p>
                  <p>🎯 Engajamento mais natural e orgânico</p>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <h3 className="text-sm font-medium text-blue-400 mb-2">💡 Como usar:</h3>
              <ul className="text-sm text-blue-300 space-y-1">
                <li>• Digite um termo de busca</li>
                <li>• Escolha a ordenação (recentes ou engajamento)</li>
                <li>• Configure quantidades de likes/retweets</li>
                <li>• Use &quot;Enviar Todas as Ações&quot; para processar em lote</li>
                <li>• Ações serão executadas por contas diferentes</li>
              </ul>
            </div>
          </div>

          {/* Search Results */}
          {tweets.length > 0 && (
            <div className="space-y-6">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-semibold text-gray-200">
                    Resultados para: &quot;{searchQuery}&quot;
                  </h2>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleBatchActions}
                      disabled={loadingActions['batch']}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      {loadingActions['batch'] ? "Enviando..." : "🚀 Enviar Todas as Ações"}
                    </button>
                    <button
                      onClick={clearResults}
                      className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      Limpar resultados
                    </button>
                  </div>
                </div>
                <p className="text-gray-400">
                  {tweets.length} tweets encontrados, ordenados por {sortBy === "recent" ? "data (mais recentes)" : "engajamento"}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Configure as quantidades nos tweets e clique em &quot;Enviar Todas as Ações&quot; para executar em lote.
                </p>
              </div>
              {/* Tweets List */}
              {tweets.map((tweet, index) => (
                <div key={tweet.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors">
                  {/* Tweet Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="font-semibold text-sm">
                          {tweet.author.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-200">{tweet.author}</p>
                        <p className="text-sm text-gray-400">{formatDate(tweet.timestamp)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-blue-400">
                        #{index + 1} • {formatNumber(tweet.engagement.total)} engajamentos
                      </p>
                    </div>
                  </div>

                  {/* Tweet Content */}
                  <div className="mb-4">
                    <p className="text-gray-200 leading-relaxed">{tweet.content}</p>
                  </div>

                  {/* Engagement Metrics */}
                  <div className="flex items-center space-x-6 mb-4 text-sm text-gray-400">
                    <span className="flex items-center space-x-1">
                      <span>💬</span>
                      <span>{formatNumber(tweet.engagement.comments)}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span>🔄</span>
                      <span>{formatNumber(tweet.engagement.retweets)}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span>❤️</span>
                      <span>{formatNumber(tweet.engagement.likes)}</span>
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                    <div className="flex flex-col space-y-3">
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleTweetAction('like', tweet.id, index)}
                          disabled={loadingActions[`like-${index}`]}
                          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${tweet.isLiked
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                            }`}
                        >
                          <span>{tweet.isLiked ? "💖" : "🤍"}</span>
                          <span>
                            {loadingActions[`like-${index}`]
                              ? "..."
                              : tweet.isLiked
                                ? "Curtido"
                                : "Curtir"
                            }
                          </span>
                        </button>

                        <button
                          onClick={() => handleTweetAction('retweet', tweet.id, index)}
                          disabled={loadingActions[`retweet-${index}`]}
                          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${tweet.isRetweeted
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                            }`}
                        >
                          <span>🔄</span>
                          <span>
                            {loadingActions[`retweet-${index}`]
                              ? "..."
                              : tweet.isRetweeted
                                ? "Retweetado"
                                : "Retweet"
                            }
                          </span>
                        </button>

                        <button
                          onClick={() => setShowCustomInputs(prev => ({ ...prev, [tweet.id]: !prev[tweet.id] }))}
                          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                        >
                          <span>⚙️</span>
                          <span>Config</span>
                        </button>
                      </div>

                      {/* Custom Amount Inputs */}
                      {showCustomInputs[tweet.id] && (
                        <div className="flex space-x-3 p-3 bg-gray-700 rounded-lg">
                          <div className="flex flex-col space-y-2">
                            <label className="text-xs text-gray-300">Likes a adicionar:</label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={customLikes[tweet.id] || 1}
                              onChange={(e) => setCustomLikes(prev => ({
                                ...prev,
                                [tweet.id]: Math.max(1, parseInt(e.target.value) || 1)
                              }))}
                              className="w-20 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                            />
                          </div>
                          <div className="flex flex-col space-y-2">
                            <label className="text-xs text-gray-300">Retweets a adicionar:</label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={customRetweets[tweet.id] || 1}
                              onChange={(e) => setCustomRetweets(prev => ({
                                ...prev,
                                [tweet.id]: Math.max(1, parseInt(e.target.value) || 1)
                              }))}
                              className="w-20 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {tweet.url && (
                      <a
                        href={tweet.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                      >
                        Ver no X →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results Message */}
          {searchQuery && tweets.length === 0 && !isLoading && (
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.467-.881-6.072-2.329C3.64 10.031 1.02 4.056 1.02 4.056S3.64 10.031 5.928 12.671A7.962 7.962 0 0112 15z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-200 mb-2">
                Nenhum tweet encontrado
              </h3>
              <p className="text-gray-400 mb-4">
                Não foram encontrados tweets para &quot;{searchQuery}&quot;.
              </p>
              <p className="text-sm text-gray-500">
                Tente com outros termos de busca ou verifique se sua conta tem acesso ao conteúdo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
