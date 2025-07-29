-- Add latitude and longitude columns to locations table
ALTER TABLE public.locations 
ADD COLUMN latitude NUMERIC(10, 8),
ADD COLUMN longitude NUMERIC(11, 8);

-- Add index for spatial queries
CREATE INDEX idx_locations_coordinates ON public.locations (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add a constraint to ensure both coordinates are provided together
ALTER TABLE public.locations 
ADD CONSTRAINT check_coordinates_together 
CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL));