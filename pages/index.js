import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Head>
        <title>BOB13 - Solana Price Scanner</title>
        <meta name="description" content="Advanced Solana price scanner with EMA analysis" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-6xl font-bold text-gray-800 mb-4">
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                BOB13
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Advanced Solana Price Scanner with EMA Analysis
            </p>
            <div className="w-24 h-1 bg-gradient-to-r from-purple-600 to-blue-600 mx-auto rounded"></div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold mb-2">Real-time Monitoring</h3>
              <p className="text-gray-600">
                Automatic price scanning every 15 minutes using Coinbase API
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-xl font-semibold mb-2">EMA Analysis</h3>
              <p className="text-gray-600">
                EMA 12/25 crossover detection for trading signals
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">💾</div>
              <h3 className="text-xl font-semibold mb-2">Supabase Storage</h3>
              <p className="text-gray-600">
                All data stored in vector database for analysis
              </p>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-8">How it works</h2>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📊</span>
                </div>
                <h4 className="font-semibold mb-2">1. Data Collection</h4>
                <p className="text-sm text-gray-600">Scanner fetches SOL/USD price from Coinbase API</p>
              </div>
              
              <div className="text-center">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🧮</span>
                </div>
                <h4 className="font-semibold mb-2">2. EMA Calculation</h4>
                <p className="text-sm text-gray-600">Calculates EMA 12 and EMA 25 moving averages</p>
              </div>
              
              <div className="text-center">
                <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🎯</span>
                </div>
                <h4 className="font-semibold mb-2">3. Signal Detection</h4>
                <p className="text-sm text-gray-600">Detects bullish/bearish crossovers automatically</p>
              </div>
              
              <div className="text-center">
                <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">💾</span>
                </div>
                <h4 className="font-semibold mb-2">4. Data Storage</h4>
                <p className="text-sm text-gray-600">Stores results in Supabase for analysis</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-white">
            <h2 className="text-3xl font-bold mb-4">Ready to start monitoring?</h2>
            <p className="text-lg mb-8 opacity-90">
              Access the dashboard to control your Solana scanner and view real-time signals
            </p>
            <Link href="/dashboard" className="inline-block">
              <button className="bg-white text-purple-600 font-bold py-4 px-8 rounded-xl text-lg hover:bg-gray-100 transition-colors transform hover:scale-105">
                Open Dashboard 🚀
              </button>
            </Link>
          </div>

          {/* Technical Details */}
          <div className="mt-12 text-left">
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4 text-center">🔧 Technical Specifications</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Data Source:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Coinbase Pro API</li>
                    <li>• SOL/USD trading pair</li>
                    <li>• 15-minute intervals</li>
                    <li>• Real-time price feeds</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Analysis:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• EMA 12 (short-term trend)</li>
                    <li>• EMA 25 (long-term trend)</li>
                    <li>• Crossover detection</li>
                    <li>• Signal classification</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
