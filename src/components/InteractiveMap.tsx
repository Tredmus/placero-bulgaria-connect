import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useLocations } from '@/hooks/useLocations';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Building2, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Bulgaria provinces (oblasti) with their approximate coordinates
const bulgariaProvinces = [
  { name: 'София', coordinates: [23.3219, 42.6977], nameEn: 'Sofia' },
  { name: 'Пловдив', coordinates: [24.7453, 42.1354], nameEn: 'Plovdiv' },
  { name: 'Варна', coordinates: [27.9147, 43.2141], nameEn: 'Varna' },
  { name: 'Бургас', coordinates: [27.4626, 42.5048], nameEn: 'Burgas' },
  { name: 'Русе', coordinates: [25.9704, 43.8564], nameEn: 'Ruse' },
  { name: 'Стара Загора', coordinates: [25.6272, 42.4258], nameEn: 'Stara Zagora' },
  { name: 'Плевен', coordinates: [24.6067, 43.4092], nameEn: 'Pleven' },
  { name: 'Сливен', coordinates: [26.3150, 42.6824], nameEn: 'Sliven' },
  { name: 'Благоевград', coordinates: [23.0958, 42.0116], nameEn: 'Blagoevgrad' },
  { name: 'Велико Търново', coordinates: [25.6515, 43.0757], nameEn: 'Veliko Tarnovo' },
  { name: 'Видин', coordinates: [22.8743, 43.9859], nameEn: 'Vidin' },
  { name: 'Враца', coordinates: [23.5480, 43.2039], nameEn: 'Vratsa' },
  { name: 'Габрово', coordinates: [25.3188, 42.8709], nameEn: 'Gabrovo' },
  { name: 'Добрич', coordinates: [27.8272, 43.5755], nameEn: 'Dobrich' },
  { name: 'Кърджали', coordinates: [25.3787, 41.6303], nameEn: 'Kardzhali' },
  { name: 'Кюстендил', coordinates: [22.6893, 42.2858], nameEn: 'Kyustendil' },
  { name: 'Ловеч', coordinates: [24.7138, 43.1350], nameEn: 'Lovech' },
  { name: 'Монтана', coordinates: [23.2291, 43.4091], nameEn: 'Montana' },
  { name: 'Пазарджик', coordinates: [24.3319, 42.1887], nameEn: 'Pazardzhik' },
  { name: 'Перник', coordinates: [23.0374, 42.6073], nameEn: 'Pernik' },
  { name: 'Разград', coordinates: [26.5228, 43.5258], nameEn: 'Razgrad' },
  { name: 'Шумен', coordinates: [26.9255, 43.2706], nameEn: 'Shumen' },
  { name: 'Силистра', coordinates: [27.2614, 44.1194], nameEn: 'Silistra' },
  { name: 'Смолян', coordinates: [24.7018, 41.5766], nameEn: 'Smolyan' },
  { name: 'Хаскрво', coordinates: [25.5557, 41.9449], nameEn: 'Haskovo' },
  { name: 'Търговище', coordinates: [26.5540, 43.2468], nameEn: 'Targovishte' },
  { name: 'Ямбол', coordinates: [26.5106, 42.4841], nameEn: 'Yambol' },
];

interface InteractiveMapProps {
  onProvinceSelect?: (provinceName: string) => void;
}

const InteractiveMap = ({ onProvinceSelect }: InteractiveMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [provinceLocations, setProvinceLocations] = useState<any[]>([]);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const { locations } = useLocations();

  // Fetch Mapbox token from edge function or use the provided token
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        // Try to get token from edge function
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (data?.token) {
          setMapboxToken(data.token);
          mapboxgl.accessToken = data.token;
        } else {
          // Fallback: use hardcoded token for now
          const token = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
          setMapboxToken(token);
          mapboxgl.accessToken = token;
        }
      } catch (error) {
        console.log('Edge function not available, using fallback token');
        // Use the provided token as fallback
        const token = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        setMapboxToken(token);
        mapboxgl.accessToken = token;
      }
    };
    
    fetchMapboxToken();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11', // Dark theme
      center: [25.4858, 42.7339], // Center of Bulgaria
      zoom: 6.5,
      projection: 'mercator'
    });

    map.current.on('load', () => {
      if (!map.current) return;

      // Add Bulgaria provinces as circles with hover effects
      bulgariaProvinces.forEach((province, index) => {
        const provinceLocations = locations.filter(loc => 
          loc.city.toLowerCase().includes(province.nameEn.toLowerCase()) ||
          loc.city.toLowerCase().includes(province.name.toLowerCase())
        );
        
        const locationCount = provinceLocations.length;
        
        // Create an enhanced animated marker for each province
        const el = document.createElement('div');
        el.className = 'province-marker';
        el.style.cssText = `
          width: ${Math.max(45, locationCount * 10)}px;
          height: ${Math.max(45, locationCount * 10)}px;
          background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 50%, hsl(var(--primary-foreground)) 100%);
          border: 3px solid hsl(var(--background));
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          transform-origin: center;
          box-shadow: 
            0 0 0 0 hsl(var(--primary) / 0.7),
            0 8px 25px hsl(var(--primary) / 0.4),
            inset 0 1px 3px hsl(var(--primary-foreground) / 0.3);
          animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        `;
        
        // Add CSS animation for pulsing ring effect
        if (!document.querySelector('#province-marker-styles')) {
          const style = document.createElement('style');
          style.id = 'province-marker-styles';
          style.textContent = `
            @keyframes pulse-ring {
              0% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.7), 0 8px 25px hsl(var(--primary) / 0.4), inset 0 1px 3px hsl(var(--primary-foreground) / 0.3); }
              50% { box-shadow: 0 0 0 10px hsl(var(--primary) / 0.1), 0 8px 25px hsl(var(--primary) / 0.4), inset 0 1px 3px hsl(var(--primary-foreground) / 0.3); }
              100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0), 0 8px 25px hsl(var(--primary) / 0.4), inset 0 1px 3px hsl(var(--primary-foreground) / 0.3); }
            }
            .province-marker:hover {
              animation-play-state: paused;
            }
          `;
          document.head.appendChild(style);
        }

        // Add inner content
        const content = document.createElement('div');
        content.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: hsl(var(--primary-foreground));
          font-size: 12px;
          font-weight: bold;
          text-align: center;
          line-height: 1;
        `;
        content.innerHTML = `${locationCount}<br><span style="font-size: 8px;">${province.name}</span>`;
        el.appendChild(content);

        // Add hover effects
        el.addEventListener('mouseenter', () => {
          setHoveredProvince(province.name);
          el.style.transform = 'scale(1.2)';
          el.style.boxShadow = '0 8px 30px hsl(var(--primary) / 0.5)';
        });

        el.addEventListener('mouseleave', () => {
          setHoveredProvince(null);
          el.style.transform = 'scale(1)';
          el.style.boxShadow = '0 4px 20px hsl(var(--primary) / 0.3)';
        });

        el.addEventListener('click', () => {
          setSelectedProvince(province.name);
          setProvinceLocations(provinceLocations);
          onProvinceSelect?.(province.name);
          
          // Animate to province
          map.current?.flyTo({
            center: province.coordinates as [number, number],
            zoom: 9,
            duration: 2000
          });
        });

        // Add marker to map
        new mapboxgl.Marker(el)
          .setLngLat(province.coordinates as [number, number])
          .addTo(map.current!);
      });
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, locations, onProvinceSelect]);

  // Reset view function
  const resetView = () => {
    setSelectedProvince(null);
    setProvinceLocations([]);
    map.current?.flyTo({
      center: [25.4858, 42.7339],
      zoom: 6.5,
      duration: 1500
    });
  };

  if (!mapboxToken) {
    return (
      <div className="bg-secondary/50 rounded-lg p-8">
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-4">Interactive Map Loading...</h3>
          <p className="text-muted-foreground">
            Please enter your Mapbox token to view the interactive map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-secondary/50 rounded-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold">Изберете регион</h3>
        {selectedProvince && (
          <button
            onClick={resetView}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Покажи всички региони
          </button>
        )}
      </div>
      
      <div className="relative">
        {/* Map Container */}
        <div
          ref={mapContainer}
          className="w-full h-96 rounded-lg overflow-hidden border border-border shadow-lg"
        />
        
        {/* Hover Info */}
        {hoveredProvince && !selectedProvince && (
          <div className="absolute top-4 left-4 z-10">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-medium">{hoveredProvince}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Selected Province Info */}
        {selectedProvince && (
          <div className="absolute top-4 left-4 z-10">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <span className="font-bold text-lg">{selectedProvince}</span>
                </div>
                <Badge variant="secondary">
                  {provinceLocations.length} офиса намерени
                </Badge>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Province List */}
      {!selectedProvince && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-6">
          {bulgariaProvinces.map((province) => {
            const provinceLocations = locations.filter(loc => 
              loc.city.toLowerCase().includes(province.nameEn.toLowerCase()) ||
              loc.city.toLowerCase().includes(province.name.toLowerCase())
            );
            
            return (
              <div
                key={province.name}
                onClick={() => {
                  setSelectedProvince(province.name);
                  setProvinceLocations(provinceLocations);
                  onProvinceSelect?.(province.name);
                  map.current?.flyTo({
                    center: province.coordinates as [number, number],
                    zoom: 9,
                    duration: 2000
                  });
                }}
                className="p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:scale-105"
              >
                <div className="text-center">
                  <h4 className="font-semibold text-sm">{province.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {provinceLocations.length} офиса
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Province Locations */}
      {selectedProvince && provinceLocations.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-4">
            Офиси в {selectedProvince}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {provinceLocations.map((location) => (
              <Card key={location.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <h5 className="font-semibold mb-2">{location.name}</h5>
                  <p className="text-sm text-muted-foreground mb-2">
                    {location.address}
                  </p>
                  {location.price_day && (
                    <Badge variant="outline">
                      {location.price_day} лв./ден
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveMap;