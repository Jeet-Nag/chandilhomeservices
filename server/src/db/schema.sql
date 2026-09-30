-- CHANDIL HOME SERVICES - DATABASE SCHEMA DDL
-- Verified for PostgreSQL 14+ / Neon PostgreSQL

-- 1. USERS & ROLES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'provider', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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

-- 2. SERVICE CATEGORIES
CREATE TABLE IF NOT EXISTS service_categories (
    id VARCHAR(50) PRIMARY KEY,
    title_en VARCHAR(100) NOT NULL,
    title_hi VARCHAR(100) NOT NULL,
    desc_en TEXT,
    desc_hi TEXT,
    icon_name VARCHAR(50) NOT NULL,
    base_visit_fee NUMERIC(10, 2) DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0
);

-- 3. PROVIDER PROFILES
CREATE TABLE IF NOT EXISTS provider_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    category_id VARCHAR(50) REFERENCES service_categories(id) ON DELETE RESTRICT,
    service_area VARCHAR(100) NOT NULL DEFAULT 'Chandil',
    is_available BOOLEAN NOT NULL DEFAULT true,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. BOOKINGS
DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM (
        'SERVICE_REQUESTED',
        'PROVIDER_ASSIGNED',
        'PROVIDER_ACCEPTED',
        'PROVIDER_ON_THE_WAY',
        'SERVICE_STARTED',
        'SERVICE_COMPLETED',
        'PAYMENT_PENDING',
        'PAYMENT_COLLECTED',
        'BOOKING_COMPLETED',
        'CANCELLED_BY_CUSTOMER',
        'REJECTED_BY_PROVIDER',
        'CANCELLED_BY_ADMIN'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(64) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    provider_id UUID REFERENCES users(id) ON DELETE SET NULL,
    category_id VARCHAR(50) NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
    
    -- Problem description
    audio_url VARCHAR(500),
    audio_duration_seconds INT,
    text_description TEXT,
    
    -- Location
    area_locality VARCHAR(100) NOT NULL,
    landmark TEXT,
    
    -- State and Financials
    status booking_status NOT NULL DEFAULT 'SERVICE_REQUESTED',
    visiting_fee NUMERIC(10, 2) DEFAULT 0.00,
    final_amount NUMERIC(10, 2),
    payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH',
    payment_collected BOOLEAN NOT NULL DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. AUDIT & STATUS TRANSITION LOGS
CREATE TABLE IF NOT EXISTS booking_status_logs (
    id BIGSERIAL PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    from_status booking_status,
    to_status booking_status NOT NULL,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. SYSTEM CONFIGURATION
CREATE TABLE IF NOT EXISTS app_configs (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_category_status ON bookings(category_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_idempotency ON bookings(idempotency_key);
