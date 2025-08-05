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

// Bulgaria provinces (oblasti) - coordinates will be calculated dynamically from actual location data
const bulgariaProvinces = [
  { name: 'София', nameEn: 'Sofia', searchTerms: ['софия', 'sofia'] },
  { name: 'Пловдив', nameEn: 'Plovdiv', searchTerms: ['пловдив', 'plovdiv'] },
  { name: 'Варна', nameEn: 'Varna', searchTerms: ['варна', 'varna', 'белослав', 'beloslav', 'девня', 'devnya'] },
  { name: 'Бургас', nameEn: 'Burgas', searchTerms: ['бургас', 'burgas'] },
  { name: 'Русе', nameEn: 'Ruse', searchTerms: ['русе', 'ruse'] },
  { name: 'Стара Загора', nameEn: 'Stara Zagora', searchTerms: ['стара загора', 'stara zagora'] },
  { name: 'Плевен', nameEn: 'Pleven', searchTerms: ['плевен', 'pleven'] },
  { name: 'Сливен', nameEn: 'Sliven', searchTerms: ['сливен', 'sliven'] },
  { name: 'Благоевград', nameEn: 'Blagoevgrad', searchTerms: ['благоевград', 'blagoevgrad'] },
  { name: 'Велико Търново', nameEn: 'Veliko Tarnovo', searchTerms: ['велико търново', 'veliko tarnovo'] },
  { name: 'Видин', nameEn: 'Vidin', searchTerms: ['видин', 'vidin'] },
  { name: 'Враца', nameEn: 'Vratsa', searchTerms: ['враца', 'vratsa'] },
  { name: 'Габрово', nameEn: 'Gabrovo', searchTerms: ['габрово', 'gabrovo'] },
  { name: 'Добрич', nameEn: 'Dobrich', searchTerms: ['добрич', 'dobrich'] },
  { name: 'Кърджали', nameEn: 'Kardzhali', searchTerms: ['кърджали', 'kardzhali'] },
  { name: 'Кюстендил', nameEn: 'Kyustendil', searchTerms: ['кюстендил', 'kyustendil'] },
  { name: 'Ловеч', nameEn: 'Lovech', searchTerms: ['ловеч', 'lovech'] },
  { name: 'Монтана', nameEn: 'Montana', searchTerms: ['монтана', 'montana'] },
  { name: 'Пазарджик', nameEn: 'Pazardzhik', searchTerms: ['пазарджик', 'pazardzhik'] },
  { name: 'Перник', nameEn: 'Pernik', searchTerms: ['перник', 'pernik'] },
  { name: 'Разград', nameEn: 'Razgrad', searchTerms: ['разград', 'razgrad'] },
  { name: 'Шумен', nameEn: 'Shumen', searchTerms: ['шумен', 'shumen'] },
  { name: 'Силистра', nameEn: 'Silistra', searchTerms: ['силистра', 'silistra'] },
  { name: 'Смолян', nameEn: 'Smolyan', searchTerms: ['смолян', 'smolyan'] },
  { name: 'Хаскрво', nameEn: 'Haskovo', searchTerms: ['хаскрво', 'haskovo'] },
  { name: 'Търговище', nameEn: 'Targovishte', searchTerms: ['търговище', 'targovishte'] },
  { name: 'Ямбол', nameEn: 'Yambol', searchTerms: ['ямбол', 'yambol'] },
];

interface InteractiveMapCopyProps {
  onProvinceSelect?: (provinceName: string) => void;
}

const InteractiveMapCopy = ({ onProvinceSelect }: InteractiveMapCopyProps) => {
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
  const [provinceData, setProvinceData] = useState<{[key: string]: {locations: any[], coordinates: [number, number]}}>({}); 
  const { locations } = useLocations();

  // Helper function to clean city names for better grouping
  const cleanCityName = (city: string): string => {
    return city.toLowerCase()
      .replace(/област$/, '')
      .replace(/region$/, '')
      .replace(/,.*$/, '') // Remove everything after comma
      .trim();
  };

  // Helper function to get locations for a province
  const getLocationsForProvince = (province: any) => {
    return locations.filter(location => {
      if (!location.city) return false;
      const cleanLocationCity = cleanCityName(location.city);
      return province.searchTerms.some((term: string) => 
        cleanLocationCity.includes(term.toLowerCase()) || 
        term.toLowerCase().includes(cleanLocationCity)
      );
    });
  };

  // Calculate province coordinates and cache them
  useEffect(() => {
    const newProvinceData: {[key: string]: {locations: any[], coordinates: [number, number]}} = {};
    
    bulgariaProvinces.forEach(province => {
      const provinceLocations = getLocationsForProvince(province);
      
      if (provinceLocations.length > 0) {
        // Calculate average coordinates from actual locations
        const validLocations = provinceLocations.filter(loc => loc.latitude && loc.longitude);
        if (validLocations.length > 0) {
          const avgLat = validLocations.reduce((sum, loc) => sum + parseFloat(loc.latitude.toString()), 0) / validLocations.length;
          const avgLng = validLocations.reduce((sum, loc) => sum + parseFloat(loc.longitude.toString()), 0) / validLocations.length;
          newProvinceData[province.name] = {
            locations: provinceLocations,
            coordinates: [avgLng, avgLat]
          };
        }
      }
    });
    
    setProvinceData(newProvinceData);
  }, [locations]);

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

  // Create optimized marker element to reduce lag
  const createMarkerElement = (size: number, color: string, borderColor: string = 'hsl(var(--background))') => {
    const el = document.createElement('div');
    el.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: 2px solid ${borderColor};
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      transform-origin: center center;
      transition: transform 0.2s ease;
      will-change: transform;
    `;
    
    // Add smooth hover effect
    el.addEventListener('mouseenter', () => {
      el.style.transform = 'scale(1.1)';
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'scale(1)';
    });
    
    return el;
  };

  // Add province locations as individual markers
  const addLocationMarkers = (locations: any[]) => {
    clearMarkers();
    
    locations.forEach((location) => {
      if (!location.latitude || !location.longitude) return;

      const el = createMarkerElement(24, 'hsl(var(--primary))');


      el.addEventListener('click', () => {
        setSelectedLocation(location);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([parseFloat(location.longitude.toString()), parseFloat(location.latitude.toString())])
        .addTo(map.current!);
      
      markersRef.current.push(marker);
    });
  };

  // Add all cities from all provinces
  const addAllCityMarkers = () => {
    clearMarkers();
    
    const allCities: {[key: string]: any[]} = {};
    
    // Collect all cities from all provinces
    Object.values(provinceData).forEach(data => {
      data.locations.forEach(location => {
        if (!location.city) return;
        
        const cleanCity = location.city
          .replace(/област$/, '')
          .replace(/,.*$/, '') // Remove everything after comma
          .trim();
        
        if (!allCities[cleanCity]) allCities[cleanCity] = [];
        allCities[cleanCity].push(location);
      });
    });
    
    Object.entries(allCities).forEach(([cityName, cityLocations]) => {
      if (cityLocations.length === 0) return;
      
      // Calculate average coordinates for city center from valid locations only
      const validLocations = cityLocations.filter(loc => loc.latitude && loc.longitude);
      if (validLocations.length === 0) return;
      
       const avgLat = validLocations.reduce((sum, loc) => sum + parseFloat(loc.latitude.toString()), 0) / validLocations.length;
       const avgLng = validLocations.reduce((sum, loc) => sum + parseFloat(loc.longitude.toString()), 0) / validLocations.length;

      const size = Math.max(30, cityLocations.length * 6);
      const el = createMarkerElement(size, 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)');

      const content = document.createElement('div');
      content.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: hsl(var(--primary-foreground));
        font-size: 10px;
        font-weight: bold;
        text-align: center;
        line-height: 1;
        pointer-events: none;
      `;
      content.innerHTML = `${cityLocations.length}<br><span style=\"font-size: 8px;\">${cityName}</span>`;
      el.appendChild(content);

      el.addEventListener('click', () => {
        handleCitySelect(cityName, cityLocations, [avgLng, avgLat]);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([avgLng, avgLat])
        .addTo(map.current!);
      
      markersRef.current.push(marker);
    });
  };

  // Add city markers for a specific province
  const addCityMarkers = (cities: {[key: string]: any[]}) => {
    clearMarkers();
    
    Object.entries(cities).forEach(([cityName, cityLocations]) => {
      if (cityLocations.length === 0) return;
      
      // Calculate average coordinates for city center from valid locations only
      const validLocations = cityLocations.filter(loc => loc.latitude && loc.longitude);
      if (validLocations.length === 0) return;
      
       const avgLat = validLocations.reduce((sum, loc) => sum + parseFloat(loc.latitude.toString()), 0) / validLocations.length;
       const avgLng = validLocations.reduce((sum, loc) => sum + parseFloat(loc.longitude.toString()), 0) / validLocations.length;

      const size = Math.max(35, cityLocations.length * 8);
      const el = createMarkerElement(size, 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)');
      el.style.border = '3px solid hsl(var(--background))';
      el.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.4)';

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
      content.innerHTML = `${cityLocations.length}<br><span style=\"font-size: 8px;\">${cityName}</span>`;
      el.appendChild(content);

      el.addEventListener('click', () => {
        handleCitySelect(cityName, cityLocations, [avgLng, avgLat]);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([avgLng, avgLat])
        .addTo(map.current!);
      
      markersRef.current.push(marker);
    });
  };

  // Add all location markers from all cities
  const addAllLocationMarkers = () => {
    clearMarkers();
    
    locations.forEach((location) => {
      if (!location.latitude || !location.longitude) return;

      const el = createMarkerElement(16, 'hsl(var(--primary))');
      
      // Add debug info to verify coordinates
      console.log(`Location ${location.name}: lat=${location.latitude}, lng=${location.longitude}`);

      el.addEventListener('click', () => {
        setSelectedLocation(location);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([parseFloat(location.longitude.toString()), parseFloat(location.latitude.toString())])
        .addTo(map.current!);
      
      markersRef.current.push(marker);
    });
  };

  // Function to update markers based on zoom level
  const updateMarkersBasedOnZoom = (zoomLevel: number) => {
    console.log('Zoom level:', zoomLevel, 'Selected Province:', selectedProvince, 'Selected City:', selectedCity, 'View Level:', viewLevel);
    
    // Always auto-switch based on zoom level
    if (zoomLevel >= 10) {
      // High zoom: Show all individual locations
      if (viewLevel !== 'locations') {
        console.log('Switching to locations view');
        setViewLevel('locations');
        addAllLocationMarkers();
      }
    } else if (zoomLevel >= 8) {
      // Medium zoom: Show all cities
      if (viewLevel !== 'cities') {
        console.log('Switching to cities view');
        setViewLevel('cities');
        addAllCityMarkers();
      }
    } else {
      // Low zoom: Show provinces
      if (viewLevel !== 'provinces') {
        console.log('Switching to provinces view');
        setViewLevel('provinces');
        addProvinceMarkers();
      }
    }
  };

  // Extracted function to add province markers
  const addProvinceMarkers = () => {
    clearMarkers();
    bulgariaProvinces.forEach((province) => {
      const data = provinceData[province.name];
      if (!data || data.locations.length === 0) return;
      
      const locationCount = data.locations.length;
      
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
        position: absolute;
        transform: translate(-50%, -50%);
        transform-origin: center center;
        box-shadow: 
          0 0 0 0 hsl(var(--primary) / 0.7),
          0 8px 25px hsl(var(--primary) / 0.4),
          inset 0 1px 3px hsl(var(--primary-foreground) / 0.3);
        animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        will-change: transform;
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
      content.innerHTML = `${locationCount}<br><span style=\"font-size: 8px;\">${province.name}</span>`;
      el.appendChild(content);

      el.addEventListener('mouseenter', () => {
        setHoveredProvince(province.name);
      });

      el.addEventListener('mouseleave', () => {
        setHoveredProvince(null);
      });

      el.addEventListener('click', () => {
        handleProvinceSelect(province.name, data.locations, data.coordinates);
      });

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat(data.coordinates)
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
      minZoom: 2,
      // Remove maxBounds to allow scrolling anywhere
      renderWorldCopies: false
    });

    map.current.on('load', () => {
      // Add Bulgaria outline layer
      map.current!.addSource('bulgaria-outline', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [22.3, 41.2],
              [28.6, 41.2],
              [28.6, 44.2],
              [22.3, 44.2],
              [22.3, 41.2]
            ]]
          }
        }
      });

      map.current!.addLayer({
        id: 'bulgaria-outline-layer',
        type: 'fill',
        source: 'bulgaria-outline',
        layout: {},
        paint: {
          'fill-color': 'rgba(16, 185, 129, 0.1)',
          'fill-outline-color': 'hsl(var(--primary))'
        }
      });
    });

    map.current.on('zoom', () => {
      if (map.current) {
        updateMarkersBasedOnZoom(map.current.getZoom());
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [mapboxToken]);

  useEffect(() => {
    if (map.current && provinceData && Object.keys(provinceData).length > 0) {
      addProvinceMarkers();
    }
  }, [provinceData]);

  const handleProvinceSelect = (provinceName: string, locations: any[], coordinates: [number, number]) => {
    setSelectedProvince(provinceName);
    setSelectedCity(null);
    setSelectedLocation(null);
    setProvinceLocations(locations);
    setViewLevel('cities');

    // Group by city for province cities display
    const cities: {[key: string]: any[]} = {};
    locations.forEach(location => {
      if (!location.city) return;
      
      const cleanCity = location.city
        .replace(/област$/, '')
        .replace(/,.*$/, '') // Remove everything after comma
        .trim();
      
      if (!cities[cleanCity]) cities[cleanCity] = [];
      cities[cleanCity].push(location);
    });
    
    setProvinceCities(cities);

    if (map.current) {
      map.current.flyTo({
        center: coordinates,
        zoom: 8.5,
        duration: 1500
      });
      
      // Clear existing markers and add city markers
      clearMarkers();
      setTimeout(() => {
        addCityMarkers(cities);
      }, 800);
    }

    if (onProvinceSelect) {
      onProvinceSelect(provinceName);
    }
  };

  const handleCitySelect = (cityName: string, locations: any[], coordinates: [number, number]) => {
    setSelectedCity(cityName);
    setSelectedLocation(null);
    setCityLocations(locations);
    setViewLevel('locations');

    if (map.current) {
      map.current.flyTo({
        center: coordinates,
        zoom: 11,
        duration: 1000
      });
      
      // Clear existing markers and add location markers
      clearMarkers();
      setTimeout(() => {
        addLocationMarkers(locations);
      }, 600);
    }
  };

  const resetView = () => {
    setSelectedProvince(null);
    setSelectedCity(null);
    setSelectedLocation(null);
    setProvinceLocations([]);
    setProvinceCities({});
    setCityLocations([]);
    setViewLevel('provinces');

    if (map.current) {
      map.current.flyTo({
        center: [25.4858, 42.7339],
        zoom: 6.5,
        duration: 1500
      });
      
      // Clear existing markers and add province markers
      clearMarkers();
      setTimeout(() => {
        addProvinceMarkers();
      }, 800);
    }
  };

  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center h-96 bg-secondary/20 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div className="bg-card rounded-lg shadow-lg overflow-hidden">
        <div className="relative">
          <div
            ref={mapContainer}
            className="w-full h-96 lg:h-[500px]"
          />
          
          {/* Reset button */}
          {(selectedProvince || selectedCity) && (
            <Button
              onClick={resetView}
              variant="secondary"
              size="sm"
              className="absolute top-4 right-4 z-10 bg-background/90 backdrop-blur-sm"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset View
            </Button>
          )}
        </div>

        {/* Province preview card */}
        {hoveredProvince && !selectedProvince && (
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <Card className="bg-background/90 backdrop-blur-sm border-primary/20">
              <CardContent className="p-3">
                <h3 className="font-semibold text-sm">{hoveredProvince}</h3>
                <p className="text-xs text-muted-foreground">
                  {provinceData[hoveredProvince]?.locations.length || 0} locations
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Selected location preview */}
        {selectedLocation && (
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <Card className="bg-background/95 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-2">{selectedLocation.name}</h3>
                    <div className="flex items-center text-sm text-muted-foreground mb-2">
                      <MapPin className="h-4 w-4 mr-1" />
                      {selectedLocation.address}
                    </div>
                    {selectedLocation.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {selectedLocation.description}
                      </p>
                    )}
                    
                    {/* Amenities */}
                    {selectedLocation.amenities && selectedLocation.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {selectedLocation.amenities.slice(0, 4).map((amenity: string, index: number) => {
                          const IconComponent = amenityIcons[amenity as keyof typeof amenityIcons];
                          return (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {IconComponent && <IconComponent className="h-3 w-3 mr-1" />}
                              {amenity}
                            </Badge>
                          );
                        })}
                        {selectedLocation.amenities.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{selectedLocation.amenities.length - 4} more
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {/* Rating */}
                    {selectedLocation.rating && (
                      <div className="flex items-center text-sm">
                        <Star className="h-4 w-4 text-yellow-500 mr-1" fill="currentColor" />
                        <span className="font-medium mr-1">{selectedLocation.rating}</span>
                        <span className="text-muted-foreground">({selectedLocation.review_count || 0} reviews)</span>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="ml-4 shrink-0"
                    onClick={() => window.open(`/locations/${selectedLocation.id}`, '_blank')}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Province list */}
        {!selectedProvince && (
          <div className="p-6 border-t">
            <h3 className="text-lg font-semibold mb-4">Top Provinces</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(provinceData)
                .sort(([,a], [,b]) => b.locations.length - a.locations.length)
                .slice(0, 6)
                .map(([provinceName, data]) => (
                <Card 
                  key={provinceName}
                  className="cursor-pointer hover:shadow-md transition-shadow border-muted"
                  onClick={() => handleProvinceSelect(provinceName, data.locations, data.coordinates)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{provinceName}</h4>
                      <Badge variant="secondary">{data.locations.length}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* City list for selected province */}
        {selectedProvince && !selectedCity && (
          <div className="p-6 border-t">
            <h3 className="text-lg font-semibold mb-4">Cities in {selectedProvince}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(provinceCities)
                .sort(([,a], [,b]) => b.length - a.length)
                .map(([cityName, cityLocations]) => {
                  // Calculate average coordinates
                  const validLocations = cityLocations.filter(loc => loc.latitude && loc.longitude);
                  if (validLocations.length === 0) return null;
                  
                  const avgLat = validLocations.reduce((sum, loc) => sum + parseFloat(loc.latitude.toString()), 0) / validLocations.length;
                  const avgLng = validLocations.reduce((sum, loc) => sum + parseFloat(loc.longitude.toString()), 0) / validLocations.length;
                  
                  return (
                    <Card 
                      key={cityName}
                      className="cursor-pointer hover:shadow-md transition-shadow border-muted"
                      onClick={() => handleCitySelect(cityName, cityLocations, [avgLng, avgLat])}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{cityName}</h4>
                          <Badge variant="secondary">{cityLocations.length}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        )}

        {/* Location list for selected city */}
        {selectedCity && (
          <div className="p-6 border-t max-h-64 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Locations in {selectedCity}</h3>
            <div className="space-y-3">
              {cityLocations.map((location) => (
                <Card 
                  key={location.id}
                  className="cursor-pointer hover:shadow-md transition-shadow border-muted"
                  onClick={() => setSelectedLocation(location)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium mb-1">{location.name}</h4>
                        <p className="text-sm text-muted-foreground">{location.address}</p>
                        {location.rating && (
                          <div className="flex items-center mt-2">
                            <Star className="h-3 w-3 text-yellow-500 mr-1" fill="currentColor" />
                            <span className="text-sm">{location.rating}</span>
                          </div>
                        )}
                      </div>
                      <Button size="sm" variant="outline">
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse-ring {
          0% {
            box-shadow: 
              0 0 0 0 hsl(var(--primary) / 0.7),
              0 8px 25px hsl(var(--primary) / 0.4),
              inset 0 1px 3px hsl(var(--primary-foreground) / 0.3);
          }
          70% {
            box-shadow: 
              0 0 0 10px hsl(var(--primary) / 0),
              0 8px 25px hsl(var(--primary) / 0.4),
              inset 0 1px 3px hsl(var(--primary-foreground) / 0.3);
          }
          100% {
            box-shadow: 
              0 0 0 0 hsl(var(--primary) / 0),
              0 8px 25px hsl(var(--primary) / 0.4),
              inset 0 1px 3px hsl(var(--primary-foreground) / 0.3);
          }
        }

        .mapboxgl-popup-content {
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          box-shadow: 0 4px 12px hsl(var(--background) / 0.1);
          padding: 0;
          min-width: 200px;
        }

        .mapboxgl-popup-tip {
          border-top-color: hsl(var(--background));
        }

        .mapboxgl-popup-close-button {
          color: hsl(var(--muted-foreground));
          font-size: 20px;
          padding: 8px;
        }

        .mapboxgl-popup-close-button:hover {
          color: hsl(var(--foreground));
          background: transparent;
        }
      `}</style>
    </div>
  );
};

export default InteractiveMapCopy;
