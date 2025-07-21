/**
 * Enhanced Scanner Control API
 * Provides start/stop control with webhook configuration and persistent status
 */

import SolanaScanner from '../../../lib/solanaScanner.js';

// Global scanner instance to maintain state across requests
let globalScanner = null;
let globalIntervalId = null;

export default async function handler(req, res) {
  console.log(`🎛️ Scanner Control API called - Method: ${req.method}`);

  if (!['POST', 'GET'].includes(req.method)) {
    return res.status(405).json({ 
      error: 'Method not allowed',
      allowedMethods: ['POST', 'GET']
    });
  }

  try {
    // Initialize scanner if not exists
    if (!globalScanner) {
      globalScanner = new SolanaScanner();
      console.log('🆕 New scanner instance created');
    }

    // Handle GET request - return current control status
    if (req.method === 'GET') {
      const status = await globalScanner.getScannerStatus();
      
      return res.status(200).json({
        success: true,
        action: 'status_check',
        data: {
          isRunning: status.isRunning,
          status: status.status || 'stopped',
          scanCount: status.scanCount || 0,
          startedAt: status.startedAt,
          lastScanAt: status.lastScanAt,
          nextScanAt: status.nextScanAt,
          hasGlobalInstance: !!globalScanner,
          hasActiveInterval: !!globalIntervalId,
          webhookConfigured: !!globalScanner.webhookUrl
        },
        timestamp: new Date().toISOString()
      });
    }

    // Handle POST request - start/stop scanner
    const { action, webhookUrl } = req.body;

    if (!action || !['start', 'stop'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be "start" or "stop"',
        receivedAction: action
      });
    }

    // Configure webhook URL if provided
    if (webhookUrl && action === 'start') {
      globalScanner.webhookUrl = webhookUrl;
      console.log(`🔗 Webhook URL configured: ${webhookUrl}`);
    }

    let result;
    const actionStartTime = Date.now();

    if (action === 'start') {
      console.log('🚀 Starting scanner...');
      
      // Stop existing scanner if running
      if (globalIntervalId) {
        await globalScanner.stopScanning(globalIntervalId);
        globalIntervalId = null;
        console.log('🛑 Stopped existing scanner before restart');
      }

      // Start new scanner
      globalIntervalId = await globalScanner.startScanning();
      
      const status = await globalScanner.getScannerStatus();
      
      result = {
        action: 'started',
        message: 'Scanner started successfully with enhanced features',
        intervalId: !!globalIntervalId,
        scanInterval: globalScanner.scanInterval,
        scanIntervalMinutes: globalScanner.scanInterval / (1000 * 60),
        webhookConfigured: !!globalScanner.webhookUrl,
        webhookUrl: globalScanner.webhookUrl ? '***configured***' : null,
        scanner: {
          isRunning: status.isRunning,
          startedAt: status.startedAt,
          scanCount: status.scanCount,
          nextScanAt: status.nextScanAt
        },
        features: {
          persistentStatus: true,
          webhookNotifications: !!globalScanner.webhookUrl,
          signalTracking: true,
          scanHistory: true,
          emaCalculation: true
        }
      };

    } else if (action === 'stop') {
      console.log('🛑 Stopping scanner...');
      
      if (globalIntervalId) {
        await globalScanner.stopScanning(globalIntervalId);
        globalIntervalId = null;
        
        const status = await globalScanner.getScannerStatus();
        
        result = {
          action: 'stopped',
          message: 'Scanner stopped successfully',
          finalScanCount: status.scanCount || 0,
          totalUptime: status.startedAt ? Date.now() - new Date(status.startedAt) : null,
          lastScanAt: status.lastScanAt,
          scanner: {
            isRunning: false,
            status: 'stopped'
          }
        };
      } else {
        result = {
          action: 'already_stopped',
          message: 'Scanner was not running',
          scanner: {
            isRunning: false,
            status: 'stopped'
          }
        };
      }
    }

    const actionTime = Date.now() - actionStartTime;

    console.log(`✅ Scanner ${action} completed successfully in ${actionTime}ms`);

    res.status(200).json({
      success: true,
      data: result,
      performance: {
        actionTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`❌ Error in scanner control API (${req.body?.action || 'unknown'}):`, error);
    
    // Try to clean up on error
    if (globalIntervalId) {
      try {
        clearInterval(globalIntervalId);
        globalIntervalId = null;
        console.log('🧹 Cleaned up interval after error');
      } catch (cleanupError) {
        console.error('❌ Error during cleanup:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: `Failed to ${req.body?.action || 'control'} scanner`,
      message: error.message,
      action: req.body?.action || null,
      timestamp: new Date().toISOString(),
      troubleshooting: {
        suggestion: 'Try stopping and restarting the scanner',
        checkWebhook: 'Ensure webhook URL is valid if provided',
        checkDatabase: 'Verify Supabase connection is working'
      }
    });
  }
}