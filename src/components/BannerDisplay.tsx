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
    <section className="py-8 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
      <div className="container mx-auto px-4">
        <div className="space-y-4">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className="placero-card-elevated flex items-center gap-4 p-6 placero-hover-lift relative overflow-hidden placero-fade-in"
              style={{animationDelay: `${index * 0.1}s`}}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5"></div>
              
              {banner.companies?.logo && (
                <div className="relative z-10">
                  <img
                    src={banner.companies.logo}
                    alt={banner.companies.name}
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0 shadow-md"
                  />
                </div>
              )}
              
              <div className="flex-grow relative z-10">
                <p className="text-base font-semibold text-foreground mb-1">
                  {banner.text}
                </p>
                <p className="text-sm text-muted-foreground">
                  {banner.companies?.name}
                </p>
              </div>
              
              {banner.image && (
                <div className="relative z-10">
                  <img
                    src={banner.image}
                    alt="Banner"
                    className="w-20 h-16 rounded-lg object-cover flex-shrink-0 shadow-md"
                  />
                </div>
              )}
              
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full -translate-y-12 translate-x-12 placero-floating"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BannerDisplay;