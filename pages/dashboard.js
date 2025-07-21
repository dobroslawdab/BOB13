import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function SolanaDashboard() {
  const [scannerStatus, setScannerStatus] = useState('unknown');
  const [stats, setStats] = useState(null);
  const [signals, setSignals] = useState([]);
  const [trendStatus, setTrendStatus] = useState(null);
  const [tradingSignals, setTradingSignals] = useState(null);
  const [signalHistory, setSignalHistory] = useState([]);
  const [scanHistory, setScanHistory] = useState([]); // NOWE
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Wszystkie poprzednie funkcje fetch...
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/solana/scanner?action=status');
      const data = await response.json();
      setScannerStatus(data.status);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/solana/scanner?action=stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchSignals = async () => {
    try {
      const response = await fetch('/api/solana/scanner?action=signals&limit=20');
      const data = await response.json();
      setSignals(data);
    } catch (error) {
      console.error('Error fetching signals:', error);
    }
  };

  const fetchTrendStatus = async () => {
    try {
      const response = await fetch('/api/solana/trends?action=trend-status');
      const data = await response.json();
      setTrendStatus(data);
    } catch (error) {
      console.error('Error fetching trend status:', error);
    }
  };

  const fetchTradingSignals = async () => {
    try {
      const response = await fetch('/api/solana/trends?action=trading-signals');
      const data = await response.json();
      setTradingSignals(data);
    } catch (error) {
      console.error('Error fetching trading signals:', error);
    }
  };

  const fetchSignalHistory = async () => {
    try {
      const response = await fetch('/api/solana/trends?action=signal-history&limit=10');
      const data = await response.json();
      setSignalHistory(data);
    } catch (error) {
      console.error('Error fetching signal history:', error);
    }
  };

  // NOWA FUNKCJA: Historia skanów
  const fetchScanHistory = async () => {
    try {
      const response = await fetch('/api/solana/scanner?action=scan-history&limit=10');
      const data = await response.json();
      setScanHistory(data);
    } catch (error) {
      console.error('Error fetching scan history:', error);
    }
  };

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

  const refreshData = async () => {
    setLoading(true);
    await Promise.all([
      fetchStatus(),
      fetchStats(),
      fetchSignals(),
      fetchTrendStatus(),
      fetchTradingSignals(),
      fetchSignalHistory(),
      fetchScanHistory() // NOWE
    ]);
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
    
    const interval = setInterval(() => {
      fetchStatus();
      fetchStats();
      fetchSignals();
      fetchTrendStatus();
      fetchTradingSignals();
      fetchScanHistory(); // NOWE - odświeża historię skanów
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Helper functions...
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

  // NOWE: Helper functions dla historii skanów
  const getScanTypeColor = (scanType) => {
    return scanType === 'manual' ? 'text-blue-600' : 'text-purple-600';
  };

  const getScanTypeEmoji = (scanType) => {
    return scanType === 'manual' ? '🔍' : '🤖';
  };

  const getScanStatusColor = (status) => {
    return status === 'success' ? 'text-green-600' : 'text-red-600';
  };

  const getScanStatusEmoji = (status) => {
    return status === 'success' ? '✅' : '❌';
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatExecutionTime = (ms) => {
    if (!ms) return 'N/A';
    return ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`;
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

        {/* Status i kontrola - jak wcześniej */}
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

          {/* Statystyki - jak wcześniej */}
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

        {/* Trend Analysis - jak wcześniej (skrócone dla miejsca) */}
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

            {/* Trading Signals - skrócone */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">🎯 Trading Signals</h2>
              {tradingSignals && tradingSignals.recommendation ? (
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
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Loading trading signals...
                </div>
              )}
            </div>
          </div>
        )}

        {/* NOWA SEKCJA: Scan History */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">🔬 Scan History</h2>
            <button
              onClick={refreshData}
              disabled={loading}
              className="bg-gray-600 text-white py-1 px-3 rounded hover:bg-gray-700 disabled:bg-gray-400"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          {loading ? (
            <div className="text-center py-8">Loading scan history...</div>
          ) : scanHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2 text-right">EMA 12/25</th>
                    <th className="px-3 py-2 text-left">Crossover</th>
                    <th className="px-3 py-2 text-right">Exec Time</th>
                    <th className="px-3 py-2 text-right">Data Points</th>
                  </tr>
                </thead>
                <tbody>
                  {scanHistory.map((scan, index) => (
                    <tr key={scan.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="px-3 py-2">
                        <div className="text-xs">
                          {formatDate(scan.timestamp)}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`font-semibold ${getScanTypeColor(scan.scan_type)}`}>
                          {getScanTypeEmoji(scan.scan_type)} {scan.scan_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`font-semibold ${getScanStatusColor(scan.status)}`}>
                          {getScanStatusEmoji(scan.status)} {scan.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {scan.status === 'success' ? formatPrice(scan.price) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {scan.status === 'success' && scan.ema_12 && scan.ema_25 ? (
                          <div>
                            <div className="text-green-600">{parseFloat(scan.ema_12).toFixed(2)}</div>
                            <div className="text-orange-600">{parseFloat(scan.ema_25).toFixed(2)}</div>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-2">
                        {scan.crossover_detected ? (
                          <span className={`font-bold ${getSignalColor(scan.crossover_detected)}`}>
                            {getSignalEmoji(scan.crossover_detected)} {scan.crossover_detected.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        {formatExecutionTime(scan.execution_time_ms)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        {scan.data_points || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No scans performed yet. Click "Scan Once" to test!
            </div>
          )}
        </div>

        {/* EMA Signals - skrócone dla miejsca */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">📡 Recent EMA Signals</h2>
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
                  {signals.slice(0, 5).map((signal, index) => (
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
            <p>• 🔍 <strong>Manual scans</strong> - triggered by "Scan Once" button</p>
            <p>• 🤖 <strong>Automatic scans</strong> - run every 15min when scanner is active</p>
            <p>• Each scan is logged with execution time, data points, and results</p>
            <p>• Detects EMA crossovers and provides trend analysis with trading signals</p>
            <p>• All scan history is stored for debugging and performance monitoring</p>
          </div>
        </div>
      </div>
    </div>
  );
}
