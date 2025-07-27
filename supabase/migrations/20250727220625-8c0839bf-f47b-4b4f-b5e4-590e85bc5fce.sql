-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('company-logos', 'company-logos', true),
  ('location-photos', 'location-photos', true);

-- Create storage policies for company logos
CREATE POLICY "Anyone can view company logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-logos');

CREATE POLICY "Authenticated users can upload company logos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'company-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own company logos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'company-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own company logos" ON storage.objects
  FOR DELETE USING (bucket_id = 'company-logos' AND auth.uid() IS NOT NULL);

-- Create storage policies for location photos
CREATE POLICY "Anyone can view location photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'location-photos');

CREATE POLICY "Authenticated users can upload location photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'location-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own location photos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'location-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own location photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'location-photos' AND auth.uid() IS NOT NULL);

-- Add main_photo field to locations table
ALTER TABLE public.locations ADD COLUMN main_photo text;