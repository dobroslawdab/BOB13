/**
 * Enhanced Scanner Dashboard
 * Real-time monitoring with persistent status, webhooks, and signal analysis
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, Play, Pause, Activity, TrendingUp, TrendingDown, 
         Settings, Webhook, Clock, Database, Signal, BarChart3, RefreshCw } from 'lucide-react';

const EnhancedScannerDashboard = () => {
  // Core state
  const [status, setStatus] = useState(null);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Control state
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);
  
  // Display state
  const [lastRefresh, setLastRefresh] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Refs
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  // Fetch status from enhanced API
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/scanner/status');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.data);
        setError(null);
        setLastRefresh(new Date());
      } else {
        throw new Error(data.message || 'Failed to fetch status');
      }
    } catch (err) {
      console.error('Error fetching status:', err);
      setError(err.message);
    }
  }, []);

  // Fetch signals from enhanced API
  const fetchSignals = useCallback(async () => {
    try {
      const response = await fetch('/api/scanner/signals?limit=10&includeStats=true');
      const data = await response.json();
      
      if (data.success) {
        setSignals(data.data.signals || []);
      }
    } catch (err) {
      console.error('Error fetching signals:', err);
    }
  }, []);

  // Start scanner with webhook support
  const startScanner = async () => {
    setIsStarting(true);
    try {
      const response = await fetch('/api/scanner/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'start',
          webhookUrl: webhookUrl || undefined
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchStatus();
        setShowWebhookConfig(false);
      } else {
        throw new Error(data.message || 'Failed to start scanner');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsStarting(false);
    }
  };

  // Stop scanner
  const stopScanner = async () => {
    setIsStopping(true);
    try {
      const response = await fetch('/api/scanner/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchStatus();
      } else {
        throw new Error(data.message || 'Failed to stop scanner');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsStopping(false);
    }
  };

  // Manual refresh
  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([fetchStatus(), fetchSignals()]);
    setLoading(false);
  };

  // Setup auto-refresh and countdown
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchStatus();
        fetchSignals();
      }, 10000); // Refresh every 10 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, fetchStatus, fetchSignals]);

  // Setup countdown timer
  useEffect(() => {
    if (status?.scanner?.isRunning && status?.timing?.timeToNextScan > 0) {
      countdownRef.current = setInterval(() => {
        const now = new Date();
        const nextScan = new Date(status.scanner.nextScanAt);
        const timeLeft = nextScan - now;
        
        if (timeLeft > 0) {
          const minutes = Math.floor(timeLeft / (1000 * 60));
          const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
          setCountdown(`${minutes}m ${seconds}s`);
        } else {
          setCountdown('Scanning...');
        }
      }, 1000);
    } else {
      setCountdown(null);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [status]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchSignals()]);
      setLoading(false);
    };
    
    loadData();
  }, [fetchStatus, fetchSignals]);

  // Helper functions
  const formatPrice = (price) => price ? `$${parseFloat(price).toFixed(4)}` : 'N/A';
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - new Date(timestamp);
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getStatusColor = (isRunning) => {
    return isRunning ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100';
  };

  const getSignalColor = (type) => {
    return type === 'bullish' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
  };

  if (loading && !status) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading Enhanced Scanner Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Enhanced Solana Scanner</h1>
              <p className="text-gray-600 mt-1">
                Real-time EMA crossover detection with webhooks and persistent status
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  autoRefresh 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
          
          {lastRefresh && (
            <p className="text-sm text-gray-500 mt-2">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Main Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Scanner Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Scanner Status</p>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    getStatusColor(status?.scanner?.isRunning)
                  }`}>
                    <Activity className="w-3 h-3 mr-1" />
                    {status?.scanner?.isRunning ? 'RUNNING' : 'STOPPED'}
                  </span>
                </div>
                {countdown && (
                  <p className="text-sm text-gray-500 mt-1">Next scan: {countdown}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {status?.scanner?.scanCount || 0}
                </p>
                <p className="text-sm text-gray-500">Total Scans</p>
              </div>
            </div>
          </div>

          {/* Current Price */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">SOL Price</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatPrice(status?.market?.latestPrice)}
                </p>
                <p className="text-sm text-gray-500">
                  {formatTimeAgo(status?.market?.lastPriceUpdate)}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          {/* EMA Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">EMA Status</p>
                <div className="mt-1">
                  <p className="text-sm">
                    EMA12: <span className="font-mono">{status?.market?.ema12?.toFixed(4) || 'N/A'}</span>
                  </p>
                  <p className="text-sm">
                    EMA25: <span className="font-mono">{status?.market?.ema25?.toFixed(4) || 'N/A'}</span>
                  </p>
                </div>
                <div className="flex items-center mt-2">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    status?.market?.emaStatus?.ema25Ready ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  <span className="text-xs text-gray-600">
                    {status?.market?.emaStatus?.ema25Ready ? 'Ready' : 'Calculating'}
                  </span>
                </div>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          {/* Active Signals */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Weekly Signals</p>
                <div className="mt-1">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                      <span className="text-sm font-medium">{status?.market?.weeklySignals?.bullish || 0}</span>
                    </div>
                    <div className="flex items-center">
                      <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                      <span className="text-sm font-medium">{status?.market?.weeklySignals?.bearish || 0}</span>
                    </div>
                  </div>
                </div>
                {status?.signals?.hasActiveSignal && (
                  <p className="text-xs text-blue-600 mt-1">
                    {status.signals.message}
                  </p>
                )}
              </div>
              <Signal className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Scanner Control</h2>
          
          <div className="flex items-center space-x-4">
            {status?.scanner?.isRunning ? (
              <button
                onClick={stopScanner}
                disabled={isStopping}
                className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <Pause className="w-5 h-5" />
                <span>{isStopping ? 'Stopping...' : 'Stop Scanner'}</span>
              </button>
            ) : (
              <div className="flex items-center space-x-4">
                <button
                  onClick={startScanner}
                  disabled={isStarting}
                  className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Play className="w-5 h-5" />
                  <span>{isStarting ? 'Starting...' : 'Start Scanner'}</span>
                </button>
                
                <button
                  onClick={() => setShowWebhookConfig(!showWebhookConfig)}
                  className="flex items-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Webhook className="w-5 h-5" />
                  <span>Configure Webhook</span>
                </button>
              </div>
            )}

            {status?.health?.webhookStatus?.configured && (
              <div className="flex items-center space-x-2 text-green-600">
                <Webhook className="w-4 h-4" />
                <span className="text-sm font-medium">Webhook Configured</span>
              </div>
            )}
          </div>

          {/* Webhook Configuration */}
          {showWebhookConfig && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Webhook Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-webhook-endpoint.com/solana-signals"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    URL that will receive EMA crossover notifications
                  </p>
                </div>
                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-2">Webhook Payload Example:</p>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`{
  "event": "ema_crossover_detected",
  "symbol": "SOL-USD",
  "signal": {
    "type": "bullish",
    "direction": "BUY",
    "confidence": "CONFIRMED"
  },
  "price": { "current": 98.45 },
  "technical_analysis": {
    "ema_12": 98.12,
    "ema_25": 97.89
  }
}`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scanner Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* System Health */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">System Health</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Data Collection</span>
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    status?.health?.dataHealth?.priceDataAvailable ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-sm font-medium">
                    {status?.health?.dataHealth?.priceDataAvailable ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">EMA Calculation</span>
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    status?.health?.dataHealth?.emaCalculationReady ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  <span className="text-sm font-medium">
                    {status?.health?.dataHealth?.emaCalculationReady ? 'Ready' : 'Preparing'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Recent Activity</span>
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    status?.health?.dataHealth?.recentActivity ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  <span className="text-sm font-medium">
                    {status?.health?.dataHealth?.recentActivity ? 'Active' : 'Idle'}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total Data Points</span>
                  <span className="font-medium">{status?.market?.totalDataPoints?.toLocaleString() || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-600">API Response Time</span>
                  <span className="font-medium">{status?.health?.lastResponseTime || 0}ms</span>
                </div>
              </div>
            </div>
          </div>

          {/* Scanner Configuration */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Configuration</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Symbol</span>
                <span className="text-sm font-medium font-mono">{status?.meta?.symbol || 'SOL-USD'}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Scan Interval</span>
                <span className="text-sm font-medium">{status?.scanner?.scanIntervalMinutes || 15} minutes</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">EMA Periods</span>
                <span className="text-sm font-medium">
                  {status?.meta?.emaPeriods?.join(', ') || '12, 25'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Scanner Version</span>
                <span className="text-sm font-medium">{status?.meta?.apiVersion || '2.0'}</span>
              </div>

              {status?.scanner?.startedAt && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Started At</span>
                    <span className="font-medium">
                      {new Date(status.scanner.startedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {status?.scanner?.lastScanAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Last Scan</span>
                  <span className="font-medium">
                    {formatTimeAgo(status.scanner.lastScanAt)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Signals */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent EMA Signals</h2>
            <div className="flex items-center space-x-2">
              {status?.signals?.hasActiveSignal && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <Signal className="w-3 h-3 mr-1" />
                  Active Signal
                </span>
              )}
              <span className="text-sm text-gray-500">
                Last {signals.length} signals
              </span>
            </div>
          </div>

          {signals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Signal
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      EMA Values
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {signals.map((signal) => (
                    <tr key={signal.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getSignalColor(signal.type)
                        }`}>
                          {signal.type === 'bullish' ? (
                            <TrendingUp className="w-3 h-3 mr-1" />
                          ) : (
                            <TrendingDown className="w-3 h-3 mr-1" />
                          )}
                          {signal.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatPrice(signal.price)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <div>EMA12: {signal.ema12?.toFixed(4) || 'N/A'}</div>
                          <div>EMA25: {signal.ema25?.toFixed(4) || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {signal.age?.humanReadable || formatTimeAgo(signal.timestamp)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(signal.timestamp).toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Signal className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No EMA crossover signals detected yet</p>
              <p className="text-sm text-gray-400 mt-1">
                {status?.scanner?.isRunning 
                  ? 'Scanner is running and will detect signals automatically'
                  : 'Start the scanner to begin detecting EMA crossover signals'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedScannerDashboard;