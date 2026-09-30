-- Seed: 002_seed_configs
-- Purpose: Default app configurations for support channels and operating region.

INSERT INTO app_configs (key, value, description)
VALUES 
    ('support_phone', '+919876543210', 'Primary customer and partner support telephone number'),
    ('support_whatsapp', '+919876543210', 'Direct customer support WhatsApp number'),
    ('operating_area', 'Chandil, Jharkhand', 'Primary service coverage region')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();
