import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Article = Database['public']['Tables']['articles']['Row'] & {
  companies?: {
    id: string;
    name: string;
    logo: string | null;
  };
};

interface ArticleFilters {
  search?: string;
}

export function useArticles(filters: ArticleFilters = {}) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchArticles();
  }, [filters.search]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('articles')
        .select(`
          *,
          companies (
            id,
            name,
            logo
          )
        `)
        .eq('status', 'approved');

      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      setArticles(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch articles');
    } finally {
      setLoading(false);
    }
  };

  const getArticleById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('articles')
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
      throw new Error(err instanceof Error ? err.message : 'Failed to fetch article');
    }
  };

  return {
    articles,
    loading,
    error,
    refetch: fetchArticles,
    getArticleById
  };
}