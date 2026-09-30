-- Migration: 005_create_app_configs
-- Purpose: System configuration key-value store for support contacts and operational variables.

CREATE TABLE IF NOT EXISTS app_configs (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
