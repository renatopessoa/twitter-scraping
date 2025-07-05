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
  const [status, setStatus] = useState("Pronto");
  const [isLoading, setIsLoading] = useState(false);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingActions, setLoadingActions] = useState<{ [key: string]: boolean }>({});

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
        body: JSON.stringify({ query: query.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus(data.message || "Busca concluída!");
        setTweets(data.tweets || []);
        setSearchQuery(data.query || query.trim());
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

    try {
      const response = await fetch("/api/twitter-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, tweetId }),
      });

      const data = await response.json();

      if (response.ok) {
        // Atualizar o estado local do tweet
        setTweets(prevTweets => {
          const newTweets = [...prevTweets];
          if (action === 'like') {
            newTweets[tweetIndex].isLiked = !newTweets[tweetIndex].isLiked;
            newTweets[tweetIndex].engagement.likes += newTweets[tweetIndex].isLiked ? 1 : -1;
          } else if (action === 'retweet') {
            newTweets[tweetIndex].isRetweeted = !newTweets[tweetIndex].isRetweeted;
            newTweets[tweetIndex].engagement.retweets += newTweets[tweetIndex].isRetweeted ? 1 : -1;
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
                    : "text-yellow-400"
                }`}>
                {status}
              </p>
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
                  <button
                    onClick={clearResults}
                    className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    Limpar resultados
                  </button>
                </div>
                <p className="text-gray-400">
                  {tweets.length} tweets encontrados, ordenados por engajamento
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

          {/* Instructions */}
          <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-gray-200 mb-3">
              Como funciona:
            </h2>
            <ul className="text-sm text-gray-300 space-y-2">
              <li>• Digite um termo de busca (palavra-chave, hashtag, etc.)</li>
              <li>• O sistema buscará e ordenará os tweets por engajamento total</li>
              <li>• Você pode curtir ou retweetar qualquer tweet da lista</li>
              <li>• Os 10 tweets com mais engajamento serão exibidos</li>
              <li>• Certifique-se de que o arquivo <code className="bg-gray-700 px-1 rounded">twitter-cookies.json</code> está configurado</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
