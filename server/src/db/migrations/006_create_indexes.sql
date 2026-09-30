-- Migration: 006_create_indexes
-- Purpose: Performance indexes for state machine queries, provider matching, and idempotency lookups.

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_category_status ON bookings(category_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_idempotency ON bookings(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_status_logs_booking ON booking_status_logs(booking_id);
