-- Migration: 002_create_users_and_profiles
-- Purpose: Create users and provider profile tables with language preference and cascade rules.

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    role user_role NOT NULL DEFAULT 'customer',
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'hi',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    category_id VARCHAR(50), -- Foreign key linked in migration 003
    service_area VARCHAR(100) NOT NULL DEFAULT 'Chandil',
    is_available BOOLEAN NOT NULL DEFAULT true,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
