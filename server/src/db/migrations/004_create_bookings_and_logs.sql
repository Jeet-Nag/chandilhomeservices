-- Migration: 004_create_bookings_and_logs
-- Purpose: Bookings table with idempotency constraints, audit status logs, and foreign key boundaries.

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

CREATE TABLE IF NOT EXISTS booking_status_logs (
    id BIGSERIAL PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    from_status booking_status,
    to_status booking_status NOT NULL,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
