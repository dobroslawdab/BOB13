/**
 * Solana Price Scanner - Fixed Version
 * Fetches SOL/USD price from Coinbase API every 15 minutes
 * Pre-loads historical data for immediate EMA calculation
 * Calculates EMA12 and EMA25, detects crossovers
 * Stores results in Supabase
 */

class SolanaScanner {
  constructor() {
    this.baseUrl = process.env.COINBASE_API_BASE_URL || 'https://api.exchange.coinbase.com';
    this.symbol = 'SOL-USD';
    this.ema12Period = 12;
    this.ema25Period = 25;
    this.scanInterval = 15 * 60 * 1000; // 15 minut w milisekundach
    this.historicalDataPoints = 100;
  }

  /**
   * Pobiera dane cenowe z Coinbase API
   */
  async fetchCurrentPrice() {
    try {
      console.log('📊 Fetching current price from Coinbase...');
      const response = await fetch(`${this.baseUrl}/products/${this.symbol}/ticker`);
      
      if (!response.ok) {
        throw new Error(`Coinbase API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Current price fetched successfully:', data.price);
      
      return {
        price: parseFloat(data.price),
        volume: parseFloat(data.volume_24h || 0),
        timestamp: new Date()
      };
    } catch (error) {
      console.error('❌ Error fetching current price:', error);
      throw error;
    }
  }

  /**
   * Pobiera dane historyczne z Coinbase (ostatnie 100 punktów po 15min)
   */
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
        price: parseFloat(candle[4]), // close price
        volume: parseFloat(candle[5])
      })).sort((a, b) => a.timestamp - b.timestamp);

      console.log(`✅ Retrieved ${historicalData.length} historical data points`);
      return historicalData;
    } catch (error) {
      console.error('❌ Error fetching historical data:', error);
      return [];
    }
  }

  /**
   * Pobiera ostatnie dane z bazy danych Supabase
   */
  async getLastStoredData(limit = 50) {
    try {
      console.log('🔍 Fetching stored data from Supabase...');
      
      // Dynamiczny import Supabase
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
      return data ? data.reverse() : []; // Odwracamy żeby mieć chronologicznie
    } catch (error) {
      console.error('❌ Error fetching stored data:', error);
      return [];
    }
  }

  /**
   * Łączy dane historyczne z Coinbase i zapisane w bazie
   */
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

  /**
   * Kalkuluje EMA (Exponential Moving Average)
   */
  calculateEMA(prices, period) {
    if (!Array.isArray(prices) || prices.length < period) {
      console.log(`⚠️ Insufficient data for EMA${period}: ${prices?.length || 0} < ${period}`);
      return null;
    }

    const multiplier = 2 / (period + 1);
    
    // Startuj z SMA pierwszych 'period' wartości
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

    // Kalkuluj EMA dla pozostałych wartości
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  /**
   * Sprawdza przecięcie EMA (bullish/bearish crossover)
   */
  detectEMACrossover(currentEMA12, currentEMA25, previousEMA12, previousEMA25) {
    if (!previousEMA12 || !previousEMA25 || !currentEMA12 || !currentEMA25) {
      return null;
    }

    // Bullish crossover: EMA12 przecina EMA25 od dołu
    if (previousEMA12 <= previousEMA25 && currentEMA12 > currentEMA25) {
      return 'bullish';
    }
    
    // Bearish crossover: EMA12 przecina EMA25 od góry
    if (previousEMA12 >= previousEMA25 && currentEMA12 < currentEMA25) {
      return 'bearish';
    }

    return null;
  }

  /**
   * Zapisuje dane cenowe do bazy
   */
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

  /**
   * Zapisuje sygnał EMA crossover do bazy
   */
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
   * Główna funkcja skanowania - Simplified & Fixed
   */
  async scanPrice() {
    try {
      console.log(`🔍 === Starting Solana scan at ${new Date().toISOString()} ===`);

      // 1. Pobierz aktualną cenę
      const currentPriceData = await this.fetchCurrentPrice();
      
      if (!currentPriceData || !currentPriceData.price) {
        throw new Error('Failed to fetch current price data');
      }

      console.log(`💰 Current SOL price: $${currentPriceData.price}`);

      // 2. Pobierz połączone dane (historyczne + zapisane)
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

      console.log(`✅ === Scan completed successfully ===`);
      
      return {
        success: true,
        price: currentPriceData.price,
        ema12,
        ema25,
        crossover,
        dataPoints: allPrices.length,
        historicalCount: combinedData.historicalCount,
        storedCount: combinedData.storedCount,
        timestamp: currentPriceData.timestamp
      };

    } catch (error) {
      console.error('❌ === Scan failed ===');
      console.error('Error details:', error);
      
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Rozpoczyna cykliczne skanowanie
   */
  startScanning() {
    console.log(`🚀 Starting scanner with ${this.scanInterval / 1000 / 60} minute intervals`);
    
    // Pierwsze skanowanie od razu
    this.scanPrice();
    
    // Następnie co 15 minut
    const intervalId = setInterval(() => {
      this.scanPrice();
    }, this.scanInterval);

    return intervalId;
  }

  /**
   * Zatrzymuje skanowanie
   */
  stopScanning(intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
      console.log('🛑 Scanner stopped');
    }
  }

  /**
   * Pobiera ostatnie sygnały
   */
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

  /**
   * Pobiera statystyki
   */
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

// Export dla użycia w innych plikach
export default SolanaScanner;
