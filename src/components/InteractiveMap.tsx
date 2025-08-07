import React, { useEffect, useState, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';

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
  const [provinces, setProvinces] = useState(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [cityPoints, setCityPoints] = useState([]);
  const [locationPoints, setLocationPoints] = useState([]);
  const [elevationMap, setElevationMap] = useState({});
  const [mapboxToken, setMapboxToken] = useState(null);

  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-mapbox-token');
        setMapboxToken(data?.token || 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw');
      } catch {
        setMapboxToken('pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw');
      }
    };
    fetchMapboxToken();
  }, []);

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then(setProvinces);
  }, []);

  useEffect(() => {
    if (selectedProvince) {
      const filtered = locations.filter(l => l.city === selectedProvince && l.latitude && l.longitude);
      const cities = {};
      filtered.forEach(l => {
        const city = l.city || '';
        if (!cities[city]) cities[city] = [];
        cities[city].push(l);
      });
      setCityPoints(
        Object.entries(cities).map(([city, pts]) => {
          const avg = pts.reduce((acc, p) => {
            acc.longitude += +p.longitude;
            acc.latitude += +p.latitude;
            return acc;
          }, { longitude: 0, latitude: 0 });
          avg.longitude /= pts.length;
          avg.latitude /= pts.length;
          return { position: [avg.longitude, avg.latitude], count: pts.length, cityName: city, pts };
        })
      );
      setLocationPoints(filtered.map(l => ({ 
        position: [+l.longitude, +l.latitude], 
        data: l 
      })));
    } else {
      setCityPoints([]);
      setLocationPoints([]);
    }
  }, [selectedProvince, locations]);

  const onViewStateChange = useCallback((info) => {
    setViewState(info.viewState);
  }, []);

  const animateElevation = (name) => {
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
        ...Object.fromEntries(Object.keys(prev).map(k => [k, 10000])),
        [name]: current
      }));
    }, 16);
  };

  const onClickProvince = useCallback((info) => {
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
      getElevation: f => (elevationMap[f.properties.name_en] || elevationMap[f.properties.name] || 10000) - 10000,
      getFillColor: f => {
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
      getPosition: d => d.position,
      getRadius: d => Math.sqrt(d.count) * 5000,
      getFillColor: [255, 140, 0],
      onClick: info => {
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
      getPosition: d => d.position,
      getRadius: 2000,
      getFillColor: [255, 0, 128],
      onClick: info => info.object && alert(info.object.data.name)
    }));
  }

  if (!mapboxToken) {
    return (
      <div style={{ width: '100%', height: '600px' }} className="flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={onViewStateChange}
        getTooltip={({ object }) => {
          if (object && object.properties) {
            return object.properties.name_en || object.properties.name;
          }
          return null;
        }}
      >
        <Map
          reuseMaps
          mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
          mapboxAccessToken={mapboxToken}
        />
      </DeckGL>
    </div>
  );
}
