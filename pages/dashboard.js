import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function SolanaDashboard() {
  const [scannerStatus, setScannerStatus] = useState('unknown');
  const [stats, setStats] = useState(null);
  const [signals, setSignals] = useState([]);
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
        await Promise.all([fetchStats(), fetchSignals()]);
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
      fetchSignals()
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'text-green-600';
      case 'stopped': return 'text-red-600';
      default: return 'text-gray-600';
    }
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
            Monitor SOL/USD price with EMA(12/25) crossover detection
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

        {/* Sygnały EMA */}
        <div className="bg-white rounded-lg shadow p-6">
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

        {/* Info */}
        <div className="bg-blue-50 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">ℹ️ How it works</h3>
          <div className="text-blue-700 space-y-2 text-sm">
            <p>• Scanner checks SOL/USD price from Coinbase API every 15 minutes</p>
            <p>• Calculates EMA 12 (short) and EMA 25 (long) exponential moving averages</p>
            <p>• Detects bullish crossover when EMA 12 crosses above EMA 25</p>
            <p>• Detects bearish crossover when EMA 12 crosses below EMA 25</p>
            <p>• All data is stored in Supabase database for analysis</p>
          </div>
        </div>
      </div>
    </div>
  );
}
