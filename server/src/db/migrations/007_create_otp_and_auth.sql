-- Migration: 007_create_otp_and_auth
-- Purpose: Add token_version to users for session revocation, and create secure otp_requests table.

-- 1. Add token_version to users table if not exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'token_version'
    ) THEN
        ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 1;
    END IF;
END $$;

-- 2. Create otp_requests table for secure, non-plaintext OTP management
CREATE TABLE IF NOT EXISTS otp_requests (
    id BIGSERIAL PRIMARY KEY,
    phone VARCHAR(15) NOT NULL,
    otp_hash VARCHAR(64) NOT NULL,
    salt VARCHAR(32) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for rate-limiting, lookup, and periodic cleanup
CREATE INDEX IF NOT EXISTS idx_otp_requests_phone_created ON otp_requests(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_requests_expires ON otp_requests(expires_at);
