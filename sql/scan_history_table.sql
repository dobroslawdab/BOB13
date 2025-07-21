-- Tabela dla historii skanów
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

-- Indeks dla wydajności
CREATE INDEX IF NOT EXISTS idx_scan_history_timestamp ON scan_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_scan_history_type ON scan_history(scan_type);
CREATE INDEX IF NOT EXISTS idx_scan_history_status ON scan_history(status);

-- RLS
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users scan_history" ON scan_history
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users scan_history" ON scan_history
    FOR INSERT WITH CHECK (true);
