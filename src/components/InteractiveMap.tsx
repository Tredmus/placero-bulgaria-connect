import React, { useEffect, useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { FlyToInterpolator } from '@deck.gl/core';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { centerOfMass, booleanPointInPolygon, point as turfPoint } from '@turf/turf';

const GEOJSON_URL = '/data/bg_provinces.geojson';

const INITIAL_VIEW_STATE = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 6.5,
  pitch: 0,
  bearing: 0,
  transitionDuration: 0
};

export default function InteractiveMap() {
  const { locations } = useLocations();
  const [provinces, setProvinces] = useState<any>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedLocationPopup, setSelectedLocationPopup] = useState<{ data: any; lng: number; lat: number; x: number; y: number } | null>(null);
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
        
        if (data?.token) {
          setMapboxToken(data.token);
          mapboxgl.accessToken = data.token;
        } else {
          // Fallback token
          const token = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
          setMapboxToken(token);
          mapboxgl.accessToken = token;
        }
      } catch (error) {
        console.log('Edge function not available, using fallback token');
        const token = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        setMapboxToken(token);
        mapboxgl.accessToken = token;
      }
    };
    
    fetchMapboxToken();
  }, []);

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainerRef.current || !mapboxToken || !provinces) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      pitch: viewState.pitch,
      bearing: viewState.bearing,
      interactive: false // DeckGL will handle interactions
    });

    mapRef.current.on('load', () => {
      if (!mapRef.current || !provinces) return;

      // Add all provinces as a source for potential masking
      mapRef.current.addSource('all-provinces', {
        type: 'geojson',
        data: provinces
      });

      // Add world mask source (starts with full coverage to hide everything)
      mapRef.current.addSource('world-mask', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]]
          }
        }
      });

      // Add mask layer that covers everything outside selected province
      mapRef.current.addLayer({
        id: 'world-mask-layer',
        type: 'fill',
        source: 'world-mask',
        paint: {
          'fill-color': '#1a1a2e',
          'fill-opacity': 1
        }
      });

      // Set satellite layer elevation to appear below 3D provinces
      const layers = mapRef.current.getStyle().layers;
      const satelliteLayer = layers?.find(layer => layer.type === 'raster');
      
      if (satelliteLayer) {
        // Add custom properties to position satellite layer below provinces
        mapRef.current.setPaintProperty(satelliteLayer.id, 'raster-opacity', 0.8);
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapboxToken, provinces]);

  // Update mask when selected province changes
  useEffect(() => {
    if (!mapRef.current || !provinces) return;

    if (!selectedProvince) {
      // Hide all satellite imagery when no province is selected
      if (mapRef.current.getSource('world-mask')) {
        const fullMask = {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'Polygon' as const,
            coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]]
          }
        };

        (mapRef.current.getSource('world-mask') as mapboxgl.GeoJSONSource).setData(fullMask);
      }
      return;
    }

    // Find the selected province feature
    const selectedFeature = provinces.features.find(
      (feature: any) => 
        feature.properties.name_en === selectedProvince || 
        feature.properties.name === selectedProvince
    );

    if (!selectedFeature) return;

    // Create world bounds with selected province cut out
    const worldBounds = [
      [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
    ];

    const maskWithHole = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [worldBounds[0], ...selectedFeature.geometry.coordinates]
      }
    };

    // Update the mask to show only the selected province
    (mapRef.current.getSource('world-mask') as mapboxgl.GeoJSONSource).setData(maskWithHole);
  }, [selectedProvince, provinces]);

  // Sync Mapbox map with DeckGL viewState
  useEffect(() => {
    if (mapRef.current && viewState) {
      mapRef.current.jumpTo({
        center: [viewState.longitude, viewState.latitude],
        zoom: viewState.zoom,
        pitch: viewState.pitch,
        bearing: viewState.bearing
      });
    }
  }, [viewState]);

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then(data => setProvinces(data));
  }, []);

  useEffect(() => {
    if (!selectedProvince || !provinces) {
      setCityPoints([]);
      setLocationPoints([]);
      return;
    }

    const selectedFeature = provinces.features.find(
      (f: any) => f.properties.name_en === selectedProvince || f.properties.name === selectedProvince
    );
    if (!selectedFeature) {
      setCityPoints([]);
      setLocationPoints([]);
      return;
    }

    const inProvince = locations.filter((l) => {
      const lng = typeof l.longitude === 'string' ? parseFloat(l.longitude) : l.longitude;
      const lat = typeof l.latitude === 'string' ? parseFloat(l.latitude) : l.latitude;
      if (lng == null || lat == null || isNaN(lng) || isNaN(lat)) return false;
      try {
        return booleanPointInPolygon(turfPoint([lng, lat]), selectedFeature as any);
      } catch {
        return false;
      }
    });

    const cities: Record<string, any[]> = {};
    inProvince.forEach((l) => {
      const city = l.city || '';
      if (!cities[city]) cities[city] = [];
      cities[city].push(l);
    });

    const cityPts = Object.entries(cities)
      .map(([city, pts]) => {
        const coords = pts
          .map((p: any) => ({
            longitude: typeof p.longitude === 'string' ? parseFloat(p.longitude) : p.longitude,
            latitude: typeof p.latitude === 'string' ? parseFloat(p.latitude) : p.latitude,
          }))
          .filter((c) => c.longitude != null && c.latitude != null && !isNaN(c.longitude) && !isNaN(c.latitude));
        if (coords.length === 0) return null;
        const avg = coords.reduce(
          (acc, c) => ({ longitude: acc.longitude + c.longitude, latitude: acc.latitude + c.latitude }),
          { longitude: 0, latitude: 0 }
        );
        avg.longitude /= coords.length;
        avg.latitude /= coords.length;
        return { position: [avg.longitude, avg.latitude], count: pts.length, cityName: city } as any;
      })
      .filter(Boolean) as any[];

    setCityPoints(cityPts);

    setLocationPoints(
      inProvince.map((l) => ({
        position: [
          typeof l.longitude === 'string' ? parseFloat(l.longitude) : (l.longitude as number),
          typeof l.latitude === 'string' ? parseFloat(l.latitude) : (l.latitude as number),
        ],
        data: l,
      }))
    );
  }, [selectedProvince, provinces, locations]);

  const onViewStateChange = useCallback((info: any) => {
    setViewState(info.viewState);
    setSelectedLocationPopup(null);
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
      setElevationMap(prev => ({
        ...Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: 10000 }), {}),
        [name]: current
      }));
    }, 16);
  };

  const onClickProvince = useCallback((info: any) => {
    if (info.object && info.object.properties) {
      const name = info.object.properties.name_en || info.object.properties.name;
      setSelectedProvince(name);
      setSelectedCity(null);
      setSelectedLocationPopup(null);

      try {
        const feature = info.object;
        const center = centerOfMass(feature).geometry.coordinates as [number, number];
        setViewState((prev) => ({
          ...prev,
          longitude: center[0],
          latitude: center[1],
          zoom: 8.5,
          pitch: 0,
          transitionDuration: 600,
          transitionInterpolator: new FlyToInterpolator(),
        }));
      } catch {
        // fallback to first coordinate
        const coordinates = info.object.properties.centroid || info.object.geometry.coordinates[0][0];
        setViewState((prev) => ({ ...prev, longitude: coordinates[0], latitude: coordinates[1], zoom: 8.5, pitch: 0, transitionDuration: 600 }));
      }
    }
  }, []);

  const layers = [];

  if (provinces) {
    layers.push(
      new GeoJsonLayer({
        id: 'provinces',
        data: provinces,
        pickable: true,
        filled: true,
        stroked: true,
        wireframe: false,
        extruded: false,
        getLineColor: [0, 0, 0, 255],
        getLineWidth: () => 1,
        lineWidthMinPixels: 1,
        getElevation: () => 0,
        getFillColor: f => {
          const isSelected = f.properties.name_en === selectedProvince || f.properties.name === selectedProvince;
          return isSelected ? [0, 0, 0, 0] : [34, 197, 94, 220];
        },
        onClick: onClickProvince,
        updateTriggers: {
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
      <div style={{ width: '100%', height: '600px', position: 'relative' }} className="flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">Loading map...</p>
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
          zIndex: 0
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