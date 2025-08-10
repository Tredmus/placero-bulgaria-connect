-- Enable required extensions for search
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- Add category column to locations (for filtering)
alter table public.locations
  add column if not exists category text;

-- Add generated columns for search
alter table public.locations
  add column if not exists search_text text generated always as (
    unaccent(
      coalesce(name,'') || ' ' ||
      coalesce(address,'') || ' ' ||
      coalesce(city,'') || ' ' ||
      coalesce(description,'') || ' ' ||
      coalesce(category,'') || ' ' ||
      array_to_string(amenities, ' ')
    )
  ) stored;

alter table public.locations
  add column if not exists search_vec tsvector
    generated always as (to_tsvector('simple', search_text)) stored;

-- Indexes for fast search
create index if not exists idx_locations_vec on public.locations using gin (search_vec);
create index if not exists idx_locations_trgm on public.locations using gin (search_text gin_trgm_ops);

-- Search logs table for analytics & synonym improvements
create table if not exists public.search_logs (
  id uuid primary key default gen_random_uuid(),
  q text,
  normalized_q text,
  tokens text[],
  filters jsonb,
  result_count integer,
  context text check (context in ('header','map')),
  created_at timestamptz not null default now()
);

-- RLS for search_logs
alter table public.search_logs enable row level security;

-- Create policies only if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'search_logs' 
      AND policyname = 'Anyone can insert search logs'
  ) THEN
    CREATE POLICY "Anyone can insert search logs"
      ON public.search_logs FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'search_logs' 
      AND policyname = 'Only admins can view search logs'
  ) THEN
    CREATE POLICY "Only admins can view search logs"
      ON public.search_logs FOR SELECT
      USING (get_current_user_role() = 'admin'::app_role);
  END IF;
END$$;