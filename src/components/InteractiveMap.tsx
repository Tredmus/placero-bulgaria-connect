import React, { useEffect, useState, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';

const GEOJSON_URL = '/data/bg_provinces.geojson';

// Province data for matching cities to provinces
const provinces = [
  { name: 'Sofia', name_en: 'Sofia', searchTerms: ['Sofia', 'Драгоман', 'Ихтиман', 'Годеч', 'Свище', 'Чавдар', 'Челопеч', 'Нови хан', 'Своге', 'Лесново', 'Пирдоп', 'Мирково', 'Елин Пелин', 'Дупница', 'Перник', 'Радомир', 'Брезник', 'Земен', 'Ковачевци', 'Трън', 'Зверино', 'Благоевград', 'Сапарева баня', 'Рила', 'Кочериново', 'Рилски манастир'] },
  { name: 'Varna', name_en: 'Varna', searchTerms: ['Варна', 'Varna', 'Аксаково', 'Белослав', 'Бяла', 'Ветрино', 'Вълчи дол', 'Девня', 'Дългопол', 'Завет', 'Каварна', 'Провадия', 'Суворово', 'Шумен', 'Търговище', 'Балчик', 'Добрич', 'Генерал Тошево', 'Кавалджиево', 'Крушари', 'Тервел', 'Шабла'] },
  { name: 'Plovdiv', name_en: 'Plovdiv', searchTerms: ['Пловдив', 'Plovdiv', 'Асеновград', 'Брацигово', 'Калояново', 'Кричим', 'Куклен', 'Лъки', 'Марица', 'Пещера', 'Първомай', 'Раковски', 'Родопи', 'Садово', 'Сопот', 'Стамболийски', 'Съединение', 'Хисаря', 'Черепиш'] }
];

function cleanCityName(city: string): string {
  return city.toLowerCase().trim();
}

function getProvinceForCity(city: string): string | null {
  const cleanCity = cleanCityName(city);
  for (const province of provinces) {
    if (province.searchTerms.some(term => cleanCityName(term) === cleanCity)) {
      return province.name_en;
    }
  }
  return null;
}

export default function InteractiveMap() {
  const { locations } = useLocations();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [markers, setMarkers] = useState<mapboxgl.Marker[]>([]);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          console.error('No Mapbox token received');
          setMapboxToken('fallback-token');
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        setMapboxToken('fallback-token');
      }
    };

    fetchToken();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || mapboxToken === 'fallback-token') return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [25.4858, 42.7339],
      zoom: 6.5,
      pitch: 45,
      bearing: 0
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      loadProvinceLayer();
      setIsLoading(false);
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  const loadProvinceLayer = async () => {
    if (!map.current) return;

    try {
      const response = await fetch(GEOJSON_URL);
      const provinces = await response.json();

      map.current.addSource('provinces', {
        type: 'geojson',
        data: provinces
      });

      map.current.addLayer({
        id: 'provinces-fill',
        type: 'fill',
        source: 'provinces',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'name_en'], selectedProvince || ''],
            '#22c55e',
            '#10b981'
          ],
          'fill-opacity': 0.6
        }
      });

      map.current.addLayer({
        id: 'provinces-border',
        type: 'line',
        source: 'provinces',
        paint: {
          'line-color': '#ffffff',
          'line-width': 1,
          'line-opacity': 0.8
        }
      });

      map.current.on('click', 'provinces-fill', (e) => {
        if (e.features && e.features[0]) {
          const provinceName = e.features[0].properties?.name_en || e.features[0].properties?.name;
          handleProvinceClick(provinceName);
        }
      });

      map.current.on('mouseenter', 'provinces-fill', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', 'provinces-fill', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });

    } catch (error) {
      console.error('Error loading provinces:', error);
    }
  };

  const handleProvinceClick = useCallback((provinceName: string) => {
    setSelectedProvince(provinceName);
    
    // Update province styling
    if (map.current && map.current.getLayer('provinces-fill')) {
      map.current.setPaintProperty('provinces-fill', 'fill-color', [
        'case',
        ['==', ['get', 'name_en'], provinceName],
        '#22c55e',
        '#10b981'
      ]);
    }

    // Filter and show locations for this province
    const provinceLocations = locations.filter(location => {
      if (!location.city) return false;
      return getProvinceForCity(location.city) === provinceName;
    });

    // Clear existing markers
    markers.forEach(marker => marker.remove());
    
    // Add new markers
    const newMarkers = provinceLocations
      .filter(location => location.latitude && location.longitude)
      .map(location => {
        const marker = new mapboxgl.Marker({ color: '#ef4444' })
          .setLngLat([location.longitude, location.latitude])
          .setPopup(new mapboxgl.Popup().setHTML(`
            <div class="p-2">
              <h3 class="font-bold">${location.name}</h3>
              <p class="text-sm">${location.city}</p>
              <p class="text-xs text-muted-foreground">${location.address}</p>
            </div>
          `))
          .addTo(map.current!);
        
        return marker;
      });

    setMarkers(newMarkers);

    // Fly to province bounds
    if (provinceLocations.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      provinceLocations.forEach(location => {
        if (location.latitude && location.longitude) {
          bounds.extend([location.longitude, location.latitude]);
        }
      });
      
      if (map.current) {
        map.current.fitBounds(bounds, { padding: 50, duration: 1000 });
      }
    }
  }, [locations, markers]);

  if (!mapboxToken || mapboxToken === 'fallback-token') {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-muted rounded-lg">
        <div className="text-center">
          <p className="text-muted-foreground">Loading map...</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please ensure Mapbox token is configured in Supabase Edge Function Secrets
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      )}

      {selectedProvince && (
        <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
          <h3 className="font-semibold mb-2">{selectedProvince} Province</h3>
          <p className="text-sm text-muted-foreground">
            {markers.length} location{markers.length !== 1 ? 's' : ''} found
          </p>
          <button 
            onClick={() => {
              setSelectedProvince(null);
              markers.forEach(marker => marker.remove());
              setMarkers([]);
              if (map.current) {
                map.current.flyTo({ center: [25.4858, 42.7339], zoom: 6.5, duration: 1000 });
              }
            }}
            className="text-xs text-primary mt-2 hover:underline"
          >
            Reset view
          </button>
        </div>
      )}
    </div>
  );
}
