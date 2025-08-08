import React, { useEffect, useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import union from '@turf/union';
import bbox from '@turf/bbox';
import centroid from '@turf/centroid';
import { FlyToInterpolator } from '@deck.gl/core';

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
      if (!mapRef.current.getSource('all-provinces')) {
        mapRef.current.addSource('all-provinces', {
          type: 'geojson',
          data: provinces
        });
      }

      // Add world mask source (starts with full coverage)
      if (!mapRef.current.getSource('world-mask')) {
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
      }

      // Add mask layer
      if (!mapRef.current.getLayer('world-mask-layer')) {
        mapRef.current.addLayer({
          id: 'world-mask-layer',
          type: 'fill',
          source: 'world-mask',
          paint: {
            'fill-color': '#1a1a2e',
            'fill-opacity': 1
          }
        });
      }

      // Slight opacity on raster so provinces/markers pop a bit
      const layers = mapRef.current.getStyle().layers;
      const satelliteLayer = layers?.find(layer => layer.type === 'raster');
      if (satelliteLayer) {
        mapRef.current.setPaintProperty(satelliteLayer.id, 'raster-opacity', 0.8);
      }

      // >>> Set mask to show the map inside ALL provinces <<<
      setMaskToAllProvinces();
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapboxToken, provinces]);

  // Build and apply a mask that cuts holes for ALL provinces
  const setMaskToAllProvinces = useCallback(() => {
    if (!mapRef.current || !provinces) return;

    // Outer world ring
    const worldRing: [number, number][] = [
      [-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]
    ];

    // Collect outer rings of every province as holes
    const holes: [number, number][][] = [];
    for (const feat of provinces.features) {
      const geom = feat.geometry;
      if (!geom) continue;

      if (geom.type === 'Polygon') {
        // outer ring is coordinates[0]
        if (Array.isArray(geom.coordinates[0])) {
          holes.push(geom.coordinates[0] as [number, number][]);
        }
      } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) {
          if (Array.isArray(poly[0])) {
            holes.push(poly[0] as [number, number][]);
          }
        }
      }
    }

    const maskWithAllProvinceHoles = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        // world outer ring + one hole per province
        coordinates: [worldRing, ...holes]
      }
    };

    (mapRef.current.getSource('world-mask') as mapboxgl.GeoJSONSource)?.setData(maskWithAllProvinceHoles);
  }, [provinces]);

  // Update mask when provinces load OR selection changes (we keep showing all provinces)
  useEffect(() => {
    setMaskToAllProvinces();
  }, [setMaskToAllProvinces, selectedProvince, provinces]);

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

  // Center Bulgaria on load based on provinces bbox
  useEffect(() => {
    if (!provinces) return;
    const [minX, minY, maxX, maxY] = bbox(provinces);
    const centerLng = (minX + maxX) / 2;
    const centerLat = (minY + maxY) / 2;
    setViewState(prev => ({
      ...prev,
      longitude: centerLng,
      latitude: centerLat,
      zoom: 6.5,
      pitch: 0,
      bearing: 0,
      transitionDuration: 0
    }));
  }, [provinces]);

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

      // Use centroid for reliable recentre and make the move quicker
      const c = centroid(info.object);
      const [lng, lat] = c.geometry.coordinates as [number, number];

      setViewState(prev => ({ 
        ...prev, 
        longitude: lng, 
        latitude: lat, 
        zoom: 8, 
        pitch: 0, 
        transitionDuration: 550,
        transitionInterpolator: new FlyToInterpolator({ speed: 2.5 })
      }));
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
        wireframe: true,
        extruded: false,
        getLineColor: [0, 0, 0, 255],
        getLineWidth: () => 1,
        lineWidthMinPixels: 1,
        getElevation: 0,
        getFillColor: f => {
          const isSelected = f.properties.name_en === selectedProvince || f.properties.name === selectedProvince;
          return isSelected ? [34, 197, 94, 120] : [16, 185, 129, 80];
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
        controller={{ dragRotate: false }}
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
