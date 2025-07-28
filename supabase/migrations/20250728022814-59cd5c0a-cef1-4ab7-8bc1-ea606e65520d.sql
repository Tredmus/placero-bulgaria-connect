-- Add rejection_reason column to banners table
ALTER TABLE public.banners ADD COLUMN rejection_reason TEXT;