-- Migration: 001_create_enums
-- Purpose: Define strict PostgreSQL enum types for user roles and booking lifecycle states.

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'provider', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
