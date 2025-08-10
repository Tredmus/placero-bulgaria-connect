import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Location = Database['public']['Tables']['locations']['Row'] & {
  companies?: {
    id: string;
    name: string;
    logo: string | null;
  };
};

interface LocationFilters {
  city?: string;
  amenities?: string[];
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  context?: 'header' | 'map';
}

export function useLocations(filters: LocationFilters = {}) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLocations();
  }, [filters.city, filters.amenities, filters.minPrice, filters.maxPrice, filters.search]);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('locations')
        .select(`
          *,
          companies (
            id,
            name,
            logo
          )
        `)
        .eq('status', 'approved');

      // Apply filters
      if (filters.city) {
        query = query.ilike('city', `%${filters.city}%`);
      }

      if (filters.search) {
        const term = filters.search.trim();
        if (term.length > 1) {
          // Use full-text search on precomputed vector (websearch syntax)
          query = query.textSearch('search_vec', term, { type: 'websearch', config: 'simple' });
        } else {
          // Fallback for very short queries
          query = query.ilike('search_text', `%${term}%`);
        }
      }

      if (filters.amenities && filters.amenities.length > 0) {
        query = query.overlaps('amenities', filters.amenities);
      }

      if (filters.minPrice) {
        query = query.gte('price_day', filters.minPrice);
      }

      if (filters.maxPrice) {
        query = query.lte('price_day', filters.maxPrice);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Fire-and-forget: log search analytics (non-blocking)
      try {
        if (filters.search) {
          await supabase.from('search_logs').insert({
            q: filters.search,
            normalized_q: filters.search.toLowerCase(),
            tokens: filters.search.toLowerCase().split(/\s+/).filter(Boolean),
            filters: {
              city: filters.city ?? null,
              amenities: filters.amenities ?? [],
              minPrice: filters.minPrice ?? null,
              maxPrice: filters.maxPrice ?? null
            },
            result_count: (data?.length ?? 0),
            context: filters.context ?? 'header'
          });
        }
      } catch (_) {
        // ignore logging errors
      }

      setLocations(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch locations');
    } finally {
      setLoading(false);
    }
  };

  const getLocationById = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select(`
          *,
          companies (
            id,
            name,
            description,
            logo
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to fetch location');
    }
  }, []);

  return {
    locations,
    loading,
    error,
    refetch: fetchLocations,
    getLocationById
  };
}