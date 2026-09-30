-- Migration: 003_create_service_categories
-- Purpose: Service categories with dual-language support and provider relationship.

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

-- Safely add foreign key from provider_profiles to service_categories
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_provider_category'
    ) THEN
        ALTER TABLE provider_profiles 
        ADD CONSTRAINT fk_provider_category 
        FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE RESTRICT;
    END IF;
END $$;
