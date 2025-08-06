import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useLocations } from '@/hooks/useLocations';
import { Button } from '@/components/ui/button';
import { RotateCcw, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import * as turf from '@turf/turf';

const BULGARIA_CENTER: [number, number] = [25.4858, 42.7339];
const PROVINCES_GEOJSON_URL = '/data/bg_provinces.geojson';

const InteractiveMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map>();
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const { locations } = useLocations({});

  // fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-mapbox-token');
        const tk = data?.token || 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        mapboxgl.accessToken = tk;
        setToken(tk);
      } catch {
        const fallback = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        mapboxgl.accessToken = fallback;
        setToken(fallback);
      }
    };
    fetchToken();
  }, []);

  // initialize map
  useEffect(() => {
    if (!token || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: BULGARIA_CENTER,
      zoom: 6,
      pitch: 45,
      bearing: -17,
      antialias: true,
    });

    const m = map.current;
    m.addControl(new mapboxgl.NavigationControl(), 'top-right');

    m.on('load', () => {
      setLoading(false);
      // add provinces source
      m.addSource('provinces', { type: 'geojson', data: PROVINCES_GEOJSON_URL });
      // extrusion layer
      m.addLayer({
        id: 'province-extrusion',
        type: 'fill-extrusion',
        source: 'provinces',
        paint: {
          'fill-extrusion-color': '#10b981',
          'fill-extrusion-height': 0,
          'fill-extrusion-opacity': 0.6,
        }
      });

      // hover logic
      let hoverId: number | null = null;
      m.on('mousemove', 'province-extrusion', e => {
        if (!e.features?.length) return;
        if (hoverId !== null) {
          m.setFeatureState({ source: 'provinces', id: hoverId }, { hover: false });
        }
        hoverId = e.features[0].id as number;
        m.setFeatureState({ source: 'provinces', id: hoverId }, { hover: true });
        m.getCanvas().style.cursor = 'pointer';
      });
      m.on('mouseleave', 'province-extrusion', () => {
        if (hoverId !== null) {
          m.setFeatureState({ source: 'provinces', id: hoverId }, { hover: false });
        }
        hoverId = null;
        m.getCanvas().style.cursor = '';
      });

      // click logic
      m.on('click', 'province-extrusion', async e => {
        if (!e.features?.length) return;
        const feature = e.features[0];
        const name = feature.properties?.name_en || feature.properties?.name;
        setSelectedProvince(name);

        // highlight selection
        m.setPaintProperty('province-extrusion', 'fill-extrusion-height', [
          'case', ['==', ['get', 'name_en'], name], 300000, 0
        ]);

        // fly to province
        const center = turf.center(feature).geometry.coordinates as [number, number];
        m.flyTo({ center, zoom: 8, pitch: 60, duration: 1500 });

        // add markers
        clearMarkers();
        const filtered = locations.filter(loc => loc.city?.toLowerCase().includes(name.toLowerCase()));
        filtered.forEach(loc => {
          if (!loc.latitude || !loc.longitude) return;
          const el = document.createElement('div');
          el.style.cssText = 'width:20px;height:20px;background:#10b981;border-radius:50%;cursor:pointer;';
          el.addEventListener('click', () => alert(loc.name));
          const marker = new mapboxgl.Marker(el)
            .setLngLat([parseFloat(loc.longitude?.toString() || '0'), parseFloat(loc.latitude?.toString() || '0')])
            .addTo(m);
          markersRef.current.push(marker);
        });
      });

      // reset when clicking backdrop
      m.on('click', e => {
        if (e.features?.[0]?.layer.id !== 'province-extrusion') {
          resetView();
        }
      });
    });

    return () => { map.current?.remove(); };
  }, [token, locations]);

  const clearMarkers = () => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
  };

  const resetView = () => {
    if (!map.current) return;
    clearMarkers();
    setSelectedProvince(null);
    map.current.setPaintProperty('province-extrusion', 'fill-extrusion-height', 0);
    map.current.flyTo({ center: BULGARIA_CENTER, zoom: 6, pitch: 45, bearing: -17, duration: 1500 });
  };

  if (loading) {
    return <div className="h-96 flex items-center justify-center">Loading map...</div>;
  }

  return (
    <div className="relative">
      {selectedProvince && (
        <Button
          onClick={resetView}
          className="absolute top-4 left-4 z-10"
          variant="outline"
        >
          <RotateCcw className="w-4 h-4 mr-1" /> Reset
        </Button>
      )}
      <div ref={mapContainer} className="w-full h-[600px]" />
    </div>
  );
};

export default InteractiveMap;
