/**
 * Enhanced EMA Trend Analysis
 * Tracks EMA crossover history and current trend direction
 * Provides trading signals with entry/exit points
 */

class EMATrendAnalyzer {
  constructor() {
    this.trends = {
      BULLISH: 'bullish',    // EMA12 > EMA25 (Long position)
      BEARISH: 'bearish',    // EMA12 < EMA25 (Short position)
      NEUTRAL: 'neutral'     // Brak wystarczających danych
    };
  }

  /**
   * Analizuje aktualny trend na podstawie EMA
   */
  getCurrentTrend(ema12, ema25) {
    if (!ema12 || !ema25) return this.trends.NEUTRAL;
    
    if (ema12 > ema25) return this.trends.BULLISH;
    if (ema12 < ema25) return this.trends.BEARISH;
    return this.trends.NEUTRAL;
  }

  /**
   * Sprawdza siłę trendu na podstawie odległości EMA
   */
  getTrendStrength(ema12, ema25, price) {
    if (!ema12 || !ema25) return { strength: 'unknown', percentage: 0 };
    
    const distance = Math.abs(ema12 - ema25);
    const pricePercentage = (distance / price) * 100;
    
    let strength;
    if (pricePercentage > 2.0) strength = 'strong';
    else if (pricePercentage > 0.5) strength = 'moderate';
    else strength = 'weak';
    
    return {
      strength,
      percentage: pricePercentage,
      distance
    };
  }
}

// Dodaj do głównej klasy SolanaScanner
export class EnhancedSolanaScanner {
  constructor() {
    this.baseUrl = process.env.COINBASE_API_BASE_URL || 'https://api.exchange.coinbase.com';
    this.symbol = 'SOL-USD';
    this.ema12Period = 12;
    this.ema25Period = 25;
    this.scanInterval = 15 * 60 * 1000;
    this.historicalDataPoints = 100;
    this.trendAnalyzer = new EMATrendAnalyzer();
  }

  // [Poprzednie metody pozostają bez zmian...]

  /**
   * Pobiera historię sygnałów z analizą trendów
   */
  async getSignalHistory(limit = 50) {
    try {
      const { supabase } = await import('./supabase.js');
      
      const { data, error } = await supabase
        .from('ema_signals')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching signal history:', error);
        return [];
      }

      return this.analyzeSignalHistory(data.reverse()); // Chronologicznie
    } catch (error) {
      console.error('Error in getSignalHistory:', error);
      return [];
    }
  }

  /**
   * Analizuje historię sygnałów i dodaje informacje o trendach
   */
  analyzeSignalHistory(signals) {
    const analyzedSignals = [];
    let currentTrend = 'neutral';
    let trendStartTime = null;
    let trendStartPrice = null;

    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i];
      const previousTrend = currentTrend;
      
      // Aktualizuj aktualny trend
      currentTrend = signal.signal_type;
      
      // Oblicz czas trwania poprzedniego trendu
      let trendDuration = null;
      let trendPriceChange = null;
      let trendPercentageChange = null;
      
      if (trendStartTime && trendStartPrice) {
        const duration = new Date(signal.timestamp) - new Date(trendStartTime);
        trendDuration = Math.round(duration / (1000 * 60)); // w minutach
        
        trendPriceChange = signal.price - trendStartPrice;
        trendPercentageChange = ((signal.price - trendStartPrice) / trendStartPrice) * 100;
      }

      const analyzedSignal = {
        ...signal,
        trend_info: {
          previous_trend: previousTrend,
          new_trend: currentTrend,
          trend_duration_minutes: trendDuration,
          trend_price_change: trendPriceChange,
          trend_percentage_change: trendPercentageChange,
          is_trend_reversal: previousTrend !== 'neutral' && previousTrend !== currentTrend,
          signal_strength: this.trendAnalyzer.getTrendStrength(
            parseFloat(signal.ema_12), 
            parseFloat(signal.ema_25), 
            parseFloat(signal.price)
          )
        }
      };

      analyzedSignals.push(analyzedSignal);
      
      // Ustaw nowy punkt startowy trendu
      trendStartTime = signal.timestamp;
      trendStartPrice = signal.price;
    }

    return analyzedSignals;
  }

  /**
   * Pobiera aktualny status trendu
   */
  async getCurrentTrendStatus() {
    try {
      const { supabase } = await import('./supabase.js');
      
      // Pobierz ostatnie dane cenowe
      const { data: latestData } = await supabase
        .from('sol_price_data')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (!latestData || !latestData.ema_12 || !latestData.ema_25) {
        return {
          current_trend: 'neutral',
          trend_since: null,
          trend_duration_minutes: 0,
          message: 'Insufficient EMA data'
        };
      }

      // Pobierz ostatni sygnał
      const { data: lastSignal } = await supabase
        .from('ema_signals')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      const ema12 = parseFloat(latestData.ema_12);
      const ema25 = parseFloat(latestData.ema_25);
      const currentTrend = this.trendAnalyzer.getCurrentTrend(ema12, ema25);
      const trendStrength = this.trendAnalyzer.getTrendStrength(ema12, ema25, parseFloat(latestData.price));

      let trendSince = null;
      let trendDuration = 0;

      if (lastSignal) {
        trendSince = lastSignal.timestamp;
        const duration = new Date(latestData.timestamp) - new Date(lastSignal.timestamp);
        trendDuration = Math.round(duration / (1000 * 60));
      }

      return {
        current_trend: currentTrend,
        trend_since: trendSince,
        trend_duration_minutes: trendDuration,
        last_crossover_signal: lastSignal?.signal_type || null,
        last_crossover_price: lastSignal?.price || null,
        last_crossover_time: lastSignal?.timestamp || null,
        current_price: parseFloat(latestData.price),
        current_ema12: ema12,
        current_ema25: ema25,
        trend_strength: trendStrength,
        price_change_since_signal: lastSignal ? 
          parseFloat(latestData.price) - parseFloat(lastSignal.price) : 0,
        percentage_change_since_signal: lastSignal ? 
          ((parseFloat(latestData.price) - parseFloat(lastSignal.price)) / parseFloat(lastSignal.price)) * 100 : 0,
        is_trend_accelerating: ema12 > ema25 ? 
          (ema12 - ema25) > 0.5 : // Bullish acceleration
          (ema25 - ema12) > 0.5    // Bearish acceleration
      };
    } catch (error) {
      console.error('Error getting current trend status:', error);
      return {
        current_trend: 'neutral',
        error: error.message
      };
    }
  }

  /**
   * Generuje sygnały tradingowe na podstawie analizy EMA
   */
  async generateTradingSignals() {
    try {
      const trendStatus = await this.getCurrentTrendStatus();
      const signalHistory = await this.getSignalHistory(10);
      
      const signals = [];

      // Analiza aktualnego trendu
      if (trendStatus.current_trend === 'bullish') {
        if (trendStatus.trend_strength.strength === 'strong') {
          signals.push({
            type: 'LONG_ENTRY',
            strength: 'HIGH',
            message: 'Strong bullish trend - Consider LONG position',
            price: trendStatus.current_price,
            ema_distance: trendStatus.trend_strength.distance,
            timestamp: new Date().toISOString()
          });
        } else if (trendStatus.trend_strength.strength === 'moderate') {
          signals.push({
            type: 'LONG_HOLD',
            strength: 'MEDIUM',
            message: 'Moderate bullish trend - Hold LONG position',
            price: trendStatus.current_price,
            timestamp: new Date().toISOString()
          });
        }
      }

      if (trendStatus.current_trend === 'bearish') {
        if (trendStatus.trend_strength.strength === 'strong') {
          signals.push({
            type: 'SHORT_ENTRY',
            strength: 'HIGH',
            message: 'Strong bearish trend - Consider SHORT position',
            price: trendStatus.current_price,
            ema_distance: trendStatus.trend_strength.distance,
            timestamp: new Date().toISOString()
          });
        } else if (trendStatus.trend_strength.strength === 'moderate') {
          signals.push({
            type: 'SHORT_HOLD',
            strength: 'MEDIUM',
            message: 'Moderate bearish trend - Hold SHORT position',
            price: trendStatus.current_price,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Sprawdź czy trend słabnie (potencjalne wyjście)
      if (trendStatus.trend_strength.strength === 'weak') {
        signals.push({
          type: 'EXIT_WARNING',
          strength: 'LOW',
          message: `Weak ${trendStatus.current_trend} trend - Consider position exit`,
          price: trendStatus.current_price,
          timestamp: new Date().toISOString()
        });
      }

      return {
        trading_signals: signals,
        trend_analysis: trendStatus,
        recent_crossovers: signalHistory.slice(-5), // 5 ostatnich przecięć
        recommendation: this.getOverallRecommendation(trendStatus, signals)
      };

    } catch (error) {
      console.error('Error generating trading signals:', error);
      return {
        trading_signals: [],
        error: error.message
      };
    }
  }

  /**
   * Generuje ogólną rekomendację
   */
  getOverallRecommendation(trendStatus, signals) {
    const strongSignals = signals.filter(s => s.strength === 'HIGH');
    
    if (strongSignals.length > 0) {
      const primarySignal = strongSignals[0];
      return {
        action: primarySignal.type,
        confidence: 'HIGH',
        message: primarySignal.message,
        current_trend: trendStatus.current_trend,
        trend_duration: `${Math.floor(trendStatus.trend_duration_minutes / 60)}h ${trendStatus.trend_duration_minutes % 60}m`
      };
    }

    return {
      action: 'HOLD',
      confidence: 'MEDIUM',
      message: `Current ${trendStatus.current_trend} trend, monitor for changes`,
      current_trend: trendStatus.current_trend,
      trend_duration: `${Math.floor(trendStatus.trend_duration_minutes / 60)}h ${trendStatus.trend_duration_minutes % 60}m`
    };
  }

  // [Pozostałe metody z poprzedniej wersji...]
  async fetchCurrentPrice() {
    try {
      const response = await fetch(`${this.baseUrl}/products/${this.symbol}/ticker`);
      if (!response.ok) throw new Error(`Coinbase API error: ${response.status}`);
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

  async fetchHistoricalData(points = null) {
    try {
      const dataPoints = points || this.historicalDataPoints;
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (dataPoints * 15 * 60);

      const response = await fetch(
        `${this.baseUrl}/products/${this.symbol}/candles?start=${startTime}&end=${endTime}&granularity=900`
      );

      if (!response.ok) throw new Error(`Coinbase historical API error: ${response.status}`);
      const data = await response.json();
      
      return data.map(candle => ({
        timestamp: new Date(candle[0] * 1000),
        price: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      })).sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('Error fetching historical data:', error);
      return [];
    }
  }

  calculateEMA(prices, period) {
    if (prices.length < period) return null;
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    return ema;
  }

  async scanPrice() {
    try {
      console.log(`🔍 Starting enhanced scan at ${new Date().toISOString()}`);
      
      const currentPriceData = await this.fetchCurrentPrice();
      console.log(`💰 Current SOL price: $${currentPriceData.price}`);

      // [Poprzednia logika skanowania...]
      // Dodaj trend analysis po obliczeniu EMA
      
      return {
        success: true,
        price: currentPriceData.price,
        timestamp: currentPriceData.timestamp
      };
    } catch (error) {
      console.error('❌ Error in scanPrice:', error);
      return { success: false, error: error.message };
    }
  }
}

export default EnhancedSolanaScanner;
