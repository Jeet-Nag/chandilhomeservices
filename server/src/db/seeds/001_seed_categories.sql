-- Seed: 001_seed_categories
-- Purpose: Insert approved 5 service categories with English and Hindi content.

INSERT INTO service_categories (id, title_en, title_hi, desc_en, desc_hi, icon_name, base_visit_fee, is_active, sort_order)
VALUES 
(
    'electrician',
    'Electrician',
    'बिजली मिस्त्री',
    'Fan, wiring, switchboard & light repair',
    'पंखा, वायरिंग, स्विचबोर्ड और लाइट सुधार',
    'zap',
    99.00,
    true,
    1
),
(
    'plumber',
    'Plumber',
    'नल / प्लंबर',
    'Tap leakage, pipe fittings & water tank',
    'नल लीकेज, पाइप फिटिंग और पानी टंकी',
    'droplet',
    99.00,
    true,
    2
),
(
    'appliance-repair',
    'Appliance Repair',
    'घरेलू उपकरण रिपेयर',
    'Fridge, washing machine & TV repair',
    'फ्रिज, वाशिंग मशीन और टीवी रिपेयर',
    'tv',
    149.00,
    true,
    3
),
(
    'ac-cooler',
    'AC / Cooler Technician',
    'कूलर / AC मिस्त्री',
    'Cooler motor, water pump & AC servicing',
    'कूलर मोटर, वाटर पंप और AC सर्विसिंग',
    'wind',
    149.00,
    true,
    4
),
(
    'bike-mechanic',
    'Bike / Auto Mechanic',
    'बाइक / गाड़ी मैकेनिक',
    'Two-wheeler puncture, servicing & starting issues',
    'दोपहिया पंचर, सर्विसिंग और स्टार्ट समस्या',
    'tool',
    99.00,
    true,
    5
)
ON CONFLICT (id) DO UPDATE SET
    title_en = EXCLUDED.title_en,
    title_hi = EXCLUDED.title_hi,
    desc_en = EXCLUDED.desc_en,
    desc_hi = EXCLUDED.desc_hi,
    icon_name = EXCLUDED.icon_name,
    base_visit_fee = EXCLUDED.base_visit_fee,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order;
