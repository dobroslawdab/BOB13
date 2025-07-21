-- ===========================================
-- BOB13 SOLANA SCANNER - COMPLETE DATABASE SETUP
-- ===========================================
-- Skopiuj i wklej cały ten kod do Supabase SQL Editor
-- ===========================================

-- 1. TABELA DANYCH CENOWYCH SOL/USD
CREATE TABLE IF NOT EXISTS sol_price_data (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    price DECIMAL(18, 8) NOT NULL,
    volume DECIMAL(18, 8),
    ema_12 DECIMAL(18, 8),
    ema_25 DECIMAL(18, 8),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA SYGNAŁÓW EMA CROSSOVER
CREATE TABLE IF NOT EXISTS ema_signals (
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

-- 3. NOWA TABELA: HISTORIA SKANÓW (manual + automatic)
CREATE TABLE IF NOT EXISTS scan_history (
    id SERIAL PRIMARY KEY,
    scan_type VARCHAR(20) NOT NULL CHECK (scan_type IN ('manual', 'automatic')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(10) NOT NULL CHECK (status IN ('success', 'error')),
    price DECIMAL(18, 8),
    volume DECIMAL(18, 8),
    ema_12 DECIMAL(18, 8),
    ema_25 DECIMAL(18, 8),
    crossover_detected VARCHAR(10) CHECK (crossover_detected IN ('bullish', 'bearish', null)),
    data_points INTEGER,
    historical_count INTEGER,
    stored_count INTEGER,
    error_message TEXT,
    execution_time_ms INTEGER,
    api_response_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- INDEKSY DLA WYDAJNOŚCI
-- ===========================================

-- Indeksy dla sol_price_data
CREATE INDEX IF NOT EXISTS idx_sol_price_timestamp ON sol_price_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sol_price_created_at ON sol_price_data(created_at DESC);

-- Indeksy dla ema_signals
CREATE INDEX IF NOT EXISTS idx_ema_signals_timestamp ON ema_signals(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ema_signals_type ON ema_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_ema_signals_created_at ON ema_signals(created_at DESC);

-- Indeksy dla scan_history
CREATE INDEX IF NOT EXISTS idx_scan_history_timestamp ON scan_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_scan_history_type ON scan_history(scan_type);
CREATE INDEX IF NOT EXISTS idx_scan_history_status ON scan_history(status);
CREATE INDEX IF NOT EXISTS idx_scan_history_created_at ON scan_history(created_at DESC);

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Włącz RLS dla wszystkich tabel
ALTER TABLE sol_price_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE ema_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- POLITYKI RLS - DOSTĘP DO ODCZYTU (publiczny)
-- ===========================================

-- Polityki odczytu dla sol_price_data
DROP POLICY IF EXISTS "Enable read access for all users" ON sol_price_data;
CREATE POLICY "Enable read access for all users" ON sol_price_data
    FOR SELECT USING (true);

-- Polityki odczytu dla ema_signals
DROP POLICY IF EXISTS "Enable read access for all users ema" ON ema_signals;
CREATE POLICY "Enable read access for all users ema" ON ema_signals  
    FOR SELECT USING (true);

-- Polityki odczytu dla scan_history
DROP POLICY IF EXISTS "Enable read access for all users scan_history" ON scan_history;
CREATE POLICY "Enable read access for all users scan_history" ON scan_history
    FOR SELECT USING (true);

-- ===========================================
-- POLITYKI RLS - DOSTĘP DO ZAPISU (dla aplikacji)
-- ===========================================

-- Polityki zapisu dla sol_price_data
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON sol_price_data;
CREATE POLICY "Enable insert for authenticated users" ON sol_price_data
    FOR INSERT WITH CHECK (true);

-- Polityki zapisu dla ema_signals
DROP POLICY IF EXISTS "Enable insert for authenticated users ema" ON ema_signals;
CREATE POLICY "Enable insert for authenticated users ema" ON ema_signals
    FOR INSERT WITH CHECK (true);

-- Polityki zapisu dla scan_history
DROP POLICY IF EXISTS "Enable insert for authenticated users scan_history" ON scan_history;
CREATE POLICY "Enable insert for authenticated users scan_history" ON scan_history
    FOR INSERT WITH CHECK (true);

-- ===========================================
-- FUNKCJE POMOCNICZE (opcjonalne)
-- ===========================================

-- Funkcja do czyszczenia starych danych (starszych niż 30 dni)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Usuń stare dane cenowe (starsze niż 30 dni)
    DELETE FROM sol_price_data 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Usuń starą historię skanów (starsza niż 7 dni)
    DELETE FROM scan_history 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Zachowaj wszystkie sygnały EMA (ważne dla analizy)
END;
$$ LANGUAGE plpgsql;

-- Funkcja do pobrania statystyk skanowania
CREATE OR REPLACE FUNCTION get_scan_stats()
RETURNS TABLE(
    total_scans bigint,
    successful_scans bigint,
    failed_scans bigint,
    manual_scans bigint,
    automatic_scans bigint,
    avg_execution_time_ms numeric,
    last_scan_time timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_scans,
        COUNT(*) FILTER (WHERE status = 'success') as successful_scans,
        COUNT(*) FILTER (WHERE status = 'error') as failed_scans,
        COUNT(*) FILTER (WHERE scan_type = 'manual') as manual_scans,
        COUNT(*) FILTER (WHERE scan_type = 'automatic') as automatic_scans,
        AVG(execution_time_ms) as avg_execution_time_ms,
        MAX(timestamp) as last_scan_time
    FROM scan_history;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TRIGGER DLA AUTOMATYCZNEGO UPDATED_AT (opcjonalny)
-- ===========================================

-- Funkcja do aktualizacji timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Dodaj kolumnę updated_at do głównych tabel (opcjonalnie)
-- ALTER TABLE sol_price_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- ALTER TABLE ema_signals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ===========================================
-- PRZYKŁADOWE ZAPYTANIA TESTOWE
-- ===========================================

-- Sprawdź czy tabele zostały utworzone
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE tablename IN ('sol_price_data', 'ema_signals', 'scan_history')
ORDER BY tablename;

-- Sprawdź indeksy
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('sol_price_data', 'ema_signals', 'scan_history')
ORDER BY tablename, indexname;

-- Sprawdź polityki RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('sol_price_data', 'ema_signals', 'scan_history')
ORDER BY tablename, policyname;

-- ===========================================
-- GOTOWE! 
-- ===========================================
-- Po wykonaniu tego SQL-a wszystkie tabele będą gotowe
-- i scanner będzie mógł zapisywać dane oraz historię skanów
-- ===========================================

-- Sprawdź ostateczny status tabel
SELECT 
    t.table_name,
    t.table_type,
    CASE 
        WHEN rls.rlsname IS NOT NULL THEN 'RLS Enabled'
        ELSE 'RLS Disabled'
    END as rls_status
FROM information_schema.tables t
LEFT JOIN (
    SELECT 
        schemaname || '.' || tablename as rlsname
    FROM pg_tables 
    WHERE rowsecurity = true
) rls ON rls.rlsname = t.table_schema || '.' || t.table_name
WHERE t.table_schema = 'public' 
AND t.table_name IN ('sol_price_data', 'ema_signals', 'scan_history')
ORDER BY t.table_name;
