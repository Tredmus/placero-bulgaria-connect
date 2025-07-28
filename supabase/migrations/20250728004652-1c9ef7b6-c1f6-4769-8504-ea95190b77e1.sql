-- Add rejection_reason column to companies, locations, and articles tables
ALTER TABLE public.companies 
ADD COLUMN rejection_reason TEXT;

ALTER TABLE public.locations 
ADD COLUMN rejection_reason TEXT;

ALTER TABLE public.articles 
ADD COLUMN rejection_reason TEXT;