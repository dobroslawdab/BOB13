/**
 * Solana Price Scanner
 * Fetches SOL/USDC price from Coinbase API every 15 minutes
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
   * Pobiera dane historyczne do kalkulacji EMA (ostatnie 50 punktów)
   */
  async fetchHistoricalData() {
    try {
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (50 * 15 * 60); // 50 ostatnich 15-minutowych świec

      const response = await fetch(
        `${this.baseUrl}/products/${this.symbol}/candles?start=${startTime}&end=${endTime}&granularity=900`
      );

      if (!response.ok) {
        throw new Error(`Coinbase historical API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Coinbase zwraca dane w formacie: [timestamp, low, high, open, close, volume]
      return data.map(candle => ({
        timestamp: new Date(candle[0] * 1000),
        price: parseFloat(candle[4]), // close price
        volume: parseFloat(candle[5])
      })).sort((a, b) => a.timestamp - b.timestamp);
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
   * Kalkuluje EMA (Exponential Moving Average)
   */
  calculateEMA(prices, period) {
    if (prices.length < period) return null;

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
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

      console.log('Price data stored successfully:', priceData);
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

      console.log('EMA signal stored successfully:', signalData);
    } catch (error) {
      console.error('Error in storeEMASignal:', error);
      throw error;
    }
  }

  /**
   * Główna funkcja skanowania
   */
  async scanPrice() {
    try {
      console.log(`🔍 Starting Solana price scan at ${new Date().toISOString()}`);

      // 1. Pobierz aktualną cenę
      const currentPriceData = await this.fetchCurrentPrice();
      console.log(`💰 Current SOL price: $${currentPriceData.price}`);

      // 2. Pobierz historyczne dane z bazy + aktualna cena
      const storedData = await this.getLastStoredData(49); // 49 + 1 aktualna = 50
      const allPrices = [
        ...storedData.map(d => parseFloat(d.price)),
        currentPriceData.price
      ];

      // 3. Kalkuluj EMA jeśli mamy wystarczająco danych
      let ema12 = null, ema25 = null;
      
      if (allPrices.length >= this.ema12Period) {
        ema12 = this.calculateEMA(allPrices, this.ema12Period);
      }
      
      if (allPrices.length >= this.ema25Period) {
        ema25 = this.calculateEMA(allPrices, this.ema25Period);
      }

      console.log(`📈 EMA12: ${ema12 ? ema12.toFixed(4) : 'N/A'}, EMA25: ${ema25 ? ema25.toFixed(4) : 'N/A'}`);

      // 4. Sprawdź przecięcie EMA
      let crossover = null;
      if (storedData.length > 0 && ema12 && ema25) {
        const lastEntry = storedData[storedData.length - 1];
        const previousEMA12 = lastEntry.ema_12 ? parseFloat(lastEntry.ema_12) : null;
        const previousEMA25 = lastEntry.ema_25 ? parseFloat(lastEntry.ema_25) : null;

        crossover = this.detectEMACrossover(ema12, ema25, previousEMA12, previousEMA25);
        
        if (crossover) {
          console.log(`🚨 EMA Crossover detected: ${crossover.toUpperCase()}`);
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
        const previousEntry = storedData[storedData.length - 1];
        
        const signalData = {
          timestamp: currentPriceData.timestamp.toISOString(),
          signal_type: crossover,
          price: currentPriceData.price,
          ema_12: ema12,
          ema_25: ema25,
          previous_ema_12: previousEntry?.ema_12 || null,
          previous_ema_25: previousEntry?.ema_25 || null
        };

        await this.storeEMASignal(signalData);
      }

      console.log(`✅ Scan completed successfully`);
      
      return {
        success: true,
        price: currentPriceData.price,
        ema12,
        ema25,
        crossover
      };

    } catch (error) {
      console.error('❌ Error in scanPrice:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Rozpoczyna cykliczne skanowanie
   */
  startScanning() {
    console.log(`🚀 Starting Solana scanner with ${this.scanInterval / 1000 / 60} minute intervals`);
    
    // Pierwsze skanowanie od razu
    this.scanPrice();
    
    // Następnie co 15 minut
    const intervalId = setInterval(() => {
      this.scanPrice();
    }, this.scanInterval);

    // Zwracamy ID interwału żeby można było go zatrzymać
    return intervalId;
  }

  /**
   * Zatrzymuje skanowanie
   */
  stopScanning(intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
      console.log('🛑 Solana scanner stopped');
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
      
      const { data: bullishSignals } = await supabase
        .from('ema_signals')
        .select('id', { count: 'exact' })
        .eq('signal_type', 'bullish')
        .gte('timestamp', weekAgo);

      const { data: bearishSignals } = await supabase
        .from('ema_signals')
        .select('id', { count: 'exact' })
        .eq('signal_type', 'bearish')
        .gte('timestamp', weekAgo);

      return {
        latestPrice: latestPrice?.price || null,
        latestEMA12: latestPrice?.ema_12 || null,
        latestEMA25: latestPrice?.ema_25 || null,
        lastScanTime: latestPrice?.timestamp || null,
        weeklyBullishSignals: bullishSignals?.length || 0,
        weeklyBearishSignals: bearishSignals?.length || 0
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return null;
    }
  }
}

// Export dla użycia w innych plikach
export default SolanaScanner;

// Jeśli uruchamiamy bezpośrednio jako skrypt Node.js
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const scanner = new SolanaScanner();
  const intervalId = scanner.startScanning();
  
  // Obsługa zatrzymania (Ctrl+C)
  process.on('SIGINT', () => {
    console.log('\n🛑 Otrzymano sygnał zatrzymania...');
    scanner.stopScanning(intervalId);
    process.exit(0);
  });
}
