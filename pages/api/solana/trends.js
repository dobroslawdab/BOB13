import { EnhancedSolanaScanner } from '../../../lib/emaTrendAnalyzer.js';

let scannerInstance = null;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!scannerInstance) {
      scannerInstance = new EnhancedSolanaScanner();
    }

    const { action } = req.query;

    switch (action) {
      case 'trend-status':
        const trendStatus = await scannerInstance.getCurrentTrendStatus();
        return res.status(200).json(trendStatus);

      case 'signal-history':
        const limit = parseInt(req.query.limit) || 20;
        const signalHistory = await scannerInstance.getSignalHistory(limit);
        return res.status(200).json(signalHistory);

      case 'trading-signals':
        const tradingSignals = await scannerInstance.generateTradingSignals();
        return res.status(200).json(tradingSignals);

      default:
        return res.status(400).json({ error: 'Invalid action. Use: trend-status, signal-history, or trading-signals' });
    }

  } catch (error) {
    console.error('Trend API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
}
