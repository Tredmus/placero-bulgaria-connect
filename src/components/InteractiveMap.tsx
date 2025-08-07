import React, { useEffect, useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';

const GEOJSON_URL = '/data/bg_provinces.geojson';
const SATELLITE_BASE_ELEVATION = 5000;
const PROVINCE_BASE_ELEVATION = 15000;
const PROVINCE_SELECTED_ELEVATION = 25000;

const INITIAL_VIEW_STATE = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 6.5,
  pitch: 30,
  bearing: 0,
  transitionDuration: 0
};

export default function InteractiveMap() {
  const { locations } = useLocations();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const deckRef = useRef<any>(null);
  
  const [provinces, setProvinces] = useState<any>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [cityPoints, setCityPoints] = useState<any[]>([]);
  const [locationPoints, setLocationPoints] = useState<any[]>([]);
  const [elevationMap, setElevationMap] = useState<Record<string, number>>({});
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          const token = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
          setMapboxToken(token);
        }
      } catch (error) {
        console.log('Edge function not available, using fallback token');
        const token = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        setMapboxToken(token);
      }
    };
    
    fetchMapboxToken();
  }, []);

  // Initialize Mapbox base map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9', // Use satellite as base
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom,
      pitch: INITIAL_VIEW_STATE.pitch,
      bearing: INITIAL_VIEW_STATE.bearing,
      maxBounds: [[22.0, 40.9], [29.0, 44.5]], // Bulgaria bounds
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Sync viewState when Mapbox camera changes
    map.current.on('move', () => {
      if (!map.current) return;
      const center = map.current.getCenter();
      const zoom = map.current.getZoom();
      const pitch = map.current.getPitch();
      const bearing = map.current.getBearing();
      
      setViewState({
        longitude: center.lng,
        latitude: center.lat,
        zoom,
        pitch,
        bearing,
        transitionDuration: 0
      });
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Load provinces GeoJSON
  useEffect(() => {
    console.log('Loading GeoJSON from:', GEOJSON_URL);
    fetch(GEOJSON_URL)
      .then(res => {
        console.log('GeoJSON fetch response:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('GeoJSON loaded:', data);
        setProvinces(data);
      })
      .catch(error => {
        console.error('Error loading GeoJSON:', error);
      });
  }, []);

  // Process location data based on selected province
  useEffect(() => {
    if (selectedProvince) {
      const filtered = locations.filter(l => l.city === selectedProvince && l.latitude && l.longitude);
      const cities: Record<string, any[]> = {};
      filtered.forEach(l => {
        const city = l.city || '';
        if (!cities[city]) cities[city] = [];
        cities[city].push(l);
      });
      setCityPoints(
        Object.entries(cities).map(([city, pts]) => {
          const avg = pts.reduce((acc, p) => {
            acc.longitude += typeof p.longitude === 'string' ? parseFloat(p.longitude) : p.longitude;
            acc.latitude += typeof p.latitude === 'string' ? parseFloat(p.latitude) : p.latitude;
            return acc;
          }, { longitude: 0, latitude: 0 });
          avg.longitude /= pts.length;
          avg.latitude /= pts.length;
          return { position: [avg.longitude, avg.latitude], count: pts.length, cityName: city, pts };
        })
      );
      setLocationPoints(filtered.map(l => ({ 
        position: [
          typeof l.longitude === 'string' ? parseFloat(l.longitude) : l.longitude, 
          typeof l.latitude === 'string' ? parseFloat(l.latitude) : l.latitude
        ], 
        data: l 
      })));
    } else {
      setCityPoints([]);
      setLocationPoints([]);
    }
  }, [selectedProvince, locations]);

  const animateElevation = (name: string) => {
    let current = PROVINCE_BASE_ELEVATION;
    const target = PROVINCE_SELECTED_ELEVATION;
    const step = 500;
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        clearInterval(interval);
        current = target;
      }
      setElevationMap(prev => ({
        ...Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: PROVINCE_BASE_ELEVATION }), {}),
        [name]: current
      }));
    }, 16);
  };

  const onClickProvince = useCallback((info: any) => {
    if (info.object && info.object.properties) {
      const name = info.object.properties.name_en || info.object.properties.name;
      setSelectedProvince(name);
      animateElevation(name);

      const coordinates = info.object.properties.centroid || info.object.geometry.coordinates[0][0];
      
      // Fly Mapbox to the selected province
      if (map.current) {
        map.current.flyTo({
          center: [coordinates[0], coordinates[1]],
          zoom: 8,
          pitch: 45,
          duration: 1000
        });
      }
    }
  }, []);

  const layers = [];

  // Remove problematic TileLayer - just use extruded provinces on dark background

  // Add province polygons above satellite layer
  if (provinces) {
    console.log('Adding provinces layer with', provinces.features?.length, 'features');
    layers.push(
      new GeoJsonLayer({
        id: 'provinces',
        data: provinces,
        pickable: true,
        filled: true,
        stroked: true,
        wireframe: true,
        extruded: true,
        getLineColor: [0, 0, 0, 255],
        getLineWidth: () => 1,
        lineWidthMinPixels: 1,
        getElevation: f => elevationMap[f.properties.name_en] || elevationMap[f.properties.name] || PROVINCE_BASE_ELEVATION,
        getFillColor: f => {
          const isSelected = f.properties.name_en === selectedProvince || f.properties.name === selectedProvince;
          return isSelected ? [34, 197, 94, 120] : [16, 185, 129, 80];
        },
        onClick: onClickProvince,
        updateTriggers: {
          getElevation: elevationMap,
          getFillColor: selectedProvince
        }
      })
    );
  } else {
    console.log('No provinces data available');
  }
  
  console.log('Total layers:', layers.length);

  // Add city markers when zoomed in
  if (viewState.zoom >= 8 && cityPoints.length > 0) {
    layers.push(
      new ScatterplotLayer({
        id: 'cities',
        data: cityPoints,
        pickable: true,
        getPosition: d => d.position,
        getRadius: d => Math.sqrt(d.count) * 5000,
        getFillColor: [255, 140, 0],
        onClick: info => {
          if (info.object) {
            setViewState(prev => ({ 
              ...prev, 
              longitude: info.object.position[0], 
              latitude: info.object.position[1], 
              zoom: 12, 
              transitionDuration: 1000 
            }));
          }
        }
      })
    );
  }

  // Add location markers when zoomed in further
  if (viewState.zoom >= 12 && locationPoints.length > 0) {
    layers.push(
      new ScatterplotLayer({
        id: 'locations',
        data: locationPoints,
        pickable: true,
        getPosition: d => d.position,
        getRadius: 2000,
        getFillColor: [255, 0, 128],
        onClick: info => info.object && alert(info.object.data.name)
      })
    );
  }


  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      {/* Mapbox base map */}
      <div ref={mapContainer} style={{ width: '100%', height: '100%', position: 'absolute' }} />
      
      {/* DeckGL overlay for 3D provinces */}
      {mapboxToken && (
        <DeckGL
          ref={deckRef}
          viewState={viewState}
          controller={false} // Let Mapbox handle camera
          layers={layers}
          style={{ 
            width: '100%', 
            height: '100%',
            position: 'absolute',
            pointerEvents: 'auto' // Enable interactions for clickable layers
          }}
          getTooltip={({ object }) => {
            if (object && object.properties) {
              return object.properties.name_en || object.properties.name;
            }
            return null;
          }}
        />
      )}
    </div>
  );
}