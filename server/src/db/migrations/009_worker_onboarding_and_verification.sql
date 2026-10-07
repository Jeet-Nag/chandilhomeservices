-- Migration: 009_worker_onboarding_and_verification
-- Purpose: Add verification status, document storage (Aadhaar front, Aadhaar back, photo), and audit timestamps to provider_profiles.

-- 1. Add verification_status column with default 'PENDING_VERIFICATION'
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'provider_profiles' AND column_name = 'verification_status'
    ) THEN
        ALTER TABLE provider_profiles 
        ADD COLUMN verification_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_VERIFICATION';
    END IF;
END $$;

-- 2. Ensure all existing provider profiles (previously created by admin/seeds) are marked 'VERIFIED'
UPDATE provider_profiles 
SET verification_status = 'VERIFIED'
WHERE verification_status = 'PENDING_VERIFICATION' 
  AND user_id IN (SELECT id FROM users WHERE role = 'provider');

-- 3. Add document storage columns (Aadhaar front, Aadhaar back, Worker photo)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'provider_profiles' AND column_name = 'aadhaar_front_data'
    ) THEN
        ALTER TABLE provider_profiles ADD COLUMN aadhaar_front_data BYTEA;
        ALTER TABLE provider_profiles ADD COLUMN aadhaar_front_mime VARCHAR(50);
        ALTER TABLE provider_profiles ADD COLUMN aadhaar_back_data BYTEA;
        ALTER TABLE provider_profiles ADD COLUMN aadhaar_back_mime VARCHAR(50);
        ALTER TABLE provider_profiles ADD COLUMN photo_data BYTEA;
        ALTER TABLE provider_profiles ADD COLUMN photo_mime VARCHAR(50);
    END IF;
END $$;

-- 4. Add timestamps & audit columns
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'provider_profiles' AND column_name = 'submitted_at'
    ) THEN
        ALTER TABLE provider_profiles ADD COLUMN submitted_at TIMESTAMPTZ;
        ALTER TABLE provider_profiles ADD COLUMN verified_at TIMESTAMPTZ;
        ALTER TABLE provider_profiles ADD COLUMN verified_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_provider_profiles_verification_status 
ON provider_profiles(verification_status);

CREATE INDEX IF NOT EXISTS idx_provider_profiles_category_id 
ON provider_profiles(category_id);
