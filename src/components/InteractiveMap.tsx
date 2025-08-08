import React, { useEffect, useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { useLocations } from '@/hooks/useLocations';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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
  const [provinces, setProvinces] = useState(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [mapboxToken, setMapboxToken] = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const token = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
    setMapboxToken(token);
    mapboxgl.accessToken = token;
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || !mapboxToken || !provinces) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      pitch: viewState.pitch,
      bearing: viewState.bearing,
      interactive: false
    });

    mapRef.current.on('load', () => {
      const layers = mapRef.current.getStyle().layers;
      const satelliteLayer = layers?.find(layer => layer.type === 'raster');
      if (satelliteLayer) {
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

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then(data => setProvinces(data));
  }, []);

  const onViewStateChange = useCallback(info => {
    setViewState(info.viewState);
  }, []);

  const onClickProvince = useCallback(info => {
    if (info.object && info.object.properties) {
      const name = info.object.properties.name_en || info.object.properties.name;
      setSelectedProvince(name);
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
        extruded: false,
        getLineColor: [0, 0, 0, 255],
        getLineWidth: () => 1,
        lineWidthMinPixels: 1,
        // ↓ Make fills more transparent so the map is visible in all provinces
        getFillColor: [16, 185, 129, 80],
        onClick: onClickProvince
      })
    );
  }

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }} />
      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={onViewStateChange}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}
      />
    </div>
  );
}
