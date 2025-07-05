"use client";

import { useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Pronto");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      setStatus("Erro: Por favor, insira um termo de busca");
      return;
    }

    setIsLoading(true);
    setStatus("Processando...");

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
        setStatus(data.message || "Tweet curtido com sucesso!");
      } else {
        setStatus(`Erro: ${data.error || "Algo deu errado"}`);
      }
    } catch (error) {
      setStatus(`Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Twitter Automation
            </h1>
            <p className="text-gray-300 text-lg">
              Automatize ações no Twitter com facilidade
            </p>
          </div>

          {/* Main Form */}
          <div className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Input Field */}
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
              >
                {isLoading ? "Processando..." : "Curtir Primeiro Tweet"}
              </button>
            </form>

            {/* Status Display */}
            <div className="mt-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Status:</h3>
              <p className={`text-sm font-mono ${status.startsWith("Erro")
                  ? "text-red-400"
                  : status.includes("sucesso")
                    ? "text-green-400"
                    : "text-yellow-400"
                }`}>
                {status}
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-gray-200 mb-3">
              Como funciona:
            </h2>
            <ul className="text-sm text-gray-300 space-y-2">
              <li>• Digite um termo de busca (palavra-chave, hashtag, etc.)</li>
              <li>• Clique no botão para iniciar a automação</li>
              <li>• O sistema irá buscar no Twitter e curtir o primeiro tweet encontrado</li>
              <li>• Certifique-se de que o arquivo <code className="bg-gray-700 px-1 rounded">twitter-cookies.json</code> está configurado</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
