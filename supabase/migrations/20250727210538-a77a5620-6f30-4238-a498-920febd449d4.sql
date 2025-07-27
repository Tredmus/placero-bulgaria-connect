
-- First, let's add a rating column to locations if it doesn't exist with proper range
ALTER TABLE locations ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 0 CHECK (rating >= 0 AND rating <= 5);

-- Insert 6 random companies
INSERT INTO companies (id, name, description, logo, status, owner_id) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Sofia Tech Hub', 'Modern coworking spaces in the heart of Sofia', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200&h=200&fit=crop', 'approved', '550e8400-e29b-41d4-a716-446655440001'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Plovdiv Creative', 'Creative workspace for artists and designers in Plovdiv', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=200&h=200&fit=crop', 'approved', '550e8400-e29b-41d4-a716-446655440002'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Varna Business Center', 'Professional business spaces near the Black Sea', 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=200&h=200&fit=crop', 'approved', '550e8400-e29b-41d4-a716-446655440003'),
  ('550e8400-e29b-41d4-a716-446655440004', 'Burgas Innovation Lab', 'Innovation-focused workspace in Burgas', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=200&h=200&fit=crop', 'approved', '550e8400-e29b-41d4-a716-446655440004'),
  ('550e8400-e29b-41d4-a716-446655440005', 'Stara Zagora Workspace', 'Collaborative workspace in the center of Stara Zagora', 'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=200&h=200&fit=crop', 'approved', '550e8400-e29b-41d4-a716-446655440005'),
  ('550e8400-e29b-41d4-a716-446655440006', 'Ruse Digital Hub', 'Digital nomad friendly space in Ruse', 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=200&h=200&fit=crop', 'approved', '550e8400-e29b-41d4-a716-446655440006');

-- Insert locations for each company
INSERT INTO locations (id, company_id, name, description, address, city, price_day, price_week, price_month, amenities, photos, rating, status) VALUES
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Sofia Tech Hub - Central', 'Modern coworking space in the heart of Sofia with high-speed internet and meeting rooms', 'бул. Витоша 100', 'София', 45, 270, 900, ARRAY['wifi', 'coffee', 'parking', 'meeting'], ARRAY['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&h=600&fit=crop'], 4.8, 'approved'),
  
  ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'Plovdiv Creative Studio', 'Creative workspace with natural light and artistic atmosphere', 'ул. Княз Александър I 42', 'Пловдив', 35, 210, 700, ARRAY['wifi', 'coffee', 'meeting', 'printer'], ARRAY['https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=800&h=600&fit=crop'], 4.6, 'approved'),
  
  ('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 'Varna Sea View Office', 'Professional workspace with sea views and modern amenities', 'бул. Приморски 15', 'Варна', 40, 240, 800, ARRAY['wifi', 'coffee', 'parking', 'meeting', 'balcony'], ARRAY['https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop'], 4.7, 'approved'),
  
  ('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', 'Burgas Innovation Space', 'Innovation-focused workspace with collaboration areas', 'ул. Богориди 25', 'Бургас', 38, 228, 760, ARRAY['wifi', 'coffee', 'meeting', 'printer', 'kitchen'], ARRAY['https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&h=600&fit=crop'], 4.5, 'approved'),
  
  ('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', 'Stara Zagora Central Hub', 'Collaborative workspace in the city center with flexible options', 'ул. Цар Симеон Велики 12', 'Стара Загора', 32, 192, 640, ARRAY['wifi', 'coffee', 'parking', 'meeting'], ARRAY['https://images.unsplash.com/photo-1497215842964-222b430dc094?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&h=600&fit=crop'], 4.4, 'approved'),
  
  ('660e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440006', 'Ruse Digital Nomad Hub', 'Digital nomad friendly space with 24/7 access and river views', 'ул. Александровска 18', 'Русе', 30, 180, 600, ARRAY['wifi', 'coffee', 'parking', 'meeting', '24h_access'], ARRAY['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop', 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&h=600&fit=crop'], 4.3, 'approved');
