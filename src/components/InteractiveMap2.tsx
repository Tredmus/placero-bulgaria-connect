import React, { useEffect, useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const GEOJSON_URL = '/data/bg_provinces.geojson';

const INITIAL_VIEW_STATE = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 6.5,
  pitch: 30,
  bearing: 0,
  transitionDuration: 0
};

export default function InteractiveMap2() {
  const { locations } = useLocations();
  const [provinces, setProvinces] = useState<any>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [cityPoints, setCityPoints] = useState<any[]>([]);
  const [locationPoints, setLocationPoints] = useState<any[]>([]);
  const [elevationMap, setElevationMap] = useState<Record<string, number>>({});
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        setMapboxToken(data.token);
      } catch (error) {
        console.error('Failed to fetch Mapbox token:', error);
        // Fallback token - replace with your actual token or handle gracefully
        setMapboxToken('pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw');
      }
    };
    
    fetchMapboxToken();
  }, []);

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapboxToken || !mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = mapboxToken;
    
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom,
      pitch: INITIAL_VIEW_STATE.pitch,
      bearing: INITIAL_VIEW_STATE.bearing,
      antialias: true
    });

    map.on('load', () => {
      // Add the world mask source
      map.addSource('world-mask', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-180, -90],
              [-180, 90],
              [180, 90],
              [180, -90],
              [-180, -90]
            ]]
          },
          properties: {}
        }
      });

      // Add the world mask layer
      map.addLayer({
        id: 'world-mask-layer',
        type: 'fill',
        source: 'world-mask',
        paint: {
          'fill-color': '#000000',
          'fill-opacity': 0.8
        }
      }, 'water');
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapboxToken]);

  // Update world mask based on selected province
  useEffect(() => {
    if (!mapRef.current || !provinces) return;

    const map = mapRef.current;
    
    if (selectedProvince) {
      // Find the selected province feature
      const selectedFeature = provinces.features.find((f: any) => 
        f.properties.name_en === selectedProvince || f.properties.name === selectedProvince
      );
      
      if (selectedFeature) {
        // Create holes in the world mask for the selected province
        const worldGeometry = {
          type: 'Polygon' as const,
          coordinates: [[
            [-180, -90],
            [-180, 90],
            [180, 90],
            [180, -90],
            [-180, -90]
          ]]
        };

        // Add the selected province's coordinates as holes
        if (selectedFeature.geometry.type === 'Polygon') {
          worldGeometry.coordinates.push(...selectedFeature.geometry.coordinates);
        } else if (selectedFeature.geometry.type === 'MultiPolygon') {
          selectedFeature.geometry.coordinates.forEach((polygon: any) => {
            worldGeometry.coordinates.push(...polygon);
          });
        }

        const maskData = {
          type: 'Feature' as const,
          geometry: worldGeometry,
          properties: {}
        };

        const source = map.getSource('world-mask') as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData(maskData);
        }
      }
    } else {
      // Show the full world mask
      const maskData = {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[
            [-180, -90],
            [-180, 90],
            [180, 90],
            [180, -90],
            [-180, -90]
          ]]
        },
        properties: {}
      };

      const source = map.getSource('world-mask') as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData(maskData);
      }
    }
  }, [selectedProvince, provinces]);

  // Sync view state with Mapbox map
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    map.jumpTo({
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      pitch: viewState.pitch,
      bearing: viewState.bearing
    });
  }, [viewState]);

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then(data => setProvinces(data));
  }, []);

  useEffect(() => {
    if (selectedProvince) {
      const filtered = locations.filter(l => l.city === selectedProvince && l.latitude && l.longitude);
      const cities: Record<string, any[]> = {};
      filtered.forEach(l => {
        const city = l.city || '';
        if (!cities[city]) cities[city] = [];
        cities[city].push(l);
      });
      
      // Convert coordinates safely with type checking
      const convertedCities = Object.entries(cities).map(([city, pts]) => {
        const coords = pts.map(p => ({
          longitude: typeof p.longitude === 'string' ? parseFloat(p.longitude) : (p.longitude || 0),
          latitude: typeof p.latitude === 'string' ? parseFloat(p.latitude) : (p.latitude || 0)
        })).filter(coord => !isNaN(coord.longitude) && !isNaN(coord.latitude));
        
        if (coords.length === 0) return null;
        
        const avg = coords.reduce((acc, coord) => ({
          longitude: acc.longitude + coord.longitude,
          latitude: acc.latitude + coord.latitude
        }), { longitude: 0, latitude: 0 });
        
        avg.longitude /= coords.length;
        avg.latitude /= coords.length;
        
        return { position: [avg.longitude, avg.latitude], count: pts.length, cityName: city, pts };
      }).filter(Boolean);
      
      setCityPoints(convertedCities);
      
      const convertedLocations = filtered.map(l => {
        const longitude = typeof l.longitude === 'string' ? parseFloat(l.longitude) : (l.longitude || 0);
        const latitude = typeof l.latitude === 'string' ? parseFloat(l.latitude) : (l.latitude || 0);
        
        if (isNaN(longitude) || isNaN(latitude)) return null;
        
        return { 
          position: [longitude, latitude], 
          data: l 
        };
      }).filter(Boolean);
      
      setLocationPoints(convertedLocations);
    } else {
      setCityPoints([]);
      setLocationPoints([]);
    }
  }, [selectedProvince, locations]);

  const onViewStateChange = useCallback((info: any) => {
    setViewState(info.viewState);
  }, []);

  const animateElevation = (name: string) => {
    let current = 10000;
    const target = 20000;
    const step = 500;
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        clearInterval(interval);
        current = target;
      }
      const newElevationMap: Record<string, number> = {};
      Object.keys(elevationMap).forEach(key => {
        newElevationMap[key] = 10000;
      });
      newElevationMap[name] = current;
      setElevationMap(newElevationMap);
    }, 16);
  };

  const onClickProvince = useCallback((info: any) => {
    if (info.object && info.object.properties) {
      const name = info.object.properties.name_en || info.object.properties.name;
      setSelectedProvince(name);
      animateElevation(name);

      const coordinates = info.object.properties.centroid || info.object.geometry.coordinates[0][0];
      setViewState(prev => ({ ...prev, longitude: coordinates[0], latitude: coordinates[1], zoom: 8, pitch: 45, transitionDuration: 1000 }));
    }
  }, [elevationMap]);

  const layers = [];

  if (provinces) {
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
        getElevation: f => elevationMap[f.properties.name_en] || elevationMap[f.properties.name] || 10000,
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
  }

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
            setViewState(prev => ({ ...prev, longitude: info.object.position[0], latitude: info.object.position[1], zoom: 12, transitionDuration: 1000 }));
          }
        }
      })
    );
  }

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

  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-muted rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      <div 
        ref={mapContainerRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'absolute',
          top: '0',
          left: '0',
          zIndex: '0'
        }} 
      />
      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={onViewStateChange}
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'absolute',
          top: '0',
          left: '0',
          zIndex: '1'
        }}
        getTooltip={({ object }) => {
          if (object && object.properties) {
            return object.properties.name_en || object.properties.name;
          }
          return null;
        }}
      />
    </div>
  );
}
