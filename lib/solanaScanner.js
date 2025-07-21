/**
 * Solana Price Scanner - Enhanced Version
 * Fetches SOL/USDC price from Coinbase API every 15 minutes
 * Pre-loads historical data for immediate EMA calculation
 * Calculates EMA12 and EMA25, detects crossovers
 * Stores results in Supabase
 */

class SolanaScanner {
  constructor() {
    this.baseUrl = process.env.COINBASE_API_BASE_URL || 'https://api.exchange.coinbase.com';
    this.symbol = 'SOL-USD'; // Używamy USD zamiast USDC (bardziej płynny)
    this.ema12Period = 12;
    this.ema25Period = 25;
    this.scanInterval = 15 * 60 * 1000; // 15 minut w milisekundach
    this.historicalDataPoints = 100; // Pobieramy więcej danych historycznych
  }

  /**
   * Pobiera dane cenowe z Coinbase API
   */
  async fetchCurrentPrice() {
    try {
      const response = await fetch(`${this.baseUrl}/products/${this.symbol}/ticker`);
      
      if (!response.ok) {
        throw new Error(`Coinbase API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        price: parseFloat(data.price),
        volume: parseFloat(data.volume_24h || 0),
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error fetching price:', error);
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
      const startTime = endTime - (dataPoints * 15 * 60); // dataPoints × 15 minut wstecz

      console.log(`🔄 Fetching ${dataPoints} historical data points from Coinbase...`);

      const response = await fetch(
        `${this.baseUrl}/products/${this.symbol}/candles?start=${startTime}&end=${endTime}&granularity=900`
      );

      if (!response.ok) {
        throw new Error(`Coinbase historical API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Coinbase zwraca dane w formacie: [timestamp, low, high, open, close, volume]
      const historicalData = data.map(candle => ({
        timestamp: new Date(candle[0] * 1000),
        price: parseFloat(candle[4]), // close price
        volume: parseFloat(candle[5])
      })).sort((a, b) => a.timestamp - b.timestamp); // Sortuj chronologicznie

      console.log(`✅ Retrieved ${historicalData.length} historical data points`);
      return historicalData;
    } catch (error) {
      console.error('Error fetching historical data:', error);
      return [];
    }
  }

  /**
   * Pobiera ostatnie dane z bazy danych Supabase
   */
  async getLastStoredData(limit = 50) {
    try {
      const { supabase } = await import('./supabase.js');
      
      const { data, error } = await supabase
        .from('sol_price_data')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Supabase fetch error:', error);
        return [];
      }

      return data.reverse(); // Odwracamy żeby mieć chronologicznie
    } catch (error) {
      console.error('Error fetching stored data:', error);
      return [];
    }
  }

  /**
   * Łączy dane historyczne z Coinbase i zapisane w bazie
   */
  async getCombinedPriceData() {
    try {
      // Pobierz ostatnie dane z bazy
      const storedData = await this.getLastStoredData(50);
      
      let historicalData = [];
      let combinedData = [];

      if (storedData.length === 0) {
        // Brak danych w bazie - pobierz wszystkie z Coinbase
        console.log('📥 No stored data found, fetching full historical dataset...');
        historicalData = await this.fetchHistoricalData(this.historicalDataPoints);
        combinedData = historicalData.map(item => item.price);
      } else {
        // Sprawdź czy potrzebujemy więcej danych historycznych
        const neededPoints = this.ema25Period - storedData.length;
        
        if (neededPoints > 0) {
          console.log(`📥 Need ${neededPoints} more historical points for EMA25...`);
          historicalData = await this.fetchHistoricalData(neededPoints + 10);
          
          // Odfiltruj dane które już mamy
          const latestStoredTime = new Date(storedData[storedData.length - 1].timestamp);
          const filteredHistorical = historicalData.filter(item => 
            item.timestamp < latestStoredTime
          );
          
          // Połącz dane historyczne + zapisane
          combinedData = [
            ...filteredHistorical.map(item => item.price),
            ...storedData.map(item => parseFloat(item.price))
          ];
        } else {
          // Wystarczy danych w bazie
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
      console.error('Error combining price data:', error);
      return { prices: [], storedCount: 0, historicalCount: 0 };
    }
  }

  /**
   * Kalkuluje EMA (Exponential Moving Average)
   */
  calculateEMA(prices, period) {
    if (prices.length < period) return null;

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
   * Kalkuluje EMA dla każdego punktu (zwraca tablicę)
   */
  calculateEMAArray(prices, period) {
    if (prices.length < period) return [];

    const multiplier = 2 / (period + 1);
    const emaArray = [];
    
    // Startuj z SMA
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    emaArray.push(ema);

    // Kalkuluj EMA dla pozostałych
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
      emaArray.push(ema);
    }

    return emaArray;
  }

  /**
   * Sprawdza przecięcie EMA (bullish/bearish crossover)
   */
  detectEMACrossover(currentEMA12, currentEMA25, previousEMA12, previousEMA25) {
    if (!previousEMA12 || !previousEMA25) return null;

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
      const { supabase } = await import('./supabase.js');

      const { error } = await supabase
        .from('sol_price_data')
        .insert([priceData]);

      if (error) {
        console.error('Error storing price data:', error);
        throw error;
      }

      console.log('💾 Price data stored successfully');
    } catch (error) {
      console.error('Error in storePriceData:', error);
      throw error;
    }
  }

  /**
   * Zapisuje sygnał EMA crossover do bazy
   */
  async storeEMASignal(signalData) {
    try {
      const { supabase } = await import('./supabase.js');

      const { error } = await supabase
        .from('ema_signals')
        .insert([signalData]);

      if (error) {
        console.error('Error storing EMA signal:', error);
        throw error;
      }

      console.log('🚨 EMA signal stored successfully:', signalData.signal_type.toUpperCase());
    } catch (error) {
      console.error('Error in storeEMASignal:', error);
      throw error;
    }
  }

  /**
   * Backfill - wypełnia brakujące dane historyczne w bazie
   */
  async backfillHistoricalData() {
    try {
      console.log('🔄 Starting historical data backfill...');
      
      const storedData = await this.getLastStoredData(10);
      
      if (storedData.length > 50) {
        console.log('✅ Sufficient historical data already exists');
        return;
      }

      const historicalData = await this.fetchHistoricalData(this.historicalDataPoints);
      
      if (historicalData.length === 0) {
        console.log('❌ No historical data retrieved');
        return;
      }

      console.log(`📥 Backfilling ${historicalData.length} historical records...`);

      // Wstaw dane historyczne (bez EMA - będą kalkulowane na bieżąco)
      const { supabase } = await import('./supabase.js');
      
      for (const item of historicalData) {
        await supabase.from('sol_price_data').insert([{
          timestamp: item.timestamp.toISOString(),
          price: item.price,
          volume: item.volume,
          ema_12: null, // Będzie kalkulowane podczas skanowania
          ema_25: null
        }]);
      }

      console.log('✅ Historical data backfill completed');
    } catch (error) {
      console.error('Error during backfill:', error);
    }
  }

  /**
   * Główna funkcja skanowania - Enhanced Version
   */
  async scanPrice() {
    try {
      console.log(`🔍 Starting enhanced Solana price scan at ${new Date().toISOString()}`);

      // 1. Pobierz aktualną cenę
      const currentPriceData = await this.fetchCurrentPrice();
      console.log(`💰 Current SOL price: $${currentPriceData.price}`);

      // 2. Pobierz połączone dane (historyczne + zapisane)
      const combinedData = await this.getCombinedPriceData();
      const allPrices = [...combinedData.prices, currentPriceData.price];

      console.log(`📊 Total data points available: ${allPrices.length}`);

      // 3. Kalkuluj EMA jeśli mamy wystarczająco danych
      let ema12 = null, ema25 = null;
      let previousEMA12 = null, previousEMA25 = null;

      if (allPrices.length >= this.ema12Period) {
        ema12 = this.calculateEMA(allPrices, this.ema12Period);
        
        // Pobierz poprzednią wartość EMA12 jeśli mamy wystarczająco danych
        if (allPrices.length > this.ema12Period) {
          previousEMA12 = this.calculateEMA(allPrices.slice(0, -1), this.ema12Period);
        }
        
        console.log(`📈 EMA12: ${ema12.toFixed(4)}`);
      } else {
        console.log(`⏳ Need ${this.ema12Period - allPrices.length} more data points for EMA12`);
      }

      if (allPrices.length >= this.ema25Period) {
        ema25 = this.calculateEMA(allPrices, this.ema25Period);
        
        // Pobierz poprzednią wartość EMA25
        if (allPrices.length > this.ema25Period) {
          previousEMA25 = this.calculateEMA(allPrices.slice(0, -1), this.ema25Period);
        }
        
        console.log(`📊 EMA25: ${ema25.toFixed(4)}`);
      } else {
        console.log(`⏳ Need ${this.ema25Period - allPrices.length} more data points for EMA25`);
      }

      // 4. Sprawdź przecięcie EMA
      let crossover = null;
      if (ema12 && ema25 && previousEMA12 && previousEMA25) {
        crossover = this.detectEMACrossover(ema12, ema25, previousEMA12, previousEMA25);
        
        if (crossover) {
          console.log(`🚨 EMA Crossover detected: ${crossover.toUpperCase()}!`);
          console.log(`📈 EMA12: ${ema12.toFixed(4)} (prev: ${previousEMA12.toFixed(4)})`);
          console.log(`📊 EMA25: ${ema25.toFixed(4)} (prev: ${previousEMA25.toFixed(4)})`);
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

      console.log(`✅ Enhanced scan completed successfully`);
      
      return {
        success: true,
        price: currentPriceData.price,
        ema12,
        ema25,
        crossover,
        dataPoints: allPrices.length,
        historicalCount: combinedData.historicalCount,
        storedCount: combinedData.storedCount
      };

    } catch (error) {
      console.error('❌ Error in enhanced scanPrice:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Rozpoczyna cykliczne skanowanie z opcją backfill
   */
  async startScanning(withBackfill = true) {
    console.log(`🚀 Starting enhanced Solana scanner...`);
    
    // Opcjonalnie wypełnij dane historyczne
    if (withBackfill) {
      await this.backfillHistoricalData();
    }
    
    // Pierwsze skanowanie od razu
    await this.scanPrice();
    
    // Następnie co 15 minut
    const intervalId = setInterval(() => {
      this.scanPrice();
    }, this.scanInterval);

    console.log(`🔄 Scanner running with ${this.scanInterval / 1000 / 60} minute intervals`);
    
    // Zwracamy ID interwału żeby można było go zatrzymać
    return intervalId;
  }

  /**
   * Zatrzymuje skanowanie
   */
  stopScanning(intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
      console.log('🛑 Enhanced Solana scanner stopped');
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

      return data;
    } catch (error) {
      console.error('Error in getRecentSignals:', error);
      return [];
    }
  }

  /**
   * Pobiera statystyki - Enhanced Version
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
      console.error('Error getting enhanced stats:', error);
      return null;
    }
  }
}

// Export dla użycia w innych plikach
export default SolanaScanner;

// Jeśli uruchamiamy bezpośrednio jako skrypt Node.js
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const scanner = new SolanaScanner();
  const intervalId = await scanner.startScanning(true); // z backfill
  
  // Obsługa zatrzymania (Ctrl+C)
  process.on('SIGINT', () => {
    console.log('\n🛑 Otrzymano sygnał zatrzymania...');
    scanner.stopScanning(intervalId);
    process.exit(0);
  });
}
