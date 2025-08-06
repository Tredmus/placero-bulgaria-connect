import React, { useEffect, useState, useCallback } from 'react';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import type { MapViewState } from '@deck.gl/core';

let MAPBOX_TOKEN = '';
const GEOJSON_URL = '/data/bg_provinces.geojson';

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 6.5,
  pitch: 45,
  bearing: 0
};

export default function InteractiveMap() {
  const { locations } = useLocations();
  const [provinces, setProvinces] = useState<any>(null);
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [cityPoints, setCityPoints] = useState<any[]>([]);
  const [locationPoints, setLocationPoints] = useState<any[]>([]);

  // Fetch Mapbox token
  useEffect(() => {
    const getMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (!error && data?.token) {
          MAPBOX_TOKEN = data.token;
        }
      } catch (err) {
        console.error('Failed to fetch Mapbox token:', err);
      }
    };
    getMapboxToken();
  }, []);

  useEffect(() => {
    // load provinces GeoJSON
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then(data => setProvinces(data));
  }, []);

  // derive city and location layers based on selection and zoom
  useEffect(() => {
    if (selectedProvince) {
      // filter locations in selected province (using city as a fallback since province doesn't exist)
      const filtered = locations.filter(l => l.city === selectedProvince && l.latitude && l.longitude);
      // group by city
      const cities: Record<string, any[]> = {};
      filtered.forEach(l => {
        const city = l.city || '';
        if (!cities[city]) cities[city] = [];
        cities[city].push(l);
      });
      setCityPoints(
        Object.entries(cities).map(([city, pts]) => {
          const avg = pts.reduce((acc, p) => {
            acc.longitude += parseFloat(p.longitude!.toString());
            acc.latitude += parseFloat(p.latitude!.toString());
            return acc;
          }, { longitude: 0, latitude: 0 });
          avg.longitude /= pts.length;
          avg.latitude /= pts.length;
          return { position: [avg.longitude, avg.latitude], count: pts.length, cityName: city, pts };
        })
      );
      setLocationPoints(filtered.map(l => ({ position: [parseFloat(l.longitude!.toString()), parseFloat(l.latitude!.toString())], data: l })));
    } else {
      setCityPoints([]);
      setLocationPoints([]);
    }
  }, [selectedProvince, locations]);

  const onViewStateChange = useCallback((params: any) => {
    setViewState(params.viewState);
  }, []);

  const onClickProvince = useCallback((info: any) => {
    if (info.object && info.object.properties) {
      const name = info.object.properties.name_en || info.object.properties.name;
      setSelectedProvince(name);
      // fly to province centroid
      const coordinates = info.object.properties.centroid || info.object.geometry.coordinates[0][0];
      setViewState(vs => ({ ...vs, longitude: coordinates[0], latitude: coordinates[1], zoom: 8, pitch: 60 }));
    }
  }, []);

  const layers = [];

  if (provinces) {
    layers.push(
      new GeoJsonLayer({
        id: 'provinces',
        data: provinces,
        pickable: true,
        stroked: false,
        extruded: true,
        wireframe: false,
        getElevation: f => (f.properties.name_en === selectedProvince ? 300000 : 0),
        getFillColor: f => (f.properties.name_en === selectedProvince ? [34, 197, 94] : [16, 185, 129]),
        onClick: onClickProvince
      })
    );
  }

  // show cities when zoomed in
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
            setViewState(vs => ({ ...vs, longitude: info.object.position[0], latitude: info.object.position[1], zoom: 12 }));
          }
        }
      })
    );
  }

  // show locations when zoomed in further
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
      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={onViewStateChange}
      >
        <Map
          reuseMaps
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
        />
      </DeckGL>
    </div>
  );
}
