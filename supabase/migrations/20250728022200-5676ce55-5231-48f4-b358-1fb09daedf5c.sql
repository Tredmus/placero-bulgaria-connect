-- Fix the banners table to allow optional images
ALTER TABLE public.banners ALTER COLUMN image DROP NOT NULL;