import React, { useEffect, useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, BitmapLayer } from '@deck.gl/layers';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import union from '@turf/union';

const GEOJSON_URL = '/data/bg_provinces.geojson';

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

      // Add Mapbox DEM source for 3D terrain
      mapRef.current.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14
      });

      // Enable 3D terrain
      mapRef.current.setTerrain({ 
        'source': 'mapbox-dem', 
        'exaggeration': 1.5 
      });

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

      // Add 3D mask layer that covers everything outside selected province
      mapRef.current.addLayer({
        id: 'world-mask-layer',
        type: 'fill-extrusion',
        source: 'world-mask',
        paint: {
          'fill-extrusion-color': '#1a1a2e',
          'fill-extrusion-height': 100000,
          'fill-extrusion-opacity': 1
        }
      });
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

  // Helper function to get province bounds for BitmapLayer
  const getProvinceBounds = (geometry: any): [[number, number], [number, number], [number, number], [number, number]] => {
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    
    const processCoordinates = (coords: any[]) => {
      coords.forEach(coord => {
        if (Array.isArray(coord[0])) {
          processCoordinates(coord);
        } else {
          minLng = Math.min(minLng, coord[0]);
          maxLng = Math.max(maxLng, coord[0]);
          minLat = Math.min(minLat, coord[1]);
          maxLat = Math.max(maxLat, coord[1]);
        }
      });
    };
    
    processCoordinates(geometry.coordinates);
    // Return bounds in the format expected by BitmapLayer: [bottomLeft, bottomRight, topRight, topLeft]
    return [
      [minLng, minLat], // bottom left
      [maxLng, minLat], // bottom right  
      [maxLng, maxLat], // top right
      [minLng, maxLat]  // top left
    ];
  };

  // Helper function to get satellite image URL for the province
  const getSatelliteImageUrl = (bounds: [[number, number], [number, number], [number, number], [number, number]], token: string) => {
    const minLng = Math.min(bounds[0][0], bounds[1][0], bounds[2][0], bounds[3][0]);
    const maxLng = Math.max(bounds[0][0], bounds[1][0], bounds[2][0], bounds[3][0]);
    const minLat = Math.min(bounds[0][1], bounds[1][1], bounds[2][1], bounds[3][1]);
    const maxLat = Math.max(bounds[0][1], bounds[1][1], bounds[2][1], bounds[3][1]);
    const width = 1024;
    const height = 1024;
    
    return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/[${minLng},${minLat},${maxLng},${maxLat}]/${width}x${height}@2x?access_token=${token}`;
  };

  const onClickProvince = useCallback((info: any) => {
    if (info.object && info.object.properties) {
      const name = info.object.properties.name_en || info.object.properties.name;
      setSelectedProvince(name);
      animateElevation(name);

      const coordinates = info.object.properties.centroid || info.object.geometry.coordinates[0][0];
      setViewState(prev => ({ ...prev, longitude: coordinates[0], latitude: coordinates[1], zoom: 8, pitch: 45, transitionDuration: 1000 }));
    }
  }, []);

  const layers = [];

  if (provinces) {
    // Add satellite imagery layer for selected province at elevated height
    if (selectedProvince && mapboxToken) {
      const selectedFeature = provinces.features.find(
        (feature: any) => 
          feature.properties.name_en === selectedProvince || 
          feature.properties.name === selectedProvince
      );
      
      if (selectedFeature) {
        const bounds = getProvinceBounds(selectedFeature.geometry);
        const satelliteUrl = getSatelliteImageUrl(bounds, mapboxToken);
        const elevation = elevationMap[selectedFeature.properties.name_en] || elevationMap[selectedFeature.properties.name] || 20000;
        
        layers.push(
          new BitmapLayer({
            id: 'satellite-imagery',
            bounds: bounds,
            image: satelliteUrl,
            elevationData: elevation,
            elevationScale: 1,
            elevationOffset: elevation,
            coordinateOrigin: [bounds[0][0], bounds[0][1], elevation],
            coordinateSystem: 1,
            modelMatrix: [
              1, 0, 0, 0,
              0, 1, 0, 0,
              0, 0, 1, elevation,
              0, 0, 0, 1
            ],
            updateTriggers: {
              image: satelliteUrl,
              bounds: bounds,
              modelMatrix: elevation
            }
          })
        );
      }
    }

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
          return isSelected ? [34, 197, 94, 20] : [16, 185, 129, 80]; // Very transparent for selected to show texture
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