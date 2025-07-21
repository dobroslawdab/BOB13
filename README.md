# 🚀 Enhanced BOB13 Solana Scanner

Zaawansowany system skanowania Solana z wykrywaniem sygnałów EMA, powiadomieniami webhook i trwałym statusem.

## ✨ Nowe Funkcje

### 🔄 Trwały Status Skanera
- ✅ Status skanera nie ginie po odświeżeniu strony
- ⏰ Licznik do następnego skanu
- 📊 Szczegółowe informacje o ostatnich skanach
- 🔄 Automatyczne przywracanie statusu

### 🔗 System Webhooks
- 🚨 Automatyczne powiadomienia o crossoverach EMA
- 📡 Szczegółowy payload z analizą techniczną
- 🔒 Bezpieczne logowanie odpowiedzi webhook
- ⚡ Natychmiastowe powiadomienia o sygnałach

### 📈 Zaawansowana Analiza Sygnałów
- 🎯 Wykrywanie crossoverów EMA12/EMA25
- 📊 Historia wszystkich sygnałów
- 🔍 Filtrowanie według typu i czasu
- 📈 Statystyki i metryki wydajności

### 🎛️ Enhanced Dashboard
- 📱 Responsywny interfejs
- 🔄 Auto-refresh co 10 sekund
- 🎨 Nowoczesny design z Tailwind CSS
- 📊 Real-time monitoring

## 🏗️ Architektura Systemu

### 📁 Struktura Plików

```
BOB13/
├── lib/
│   ├── solanaScanner.js        # Enhanced scanner z webhooks
│   └── supabase.js            # Konfiguracja bazy danych
├── pages/
│   ├── api/scanner/
│   │   ├── control.js         # Start/Stop skanera
│   │   ├── status.js          # Kompleksowy status
│   │   ├── signals.js         # Historia sygnałów EMA
│   │   └── history.js         # Historia skanowania
│   ├── enhanced-scanner.js    # Nowy dashboard
│   └── scanner.js            # Oryginalny dashboard
```

### 🗄️ Schema Bazy Danych

#### `scan_history` - Historia skanowania
```sql
- id: SERIAL PRIMARY KEY
- scan_type: TEXT (manual/automatic/scanner_status_update)
- timestamp: TIMESTAMPTZ
- status: TEXT (success/error/running/stopped)
- total_scanned: INTEGER
- candidates_found: INTEGER
- alerts_sent: INTEGER
- duration_ms: INTEGER
- details: JSONB (szczegółowe dane skanu)
```

#### `ema_signals` - Sygnały EMA
```sql
- id: SERIAL PRIMARY KEY
- timestamp: TIMESTAMPTZ
- signal_type: TEXT (bullish/bearish)
- price: DECIMAL
- ema_12: DECIMAL
- ema_25: DECIMAL
- previous_ema_12: DECIMAL
- previous_ema_25: DECIMAL
- scan_type: TEXT
```

#### `webhook_responses` - Logi webhook
```sql
- id: SERIAL PRIMARY KEY
- webhook_url: TEXT
- payload: JSONB
- response_status: INTEGER
- response_body: TEXT
- timestamp: TIMESTAMPTZ
```

## 🚀 API Endpoints

### 📊 `/api/scanner/status` (GET)
Zwraca kompletny status skanera z metrykami.

**Response:**
```json
{
  "success": true,
  "data": {
    "scanner": {
      "isRunning": true,
      "status": "running",
      "scanCount": 42,
      "scanInterval": 900000
    },
    "timing": {
      "timeToNextScan": 300000,
      "nextScanCountdown": "5m 0s"
    },
    "signals": {
      "hasActiveSignal": false,
      "recentCount": 3
    },
    "market": {
      "latestPrice": 98.45,
      "ema12": 98.12,
      "ema25": 97.89
    },
    "health": {
      "lastResponseTime": 145,
      "dataHealth": {
        "priceDataAvailable": true,
        "emaCalculationReady": true
      }
    }
  }
}
```

### 🎛️ `/api/scanner/control` (POST)
Kontrola skanera (start/stop) z konfiguracją webhook.

**Request:**
```json
{
  "action": "start",
  "webhookUrl": "https://your-webhook.com/solana-signals"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "action": "started",
    "message": "Scanner started successfully with enhanced features",
    "webhookConfigured": true,
    "features": {
      "persistentStatus": true,
      "webhookNotifications": true,
      "signalTracking": true
    }
  }
}
```

### 📈 `/api/scanner/signals` (GET)
Historia sygnałów EMA z filtrami i statystykami.

**Query Parameters:**
- `limit`: Liczba sygnałów (default: 20, max: 100)
- `type`: Typ sygnału (bullish/bearish)
- `days`: Liczba dni wstecz (default: 7, max: 30)
- `includeStats`: Czy dołączyć statystyki (true/false)

**Response:**
```json
{
  "success": true,
  "data": {
    "currentStatus": {
      "hasActiveSignal": false,
      "message": "No active signals"
    },
    "signals": [
      {
        "id": 123,
        "type": "bullish",
        "price": 98.45,
        "ema12": 98.12,
        "ema25": 97.89,
        "crossoverStrength": "0.0023",
        "age": {
          "humanReadable": "2h ago"
        }
      }
    ],
    "statistics": {
      "totalSignals": 15,
      "bullishCount": 8,
      "bearishCount": 7,
      "signalRatio": {
        "bullishPercent": 53,
        "bearishPercent": 47
      }
    }
  }
}
```

### 📊 `/api/scanner/history` (GET)
Historia skanowania z analityką.

**Query Parameters:**
- `limit`: Liczba rekordów (default: 50, max: 200)
- `status`: Status skanu (success/error)
- `type`: Typ skanu (manual/automatic)
- `days`: Liczba dni wstecz (default: 7, max: 30)
- `includeAnalytics`: Czy dołączyć analitykę (true/false)

## 🔗 Webhook System

### 📡 Payload Webhook
```json
{
  "event": "ema_crossover_detected",
  "timestamp": "2024-01-15T10:30:00Z",
  "symbol": "SOL-USD",
  "signal": {
    "type": "bullish",
    "direction": "BUY",
    "confidence": "CONFIRMED"
  },
  "price": {
    "current": 98.45,
    "volume_24h": 2891234
  },
  "technical_analysis": {
    "ema_12": 98.12,
    "ema_25": 97.89,
    "previous_ema_12": 97.98,
    "previous_ema_25": 98.01,
    "crossover_strength": "0.0023"
  },
  "context": {
    "scan_type": "automatic",
    "data_points_used": 87,
    "api_response_time_ms": 234
  },
  "next_action": {
    "suggested": "ANALYZE_FOR_ENTRY",
    "webhook_id": "sol_1642248600000_bullish"
  }
}
```

### 🔧 Konfiguracja Webhook
1. Przejdź do Enhanced Scanner Dashboard
2. Kliknij "Configure Webhook"
3. Wpisz URL swojego endpointu
4. Uruchom skaner

## 🎯 Jak Używać

### 1. 🚀 Uruchomienie Skanera
```bash
# Przejdź do Enhanced Dashboard
http://localhost:3000/enhanced-scanner

# Lub użyj API
curl -X POST http://localhost:3000/api/scanner/control \
  -H "Content-Type: application/json" \
  -d '{"action":"start","webhookUrl":"https://your-webhook.com"}'
```

### 2. 📊 Monitorowanie
- Dashboard odświeża się automatycznie co 10 sekund
- Real-time countdown do następnego skanu
- Live status wszystkich komponentów

### 3. 🔍 Analiza Sygnałów
- Sprawdź najnowsze sygnały EMA
- Filtruj według typu (bullish/bearish)
- Analizuj statystyki wydajności

### 4. ⚙️ Konfiguracja
```javascript
// Zmiana interwału skanowania (w konstruktorze SolanaScanner)
this.scanInterval = 15 * 60 * 1000; // 15 minut

// Zmiana okresów EMA
this.ema12Period = 12;
this.ema25Period = 25;

// Konfiguracja webhook
this.webhookUrl = process.env.WEBHOOK_URL;
```

## 🔧 Zmienne Środowiskowe

```bash
# .env.local
WEBHOOK_URL=https://your-webhook-endpoint.com/solana-signals
COINBASE_API_BASE_URL=https://api.exchange.coinbase.com
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
```

## 📈 Metryki i Monitoring

### 🎯 KPI Skanera
- **Uptime**: Czas działania skanera
- **Scan Success Rate**: % udanych skanów
- **Signal Detection Rate**: % skanów z wykrytymi sygnałami
- **Webhook Success Rate**: % udanych powiadomień
- **API Response Time**: Średni czas odpowiedzi Coinbase

### 📊 Analityka Sygnałów
- Stosunek sygnałów bullish/bearish
- Średni czas między sygnałami
- Performance po sygnałach
- Analiza zakresów cenowych

## 🚨 Troubleshooting

### ❌ Częste Problemy

1. **Skaner się nie uruchamia**
   ```bash
   # Sprawdź logi
   curl http://localhost:3000/api/scanner/status
   
   # Sprawdź połączenie z bazą
   curl http://localhost:3000/api/scanner/history?limit=1
   ```

2. **Brak sygnałów EMA**
   - Upewnij się, że masz ≥25 punktów danych
   - Sprawdź czy API Coinbase działa
   - Zweryfikuj kalkulacje EMA

3. **Webhook nie działa**
   ```bash
   # Sprawdź logi webhook
   SELECT * FROM webhook_responses ORDER BY timestamp DESC LIMIT 5;
   
   # Test endpointu
   curl -X POST your-webhook-url -H "Content-Type: application/json" -d '{}'
   ```

4. **Status się resetuje**
   - Sprawdź tabele scan_history
   - Zweryfikuj persistent status functions

### 🔍 Debug Mode
```javascript
// Włącz szczegółowe logi
console.log('🔍 Debug mode enabled');

// Sprawdź status w czasie rzeczywistym
setInterval(async () => {
  const status = await scanner.getScannerStatus();
  console.log('Current status:', status);
}, 5000);
```

## 🔄 Updates i Migracje

### 📝 Changelog v2.0
- ✅ Persistent scanner status
- ✅ Webhook notifications
- ✅ Enhanced dashboard
- ✅ Signal analytics
- ✅ Performance metrics
- ✅ Error handling improvements

### 🔄 Migration Guide
Jeśli aktualizujesz z v1.0:

1. **Aktualizuj tabele bazy danych**
   ```sql
   -- Dodaj kolumny do istniejących tabel jeśli potrzeba
   ALTER TABLE scan_history ADD COLUMN IF NOT EXISTS details JSONB;
   ```

2. **Zaktualizuj enviroment variables**
   ```bash
   echo "WEBHOOK_URL=your-webhook-url" >> .env.local
   ```

3. **Przetestuj nowy system**
   ```bash
   npm run dev
   # Przejdź do /enhanced-scanner
   ```

## 🤝 Contributing

1. Fork projektu
2. Stwórz feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push branch (`git push origin feature/AmazingFeature`)
5. Otwórz Pull Request

## 📄 License

Ten projekt jest licencjonowany pod MIT License.

## 🙏 Acknowledgments

- [Coinbase Pro API](https://docs.pro.coinbase.com/) - Market data
- [Supabase](https://supabase.com/) - Database backend
- [Tailwind CSS](https://tailwindcss.com/) - UI styling
- [Lucide React](https://lucide.dev/) - Icons

---

**BOB13 Enhanced Solana Scanner** - Professional crypto signal detection with webhooks and persistent monitoring! 🚀