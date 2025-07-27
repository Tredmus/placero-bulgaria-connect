import { useState, useEffect } from 'react';
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
}

export function useLocations(filters: LocationFilters = {}) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLocations();
  }, [filters]);

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
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
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

      setLocations(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch locations');
    } finally {
      setLoading(false);
    }
  };

  const getLocationById = async (id: string) => {
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
  };

  return {
    locations,
    loading,
    error,
    refetch: fetchLocations,
    getLocationById
  };
}