/**
 * Enhanced Solana Price Scanner with Persistent Status & Webhooks
 * Features: Persistent scanner status, signal tracking, webhook notifications
 */

class SolanaScanner {
  constructor() {
    this.baseUrl = process.env.COINBASE_API_BASE_URL || 'https://api.exchange.coinbase.com';
    this.symbol = 'SOL-USD';
    this.ema12Period = 12;
    this.ema25Period = 25;
    this.scanInterval = 15 * 60 * 1000; // 15 minutes
    this.historicalDataPoints = 100;
    this.webhookUrl = process.env.WEBHOOK_URL || null;
    
    // Enhanced status tracking
    this.currentStatus = {
      isRunning: false,
      startedAt: null,
      lastScanAt: null,
      nextScanAt: null,
      scanCount: 0,
      intervalId: null
    };
  }

  async fetchCurrentPrice() {
    try {
      console.log('📊 Fetching current price from Coinbase...');
      const startTime = Date.now();
      const response = await fetch(`${this.baseUrl}/products/${this.symbol}/ticker`);
      const apiResponseTime = Date.now() - startTime;
      
      if (!response.ok) {
        throw new Error(`Coinbase API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Current price fetched successfully:', data.price);
      
      return {
        price: parseFloat(data.price),
        volume: parseFloat(data.volume_24h || 0),
        timestamp: new Date(),
        apiResponseTime
      };
    } catch (error) {
      console.error('❌ Error fetching current price:', error);
      throw error;
    }
  }

  async fetchHistoricalData(points = null) {
    try {
      const dataPoints = points || this.historicalDataPoints;
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (dataPoints * 15 * 60);

      console.log(`📥 Fetching ${dataPoints} historical data points...`);

      const response = await fetch(
        `${this.baseUrl}/products/${this.symbol}/candles?start=${startTime}&end=${endTime}&granularity=900`
      );

      if (!response.ok) {
        throw new Error(`Coinbase historical API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.warn('⚠️ Invalid historical data format received');
        return [];
      }

      const historicalData = data.map(candle => ({
        timestamp: new Date(candle[0] * 1000),
        price: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      })).sort((a, b) => a.timestamp - b.timestamp);

      console.log(`✅ Retrieved ${historicalData.length} historical data points`);
      return historicalData;
    } catch (error) {
      console.error('❌ Error fetching historical data:', error);
      return [];
    }
  }

  async getLastStoredData(limit = 50) {
    try {
      console.log('🔍 Fetching stored data from Supabase...');
      
      const { supabase } = await import('./supabase.js');
      
      const { data, error } = await supabase
        .from('sol_price_data')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Supabase fetch error:', error);
        return [];
      }

      console.log(`📊 Retrieved ${data?.length || 0} stored records`);
      return data ? data.reverse() : [];
    } catch (error) {
      console.error('❌ Error fetching stored data:', error);
      return [];
    }
  }

  async getCombinedPriceData() {
    try {
      const storedData = await this.getLastStoredData(50);
      
      let historicalData = [];
      let combinedData = [];

      if (storedData.length === 0) {
        console.log('📥 No stored data - fetching full historical dataset...');
        historicalData = await this.fetchHistoricalData(this.historicalDataPoints);
        combinedData = historicalData.map(item => item.price);
      } else {
        console.log(`📊 Found ${storedData.length} stored records`);
        const neededPoints = Math.max(0, this.ema25Period - storedData.length);
        
        if (neededPoints > 0) {
          console.log(`📥 Need ${neededPoints} more historical points for EMA25...`);
          historicalData = await this.fetchHistoricalData(neededPoints + 10);
          
          if (historicalData.length > 0) {
            const latestStoredTime = new Date(storedData[storedData.length - 1].timestamp);
            const filteredHistorical = historicalData.filter(item => 
              item.timestamp < latestStoredTime
            );
            
            combinedData = [
              ...filteredHistorical.map(item => item.price),
              ...storedData.map(item => parseFloat(item.price))
            ];
          } else {
            combinedData = storedData.map(item => parseFloat(item.price));
          }
        } else {
          combinedData = storedData.map(item => parseFloat(item.price));
        }
      }

      console.log(`📊 Combined dataset: ${combinedData.length} price points`);
      return {
        prices: combinedData,
        storedCount: storedData.length,
        historicalCount: historicalData.length
      };
    } catch (error) {
      console.error('❌ Error combining price data:', error);
      return { prices: [], storedCount: 0, historicalCount: 0 };
    }
  }

  calculateEMA(prices, period) {
    if (!Array.isArray(prices) || prices.length < period) {
      console.log(`⚠️ Insufficient data for EMA${period}: ${prices?.length || 0} < ${period}`);
      return null;
    }

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  detectEMACrossover(currentEMA12, currentEMA25, previousEMA12, previousEMA25) {
    if (!previousEMA12 || !previousEMA25 || !currentEMA12 || !currentEMA25) {
      return null;
    }

    if (previousEMA12 <= previousEMA25 && currentEMA12 > currentEMA25) {
      return 'bullish';
    }
    
    if (previousEMA12 >= previousEMA25 && currentEMA12 < currentEMA25) {
      return 'bearish';
    }

    return null;
  }

  async storePriceData(priceData) {
    try {
      console.log('💾 Storing price data...');
      
      const { supabase } = await import('./supabase.js');

      const { error } = await supabase
        .from('sol_price_data')
        .insert([priceData]);

      if (error) {
        console.error('❌ Error storing price data:', error);
        throw error;
      }

      console.log('✅ Price data stored successfully');
    } catch (error) {
      console.error('❌ Error in storePriceData:', error);
      throw error;
    }
  }

  async storeEMASignal(signalData) {
    try {
      console.log('🚨 Storing EMA signal:', signalData.signal_type);
      
      const { supabase } = await import('./supabase.js');

      const { error } = await supabase
        .from('ema_signals')
        .insert([signalData]);

      if (error) {
        console.error('❌ Error storing EMA signal:', error);
        throw error;
      }

      console.log('✅ EMA signal stored successfully');
    } catch (error) {
      console.error('❌ Error in storeEMASignal:', error);
      throw error;
    }
  }

  /**
   * NEW: Send webhook notification for EMA crossover signals
   */
  async sendWebhookNotification(signalData, priceData, emaData) {
    if (!this.webhookUrl) {
      console.log('⚠️ No webhook URL configured, skipping notification');
      return null;
    }

    try {
      console.log('🔗 Sending webhook notification...');
      
      const webhookPayload = {
        event: 'ema_crossover_detected',
        timestamp: new Date().toISOString(),
        symbol: this.symbol,
        signal: {
          type: signalData.signal_type,
          direction: signalData.signal_type === 'bullish' ? 'BUY' : 'SELL',
          confidence: 'CONFIRMED' // EMA crossover is confirmed signal
        },
        price: {
          current: priceData.price,
          volume_24h: priceData.volume
        },
        technical_analysis: {
          ema_12: emaData.ema12,
          ema_25: emaData.ema25,
          previous_ema_12: emaData.previousEMA12,
          previous_ema_25: emaData.previousEMA25,
          crossover_strength: Math.abs(emaData.ema12 - emaData.ema25).toFixed(4)
        },
        context: {
          scan_type: signalData.scan_type || 'automatic',
          data_points_used: emaData.dataPoints,
          api_response_time_ms: priceData.apiResponseTime
        },
        next_action: {
          suggested: signalData.signal_type === 'bullish' ? 'ANALYZE_FOR_ENTRY' : 'ANALYZE_FOR_EXIT',
          webhook_id: `sol_${Date.now()}_${signalData.signal_type}`
        }
      };

      console.log('Webhook payload:', JSON.stringify(webhookPayload, null, 2));

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BOB13-Solana-Scanner/1.0'
        },
        body: JSON.stringify(webhookPayload)
      });

      const responseText = await response.text();
      
      // Log webhook response to database if webhook_responses table exists
      try {
        const { supabase } = await import('./supabase.js');
        await supabase.from('webhook_responses').insert([{
          webhook_url: this.webhookUrl,
          payload: webhookPayload,
          response_status: response.status,
          response_body: responseText,
          timestamp: new Date().toISOString()
        }]);
      } catch (dbError) {
        console.log('Note: Could not log webhook response to database:', dbError.message);
      }

      if (response.ok) {
        console.log('✅ Webhook sent successfully');
        console.log('Response status:', response.status);
        console.log('Response:', responseText);
        return { success: true, status: response.status, response: responseText };
      } else {
        console.error('❌ Webhook failed');
        console.error('Status:', response.status);
        console.error('Response:', responseText);
        return { success: false, status: response.status, error: responseText };
      }
    } catch (error) {
      console.error('❌ Error sending webhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * ENHANCED: Get current signal status and time since last crossover
   */
  async getCurrentSignalStatus() {
    try {
      const { supabase } = await import('./supabase.js');
      
      // Get the most recent EMA signal
      const { data: latestSignal } = await supabase
        .from('ema_signals')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (!latestSignal) {
        return {
          hasActiveSignal: false,
          message: 'No EMA crossover signals detected yet'
        };
      }

      const signalTime = new Date(latestSignal.timestamp);
      const now = new Date();
      const timeSinceSignal = now - signalTime;
      const hoursSinceSignal = Math.floor(timeSinceSignal / (1000 * 60 * 60));
      const minutesSinceSignal = Math.floor((timeSinceSignal % (1000 * 60 * 60)) / (1000 * 60));

      // Consider signal "active" if it's less than 24 hours old
      const isActive = timeSinceSignal < (24 * 60 * 60 * 1000);

      return {
        hasActiveSignal: isActive,
        latestSignal: {
          type: latestSignal.signal_type,
          price: latestSignal.price,
          timestamp: latestSignal.timestamp,
          timeSinceSignal: `${hoursSinceSignal}h ${minutesSinceSignal}m ago`,
          isRecent: timeSinceSignal < (2 * 60 * 60 * 1000), // Less than 2 hours
        },
        message: isActive 
          ? `${latestSignal.signal_type.toUpperCase()} signal active (${hoursSinceSignal}h ${minutesSinceSignal}m ago)`
          : `Last signal was ${hoursSinceSignal}h ${minutesSinceSignal}m ago`
      };
    } catch (error) {
      console.error('Error getting signal status:', error);
      return {
        hasActiveSignal: false,
        error: error.message
      };
    }
  }

  async updateScannerStatus(status, additionalData = {}) {
    try {
      const { supabase } = await import('./supabase.js');
      
      const statusData = {
        scan_type: 'scanner_status_update',
        timestamp: new Date().toISOString(),
        status: status,
        total_scanned: this.currentStatus.scanCount,
        candidates_found: 0,
        alerts_sent: 0,
        duration_ms: 0,
        details: {
          scanner_status: {
            isRunning: this.currentStatus.isRunning,
            startedAt: this.currentStatus.startedAt,
            lastScanAt: this.currentStatus.lastScanAt,
            nextScanAt: this.currentStatus.nextScanAt,
            scanCount: this.currentStatus.scanCount,
            scanInterval: this.scanInterval,
            ...additionalData
          }
        }
      };

      await supabase.from('scan_history').insert([statusData]);
      console.log(`📊 Scanner status updated: ${status}`);
    } catch (error) {
      console.error('❌ Error updating scanner status:', error);
    }
  }

  async getScannerStatus() {
    try {
      const { supabase } = await import('./supabase.js');
      
      const { data: statusRecord } = await supabase
        .from('scan_history')
        .select('*')
        .eq('scan_type', 'scanner_status_update')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (statusRecord && statusRecord.details?.scanner_status) {
        const savedStatus = statusRecord.details.scanner_status;
        
        if (savedStatus.isRunning && savedStatus.lastScanAt) {
          const lastScan = new Date(savedStatus.lastScanAt);
          const nextScan = new Date(lastScan.getTime() + this.scanInterval);
          const now = new Date();
          
          return {
            isRunning: savedStatus.isRunning,
            startedAt: savedStatus.startedAt,
            lastScanAt: savedStatus.lastScanAt,
            nextScanAt: nextScan.toISOString(),
            scanCount: savedStatus.scanCount || 0,
            timeToNextScan: Math.max(0, nextScan - now),
            status: now < nextScan ? 'running' : 'stopped'
          };
        }
        
        return {
          isRunning: false,
          status: 'stopped',
          scanCount: savedStatus.scanCount || 0
        };
      }

      return {
        isRunning: false,
        status: 'stopped',
        scanCount: 0,
        message: 'Scanner status not found - first run'
      };
    } catch (error) {
      console.error('Error getting scanner status:', error);
      return {
        isRunning: false,
        status: 'stopped',
        error: error.message
      };
    }
  }

  async storeScanHistory(scanData) {
    try {
      console.log('📝 === STORING SCAN HISTORY ===');
      
      const { supabase } = await import('./supabase.js');
      
      const mappedData = {
        scan_type: scanData.scan_type || 'manual',
        timestamp: scanData.timestamp || new Date().toISOString(),
        status: scanData.status || 'unknown',
        total_scanned: scanData.data_points || 0,
        candidates_found: scanData.crossover_detected ? 1 : 0,
        alerts_sent: scanData.crossover_detected ? 1 : 0,
        duration_ms: scanData.execution_time_ms || 0,
        details: {
          price: scanData.price,
          volume: scanData.volume,
          ema_12: scanData.ema_12,
          ema_25: scanData.ema_25,
          crossover_detected: scanData.crossover_detected,
          data_points: scanData.data_points,
          historical_count: scanData.historical_count,
          stored_count: scanData.stored_count,
          error_message: scanData.error_message,
          execution_time_ms: scanData.execution_time_ms,
          api_response_time_ms: scanData.api_response_time_ms,
          webhook_sent: scanData.webhook_sent || false,
          scanner_metadata: {
            version: '2.0',
            ema_periods: [12, 25],
            symbol: 'SOL-USD',
            scan_count: this.currentStatus.scanCount
          }
        }
      };

      const { data, error } = await supabase
        .from('scan_history')
        .insert([mappedData])
        .select();

      if (error) {
        console.error('❌ Error storing scan history:', error);
        return;
      }

      console.log('✅ Scan history stored successfully!');
      
    } catch (error) {
      console.error('❌ Exception in storeScanHistory:', error);
    }
  }

  async getScanHistory(limit = 10) {
    try {
      const { supabase } = await import('./supabase.js');
      
      const { data, error } = await supabase
        .from('scan_history')
        .select('*')
        .not('scan_type', 'eq', 'scanner_status_update')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Error fetching scan history:', error);
        return [];
      }

      const mappedData = data?.map(record => ({
        id: record.id,
        scan_type: record.scan_type,
        timestamp: record.timestamp,
        status: record.status,
        price: record.details?.price,
        volume: record.details?.volume,
        ema_12: record.details?.ema_12,
        ema_25: record.details?.ema_25,
        crossover_detected: record.details?.crossover_detected,
        data_points: record.details?.data_points || record.total_scanned,
        historical_count: record.details?.historical_count,
        stored_count: record.details?.stored_count,
        error_message: record.details?.error_message,
        execution_time_ms: record.details?.execution_time_ms || record.duration_ms,
        api_response_time_ms: record.details?.api_response_time_ms,
        webhook_sent: record.details?.webhook_sent,
        created_at: record.created_at
      })) || [];

      return mappedData;
    } catch (error) {
      console.error('❌ Exception in getScanHistory:', error);
      return [];
    }
  }

  async scanPrice(scanType = 'automatic') {
    const scanStartTime = Date.now();
    const scanTimestamp = new Date();
    let webhookSent = false;

    try {
      console.log(`🔍 === Starting ${scanType} Solana scan at ${scanTimestamp.toISOString()} ===`);

      this.currentStatus.scanCount++;
      this.currentStatus.lastScanAt = scanTimestamp.toISOString();
      
      if (scanType === 'automatic') {
        this.currentStatus.nextScanAt = new Date(scanTimestamp.getTime() + this.scanInterval).toISOString();
      }

      const currentPriceData = await this.fetchCurrentPrice();
      const combinedData = await this.getCombinedPriceData();
      const allPrices = [...combinedData.prices, currentPriceData.price];

      let ema12 = null, ema25 = null, previousEMA12 = null, previousEMA25 = null;

      if (allPrices.length >= this.ema12Period) {
        ema12 = this.calculateEMA(allPrices, this.ema12Period);
        if (allPrices.length > this.ema12Period) {
          previousEMA12 = this.calculateEMA(allPrices.slice(0, -1), this.ema12Period);
        }
      }

      if (allPrices.length >= this.ema25Period) {
        ema25 = this.calculateEMA(allPrices, this.ema25Period);
        if (allPrices.length > this.ema25Period) {
          previousEMA25 = this.calculateEMA(allPrices.slice(0, -1), this.ema25Period);
        }
      }

      let crossover = null;
      if (ema12 && ema25 && previousEMA12 && previousEMA25) {
        crossover = this.detectEMACrossover(ema12, ema25, previousEMA12, previousEMA25);
        if (crossover) {
          console.log(`🚨 EMA Crossover: ${crossover.toUpperCase()}!`);
        }
      }

      await this.storePriceData({
        timestamp: currentPriceData.timestamp.toISOString(),
        price: currentPriceData.price,
        volume: currentPriceData.volume,
        ema_12: ema12,
        ema_25: ema25
      });

      if (crossover && ema12 && ema25) {
        const signalData = {
          timestamp: currentPriceData.timestamp.toISOString(),
          signal_type: crossover,
          price: currentPriceData.price,
          ema_12: ema12,
          ema_25: ema25,
          previous_ema_12: previousEMA12,
          previous_ema_25: previousEMA25,
          scan_type: scanType
        };

        await this.storeEMASignal(signalData);

        const webhookResult = await this.sendWebhookNotification(
          signalData, 
          currentPriceData, 
          { ema12, ema25, previousEMA12, previousEMA25, dataPoints: allPrices.length }
        );

        webhookSent = webhookResult?.success || false;
      }

      const executionTime = Date.now() - scanStartTime;
      
      await this.storeScanHistory({
        scan_type: scanType,
        timestamp: scanTimestamp.toISOString(),
        status: 'success',
        price: currentPriceData.price,
        volume: currentPriceData.volume,
        ema_12: ema12,
        ema_25: ema25,
        crossover_detected: crossover,
        data_points: allPrices.length,
        historical_count: combinedData.historicalCount,
        stored_count: combinedData.storedCount,
        execution_time_ms: executionTime,
        api_response_time_ms: currentPriceData.apiResponseTime,
        webhook_sent: webhookSent
      });

      if (scanType === 'automatic') {
        await this.updateScannerStatus('running', {
          lastScanResult: 'success',
          lastCrossover: crossover,
          webhookSent
        });
      }

      return {
        success: true,
        price: currentPriceData.price,
        ema12, ema25, crossover,
        dataPoints: allPrices.length,
        executionTime,
        webhookSent
      };

    } catch (error) {
      console.error('❌ === Scan failed ===', error);
      
      const executionTime = Date.now() - scanStartTime;
      
      await this.storeScanHistory({
        scan_type: scanType,
        timestamp: scanTimestamp.toISOString(),
        status: 'error',
        error_message: error.message,
        execution_time_ms: executionTime
      });

      if (scanType === 'automatic') {
        await this.updateScannerStatus('error', { lastError: error.message });
      }

      return { success: false, error: error.message, executionTime };
    }
  }

  async scanPriceManual() {
    return await this.scanPrice('manual');
  }

  async scanPriceAutomatic() {
    return await this.scanPrice('automatic');
  }

  async startScanning() {
    console.log(`🚀 Starting enhanced scanner with ${this.scanInterval / 1000 / 60} minute intervals`);
    
    this.currentStatus.isRunning = true;
    this.currentStatus.startedAt = new Date().toISOString();
    
    await this.updateScannerStatus('starting');
    await this.scanPriceAutomatic();
    await this.updateScannerStatus('running');
    
    const intervalId = setInterval(async () => {
      console.log('⏰ Scheduled automatic scan triggered');
      await this.scanPriceAutomatic();
    }, this.scanInterval);

    this.currentStatus.intervalId = intervalId;
    return intervalId;
  }

  async stopScanning(intervalId) {
    if (intervalId || this.currentStatus.intervalId) {
      clearInterval(intervalId || this.currentStatus.intervalId);
      console.log('🛑 Scanner stopped');
      
      this.currentStatus.isRunning = false;
      this.currentStatus.intervalId = null;
      
      await this.updateScannerStatus('stopped');
    }
  }

  async getRecentSignals(limit = 10) {
    try {
      const { supabase } = await import('./supabase.js');
      
      const { data, error } = await supabase
        .from('ema_signals')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching signals:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getRecentSignals:', error);
      return [];
    }
  }

  async getStats() {
    try {
      const { supabase } = await import('./supabase.js');
      
      const { data: latestPrice } = await supabase
        .from('sol_price_data')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: bullishSignals, count: bullishCount } = await supabase
        .from('ema_signals')
        .select('id', { count: 'exact' })
        .eq('signal_type', 'bullish')
        .gte('timestamp', weekAgo);

      const { data: bearishSignals, count: bearishCount } = await supabase
        .from('ema_signals')
        .select('id', { count: 'exact' })
        .eq('signal_type', 'bearish')
        .gte('timestamp', weekAgo);

      const { count: totalDataPoints } = await supabase
        .from('sol_price_data')
        .select('id', { count: 'exact' });

      return {
        latestPrice: latestPrice?.price || null,
        latestEMA12: latestPrice?.ema_12 || null,
        latestEMA25: latestPrice?.ema_25 || null,
        lastScanTime: latestPrice?.timestamp || null,
        weeklyBullishSignals: bullishCount || 0,
        weeklyBearishSignals: bearishCount || 0,
        totalDataPoints: totalDataPoints || 0,
        emaStatus: {
          ema12Ready: latestPrice?.ema_12 !== null,
          ema25Ready: latestPrice?.ema_25 !== null
        }
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        error: error.message,
        latestPrice: null,
        latestEMA12: null,
        latestEMA25: null
      };
    }
  }
}

export default SolanaScanner;