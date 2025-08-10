-- Enable required extensions for search
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- Add category column to locations (for filtering)
alter table public.locations
  add column if not exists category text;

-- Add plain columns for search (maintained via trigger)
alter table public.locations
  add column if not exists search_text text;

alter table public.locations
  add column if not exists search_vec tsvector;

-- Function to maintain search fields
create or replace function public.update_locations_search_fields()
returns trigger
language plpgsql
as $$
begin
  NEW.search_text := unaccent(
    coalesce(NEW.name,'') || ' ' ||
    coalesce(NEW.address,'') || ' ' ||
    coalesce(NEW.city,'') || ' ' ||
    coalesce(NEW.description,'') || ' ' ||
    coalesce(NEW.category,'') || ' ' ||
    array_to_string(coalesce(NEW.amenities, '{}'), ' ')
  );
  NEW.search_vec := to_tsvector('simple', NEW.search_text);
  return NEW;
end;
$$;

-- Trigger to update search fields
drop trigger if exists trg_update_locations_search_fields on public.locations;
create trigger trg_update_locations_search_fields
before insert or update on public.locations
for each row execute function public.update_locations_search_fields();

-- Indexes for fast search
create index if not exists idx_locations_vec on public.locations using gin (search_vec);
create index if not exists idx_locations_trgm on public.locations using gin (search_text gin_trgm_ops);

-- Backfill search fields for existing rows
update public.locations set name = name;

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