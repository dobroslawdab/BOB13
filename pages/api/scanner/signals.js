/**
 * Enhanced EMA Signals API
 * Provides comprehensive EMA crossover signal information and analysis
 */

import SolanaScanner from '../../../lib/solanaScanner.js';

const scanner = new SolanaScanner();

export default async function handler(req, res) {
  console.log(`📈 EMA Signals API called - Method: ${req.method}`);

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      allowedMethods: ['GET']
    });
  }

  try {
    const startTime = Date.now();
    
    // Parse query parameters
    const { 
      limit = 20, 
      type, 
      days = 7,
      includeStats = 'true',
      includeChart = 'false'
    } = req.query;

    const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100 signals
    const daysNum = Math.min(parseInt(days) || 7, 30); // Max 30 days
    
    console.log(`📊 Fetching signals - Limit: ${limitNum}, Days: ${daysNum}, Type: ${type || 'all'}`);

    // Get recent signals with optional filtering
    const { supabase } = await import('../../../lib/supabase.js');
    
    let query = supabase
      .from('ema_signals')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limitNum);

    // Add type filter if specified
    if (type && ['bullish', 'bearish'].includes(type)) {
      query = query.eq('signal_type', type);
    }

    // Add date filter
    const dateThreshold = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('timestamp', dateThreshold);

    const { data: signals, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch signals: ${error.message}`);
    }

    console.log(`✅ Retrieved ${signals?.length || 0} signals`);

    // Get current signal status
    const currentStatus = await scanner.getCurrentSignalStatus();

    // Calculate signal statistics if requested
    let stats = null;
    if (includeStats === 'true') {
      const bullishSignals = signals?.filter(s => s.signal_type === 'bullish') || [];
      const bearishSignals = signals?.filter(s => s.signal_type === 'bearish') || [];
      
      // Calculate average time between signals
      let avgTimeBetweenSignals = null;
      if (signals && signals.length > 1) {
        const timeDiffs = [];
        for (let i = 0; i < signals.length - 1; i++) {
          const diff = new Date(signals[i].timestamp) - new Date(signals[i + 1].timestamp);
          timeDiffs.push(diff);
        }
        avgTimeBetweenSignals = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
      }

      // Calculate price performance after signals
      const signalPerformance = signals?.map(signal => {
        const signalTime = new Date(signal.timestamp);
        const currentTime = new Date();
        const hoursElapsed = (currentTime - signalTime) / (1000 * 60 * 60);
        
        return {
          id: signal.id,
          type: signal.signal_type,
          signalPrice: signal.price,
          hoursElapsed: Math.round(hoursElapsed * 100) / 100,
          priceChange: null // Would need current price to calculate
        };
      }) || [];

      stats = {
        totalSignals: signals?.length || 0,
        bullishCount: bullishSignals.length,
        bearishCount: bearishSignals.length,
        signalRatio: signals?.length > 0 ? {
          bullishPercent: Math.round((bullishSignals.length / signals.length) * 100),
          bearishPercent: Math.round((bearishSignals.length / signals.length) * 100)
        } : null,
        avgTimeBetweenSignals: avgTimeBetweenSignals ? {
          milliseconds: Math.round(avgTimeBetweenSignals),
          hours: Math.round(avgTimeBetweenSignals / (1000 * 60 * 60) * 100) / 100,
          days: Math.round(avgTimeBetweenSignals / (1000 * 60 * 60 * 24) * 100) / 100
        } : null,
        priceRanges: {
          bullish: bullishSignals.length > 0 ? {
            min: Math.min(...bullishSignals.map(s => s.price)),
            max: Math.max(...bullishSignals.map(s => s.price)),
            avg: bullishSignals.reduce((sum, s) => sum + s.price, 0) / bullishSignals.length
          } : null,
          bearish: bearishSignals.length > 0 ? {
            min: Math.min(...bearishSignals.map(s => s.price)),
            max: Math.max(...bearishSignals.map(s => s.price)),
            avg: bearishSignals.reduce((sum, s) => sum + s.price, 0) / bearishSignals.length
          } : null
        },
        recentActivity: {
          last24h: signals?.filter(s => 
            new Date(s.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
          ).length || 0,
          last7days: signals?.length || 0
        }
      };
    }

    // Generate chart data if requested
    let chartData = null;
    if (includeChart === 'true' && signals && signals.length > 0) {
      chartData = signals.slice(0, 50).reverse().map(signal => ({
        timestamp: signal.timestamp,
        price: signal.price,
        type: signal.signal_type,
        ema12: signal.ema_12,
        ema25: signal.ema_25,
        date: new Date(signal.timestamp).toISOString().split('T')[0]
      }));
    }

    // Enhanced signal data with calculated fields
    const enhancedSignals = signals?.map(signal => {
      const signalTime = new Date(signal.timestamp);
      const now = new Date();
      const ageMs = now - signalTime;
      const ageHours = ageMs / (1000 * 60 * 60);
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      return {
        id: signal.id,
        type: signal.signal_type,
        timestamp: signal.timestamp,
        price: signal.price,
        ema12: signal.ema_12,
        ema25: signal.ema_25,
        previousEma12: signal.previous_ema_12,
        previousEma25: signal.previous_ema_25,
        scanType: signal.scan_type,
        age: {
          milliseconds: ageMs,
          hours: Math.round(ageHours * 100) / 100,
          days: Math.round(ageDays * 100) / 100,
          humanReadable: ageHours < 1 ? 
            `${Math.round(ageMs / (1000 * 60))}m ago` :
            ageHours < 24 ?
            `${Math.round(ageHours)}h ago` :
            `${Math.round(ageDays)}d ago`
        },
        crossoverStrength: signal.ema_12 && signal.ema_25 ? 
          Math.abs(signal.ema_12 - signal.ema_25).toFixed(4) : null,
        direction: signal.signal_type === 'bullish' ? 'BUY' : 'SELL',
        confidence: 'CONFIRMED'
      };
    }) || [];

    const responseTime = Date.now() - startTime;

    const response = {
      success: true,
      data: {
        // Current signal status
        currentStatus: {
          hasActiveSignal: currentStatus.hasActiveSignal,
          message: currentStatus.message,
          latest: currentStatus.latestSignal
        },
        
        // Signal data
        signals: enhancedSignals,
        signalCount: enhancedSignals.length,
        
        // Filters applied
        filters: {
          limit: limitNum,
          type: type || 'all',
          days: daysNum,
          dateFrom: dateThreshold
        },
        
        // Optional statistics
        ...(stats && { statistics: stats }),
        
        // Optional chart data
        ...(chartData && { chartData }),
        
        // Metadata
        meta: {
          apiVersion: '2.0',
          symbol: scanner.symbol,
          emaPeriods: [scanner.ema12Period, scanner.ema25Period],
          responseTime,
          timestamp: new Date().toISOString()
        }
      }
    };

    console.log(`✅ EMA Signals API completed successfully in ${responseTime}ms`);
    
    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error in EMA signals API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch EMA signals',
      message: error.message,
      timestamp: new Date().toISOString(),
      troubleshooting: {
        checkDatabase: 'Verify ema_signals table exists and is accessible',
        checkFilters: 'Ensure query parameters are valid',
        supportedTypes: ['bullish', 'bearish', 'all']
      }
    });
  }
}