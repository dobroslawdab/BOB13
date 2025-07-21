import SolanaScanner from '../../../lib/solanaScanner.js';

// Globalny scanner instance (w produkcji lepiej użyć Redis lub DB)
let scannerInstance = null;
let scannerIntervalId = null;

export default async function handler(req, res) {
  // Zezwalamy tylko na POST i GET
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Inicjalizuj scanner jeśli nie istnieje
    if (!scannerInstance) {
      scannerInstance = new SolanaScanner();
    }

    // GET - pobierz status i statystyki
    if (req.method === 'GET') {
      const { action } = req.query;

      switch (action) {
        case 'status':
          return res.status(200).json({
            status: scannerIntervalId ? 'running' : 'stopped',
            message: scannerIntervalId ? 'Scanner is active' : 'Scanner is not running'
          });

        case 'stats':
          const stats = await scannerInstance.getStats();
          return res.status(200).json(stats);

        case 'signals':
          const limit = parseInt(req.query.limit) || 10;
          const signals = await scannerInstance.getRecentSignals(limit);
          return res.status(200).json(signals);

        case 'scan-now':
          // Jednorazowe skanowanie
          const result = await scannerInstance.scanPrice();
          return res.status(200).json(result);

        default:
          return res.status(400).json({ error: 'Invalid action parameter' });
      }
    }

    // POST - sterowanie skanerem
    if (req.method === 'POST') {
      const { action } = req.body;

      switch (action) {
        case 'start':
          if (scannerIntervalId) {
            return res.status(400).json({ 
              error: 'Scanner is already running',
              status: 'running'
            });
          }

          scannerIntervalId = scannerInstance.startScanning();
          return res.status(200).json({
            message: 'Scanner started successfully',
            status: 'running'
          });

        case 'stop':
          if (!scannerIntervalId) {
            return res.status(400).json({ 
              error: 'Scanner is not running',
              status: 'stopped'
            });
          }

          scannerInstance.stopScanning(scannerIntervalId);
          scannerIntervalId = null;
          return res.status(200).json({
            message: 'Scanner stopped successfully',
            status: 'stopped'
          });

        case 'restart':
          // Zatrzymaj jeśli działa
          if (scannerIntervalId) {
            scannerInstance.stopScanning(scannerIntervalId);
            scannerIntervalId = null;
          }

          // Uruchom ponownie
          scannerIntervalId = scannerInstance.startScanning();
          return res.status(200).json({
            message: 'Scanner restarted successfully',
            status: 'running'
          });

        case 'scan-once':
          // Jednorazowe skanowanie bez uruchamiania cyklu
          const scanResult = await scannerInstance.scanPrice();
          return res.status(200).json({
            message: 'Manual scan completed',
            result: scanResult
          });

        default:
          return res.status(400).json({ error: 'Invalid action' });
      }
    }

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
}

// Automatyczne uruchomienie skanera przy starcie serwera (opcjonalne)
// Odkomentuj poniższą linię jeśli chcesz automatycznie uruchamiać skaner
// if (!scannerIntervalId && !global._scannerAutoStarted) {
//   scannerInstance = new SolanaScanner();
//   scannerIntervalId = scannerInstance.startScanning();
//   global._scannerAutoStarted = true;
//   console.log('🚀 Auto-started Solana scanner');
// }
