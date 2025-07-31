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
        position: absolute;
        transform: translate(-50%, -50%);
        transform-origin: center center;
        box-shadow: 0 4px 12px hsl(var(--primary) / 0.4);
        will-change: transform;
      `;


      el.addEventListener('click', () => {
        setSelectedLocation(location);
      });

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center'
      })
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

      const el = document.createElement('div');
      el.className = 'city-marker';
      el.style.cssText = `
        width: ${Math.max(45, cityLocations.length * 10)}px;
        height: ${Math.max(45, cityLocations.length * 10)}px;
        background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 50%, hsl(var(--primary-foreground)) 100%);
        border: 3px solid hsl(var(--background));
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.3s ease;
        position: absolute;
        transform: translate(-50%, -50%);
        transform-origin: center center;
        box-shadow: 0 8px 25px hsl(var(--primary) / 0.4);
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
      content.innerHTML = `${cityLocations.length}<br><span style="font-size: 8px;">${cityName}</span>`;
      el.appendChild(content);

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

      const el = document.createElement('div');
      el.className = 'city-marker';
      el.style.cssText = `
        width: ${Math.max(45, cityLocations.length * 10)}px;
        height: ${Math.max(45, cityLocations.length * 10)}px;
        background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 50%, hsl(var(--primary-foreground)) 100%);
        border: 3px solid hsl(var(--background));
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.3s ease;
        position: absolute;
        transform: translate(-50%, -50%);
        transform-origin: center center;
        box-shadow: 0 8px 25px hsl(var(--primary) / 0.4);
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
      content.innerHTML = `${cityLocations.length}<br><span style="font-size: 8px;">${cityName}</span>`;
      el.appendChild(content);

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

  // Add all location markers from all cities
  const addAllLocationMarkers = () => {
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
        position: absolute;
        transform: translate(-50%, -50%);
        transform-origin: center center;
        box-shadow: 0 4px 12px hsl(var(--primary) / 0.4);
        will-change: transform;
      `;

      el.addEventListener('click', () => {
        setSelectedLocation(location);
      });

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat([parseFloat(location.longitude.toString()), parseFloat(location.latitude.toString())])
        .addTo(map.current!);
      
      markersRef.current.push(marker);
    });
  };

  // Function to update markers based on zoom level
  const updateMarkersBasedOnZoom = (zoomLevel: number) => {
    if (!selectedProvince && !selectedCity) { // Only if no manual selection
      if (zoomLevel >= 10) {
        // High zoom: Show all individual locations
        if (viewLevel !== 'locations') {
          setViewLevel('locations');
          addAllLocationMarkers();
        }
      } else if (zoomLevel >= 8) {
        // Medium zoom: Show all cities
        if (viewLevel !== 'cities') {
          setViewLevel('cities');
          addAllCityMarkers();
        }
      } else {
        // Low zoom: Show provinces
        if (viewLevel !== 'provinces') {
          setViewLevel('provinces');
          // Re-add province markers
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
            content.innerHTML = `${locationCount}<br><span style="font-size: 8px;">${province.name}</span>`;
            el.appendChild(content);

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
        }
      }
    }
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
        const data = provinceData[province.name];
        if (!data || data.locations.length === 0) return;
        
        const locationCount = data.locations.length;
        
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

        // Add hover effects without popup (fix positioning issue)
        el.addEventListener('mouseenter', () => {
          setHoveredProvince(province.name);
        });

        el.addEventListener('mouseleave', () => {
          setHoveredProvince(null);
        });

        el.addEventListener('click', () => {
          handleProvinceSelect(province.name, data.locations, data.coordinates);
        });

        // Add marker to map with fixed positioning
        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat(data.coordinates)
          .addTo(map.current!);
        
        markersRef.current.push(marker);
      });
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add zoom event listener for dynamic pin visibility
    map.current.on('zoom', () => {
      if (map.current) {
        const zoomLevel = map.current.getZoom();
        updateMarkersBasedOnZoom(zoomLevel);
      }
    });

    return () => {
      clearMarkers();
      map.current?.remove();
    };
  }, [mapboxToken, locations, onProvinceSelect, provinceData]);

  // Handle province selection
  const handleProvinceSelect = (provinceName: string, provinceLocations: any[], coordinates: number[]) => {
    setSelectedProvince(provinceName);
    setSelectedCity(null);
    setProvinceLocations(provinceLocations);
    setSelectedLocation(null);
    setViewLevel('cities');
    onProvinceSelect?.(provinceName);
    
    // Group locations by cleaned city name for better grouping
    const citiesInProvince = provinceLocations.reduce((acc, location) => {
      if (!location.city) return acc;
      
      // Clean the city name to remove province suffixes and extra info
      const cleanCity = location.city
        .replace(/област$/, '')
        .replace(/,.*$/, '') // Remove everything after comma
        .trim();
      
      if (!acc[cleanCity]) acc[cleanCity] = [];
      acc[cleanCity].push(location);
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
          className="w-full h-[600px] rounded-lg overflow-hidden border border-border shadow-lg"
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
          const data = provinceData[province.name];
          if (!data || data.locations.length === 0) return null;
          
          const isSelected = selectedProvince === province.name;
          
          return (
            <div
              key={province.name}
              onClick={() => {
                if (isSelected) {
                  resetView();
                } else {
                  handleProvinceSelect(province.name, data.locations, data.coordinates);
                }
              }}
              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:scale-105 ${
                isSelected ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : ''
              }`}
            >
              <div className="text-center">
                <h4 className="font-semibold text-sm">{province.name}</h4>
                <p className="text-xs text-muted-foreground">
                  {data.locations.length} офиса
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
                  const validLocations = cityLocations.filter(loc => loc.latitude && loc.longitude);
                  if (validLocations.length === 0) return;
                   const avgLat = validLocations.reduce((sum, loc) => sum + parseFloat(loc.latitude.toString()), 0) / validLocations.length;
                   const avgLng = validLocations.reduce((sum, loc) => sum + parseFloat(loc.longitude.toString()), 0) / validLocations.length;
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