import React, { useEffect, useState, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
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

// Define proper types
interface Location {
  city?: string;
  latitude?: string | number;
  longitude?: string | number;
  name?: string;
}

interface CityPoint {
  position: [number, number];
  count: number;
  cityName: string;
  pts: Location[];
}

interface LocationPoint {
  position: [number, number];
  data: Location;
}

function InteractiveMap() {
  const { locations } = useLocations();
  const [provinces, setProvinces] = useState<any>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [cityPoints, setCityPoints] = useState<CityPoint[]>([]);
  const [locationPoints, setLocationPoints] = useState<LocationPoint[]>([]);
  const [elevationMap, setElevationMap] = useState<{[key: string]: number}>({});

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then(setProvinces);
  }, []);

  useEffect(() => {
    if (selectedProvince) {
      const filtered = locations.filter(l => l.city === selectedProvince && l.latitude && l.longitude);
      const cities: {[key: string]: Location[]} = {};
      filtered.forEach(l => {
        const city = l.city || '';
        if (!cities[city]) cities[city] = [];
        cities[city].push(l);
      });
      setCityPoints(
        Object.entries(cities).map(([city, pts]): CityPoint => {
          const avg = pts.reduce((acc: { longitude: number; latitude: number }, p) => {
            const lng = typeof p.longitude === 'string' ? parseFloat(p.longitude) : (p.longitude || 0);
            const lat = typeof p.latitude === 'string' ? parseFloat(p.latitude) : (p.latitude || 0);
            acc.longitude += lng;
            acc.latitude += lat;
            return acc;
          }, { longitude: 0, latitude: 0 });
          avg.longitude /= pts.length;
          avg.latitude /= pts.length;
          return { position: [avg.longitude, avg.latitude], count: pts.length, cityName: city, pts };
        })
      );
      setLocationPoints(filtered.map(l => {
        const lng = typeof l.longitude === 'string' ? parseFloat(l.longitude) : (l.longitude || 0);
        const lat = typeof l.latitude === 'string' ? parseFloat(l.latitude) : (l.latitude || 0);
        return { 
          position: [lng, lat] as [number, number], 
          data: l 
        };
      }));
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
      setElevationMap(prev => {
        const newMap: {[key: string]: number} = {};
        Object.keys(prev).forEach(k => newMap[k] = 10000);
        newMap[name] = current;
        return newMap;
      });
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
  }, []);

  const layers = [];
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
      getLineWidth: 1,
      lineWidthMinPixels: 1,
      getElevation: (f: any) => (elevationMap[f.properties.name_en] || elevationMap[f.properties.name] || 10000) - 10000,
      getFillColor: (f: any) => {
        const isSelected = f.properties.name_en === selectedProvince || f.properties.name === selectedProvince;
        return isSelected ? [34, 197, 94, 120] : [16, 185, 129, 80];
      },
      onClick: onClickProvince,
      updateTriggers: {
        getElevation: elevationMap,
        getFillColor: selectedProvince
      }
    }));
  }

  if (viewState.zoom >= 8 && cityPoints.length > 0) {
    layers.push(new ScatterplotLayer({
      id: 'cities',
      data: cityPoints,
      pickable: true,
      getPosition: (d: CityPoint) => d.position,
      getRadius: (d: CityPoint) => Math.sqrt(d.count) * 5000,
      getFillColor: [255, 140, 0],
      onClick: (info: any) => {
        if (info.object) {
          setViewState(prev => ({ ...prev, longitude: info.object.position[0], latitude: info.object.position[1], zoom: 12, transitionDuration: 1000 }));
        }
      }
    }));
  }

  if (viewState.zoom >= 12 && locationPoints.length > 0) {
    layers.push(new ScatterplotLayer({
      id: 'locations',
      data: locationPoints,
      pickable: true,
      getPosition: (d: LocationPoint) => d.position,
      getRadius: 2000,
      getFillColor: [255, 0, 128],
      onClick: (info: any) => info.object && alert(info.object.data.name)
    }));
  }

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={onViewStateChange}
        getTooltip={({ object }: any) => {
          if (object && object.properties) {
            return object.properties.name_en || object.properties.name;
          }
          return null;
        }}
      />
    </div>
  );
}

export default InteractiveMap;