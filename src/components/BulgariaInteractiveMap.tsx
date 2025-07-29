import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useLocations } from '@/hooks/useLocations';
import { MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Bulgaria bounding box
const BULGARIA_BOUNDS: [number, number, number, number] = [22.35, 41.24, 28.61, 44.21];

// Bulgarian provinces with approximate coordinates
const bulgarianProvinces = [
  { name: 'София', coordinates: [23.3219, 42.6977] },
  { name: 'Пловдив', coordinates: [24.7453, 42.1354] },
  { name: 'Варна', coordinates: [27.9147, 43.2141] },
  { name: 'Бургас', coordinates: [27.4626, 42.5048] },
  { name: 'Русе', coordinates: [25.9706, 43.8564] },
  { name: 'Стара Загора', coordinates: [25.6341, 42.4258] },
  { name: 'Плевен', coordinates: [24.6067, 43.4092] },
  { name: 'Сливен', coordinates: [26.3150, 42.6824] },
  { name: 'Добрич', coordinates: [27.8289, 43.5735] },
  { name: 'Шумен', coordinates: [26.9255, 43.2706] },
  { name: 'Перник', coordinates: [23.0370, 42.6055] },
  { name: 'Хасково', coordinates: [25.5553, 41.9297] },
  { name: 'Ямбол', coordinates: [26.5106, 42.4841] },
  { name: 'Пазарджик', coordinates: [24.3319, 42.1887] },
  { name: 'Благоевград', coordinates: [23.0979, 42.0116] },
  { name: 'Велико Търново', coordinates: [25.6294, 43.0757] },
  { name: 'Враца', coordinates: [23.5389, 43.2028] },
  { name: 'Габрово', coordinates: [25.3188, 42.8709] },
  { name: 'Кърджали', coordinates: [25.3787, 41.6303] },
  { name: 'Кюстендил', coordinates: [22.6893, 42.2858] },
  { name: 'Ловеч', coordinates: [24.7151, 43.1396] },
  { name: 'Монтана', coordinates: [23.2266, 43.4091] },
  { name: 'Разград', coordinates: [26.5249, 43.5258] },
  { name: 'Силистра', coordinates: [27.2609, 44.1194] },
  { name: 'Смолян', coordinates: [24.7183, 41.5766] },
  { name: 'Търговище', coordinates: [26.5722, 43.2468] },
  { name: 'Видин', coordinates: [22.8784, 43.9924] },
  { name: 'Димитровград', coordinates: [25.5953, 42.0568] }
];

interface BulgariaInteractiveMapProps {
  onProvinceSelect?: (province: string) => void;
}

const BulgariaInteractiveMap = ({ onProvinceSelect }: BulgariaInteractiveMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { locations } = useLocations({});
  const markers = useRef<mapboxgl.Marker[]>([]);

  // Get location counts by province
  const getLocationCountsByProvince = () => {
    const counts: { [key: string]: number } = {};
    locations.forEach(location => {
      if (location.city) {
        // Match city to province (simplified matching)
        const province = bulgarianProvinces.find(p => 
          location.city.toLowerCase().includes(p.name.toLowerCase()) ||
          p.name.toLowerCase().includes(location.city.toLowerCase())
        );
        if (province) {
          counts[province.name] = (counts[province.name] || 0) + 1;
        }
      }
    });
    return counts;
  };

  const locationCounts = getLocationCountsByProvince();

  // Fetch Mapbox token
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error) throw error;
        
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          // Fallback token
          setMapboxToken('pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA');
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        // Fallback token
        setMapboxToken('pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4M29iazA2Z2gycXA4N2pmbDZmangifQ.-g_vE53SD2WrJ6tFX7QHmA');
      }
    };

    fetchMapboxToken();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      bounds: BULGARIA_BOUNDS,
      fitBoundsOptions: {
        padding: 20
      },
      maxBounds: [
        [BULGARIA_BOUNDS[0] - 2, BULGARIA_BOUNDS[1] - 2], // Southwest
        [BULGARIA_BOUNDS[2] + 2, BULGARIA_BOUNDS[3] + 2]  // Northeast
      ]
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setIsLoading(false);
      addProvinceMarkers();
    });

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [mapboxToken]);

  // Add province markers
  const addProvinceMarkers = () => {
    if (!map.current) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    bulgarianProvinces.forEach(province => {
      const count = locationCounts[province.name] || 0;
      
      // Create marker element
      const markerEl = document.createElement('div');
      markerEl.className = 'province-marker';
      markerEl.style.cssText = `
        width: ${Math.max(20, 12 + count * 2)}px;
        height: ${Math.max(20, 12 + count * 2)}px;
        background: hsl(var(--primary));
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: bold;
      `;

      // Add pulsing animation for provinces with locations
      if (count > 0) {
        const pulseRing = document.createElement('div');
        pulseRing.style.cssText = `
          position: absolute;
          top: -4px;
          left: -4px;
          right: -4px;
          bottom: -4px;
          border: 2px solid hsl(var(--primary) / 0.6);
          border-radius: 50%;
          animation: pulse 2s infinite;
        `;
        markerEl.appendChild(pulseRing);
      }

      // Add count text
      if (count > 0) {
        markerEl.textContent = count.toString();
      }

      // Add hover effect
      markerEl.addEventListener('mouseenter', () => {
        markerEl.style.transform = 'scale(1.2)';
        markerEl.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)';
      });

      markerEl.addEventListener('mouseleave', () => {
        markerEl.style.transform = 'scale(1)';
        markerEl.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
      });

      // Create marker
      const marker = new mapboxgl.Marker(markerEl)
        .setLngLat(province.coordinates as [number, number])
        .addTo(map.current!);

      // Add popup on hover
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: false,
        className: 'province-popup'
      }).setHTML(`
        <div class="p-2">
          <h4 class="font-semibold">${province.name}</h4>
          <p class="text-sm text-muted-foreground">${count} locations</p>
        </div>
      `);

      markerEl.addEventListener('mouseenter', () => {
        popup.setLngLat(province.coordinates as [number, number]).addTo(map.current!);
      });

      markerEl.addEventListener('mouseleave', () => {
        popup.remove();
      });

      // Handle click
      markerEl.addEventListener('click', () => {
        handleProvinceClick(province.name, province.coordinates as [number, number]);
      });

      markers.current.push(marker);
    });
  };

  // Handle province selection
  const handleProvinceClick = (provinceName: string, coordinates: [number, number]) => {
    setSelectedProvince(provinceName);
    onProvinceSelect?.(provinceName);
    
    // Zoom to province
    if (map.current) {
      map.current.flyTo({
        center: coordinates,
        zoom: 10,
        duration: 1000
      });
    }
  };

  // Reset view
  const resetView = () => {
    setSelectedProvince(null);
    if (map.current) {
      map.current.fitBounds(BULGARIA_BOUNDS, {
        padding: 20,
        duration: 1000
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-secondary/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading Bulgaria map...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">Explore Coworking Spaces in Bulgaria</h2>
        <p className="text-muted-foreground">Click on any province to discover locations</p>
      </div>

      <div className="relative bg-background rounded-lg overflow-hidden shadow-lg">
        <div ref={mapContainer} className="w-full h-96" />
        
        {selectedProvince && (
          <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg p-4 shadow-lg">
            <h3 className="font-semibold text-lg">{selectedProvince}</h3>
            <p className="text-sm text-muted-foreground mb-2">
              {locationCounts[selectedProvince] || 0} coworking spaces
            </p>
            <Button size="sm" variant="outline" onClick={resetView}>
              Back to overview
            </Button>
          </div>
        )}
      </div>

      {/* Province list */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {bulgarianProvinces
          .filter(province => locationCounts[province.name] > 0)
          .sort((a, b) => (locationCounts[b.name] || 0) - (locationCounts[a.name] || 0))
          .slice(0, 12) // Show top 12 provinces
          .map((province) => (
          <button
            key={province.name}
            onClick={() => handleProvinceClick(province.name, province.coordinates as [number, number])}
            className={`p-3 rounded-lg border transition-all duration-200 text-left hover:scale-105 ${
              selectedProvince === province.name
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-secondary border-border"
            }`}
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{province.name}</p>
                <p className="text-xs opacity-80">{locationCounts[province.name] || 0} spaces</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        .province-popup .mapboxgl-popup-content {
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
        }
        
        .province-popup .mapboxgl-popup-tip {
          border-top-color: hsl(var(--background));
        }
      `}</style>
    </div>
  );
};

export default BulgariaInteractiveMap;