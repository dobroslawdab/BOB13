# BOB13 - Solana Scanner

🔍 Zaawansowany skaner ceny Solana z analizą techniczną EMA i integracją z Supabase

## ✨ Funkcje

- 🔄 **Automatyczne skanowanie** ceny SOL/USD co 15 minut
- 📈 **Analiza EMA** - obliczanie EMA 12 i EMA 25
- 🎯 **Detekcja sygnałów** - wykrywanie przecięć bullish/bearish
- 💾 **Zapis w bazie wektorowej** - wszystkie dane w Supabase
- 🎛️ **Dashboard kontroli** - interfejs do zarządzania skanerem
- 📊 **Statystyki w czasie rzeczywistym** - monitoring sygnałów
- 🌐 **Next.js + React** - nowoczesny stack technologiczny

## 🚀 Demo

- **Homepage**: Przegląd funkcji i specyfikacji
- **Dashboard**: `/dashboard` - kontrola skanera i monitorowanie

## 🏗️ Architektura

```
BOB13/
├── lib/
│   ├── supabase.js          # Klient Supabase + helpery
│   └── solanaScanner.js     # Główny skaner z analizą EMA
├── pages/
│   ├── index.js             # Strona główna
│   ├── dashboard.js         # Dashboard monitorowania
│   ├── _app.js              # Konfiguracja Next.js
│   └── api/
│       └── solana/
│           └── scanner.js   # API kontroli skanera
├── styles/
│   └── globals.css          # Style Tailwind CSS
├── types/
│   └── supabase.ts          # Typy TypeScript
└── [konfiguracja]
```

## 🔧 Instalacja

1. **Sklonuj repozytorium:**
```bash
git clone https://github.com/dobroslawdab/BOB13.git
cd BOB13
```

2. **Zainstaluj zależności:**
```bash
npm install
```

3. **Konfiguracja bazy danych:**
Przed uruchomieniem należy utworzyć tabele w Supabase:

```sql
-- Tabela dla danych cenowych SOL/USD
CREATE TABLE sol_price_data (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    price DECIMAL(18, 8) NOT NULL,
    volume DECIMAL(18, 8),
    ema_12 DECIMAL(18, 8),
    ema_25 DECIMAL(18, 8),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela dla sygnałów przecięć EMA
CREATE TABLE ema_signals (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    signal_type VARCHAR(10) NOT NULL CHECK (signal_type IN ('bullish', 'bearish')),
    price DECIMAL(18, 8) NOT NULL,
    ema_12 DECIMAL(18, 8) NOT NULL,
    ema_25 DECIMAL(18, 8) NOT NULL,
    previous_ema_12 DECIMAL(18, 8),
    previous_ema_25 DECIMAL(18, 8),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy dla wydajności
CREATE INDEX idx_sol_price_timestamp ON sol_price_data(timestamp DESC);
CREATE INDEX idx_ema_signals_timestamp ON ema_signals(timestamp DESC);
CREATE INDEX idx_ema_signals_type ON ema_signals(signal_type);
```

4. **Konfiguruj zmienne środowiskowe:**
Skopiuj i dostosuj plik `.env.local`:
```bash
cp .env.example .env.local
```

5. **Uruchom aplikację:**
```bash
npm run dev
```

## 🎛️ Użycie

### Dashboard

Otwórz `/dashboard` aby:

- ▶️ **Uruchomić skaner** - automatyczne skanowanie co 15 minut
- ⏹️ **Zatrzymać skaner** - wstrzymanie monitorowania
- 🔄 **Restart** - restartowanie procesu skanowania
- 🔍 **Scan Once** - jednorazowe skanowanie
- 📊 **Podgląd statystyk** - aktualna cena, EMA, sygnały
- 📈 **Historia sygnałów** - tabela ostatnich przecięć

### API Endpoints

**GET `/api/solana/scanner`**
- `?action=status` - status skanera
- `?action=stats` - statystyki
- `?action=signals&limit=20` - ostatnie sygnały
- `?action=scan-now` - jednorazowe skanowanie

**POST `/api/solana/scanner`**
```json
{
  "action": "start|stop|restart|scan-once"
}
```

## 📊 Jak to działa

### 1. Pobieranie danych
- Skaner łączy się z Coinbase Pro API co 15 minut
- Pobiera aktualne dane cenowe dla pary SOL/USD
- Zapisuje cenę, wolumen i timestamp

### 2. Analiza techniczna
```javascript
// Obliczanie EMA
EMA = (Cena × Multiplier) + (EMA_poprzednia × (1 - Multiplier))
// gdzie Multiplier = 2 / (Okres + 1)

// EMA 12: szybka średnia (12 okresów)
// EMA 25: wolna średnia (25 okresów)
```

### 3. Detekcja sygnałów
- **Bullish crossover**: EMA12 przecina EMA25 od dołu (sygnał kupna)
- **Bearish crossover**: EMA12 przecina EMA25 od góry (sygnał sprzedaży)

### 4. Zapis w bazie
- Wszystkie dane cenowe → `sol_price_data`
- Sygnały przecięć → `ema_signals`
- Wykorzystanie bazy wektorowej Supabase dla wydajności

## 🔌 Integracje

### Coinbase Pro API
- Endpoint: `https://api.exchange.coinbase.com`
- Dane: SOL/USD ticker + dane historyczne
- Interwał: 15 minut (900 sekund)
- Format: REST API, JSON response

### Supabase
- **URL projektu**: `https://qxjudardrlbxqxlvpdvl.supabase.co`
- **Funkcje**: Real-time DB, Auth, API auto-gen
- **RLS**: Row Level Security włączone
- **Typy**: Auto-generowane TypeScript types

## 📈 Metryki

- **Częstotliwość**: Skanowanie co 15 minut
- **Okresy EMA**: 12 (krótki), 25 (długi)
- **Dokładność ceny**: 8 miejsc po przecinku
- **Retencja danych**: Bez limitu (Supabase)
- **API Response**: < 2 sekundy

## 🛠️ Stack technologiczny

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Baza danych**: Supabase (PostgreSQL + Vector)
- **API**: Coinbase Pro REST API
- **Język**: JavaScript/TypeScript
- **Hosting**: Vercel/Netlify ready
- **Dev tools**: ESLint, Prettier

## 📱 Responsywność

Dashboard w pełni responsywny:
- 📱 **Mobile**: Optymalizacja dla urządzeń mobilnych
- 💻 **Desktop**: Pełna funkcjonalność na dużych ekranach
- 📊 **Tabela**: Przewijanie poziome na małych ekranach

## 🔒 Bezpieczeństwo

- ✅ **RLS**: Row Level Security w Supabase
- 🔑 **API Keys**: Bezpieczne zarządzanie kluczami
- 🚫 **Rate limiting**: Ochrona przed spam'em
- 🔍 **Validation**: Walidacja wszystkich inputów
- 📝 **Logs**: Szczegółowe logowanie zdarzeń

## 📚 Rozwój

### Planowane funkcje:
- 📧 **Powiadomienia** email/SMS przy sygnałach
- 📊 **Więcej wskaźników** (RSI, MACD, Bollinger Bands)
- 🎯 **Backtesting** - testowanie strategii na danych historycznych
- 🤖 **Machine Learning** - predykcja cen
- 💹 **Więcej par** - ETH/USD, BTC/USD, etc.
- 📈 **Wykresy** - wizualizacja cen i EMA

### Contributing:
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 Licencja

MIT License - szczegóły w pliku LICENSE

## 🤝 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/dobroslawdab/BOB13/issues)
- 📧 **Email**: support@example.com
- 💬 **Discord**: [Dołącz do serwera](https://discord.gg/example)

---

**Autor**: [@dobroslawdab](https://github.com/dobroslawdab)  
**Status**: 🟢 Active Development  
**Wersja**: 1.0.0

⭐ Jeśli projekt Ci się podoba, zostaw gwiazdkę na GitHubie!