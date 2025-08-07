import React, { useEffect, useState, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, BitmapLayer } from '@deck.gl/layers';
import { useLocations } from '@/hooks/useLocations';

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

  // Load province data
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then(data => setProvinces(data));
  }, []);

  // Process location data when province is selected
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
    let current = 5000;
    const target = 15000;
    const step = 500;
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        clearInterval(interval);
        current = target;
      }
      setElevationMap(prev => ({
        ...Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: 5000 }), {}),
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
      setViewState(prev => ({ 
        ...prev, 
        longitude: coordinates[0], 
        latitude: coordinates[1], 
        zoom: 8, 
        pitch: 45, 
        transitionDuration: 1000 
      }));
    }
  }, []);

  const layers = [];

  // Add terrain texture layer using solid colors that simulate terrain
  const bulgariaBounds: [[number, number], [number, number], [number, number], [number, number]] = [
    [22.3, 41.2], // bottom-left
    [28.6, 41.2], // bottom-right  
    [28.6, 44.2], // top-right
    [22.3, 44.2]  // top-left
  ];
  
  // Create a simple terrain-colored canvas as texture
  const createTerrainTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Create gradient that looks like terrain
      const gradient = ctx.createLinearGradient(0, 0, 512, 512);
      gradient.addColorStop(0, '#8B7355'); // mountain brown
      gradient.addColorStop(0.3, '#6B8E23'); // olive green
      gradient.addColorStop(0.6, '#228B22'); // forest green
      gradient.addColorStop(1, '#2F4F4F'); // dark slate gray
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 512);
    }
    return canvas.toDataURL();
  };

  layers.push(
    new BitmapLayer({
      id: 'terrain-base',
      bounds: bulgariaBounds,
      image: createTerrainTexture(),
      opacity: 0.8
    })
  );

  if (provinces) {
    layers.push(
      new GeoJsonLayer({
        id: 'provinces',
        data: provinces,
        pickable: true,
        filled: true,
        stroked: true,
        wireframe: false,
        extruded: true,
        getLineColor: [255, 255, 255, 100],
        getLineWidth: () => 1,
        lineWidthMinPixels: 1,
        getElevation: f => elevationMap[f.properties.name_en] || elevationMap[f.properties.name] || 3000,
        getFillColor: f => {
          const isSelected = f.properties.name_en === selectedProvince || f.properties.name === selectedProvince;
          if (isSelected) {
            // Transparent with bright outline for selected
            return [34, 197, 94, 60];
          } else {
            // Very transparent to show satellite through
            return [255, 255, 255, 30];
          }
        },
        material: {
          ambient: 0.8,
          diffuse: 0.6,
          shininess: 5,
          specularColor: [200, 200, 200]
        },
        onClick: onClickProvince,
        updateTriggers: {
          getElevation: elevationMap,
          getFillColor: selectedProvince
        }
      })
    );
  }

  // Add city points
  if (viewState.zoom >= 8 && cityPoints.length > 0) {
    layers.push(
      new ScatterplotLayer({
        id: 'cities',
        data: cityPoints,
        pickable: true,
        getPosition: d => d.position,
        getRadius: d => Math.sqrt(d.count) * 5000,
        getFillColor: [255, 140, 0, 200],
        getLineColor: [255, 255, 255, 255],
        lineWidthMinPixels: 2,
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

  // Add location points
  if (viewState.zoom >= 12 && locationPoints.length > 0) {
    layers.push(
      new ScatterplotLayer({
        id: 'locations',
        data: locationPoints,
        pickable: true,
        getPosition: d => d.position,
        getRadius: 2000,
        getFillColor: [255, 0, 128, 200],
        getLineColor: [255, 255, 255, 255],
        lineWidthMinPixels: 2,
        onClick: info => info.object && alert(info.object.data.name)
      })
    );
  }

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={onViewStateChange}
        style={{ 
          width: '100%', 
          height: '100%'
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