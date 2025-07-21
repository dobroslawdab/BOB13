/**
 * Enhanced Scanner Status API
 * Provides comprehensive scanner status including persistent state and signal information
 */

import SolanaScanner from '../../../lib/solanaScanner.js';

const scanner = new SolanaScanner();

export default async function handler(req, res) {
  console.log(`📡 Scanner Status API called - Method: ${req.method}`);

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      allowedMethods: ['GET']
    });
  }

  try {
    const startTime = Date.now();

    // Get comprehensive scanner status
    const [
      scannerStatus,
      currentSignalStatus,
      recentSignals,
      stats,
      recentHistory
    ] = await Promise.all([
      scanner.getScannerStatus(),
      scanner.getCurrentSignalStatus(),
      scanner.getRecentSignals(5),
      scanner.getStats(),
      scanner.getScanHistory(5)
    ]);

    const responseTime = Date.now() - startTime;
    const now = new Date();

    // Calculate time to next scan
    let timeToNextScan = null;
    let nextScanCountdown = null;
    
    if (scannerStatus.isRunning && scannerStatus.nextScanAt) {
      const nextScan = new Date(scannerStatus.nextScanAt);
      const msToNext = nextScan - now;
      
      if (msToNext > 0) {
        timeToNextScan = msToNext;
        const minutes = Math.floor(msToNext / (1000 * 60));
        const seconds = Math.floor((msToNext % (1000 * 60)) / 1000);
        nextScanCountdown = `${minutes}m ${seconds}s`;
      }
    }

    // Enhanced status response
    const enhancedStatus = {
      // Core scanner status
      scanner: {
        isRunning: scannerStatus.isRunning,
        status: scannerStatus.status || (scannerStatus.isRunning ? 'running' : 'stopped'),
        startedAt: scannerStatus.startedAt,
        lastScanAt: scannerStatus.lastScanAt,
        nextScanAt: scannerStatus.nextScanAt,
        scanCount: scannerStatus.scanCount || 0,
        scanInterval: scanner.scanInterval,
        scanIntervalMinutes: scanner.scanInterval / (1000 * 60),
        uptime: scannerStatus.startedAt ? now - new Date(scannerStatus.startedAt) : null
      },

      // Timing information
      timing: {
        currentTime: now.toISOString(),
        timeToNextScan,
        nextScanCountdown,
        lastScanAge: scannerStatus.lastScanAt ? now - new Date(scannerStatus.lastScanAt) : null
      },

      // Signal status
      signals: {
        hasActiveSignal: currentSignalStatus.hasActiveSignal,
        message: currentSignalStatus.message,
        latest: currentSignalStatus.latestSignal || null,
        recentCount: recentSignals.length,
        recent: recentSignals.map(signal => ({
          id: signal.id,
          type: signal.signal_type,
          price: signal.price,
          timestamp: signal.timestamp,
          ema12: signal.ema_12,
          ema25: signal.ema_25,
          age: now - new Date(signal.timestamp)
        }))
      },

      // Market data and technical indicators
      market: {
        latestPrice: stats.latestPrice,
        ema12: stats.latestEMA12,
        ema25: stats.latestEMA25,
        lastPriceUpdate: stats.lastScanTime,
        emaStatus: stats.emaStatus,
        totalDataPoints: stats.totalDataPoints,
        weeklySignals: {
          bullish: stats.weeklyBullishSignals,
          bearish: stats.weeklyBearishSignals,
          total: stats.weeklyBullishSignals + stats.weeklyBearishSignals
        }
      },

      // Recent activity
      activity: {
        recentScans: recentHistory.map(scan => ({
          id: scan.id,
          type: scan.scan_type,
          status: scan.status,
          timestamp: scan.timestamp,
          price: scan.price,
          crossover: scan.crossover_detected,
          executionTime: scan.execution_time_ms,
          webhookSent: scan.webhook_sent
        }))
      },

      // Health and performance
      health: {
        lastResponseTime: responseTime,
        dataHealth: {
          priceDataAvailable: stats.totalDataPoints > 0,
          emaCalculationReady: stats.emaStatus?.ema25Ready || false,
          recentActivity: scannerStatus.lastScanAt ? (now - new Date(scannerStatus.lastScanAt)) < (30 * 60 * 1000) : false
        },
        webhookStatus: {
          configured: !!scanner.webhookUrl,
          recentlySent: recentHistory.some(scan => scan.webhook_sent)
        }
      },

      // Metadata
      meta: {
        apiVersion: '2.0',
        symbol: scanner.symbol,
        emaPeriods: [scanner.ema12Period, scanner.ema25Period],
        responseTime,
        timestamp: now.toISOString()
      }
    };

    console.log('✅ Scanner status retrieved successfully');
    
    res.status(200).json({
      success: true,
      data: enhancedStatus
    });

  } catch (error) {
    console.error('❌ Error in scanner status API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get scanner status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}