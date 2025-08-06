import React, { useEffect, useState, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { Map } from 'react-map-gl';
import * as turf from '@turf/turf';
import { useLocations } from '@/hooks/useLocations';

const GEOJSON_URL = '/data/bg_provinces.geojson';

const INITIAL_VIEW_STATE = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 6.5,
  pitch: 30,
  bearing: 0,
  transitionDuration: 0,
  minZoom: 6,
  maxZoom: 14
};

export default function InteractiveMap() {
  const { locations } = useLocations();
  const [provinces, setProvinces] = useState<any>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [cityPoints, setCityPoints] = useState<any[]>([]);
  const [locationPoints, setLocationPoints] = useState<any[]>([]);
  const [elevationMap, setElevationMap] = useState<Record<string, number>>({});
  const [maskPolygons, setMaskPolygons] = useState<any>(null);

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then(data => {
        setProvinces(data);

        // Fix union function call - it expects individual features, not an array
        let unionResult = data.features[0];
        for (let i = 1; i < data.features.length; i++) {
          unionResult = turf.union(unionResult, data.features[i]);
        }
        
        // Create mask by subtracting country from bounding box
        const bbox = turf.bboxPolygon([19.3, 41.2, 28.6, 44.2]);
        const mask = turf.difference(bbox, unionResult);
        setMaskPolygons(mask);
      });
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
      setCityPoints(Object.entries(cities).map(([city, pts]) => {
        const avg = pts.reduce((acc, p) => {
          acc.longitude += +p.longitude;
          acc.latitude += +p.latitude;
          return acc;
        }, { longitude: 0, latitude: 0 });
        avg.longitude /= pts.length;
        avg.latitude /= pts.length;
        return { position: [avg.longitude, avg.latitude], count: pts.length, cityName: city, pts };
      }));

      setLocationPoints(filtered.map(l => ({
        position: [+l.longitude, +l.latitude],
        data: l
      })));
    } else {
      setCityPoints([]);
      setLocationPoints([]);
    }
  }, [selectedProvince, locations]);

  const onViewStateChange = useCallback(info => setViewState(info.viewState), []);

  const animateElevation = (name: string) => {
    let current = 10000;
    const target = 30000;
    const step = 500;
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        clearInterval(interval);
        current = target;
      }
      setElevationMap(prev => {
        const updated = Object.fromEntries(Object.keys(prev).map(key => [key, 10000]));
        updated[name] = current;
        return updated;
      });
    }, 16);
  };

  const onClickProvince = useCallback(info => {
    if (info.object?.properties) {
      const name = info.object.properties.name_en || info.object.properties.name;
      setSelectedProvince(name);
      animateElevation(name);

      const coordinates = info.object.properties.centroid || turf.centroid(info.object).geometry.coordinates;
      setViewState(prev => ({ ...prev, longitude: coordinates[0], latitude: coordinates[1], zoom: 8, pitch: 45, transitionDuration: 1000 }));
    }
  }, []);

  const layers = [];

  // Add satellite tile layer that follows the selected province elevation
  if (selectedProvince) {
    const selectedProvinceElevation = Object.entries(elevationMap).find(([key]) => key === selectedProvince)?.[1] || 10000;
    
    layers.push(new TileLayer({
      id: 'satellite',
      data: 'https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg?access_token=' + (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''),
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      getElevation: () => selectedProvinceElevation - 1000,
      elevationScale: 1
    }));
  }

  if (provinces) {
    layers.push(new GeoJsonLayer({
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
      getFillColor: f => (f.properties.name_en === selectedProvince || f.properties.name === selectedProvince) ? [34, 197, 94, 180] : [16, 185, 129, 160],
      onClick: onClickProvince,
      updateTriggers: { getElevation: elevationMap, getFillColor: selectedProvince }
    }));
  }

  if (maskPolygons) {
    layers.push(new GeoJsonLayer({
      id: 'mask-layer',
      data: maskPolygons,
      filled: true,
      getFillColor: [0, 0, 0, 255],
      getLineColor: [0, 0, 0, 0]
    }));
  }

  if (viewState.zoom >= 8 && cityPoints.length > 0) {
    layers.push(new ScatterplotLayer({
      id: 'cities',
      data: cityPoints,
      pickable: true,
      getPosition: d => d.position,
      getRadius: d => Math.sqrt(d.count) * 5000,
      getFillColor: [255, 140, 0],
      onClick: info => info.object && setViewState(prev => ({ ...prev, longitude: info.object.position[0], latitude: info.object.position[1], zoom: 12, transitionDuration: 1000 }))
    }));
  }

  if (viewState.zoom >= 12 && locationPoints.length > 0) {
    layers.push(new ScatterplotLayer({
      id: 'locations',
      data: locationPoints,
      pickable: true,
      getPosition: d => d.position,
      getRadius: 2000,
      getFillColor: [255, 0, 128],
      onClick: info => info.object && alert(info.object.data.name)
    }));
  }

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={onViewStateChange}
        style={{ width: '100%', height: '100%' }}
        getTooltip={({ object }) => object?.properties?.name_en || object?.properties?.name || null}
      />
    </div>
  );
}
