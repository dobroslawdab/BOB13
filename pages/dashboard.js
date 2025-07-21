import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function SolanaDashboard() {
  const [scannerStatus, setScannerStatus] = useState('unknown');
  const [stats, setStats] = useState(null);
  const [signals, setSignals] = useState([]);
  const [trendStatus, setTrendStatus] = useState(null);
  const [tradingSignals, setTradingSignals] = useState(null);
  const [signalHistory, setSignalHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Pobierz status skanera
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/solana/scanner?action=status');
      const data = await response.json();
      setScannerStatus(data.status);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  // Pobierz statystyki
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/solana/scanner?action=stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Pobierz sygnały
  const fetchSignals = async () => {
    try {
      const response = await fetch('/api/solana/scanner?action=signals&limit=20');
      const data = await response.json();
      setSignals(data);
    } catch (error) {
      console.error('Error fetching signals:', error);
    }
  };

  // Pobierz status trendu
  const fetchTrendStatus = async () => {
    try {
      const response = await fetch('/api/solana/trends?action=trend-status');
      const data = await response.json();
      setTrendStatus(data);
    } catch (error) {
      console.error('Error fetching trend status:', error);
    }
  };

  // Pobierz sygnały tradingowe
  const fetchTradingSignals = async () => {
    try {
      const response = await fetch('/api/solana/trends?action=trading-signals');
      const data = await response.json();
      setTradingSignals(data);
    } catch (error) {
      console.error('Error fetching trading signals:', error);
    }
  };

  // Pobierz historię sygnałów z analizą
  const fetchSignalHistory = async () => {
    try {
      const response = await fetch('/api/solana/trends?action=signal-history&limit=10');
      const data = await response.json();
      setSignalHistory(data);
    } catch (error) {
      console.error('Error fetching signal history:', error);
    }
  };

  // Kontrola skanera
  const controlScanner = async (action) => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/solana/scanner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        await fetchStatus();
        alert(data.message);
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error controlling scanner:', error);
      alert('Error: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Jednorazowe skanowanie
  const scanOnce = async () => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/solana/scanner?action=scan-now');
      const data = await response.json();
      
      if (response.ok) {
        await refreshData();
        alert(`Skanowanie zakończone! Cena: $${data.price}`);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error scanning:', error);
      alert('Error: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Odświeżanie danych
  const refreshData = async () => {
    setLoading(true);
    await Promise.all([
      fetchStatus(),
      fetchStats(),
      fetchSignals(),
      fetchTrendStatus(),
      fetchTradingSignals(),
      fetchSignalHistory()
    ]);
    setLoading(false);
  };

  // Załaduj dane na starcie i ustaw auto-refresh
  useEffect(() => {
    refreshData();
    
    const interval = setInterval(() => {
      fetchStatus();
      fetchStats();
      fetchSignals();
      fetchTrendStatus();
      fetchTradingSignals();
    }, 30000); // Odświeżanie co 30 sekund

    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatPrice = (price) => {
    return price ? `$${parseFloat(price).toFixed(4)}` : 'N/A';
  };

  const getSignalColor = (signalType) => {
    return signalType === 'bullish' ? 'text-green-600' : 'text-red-600';
  };

  const getSignalEmoji = (signalType) => {
    return signalType === 'bullish' ? '📈' : '📉';
  };

  const getTrendEmoji = (trend) => {
    switch(trend) {
      case 'bullish': return '🟢';
      case 'bearish': return '🔴';
      default: return '⚪';
    }
  };

  const getTradingSignalColor = (signalType) => {
    switch(signalType) {
      case 'LONG_ENTRY': return 'text-green-600 font-bold';
      case 'SHORT_ENTRY': return 'text-red-600 font-bold';
      case 'LONG_HOLD': return 'text-green-500';
      case 'SHORT_HOLD': return 'text-red-500';
      case 'EXIT_WARNING': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'text-green-600';
      case 'stopped': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>BOB13 - Solana Scanner Dashboard</title>
        <meta name="description" content="Monitor Solana price and EMA signals" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🔍 Solana Scanner Dashboard
          </h1>
          <p className="text-gray-600">
            Monitor SOL/USD price with EMA(12/25) crossover detection & trend analysis
          </p>
        </div>

        {/* Status i kontrola */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">🎛️ Scanner Control</h2>
            <div className="flex items-center mb-4">
              <span className="font-medium mr-2">Status:</span>
              <span className={`font-bold ${getStatusColor(scannerStatus)}`}>
                {scannerStatus.toUpperCase()}
              </span>
            </div>
            
            <div className="space-y-2">
              <button
                onClick={() => controlScanner('start')}
                disabled={actionLoading || scannerStatus === 'running'}
                className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Loading...' : 'Start Scanner'}
              </button>
              
              <button
                onClick={() => controlScanner('stop')}
                disabled={actionLoading || scannerStatus === 'stopped'}
                className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Loading...' : 'Stop Scanner'}
              </button>
              
              <button
                onClick={() => controlScanner('restart')}
                disabled={actionLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Loading...' : 'Restart Scanner'}
              </button>
              
              <button
                onClick={scanOnce}
                disabled={actionLoading}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Scanning...' : 'Scan Once'}
              </button>
            </div>
          </div>

          {/* Statystyki */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">📊 Current Stats</h2>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : stats ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="font-medium">Latest Price:</span>
                  <span className="text-lg font-bold text-blue-600">
                    {formatPrice(stats.latestPrice)}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="font-medium">EMA 12:</span>
                  <span className="text-green-600 font-semibold">
                    {formatPrice(stats.latestEMA12)}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="font-medium">EMA 25:</span>
                  <span className="text-orange-600 font-semibold">
                    {formatPrice(stats.latestEMA25)}
                  </span>
                </div>
                
                <hr className="my-3" />
                
                <div className="flex justify-between">
                  <span className="font-medium">Weekly Bullish:</span>
                  <span className="text-green-600 font-bold">
                    📈 {stats.weeklyBullishSignals}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="font-medium">Weekly Bearish:</span>
                  <span className="text-red-600 font-bold">
                    📉 {stats.weeklyBearishSignals}
                  </span>
                </div>
                
                <div className="text-xs text-gray-500 mt-3">
                  Last scan: {stats.lastScanTime ? formatDate(stats.lastScanTime) : 'Never'}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No data available</div>
            )}
          </div>
        </div>

        {/* Trend Analysis - NOWA SEKCJA */}
        {trendStatus && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">📈 Current Trend Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Current Trend:</span>
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">{getTrendEmoji(trendStatus.current_trend)}</span>
                    <span className={`font-bold ${getSignalColor(trendStatus.current_trend)}`}>
                      {trendStatus.current_trend.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between">
                  <span className="font-medium">Trend Duration:</span>
                  <span className="font-semibold">
                    {formatDuration(trendStatus.trend_duration_minutes)}
                  </span>
                </div>

                {trendStatus.last_crossover_signal && (
                  <>
                    <div className="flex justify-between">
                      <span className="font-medium">Last Signal:</span>
                      <span className={`font-semibold ${getSignalColor(trendStatus.last_crossover_signal)}`}>
                        {getSignalEmoji(trendStatus.last_crossover_signal)} {trendStatus.last_crossover_signal.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="font-medium">Signal Price:</span>
                      <span className="font-mono">
                        {formatPrice(trendStatus.last_crossover_price)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="font-medium">Price Change:</span>
                      <span className={`font-bold ${trendStatus.price_change_since_signal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {trendStatus.price_change_since_signal >= 0 ? '+' : ''}
                        ${trendStatus.price_change_since_signal?.toFixed(4)} 
                        ({trendStatus.percentage_change_since_signal >= 0 ? '+' : ''}
                        {trendStatus.percentage_change_since_signal?.toFixed(2)}%)
                      </span>
                    </div>
                  </>
                )}

                {trendStatus.trend_strength && (
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Trend Strength:</span>
                      <span className={`font-semibold ${
                        trendStatus.trend_strength.strength === 'strong' ? 'text-green-600' :
                        trendStatus.trend_strength.strength === 'moderate' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {trendStatus.trend_strength.strength.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      EMA Distance: {trendStatus.trend_strength.percentage?.toFixed(3)}%
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Trading Signals */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">🎯 Trading Signals</h2>
              {tradingSignals && tradingSignals.trading_signals ? (
                <div className="space-y-3">
                  {tradingSignals.trading_signals.length > 0 ? (
                    tradingSignals.trading_signals.map((signal, index) => (
                      <div key={index} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-bold ${getTradingSignalColor(signal.type)}`}>
                            {signal.type.replace('_', ' ')}
                          </span>
                          <span className={`text-sm px-2 py-1 rounded ${
                            signal.strength === 'HIGH' ? 'bg-green-100 text-green-800' :
                            signal.strength === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {signal.strength}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{signal.message}</p>
                        <div className="text-xs text-gray-500 mt-2">
                          Price: {formatPrice(signal.price)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      No active trading signals
                    </div>
                  )}

                  {tradingSignals.recommendation && (
                    <div className="border-t pt-3 mt-4">
                      <h3 className="font-semibold mb-2">💡 Recommendation:</h3>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-blue-800">
                            {tradingSignals.recommendation.action}
                          </span>
                          <span className={`text-sm px-2 py-1 rounded ${
                            tradingSignals.recommendation.confidence === 'HIGH' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {tradingSignals.recommendation.confidence}
                          </span>
                        </div>
                        <p className="text-sm text-blue-700">
                          {tradingSignals.recommendation.message}
                        </p>
                        <div className="text-xs text-blue-600 mt-1">
                          Duration: {tradingSignals.recommendation.trend_duration}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Loading trading signals...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sygnały EMA */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">📡 Recent EMA Signals</h2>
            <button
              onClick={refreshData}
              disabled={loading}
              className="bg-gray-600 text-white py-1 px-3 rounded hover:bg-gray-700 disabled:bg-gray-400"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          {loading ? (
            <div className="text-center py-8">Loading signals...</div>
          ) : signals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">Time</th>
                    <th className="px-4 py-2 text-left">Signal</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">EMA 12</th>
                    <th className="px-4 py-2 text-right">EMA 25</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((signal, index) => (
                    <tr key={signal.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="px-4 py-2 text-sm">
                        {formatDate(signal.timestamp)}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`font-semibold ${getSignalColor(signal.signal_type)}`}>
                          {getSignalEmoji(signal.signal_type)} {signal.signal_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {formatPrice(signal.price)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-green-600">
                        {formatPrice(signal.ema_12)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-orange-600">
                        {formatPrice(signal.ema_25)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No signals detected yet. Start the scanner to begin monitoring!
            </div>
          )}
        </div>

        {/* Signal History z analizą trendów */}
        {signalHistory.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">🔄 Trend History Analysis</h2>
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left">Signal</th>
                    <th className="px-3 py-2 text-left">Price</th>
                    <th className="px-3 py-2 text-left">Duration</th>
                    <th className="px-3 py-2 text-left">Change</th>
                    <th className="px-3 py-2 text-left">Strength</th>
                  </tr>
                </thead>
                <tbody>
                  {signalHistory.map((signal, index) => (
                    <tr key={signal.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="px-3 py-2">
                        <div className={`font-semibold ${getSignalColor(signal.signal_type)}`}>
                          {getSignalEmoji(signal.signal_type)} {signal.signal_type.toUpperCase()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(signal.timestamp)}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {formatPrice(signal.price)}
                      </td>
                      <td className="px-3 py-2">
                        {signal.trend_info?.trend_duration_minutes ? 
                          formatDuration(signal.trend_info.trend_duration_minutes) : 'N/A'
                        }
                      </td>
                      <td className="px-3 py-2">
                        {signal.trend_info?.trend_percentage_change ? (
                          <span className={`font-semibold ${
                            signal.trend_info.trend_percentage_change >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {signal.trend_info.trend_percentage_change >= 0 ? '+' : ''}
                            {signal.trend_info.trend_percentage_change.toFixed(2)}%
                          </span>
                        ) : 'N/A'}
                      </td>
                      <td className="px-3 py-2">
                        {signal.trend_info?.signal_strength?.strength ? (
                          <span className={`text-xs px-2 py-1 rounded ${
                            signal.trend_info.signal_strength.strength === 'strong' ? 'bg-green-100 text-green-800' :
                            signal.trend_info.signal_strength.strength === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {signal.trend_info.signal_strength.strength.toUpperCase()}
                          </span>
                        ) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">ℹ️ How it works</h3>
          <div className="text-blue-700 space-y-2 text-sm">
            <p>• Scanner checks SOL/USD price from Coinbase API every 15 minutes</p>
            <p>• Calculates EMA 12 (short) and EMA 25 (long) exponential moving averages</p>
            <p>• Detects bullish crossover when EMA 12 crosses above EMA 25 (Long signal)</p>
            <p>• Detects bearish crossover when EMA 12 crosses below EMA 25 (Short signal)</p>
            <p>• Provides trend analysis with strength and duration tracking</p>
            <p>• Generates trading signals based on current trend and momentum</p>
            <p>• All data is stored in Supabase database for historical analysis</p>
          </div>
        </div>
      </div>
    </div>
  );
}
