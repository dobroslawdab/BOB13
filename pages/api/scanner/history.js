/**
 * Scan History API
 * Provides detailed scan history with filtering and analytics
 */

import SolanaScanner from '../../../lib/solanaScanner.js';

const scanner = new SolanaScanner();

export default async function handler(req, res) {
  console.log(`📊 Scan History API called - Method: ${req.method}`);

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
      limit = 50, 
      status,
      type,
      days = 7,
      includeAnalytics = 'true'
    } = req.query;

    const limitNum = Math.min(parseInt(limit) || 50, 200); // Max 200 records
    const daysNum = Math.min(parseInt(days) || 7, 30); // Max 30 days
    
    console.log(`📈 Fetching scan history - Limit: ${limitNum}, Days: ${daysNum}`);

    // Get scan history with optional filtering
    const { supabase } = await import('../../../lib/supabase.js');
    
    let query = supabase
      .from('scan_history')
      .select('*')
      .not('scan_type', 'eq', 'scanner_status_update') // Exclude status updates
      .order('timestamp', { ascending: false })
      .limit(limitNum);

    // Add status filter if specified
    if (status && ['success', 'error'].includes(status)) {
      query = query.eq('status', status);
    }

    // Add scan type filter if specified
    if (type && ['manual', 'automatic'].includes(type)) {
      query = query.eq('scan_type', type);
    }

    // Add date filter
    const dateThreshold = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('timestamp', dateThreshold);

    const { data: scanHistory, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch scan history: ${error.message}`);
    }

    console.log(`✅ Retrieved ${scanHistory?.length || 0} scan records`);

    // Process and enhance scan history data
    const enhancedHistory = scanHistory?.map(scan => {
      const scanTime = new Date(scan.timestamp);
      const now = new Date();
      const ageMs = now - scanTime;
      const ageHours = ageMs / (1000 * 60 * 60);
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      return {
        id: scan.id,
        scanType: scan.scan_type,
        timestamp: scan.timestamp,
        status: scan.status,
        executionTime: scan.duration_ms,
        
        // Market data from scan
        price: scan.details?.price,
        volume: scan.details?.volume,
        ema12: scan.details?.ema_12,
        ema25: scan.details?.ema_25,
        
        // Signal detection
        crossoverDetected: scan.details?.crossover_detected,
        crossoverType: scan.details?.crossover_detected,
        
        // Data metrics
        dataPoints: scan.details?.data_points || scan.total_scanned,
        historicalCount: scan.details?.historical_count,
        storedCount: scan.details?.stored_count,
        
        // Performance metrics
        apiResponseTime: scan.details?.api_response_time_ms,
        webhookSent: scan.details?.webhook_sent || false,
        
        // Error information
        errorMessage: scan.details?.error_message,
        
        // Age calculation
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
        
        // Metadata
        scannerVersion: scan.details?.scanner_metadata?.version,
        createdAt: scan.created_at
      };
    }) || [];

    // Calculate analytics if requested
    let analytics = null;
    if (includeAnalytics === 'true' && enhancedHistory.length > 0) {
      const successfulScans = enhancedHistory.filter(s => s.status === 'success');
      const errorScans = enhancedHistory.filter(s => s.status === 'error');
      const manualScans = enhancedHistory.filter(s => s.scanType === 'manual');
      const automaticScans = enhancedHistory.filter(s => s.scanType === 'automatic');
      const crossoverScans = enhancedHistory.filter(s => s.crossoverDetected);
      const webhookScans = enhancedHistory.filter(s => s.webhookSent);

      // Performance metrics
      const executionTimes = successfulScans
        .filter(s => s.executionTime)
        .map(s => s.executionTime);
      
      const apiResponseTimes = successfulScans
        .filter(s => s.apiResponseTime)
        .map(s => s.apiResponseTime);

      // Price analysis
      const pricesInScans = successfulScans
        .filter(s => s.price)
        .map(s => s.price);

      analytics = {
        overview: {
          totalScans: enhancedHistory.length,
          successfulScans: successfulScans.length,
          errorScans: errorScans.length,
          successRate: enhancedHistory.length > 0 ? 
            Math.round((successfulScans.length / enhancedHistory.length) * 100) : 0
        },
        
        scanTypes: {
          manual: manualScans.length,
          automatic: automaticScans.length,
          manualPercent: enhancedHistory.length > 0 ? 
            Math.round((manualScans.length / enhancedHistory.length) * 100) : 0,
          automaticPercent: enhancedHistory.length > 0 ? 
            Math.round((automaticScans.length / enhancedHistory.length) * 100) : 0
        },
        
        signalDetection: {
          totalCrossovers: crossoverScans.length,
          crossoverRate: successfulScans.length > 0 ? 
            Math.round((crossoverScans.length / successfulScans.length) * 100) : 0,
          webhooksSent: webhookScans.length,
          webhookSuccessRate: crossoverScans.length > 0 ? 
            Math.round((webhookScans.length / crossoverScans.length) * 100) : 0
        },
        
        performance: {
          avgExecutionTime: executionTimes.length > 0 ? 
            Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length) : null,
          minExecutionTime: executionTimes.length > 0 ? Math.min(...executionTimes) : null,
          maxExecutionTime: executionTimes.length > 0 ? Math.max(...executionTimes) : null,
          
          avgApiResponseTime: apiResponseTimes.length > 0 ? 
            Math.round(apiResponseTimes.reduce((a, b) => a + b, 0) / apiResponseTimes.length) : null,
          minApiResponseTime: apiResponseTimes.length > 0 ? Math.min(...apiResponseTimes) : null,
          maxApiResponseTime: apiResponseTimes.length > 0 ? Math.max(...apiResponseTimes) : null
        },
        
        priceData: pricesInScans.length > 0 ? {
          minPrice: Math.min(...pricesInScans),
          maxPrice: Math.max(...pricesInScans),
          avgPrice: pricesInScans.reduce((a, b) => a + b, 0) / pricesInScans.length,
          priceRange: Math.max(...pricesInScans) - Math.min(...pricesInScans),
          totalScansWithPrice: pricesInScans.length
        } : null,
        
        timeDistribution: {
          last1h: enhancedHistory.filter(s => s.age.hours <= 1).length,
          last6h: enhancedHistory.filter(s => s.age.hours <= 6).length,
          last24h: enhancedHistory.filter(s => s.age.hours <= 24).length,
          last7d: enhancedHistory.length // All scans in the period
        },
        
        errorAnalysis: errorScans.length > 0 ? {
          totalErrors: errorScans.length,
          recentErrors: errorScans.filter(s => s.age.hours <= 24).length,
          commonErrors: (() => {
            const errorCounts = {};
            errorScans.forEach(scan => {
              if (scan.errorMessage) {
                const errorType = scan.errorMessage.split(':')[0] || scan.errorMessage;
                errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
              }
            });
            return Object.entries(errorCounts)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 5)
              .map(([error, count]) => ({ error, count }));
          })()
        } : null
      };
    }

    const responseTime = Date.now() - startTime;

    const response = {
      success: true,
      data: {
        // Scan history data
        scans: enhancedHistory,
        scanCount: enhancedHistory.length,
        
        // Filters applied
        filters: {
          limit: limitNum,
          status: status || 'all',
          type: type || 'all',
          days: daysNum,
          dateFrom: dateThreshold
        },
        
        // Optional analytics
        ...(analytics && { analytics }),
        
        // Metadata
        meta: {
          apiVersion: '2.0',
          symbol: scanner.symbol,
          responseTime,
          timestamp: new Date().toISOString(),
          totalRecordsAvailable: enhancedHistory.length >= limitNum ? 'More available' : enhancedHistory.length
        }
      }
    };

    console.log(`✅ Scan History API completed successfully in ${responseTime}ms`);
    
    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error in scan history API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scan history',
      message: error.message,
      timestamp: new Date().toISOString(),
      troubleshooting: {
        checkDatabase: 'Verify scan_history table exists and is accessible',
        checkFilters: 'Ensure query parameters are valid',
        supportedStatuses: ['success', 'error', 'all'],
        supportedTypes: ['manual', 'automatic', 'all']
      }
    });
  }
}