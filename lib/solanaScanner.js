/**
 * Solana Price Scanner - With Scan History Logging
 * Logs every scan (manual/automatic) for debugging and monitoring
 */

class SolanaScanner {
  constructor() {
    this.baseUrl = process.env.COINBASE_API_BASE_URL || 'https://api.exchange.coinbase.com';
    this.symbol = 'SOL-USD';
    this.ema12Period = 12;
    this.ema25Period = 25;
    this.scanInterval = 15 * 60 * 1000;
    this.historicalDataPoints = 100;
  }

  // [Poprzednie metody pozostają bez zmian...]
  
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
   * NOWA FUNKCJA: Zapisuje historię skanowania
   */
  async storeScanHistory(scanData) {
    try {
      const { supabase } = await import('./supabase.js');

      const { error } = await supabase
        .from('scan_history')
        .insert([scanData]);

      if (error) {
        console.error('❌ Error storing scan history:', error);
        // Nie rzucamy błędu - historia skanów nie powinna przerywać głównego procesu
      } else {
        console.log('📝 Scan history logged');
      }
    } catch (error) {
      console.error('❌ Error in storeScanHistory:', error);
    }
  }

  /**
   * NOWA FUNKCJA: Pobiera historię skanów
   */
  async getScanHistory(limit = 10) {
    try {
      const { supabase } = await import('./supabase.js');
      
      const { data, error } = await supabase
        .from('scan_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching scan history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getScanHistory:', error);
      return [];
    }
  }

  /**
   * ZAKTUALIZOWANA: Główna funkcja skanowania z logowaniem
   */
  async scanPrice(scanType = 'automatic') {
    const scanStartTime = Date.now();
    const scanTimestamp = new Date();
    let scanResult = null;
    let apiResponseTime = null;

    try {
      console.log(`🔍 === Starting ${scanType} Solana scan at ${scanTimestamp.toISOString()} ===`);

      // 1. Pobierz aktualną cenę
      const currentPriceData = await this.fetchCurrentPrice();
      apiResponseTime = currentPriceData.apiResponseTime;
      
      if (!currentPriceData || !currentPriceData.price) {
        throw new Error('Failed to fetch current price data');
      }

      console.log(`💰 Current SOL price: $${currentPriceData.price}`);

      // 2. Pobierz połączone dane
      const combinedData = await this.getCombinedPriceData();
      const allPrices = [...combinedData.prices, currentPriceData.price];

      console.log(`📊 Total data points: ${allPrices.length}`);

      // 3. Kalkuluj EMA
      let ema12 = null, ema25 = null;
      let previousEMA12 = null, previousEMA25 = null;

      if (allPrices.length >= this.ema12Period) {
        ema12 = this.calculateEMA(allPrices, this.ema12Period);
        
        if (allPrices.length > this.ema12Period) {
          previousEMA12 = this.calculateEMA(allPrices.slice(0, -1), this.ema12Period);
        }
        
        if (ema12) {
          console.log(`📈 EMA12: ${ema12.toFixed(4)}`);
        }
      } else {
        console.log(`⏳ Need ${this.ema12Period - allPrices.length} more points for EMA12`);
      }

      if (allPrices.length >= this.ema25Period) {
        ema25 = this.calculateEMA(allPrices, this.ema25Period);
        
        if (allPrices.length > this.ema25Period) {
          previousEMA25 = this.calculateEMA(allPrices.slice(0, -1), this.ema25Period);
        }
        
        if (ema25) {
          console.log(`📊 EMA25: ${ema25.toFixed(4)}`);
        }
      } else {
        console.log(`⏳ Need ${this.ema25Period - allPrices.length} more points for EMA25`);
      }

      // 4. Sprawdź przecięcie EMA
      let crossover = null;
      if (ema12 && ema25 && previousEMA12 && previousEMA25) {
        crossover = this.detectEMACrossover(ema12, ema25, previousEMA12, previousEMA25);
        
        if (crossover) {
          console.log(`🚨 EMA Crossover: ${crossover.toUpperCase()}!`);
        }
      }

      // 5. Zapisz dane cenowe
      const priceDataToStore = {
        timestamp: currentPriceData.timestamp.toISOString(),
        price: currentPriceData.price,
        volume: currentPriceData.volume,
        ema_12: ema12,
        ema_25: ema25
      };

      await this.storePriceData(priceDataToStore);

      // 6. Zapisz sygnał crossover jeśli wystąpił
      if (crossover && ema12 && ema25) {
        const signalData = {
          timestamp: currentPriceData.timestamp.toISOString(),
          signal_type: crossover,
          price: currentPriceData.price,
          ema_12: ema12,
          ema_25: ema25,
          previous_ema_12: previousEMA12,
          previous_ema_25: previousEMA25
        };

        await this.storeEMASignal(signalData);
      }

      const executionTime = Date.now() - scanStartTime;

      scanResult = {
        success: true,
        price: currentPriceData.price,
        ema12,
        ema25,
        crossover,
        dataPoints: allPrices.length,
        historicalCount: combinedData.historicalCount,
        storedCount: combinedData.storedCount,
        timestamp: currentPriceData.timestamp,
        executionTime,
        apiResponseTime
      };

      // 7. NOWE: Zapisz historię skanowania (SUKCES)
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
        api_response_time_ms: apiResponseTime
      });

      console.log(`✅ === Scan completed successfully in ${executionTime}ms ===`);
      
      return scanResult;

    } catch (error) {
      console.error('❌ === Scan failed ===');
      console.error('Error details:', error);
      
      const executionTime = Date.now() - scanStartTime;

      scanResult = {
        success: false,
        error: error.message,
        stack: error.stack,
        executionTime,
        apiResponseTime
      };

      // 8. NOWE: Zapisz historię skanowania (BŁĄD)
      await this.storeScanHistory({
        scan_type: scanType,
        timestamp: scanTimestamp.toISOString(),
        status: 'error',
        error_message: error.message,
        execution_time_ms: executionTime,
        api_response_time_ms: apiResponseTime
      });

      return scanResult;
    }
  }

  /**
   * ZAKTUALIZOWANE: Skanowanie z oznaczeniem typu
   */
  async scanPriceManual() {
    return await this.scanPrice('manual');
  }

  async scanPriceAutomatic() {
    return await this.scanPrice('automatic');
  }

  startScanning() {
    console.log(`🚀 Starting scanner with ${this.scanInterval / 1000 / 60} minute intervals`);
    
    // Pierwsze skanowanie automatyczne od razu
    this.scanPriceAutomatic();
    
    // Następnie co 15 minut
    const intervalId = setInterval(() => {
      this.scanPriceAutomatic();
    }, this.scanInterval);

    return intervalId;
  }

  stopScanning(intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
      console.log('🛑 Scanner stopped');
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
      
      // Ostatnie dane cenowe
      const { data: latestPrice } = await supabase
        .from('sol_price_data')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      // Liczba sygnałów w ostatnim tygodniu
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

      // Całkowita liczba zapisów
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
