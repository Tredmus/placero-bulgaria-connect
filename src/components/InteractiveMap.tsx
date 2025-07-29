import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useLocations } from '@/hooks/useLocations';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Building2, RotateCcw, Star, Wifi, Coffee, Car, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Bulgaria boundaries for highlighting
const BULGARIA_BOUNDS: [number, number, number, number] = [22.3, 41.2, 28.6, 44.2];

// Bulgaria provinces (oblasti) with their correct coordinates  
const bulgariaProvinces = [
  { name: 'София', coordinates: [23.3219, 42.6977], nameEn: 'Sofia', bounds: [23.1, 42.5, 23.5, 42.9] },
  { name: 'Пловдив', coordinates: [24.7453, 42.1354], nameEn: 'Plovdiv', bounds: [24.5, 41.9, 25.0, 42.4] },
  { name: 'Варна', coordinates: [27.9147, 43.2141], nameEn: 'Varna', bounds: [27.7, 43.0, 28.2, 43.5] },
  { name: 'Бургас', coordinates: [27.4626, 42.5048], nameEn: 'Burgas', bounds: [27.2, 42.3, 27.7, 42.8] },
  { name: 'Русе', coordinates: [25.9704, 43.8564], nameEn: 'Ruse', bounds: [25.7, 43.6, 26.2, 44.1] },
  { name: 'Стара Загора', coordinates: [25.6272, 42.4258], nameEn: 'Stara Zagora', bounds: [25.4, 42.2, 25.9, 42.7] },
  { name: 'Плевен', coordinates: [24.6067, 43.4092], nameEn: 'Pleven', bounds: [24.4, 43.2, 24.9, 43.6] },
  { name: 'Сливен', coordinates: [26.3150, 42.6824], nameEn: 'Sliven', bounds: [26.1, 42.5, 26.6, 42.9] },
  { name: 'Благоевград', coordinates: [23.0958, 42.0116], nameEn: 'Blagoevgrad', bounds: [22.9, 41.8, 23.3, 42.3] },
  { name: 'Велико Търново', coordinates: [25.6515, 43.0757], nameEn: 'Veliko Tarnovo', bounds: [25.4, 42.9, 25.9, 43.3] },
  { name: 'Видин', coordinates: [22.8743, 43.9859], nameEn: 'Vidin', bounds: [22.6, 43.8, 23.1, 44.2] },
  { name: 'Враца', coordinates: [23.5480, 43.2039], nameEn: 'Vratsa', bounds: [23.3, 43.0, 23.8, 43.4] },
  { name: 'Габрово', coordinates: [25.3188, 42.8709], nameEn: 'Gabrovo', bounds: [25.1, 42.7, 25.6, 43.1] },
  { name: 'Добрич', coordinates: [27.8272, 43.5755], nameEn: 'Dobrich', bounds: [27.6, 43.4, 28.1, 43.8] },
  { name: 'Кърджали', coordinates: [25.3787, 41.6303], nameEn: 'Kardzhali', bounds: [25.1, 41.4, 25.7, 41.9] },
  { name: 'Кюстендил', coordinates: [22.6893, 42.2858], nameEn: 'Kyustendil', bounds: [22.5, 42.1, 22.9, 42.5] },
  { name: 'Ловеч', coordinates: [24.7138, 43.1350], nameEn: 'Lovech', bounds: [24.5, 42.9, 24.9, 43.3] },
  { name: 'Монтана', coordinates: [23.2291, 43.4091], nameEn: 'Montana', bounds: [23.0, 43.2, 23.5, 43.6] },
  { name: 'Пазарджик', coordinates: [24.3319, 42.1887], nameEn: 'Pazardzhik', bounds: [24.1, 42.0, 24.6, 42.4] },
  { name: 'Перник', coordinates: [23.0374, 42.6073], nameEn: 'Pernik', bounds: [22.8, 42.4, 23.3, 42.8] },
  { name: 'Разград', coordinates: [26.5228, 43.5258], nameEn: 'Razgrad', bounds: [26.3, 43.3, 26.8, 43.7] },
  { name: 'Шумен', coordinates: [26.9255, 43.2706], nameEn: 'Shumen', bounds: [26.7, 43.1, 27.2, 43.5] },
  { name: 'Силистра', coordinates: [27.2614, 44.1194], nameEn: 'Silistra', bounds: [27.0, 43.9, 27.5, 44.3] },
  { name: 'Смолян', coordinates: [24.7018, 41.5766], nameEn: 'Smolyan', bounds: [24.5, 41.4, 25.0, 41.8] },
  { name: 'Хаскрво', coordinates: [25.5557, 41.9449], nameEn: 'Haskovo', bounds: [25.3, 41.7, 25.8, 42.2] },
  { name: 'Търговище', coordinates: [26.5540, 43.2468], nameEn: 'Targovishte', bounds: [26.3, 43.1, 26.8, 43.4] },
  { name: 'Ямбол', coordinates: [26.5106, 42.4841], nameEn: 'Yambol', bounds: [26.3, 42.3, 26.8, 42.7] },
];

interface InteractiveMapProps {
  onProvinceSelect?: (provinceName: string) => void;
}

const InteractiveMap = ({ onProvinceSelect }: InteractiveMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [provinceLocations, setProvinceLocations] = useState<any[]>([]);
  const [provinceCities, setProvinceCities] = useState<{[key: string]: any[]}>({});
  const [cityLocations, setCityLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [viewLevel, setViewLevel] = useState<'provinces' | 'cities' | 'locations'>('provinces');
  const { locations } = useLocations();

  const amenityIcons = {
    wifi: Wifi,
    coffee: Coffee,
    parking: Car,
    meeting: Users,
  };

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

  // Clear all markers
  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
  };

  // Add province locations as individual markers
  const addLocationMarkers = (locations: any[]) => {
    clearMarkers();
    
    locations.forEach((location) => {
      if (!location.latitude || !location.longitude) return;

      const el = document.createElement('div');
      el.className = 'location-marker';
      el.style.cssText = `
        width: 24px;
        height: 24px;
        background: hsl(var(--primary));
        border: 2px solid hsl(var(--background));
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
        transform-origin: center;
        box-shadow: 0 4px 12px hsl(var(--primary) / 0.4);
      `;

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.3)';
        el.style.boxShadow = '0 6px 20px hsl(var(--primary) / 0.6)';
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = '0 4px 12px hsl(var(--primary) / 0.4)';
      });

      el.addEventListener('click', () => {
        setSelectedLocation(location);
      });

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat([parseFloat(location.longitude), parseFloat(location.latitude)])
        .addTo(map.current!);
      
      markersRef.current.push(marker);
    });
  };

  // Add city markers
  const addCityMarkers = (cities: {[key: string]: any[]}) => {
    clearMarkers();
    
    Object.entries(cities).forEach(([cityName, cityLocations]) => {
      if (cityLocations.length === 0) return;
      
      // Calculate average coordinates for city center
      const avgLat = cityLocations.reduce((sum, loc) => sum + parseFloat(loc.latitude), 0) / cityLocations.length;
      const avgLng = cityLocations.reduce((sum, loc) => sum + parseFloat(loc.longitude), 0) / cityLocations.length;

      const el = document.createElement('div');
      el.className = 'city-marker';
      el.style.cssText = `
        width: ${Math.max(35, cityLocations.length * 8)}px;
        height: ${Math.max(35, cityLocations.length * 8)}px;
        background: linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--secondary-foreground)) 100%);
        border: 2px solid hsl(var(--background));
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
        transform-origin: center;
        box-shadow: 0 4px 12px hsl(var(--secondary) / 0.4);
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: hsl(var(--secondary-foreground));
        font-size: 10px;
        font-weight: bold;
        text-align: center;
        line-height: 1;
        pointer-events: none;
      `;
      content.innerHTML = `${cityLocations.length}<br><span style="font-size: 8px;">${cityName}</span>`;
      el.appendChild(content);

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)';
        el.style.boxShadow = '0 6px 20px hsl(var(--secondary) / 0.6)';
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = '0 4px 12px hsl(var(--secondary) / 0.4)';
      });

      el.addEventListener('click', () => {
        handleCitySelect(cityName, cityLocations, [avgLng, avgLat]);
      });

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat([avgLng, avgLat])
        .addTo(map.current!);
      
      markersRef.current.push(marker);
    });
  };

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [25.4858, 42.7339],
      zoom: 6.5,
      projection: 'mercator',
      maxZoom: 18,
      minZoom: 5,
      maxBounds: BULGARIA_BOUNDS
    });

    map.current.on('load', () => {
      if (!map.current) return;

      // Add Bulgaria country outline/highlight
      map.current!.addSource('bulgaria-highlight', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [BULGARIA_BOUNDS[0], BULGARIA_BOUNDS[1]],
              [BULGARIA_BOUNDS[2], BULGARIA_BOUNDS[1]],
              [BULGARIA_BOUNDS[2], BULGARIA_BOUNDS[3]], 
              [BULGARIA_BOUNDS[0], BULGARIA_BOUNDS[3]],
              [BULGARIA_BOUNDS[0], BULGARIA_BOUNDS[1]]
            ]]
          }
        }
      });

      map.current!.addLayer({
        id: 'bulgaria-highlight',
        type: 'fill',
        source: 'bulgaria-highlight',
        paint: {
          'fill-color': 'hsl(var(--primary))',
          'fill-opacity': 0.1
        }
      });

      map.current!.addLayer({
        id: 'bulgaria-border',
        type: 'line',
        source: 'bulgaria-highlight',
        paint: {
          'line-color': 'hsl(var(--primary))',
          'line-width': 2,
          'line-opacity': 0.5
        }
      });

      // Add Bulgaria provinces as circles with hover effects
      bulgariaProvinces.forEach((province) => {
        const provinceLocations = locations.filter(loc => 
          loc.city.toLowerCase().includes(province.nameEn.toLowerCase()) ||
          loc.city.toLowerCase().includes(province.name.toLowerCase())
        );
        
        const locationCount = provinceLocations.length;
        
        // Create marker element
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
          pointer-events: none;
        `;
        content.innerHTML = `${locationCount}<br><span style="font-size: 8px;">${province.name}</span>`;
        el.appendChild(content);

        // Create popup for hover info
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: [0, -15]
        });

        // Add hover effects
        el.addEventListener('mouseenter', () => {
          setHoveredProvince(province.name);
          el.style.transform = 'scale(1.2)';
          el.style.boxShadow = '0 8px 30px hsl(var(--primary) / 0.5)';
          
          // Show popup
          popup.setLngLat(province.coordinates as [number, number])
            .setHTML(`
              <div style="padding: 8px; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); border-radius: 6px; color: hsl(var(--foreground)); font-size: 12px;">
                <strong>${province.name}</strong><br>
                ${locationCount} офиса
              </div>
            `)
            .addTo(map.current!);
        });

        el.addEventListener('mouseleave', () => {
          setHoveredProvince(null);
          el.style.transform = 'scale(1)';
          el.style.boxShadow = '0 4px 20px hsl(var(--primary) / 0.3)';
          popup.remove();
        });

        el.addEventListener('click', () => {
          handleProvinceSelect(province.name, provinceLocations, province.coordinates);
        });

        // Add marker to map (anchored to fix positioning issues)
        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat([province.coordinates[0], province.coordinates[1]])
          .addTo(map.current!);
        
        markersRef.current.push(marker);
      });
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      clearMarkers();
      map.current?.remove();
    };
  }, [mapboxToken, locations, onProvinceSelect]);

  // Handle province selection
  const handleProvinceSelect = (provinceName: string, provinceLocations: any[], coordinates: number[]) => {
    setSelectedProvince(provinceName);
    setSelectedCity(null);
    setProvinceLocations(provinceLocations);
    setSelectedLocation(null);
    setViewLevel('cities');
    onProvinceSelect?.(provinceName);
    
    // Group locations by city
    const citiesInProvince = provinceLocations.reduce((acc, location) => {
      const city = location.city;
      if (!acc[city]) acc[city] = [];
      acc[city].push(location);
      return acc;
    }, {} as {[key: string]: any[]});
    
    setProvinceCities(citiesInProvince);
    
    // Clear province markers and add city markers
    clearMarkers();
    addCityMarkers(citiesInProvince);
    
    // Animate to province
    map.current?.flyTo({
      center: coordinates as [number, number],
      zoom: 9,
      duration: 2000
    });
  };

  // Handle city selection
  const handleCitySelect = (cityName: string, cityLocations: any[], coordinates: number[]) => {
    setSelectedCity(cityName);
    setCityLocations(cityLocations);
    setSelectedLocation(null);
    setViewLevel('locations');
    
    // Clear city markers and add location markers
    clearMarkers();
    addLocationMarkers(cityLocations);
    
    // Animate to city
    map.current?.flyTo({
      center: coordinates as [number, number],
      zoom: 12,
      duration: 2000
    });
  };

  // Reset view function
  const resetView = () => {
    setSelectedProvince(null);
    setSelectedCity(null);
    setProvinceLocations([]);
    setProvinceCities({});
    setCityLocations([]);
    setSelectedLocation(null);
    setViewLevel('provinces');
    clearMarkers();
    
    // Re-add province markers
    if (map.current) {
      bulgariaProvinces.forEach((province) => {
        const provinceLocations = locations.filter(loc => 
          loc.city.toLowerCase().includes(province.nameEn.toLowerCase()) ||
          loc.city.toLowerCase().includes(province.name.toLowerCase())
        );
        
        const locationCount = provinceLocations.length;
        
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
          pointer-events: none;
        `;
        content.innerHTML = `${locationCount}<br><span style="font-size: 8px;">${province.name}</span>`;
        el.appendChild(content);

        el.addEventListener('click', () => {
          handleProvinceSelect(province.name, provinceLocations, province.coordinates);
        });

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat([province.coordinates[0], province.coordinates[1]])
          .addTo(map.current!);
        
        markersRef.current.push(marker);
      });
    }
    
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
        <Button onClick={resetView} variant="outline" className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4" />
          Покажи всички региони
        </Button>
      </div>
      
      <div className="relative">
        {/* Map Container - Made taller */}
        <div
          ref={mapContainer}
          className="w-full h-[500px] rounded-lg overflow-hidden border border-border shadow-lg"
        />
        
        {/* Navigation Info */}
        {(selectedProvince || selectedCity) && (
          <div className="absolute top-4 left-4 z-10">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div className="flex flex-col">
                    {selectedCity ? (
                      <>
                        <span className="font-bold text-lg">{selectedCity}</span>
                        <span className="text-sm text-muted-foreground">{selectedProvince}</span>
                      </>
                    ) : (
                      <span className="font-bold text-lg">{selectedProvince}</span>
                    )}
                  </div>
                </div>
                <Badge variant="secondary">
                  {selectedCity 
                    ? `${cityLocations.length} офиса`
                    : `${Object.keys(provinceCities).length} града, ${provinceLocations.length} офиса`
                  }
                </Badge>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Location Preview Popup */}
        {selectedLocation && (
          <div className="absolute top-4 right-4 z-20 w-80">
            <Card className="shadow-xl">
              <div className="relative">
                {selectedLocation.image && (
                  <img
                    src={selectedLocation.image}
                    alt={selectedLocation.name}
                    className="w-full h-32 object-cover rounded-t-lg"
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 bg-background/80 hover:bg-background"
                  onClick={() => setSelectedLocation(null)}
                >
                  ×
                </Button>
              </div>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedLocation.name}</h3>
                    {selectedLocation.companies && (
                      <p className="text-sm text-muted-foreground">{selectedLocation.companies.name}</p>
                    )}
                  </div>

                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{selectedLocation.address}</span>
                  </div>

                  {selectedLocation.amenities && selectedLocation.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedLocation.amenities.slice(0, 4).map((amenity: string) => {
                        const IconComponent = amenityIcons[amenity as keyof typeof amenityIcons];
                        return (
                          <div key={amenity} className="flex items-center text-xs text-muted-foreground">
                            {IconComponent && <IconComponent className="h-3 w-3 mr-1" />}
                            <span className="capitalize">{amenity}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    {selectedLocation.price_day && (
                      <div>
                        <span className="text-lg font-semibold">{selectedLocation.price_day}лв</span>
                        <span className="text-sm text-muted-foreground">/ден</span>
                      </div>
                    )}
                    {selectedLocation.rating && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {selectedLocation.rating}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Province List - Always visible */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-6">
        {bulgariaProvinces.map((province) => {
          const provinceLocations = locations.filter(loc => 
            loc.city.toLowerCase().includes(province.nameEn.toLowerCase()) ||
            loc.city.toLowerCase().includes(province.name.toLowerCase())
          );
          
          const isSelected = selectedProvince === province.name;
          
          return (
            <div
              key={province.name}
              onClick={() => {
                if (isSelected) {
                  resetView();
                } else {
                  handleProvinceSelect(province.name, provinceLocations, province.coordinates);
                }
              }}
              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:scale-105 ${
                isSelected ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : ''
              }`}
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

      {/* Cities in Province */}
      {selectedProvince && !selectedCity && Object.keys(provinceCities).length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-4">
            Градове в {selectedProvince}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(provinceCities).map(([cityName, cityLocations]) => (
              <div
                key={cityName}
                onClick={() => {
                  const avgLat = cityLocations.reduce((sum, loc) => sum + parseFloat(loc.latitude), 0) / cityLocations.length;
                  const avgLng = cityLocations.reduce((sum, loc) => sum + parseFloat(loc.longitude), 0) / cityLocations.length;
                  handleCitySelect(cityName, cityLocations, [avgLng, avgLat]);
                }}
                className="p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:border-secondary hover:bg-secondary/5 hover:scale-105"
              >
                <div className="text-center">
                  <h5 className="font-semibold text-sm">{cityName}</h5>
                  <p className="text-xs text-muted-foreground">
                    {cityLocations.length} офиса
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locations in City */}
      {selectedCity && cityLocations.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-4">
            Офиси в {selectedCity}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cityLocations.map((location) => (
              <Card 
                key={location.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedLocation(location)}
              >
                <CardContent className="p-4">
                  <h5 className="font-semibold mb-2">{location.name}</h5>
                  <div className="flex items-center text-sm text-muted-foreground mb-2">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{location.address}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    {location.price_day && (
                      <Badge variant="outline">
                        {location.price_day} лв./ден
                      </Badge>
                    )}
                    {location.rating && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {location.rating}
                      </Badge>
                    )}
                  </div>
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