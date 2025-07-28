import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Banner = Database['public']['Tables']['banners']['Row'] & {
  companies?: {
    id: string;
    name: string;
    logo: string | null;
  };
};

const BannerDisplay = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveBanners();
  }, []);

  const fetchActiveBanners = async () => {
    try {
      setLoading(true);
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data, error } = await supabase
        .from('banners')
        .select(`
          *,
          companies (
            id,
            name,
            logo
          )
        `)
        .eq('status', 'approved')
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBanners(data || []);
    } catch (err) {
      console.error('Failed to fetch banners:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || banners.length === 0) {
    return null;
  }

  return (
    <section className="py-8 bg-primary/5">
      <div className="container mx-auto px-4">
        <div className="space-y-4">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="flex items-center gap-4 p-4 bg-background rounded-lg border shadow-sm"
            >
              {banner.companies?.logo && (
                <img
                  src={banner.companies.logo}
                  alt={banner.companies.name}
                  className="w-12 h-12 rounded object-cover flex-shrink-0"
                />
              )}
              <div className="flex-grow">
                <p className="text-sm font-medium text-foreground">
                  {banner.text}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {banner.companies?.name}
                </p>
              </div>
              {banner.image && (
                <img
                  src={banner.image}
                  alt="Banner"
                  className="w-16 h-16 rounded object-cover flex-shrink-0"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BannerDisplay;