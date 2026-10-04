-- Migration: 008_create_passkey_auth
-- Purpose: Introduce WebAuthn/FIDO2 passkey credentials, challenges, and recovery codes schema. Drop obsolete otp_requests table.

-- 1. Ensure token_version exists on users table for session revocation
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'token_version'
    ) THEN
        ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 1;
    END IF;
END $$;

-- 2. Create user_credentials table for FIDO2 WebAuthn public key credentials
CREATE TABLE IF NOT EXISTS user_credentials (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id VARCHAR(255) NOT NULL UNIQUE,
    public_key BYTEA NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    device_type VARCHAR(32) NOT NULL DEFAULT 'single_device',
    backed_up BOOLEAN NOT NULL DEFAULT FALSE,
    transports VARCHAR(32)[] DEFAULT ARRAY['internal'],
    friendly_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_cred_id ON user_credentials(credential_id);

-- 3. Create webauthn_challenges table for ephemeral ceremony nonces
CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id BIGSERIAL PRIMARY KEY,
    challenge VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(15),
    flow_type VARCHAR(32) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_lookup ON webauthn_challenges(challenge);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires ON webauthn_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user_id ON webauthn_challenges(user_id);

-- 4. Create user_recovery_codes table for emergency account recovery
CREATE TABLE IF NOT EXISTS user_recovery_codes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(64) NOT NULL,
    salt VARCHAR(32) NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_recovery_codes_user_id ON user_recovery_codes(user_id);

-- 5. Drop obsolete otp_requests table and its associated indexes
DROP TABLE IF EXISTS otp_requests CASCADE;
