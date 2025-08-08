import React, { useEffect, useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import union from '@turf/union';
import bbox from '@turf/bbox';
import centroid from '@turf/centroid';
import * as turf from '@turf/turf';
import { FlyToInterpolator } from '@deck.gl/core';
import LocationPreview from './LocationPreview';

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
  const [cityPoints, setCityPoints] = useState<any[]>([]);
  const [locationPoints, setLocationPoints] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const nationalCenterRef = useRef<{ lng: number; lat: number; zoom: number } | null>(null);

  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-mapbox-token');
        if (data?.token) {
          setMapboxToken(data.token);
          mapboxgl.accessToken = data.token;
        } else {
          const token = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
          setMapboxToken(token);
          mapboxgl.accessToken = token;
        }
      } catch {
        const token = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        setMapboxToken(token);
        mapboxgl.accessToken = token;
      }
    };
    fetchMapboxToken();
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
      if (!mapRef.current || !provinces) return;
      if (!mapRef.current.getSource('all-provinces')) {
        mapRef.current.addSource('all-provinces', { type: 'geojson', data: provinces });
      }
      if (!mapRef.current.getSource('world-mask')) {
        mapRef.current.addSource('world-mask', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] } }
        });
      }
      if (!mapRef.current.getLayer('world-mask-layer')) {
        mapRef.current.addLayer({ id: 'world-mask-layer', type: 'fill', source: 'world-mask', paint: { 'fill-color': '#020817', 'fill-opacity': 1 } });
      }
      const layers = mapRef.current.getStyle().layers;
      const satelliteLayer = layers?.find(layer => layer.type === 'raster');
      if (satelliteLayer) {
        mapRef.current.setPaintProperty(satelliteLayer.id, 'raster-opacity', 0.8);
      }
      setMaskToAllProvinces();
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapboxToken, provinces]);

  const setMaskToAllProvinces = useCallback(() => {
    if (!mapRef.current || !provinces) return;
    const worldRing: [number, number][] = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
    const holes: [number, number][][] = [];
    for (const feat of provinces.features) {
      const geom = feat.geometry;
      if (!geom) continue;
      if (geom.type === 'Polygon') {
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
    const maskWithAllProvinceHoles = { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [worldRing, ...holes] } };
    (mapRef.current.getSource('world-mask') as mapboxgl.GeoJSONSource)?.setData(maskWithAllProvinceHoles);
  }, [provinces]);

  // Remove satellite masking to show map everywhere
  useEffect(() => {
    if (!mapRef.current) return;
    // Remove the world mask to show satellite everywhere
    if (mapRef.current.getLayer('world-mask-layer')) {
      mapRef.current.removeLayer('world-mask-layer');
    }
  }, [selectedProvince, provinces]);

  useEffect(() => {
    if (mapRef.current && viewState) {
      mapRef.current.jumpTo({ center: [viewState.longitude, viewState.latitude], zoom: viewState.zoom, pitch: viewState.pitch, bearing: viewState.bearing });
    }
  }, [viewState]);

  useEffect(() => {
    fetch(GEOJSON_URL).then(res => res.json()).then(data => setProvinces(data));
  }, []);

  useEffect(() => {
    if (!provinces) return;
    const [minX, minY, maxX, maxY] = bbox(provinces);
    const centerLng = (minX + maxX) / 2;
    const centerLat = (minY + maxY) / 2;
    const zoom = 6.5;
    nationalCenterRef.current = { lng: centerLng, lat: centerLat, zoom };
    setViewState(prev => ({ ...prev, longitude: centerLng, latitude: centerLat, zoom, pitch: 0, bearing: 0, transitionDuration: 0 }));
  }, [provinces]);

  // Auto-select province based on zoom level
  useEffect(() => {
    if (!provinces || viewState.zoom < 7.5) {
      if (selectedProvince) {
        setSelectedProvince(null);
        setSelectedCity(null);
      }
      return;
    }

    // Find which province the current view center is in
    const viewCenter = [viewState.longitude, viewState.latitude];
    const containingProvince = provinces.features.find((feature: any) => {
      const geom = feature.geometry;
      if (!geom) return false;
      
      // Simple point-in-polygon check for center
      try {
        return turf.booleanPointInPolygon(viewCenter, geom);
      } catch {
        return false;
      }
    });

    if (containingProvince && !selectedProvince) {
      const name = containingProvince.properties.name_en || containingProvince.properties.name;
      setSelectedProvince(name);
    }
  }, [viewState.zoom, viewState.longitude, viewState.latitude, provinces, selectedProvince]);

  // Process locations data based on selected province and city
  useEffect(() => {
    if (!locations.length) return;

    if (selectedProvince) {
      // Find cities in the selected province with their locations
      const provinceCities: Record<string, any[]> = {};
      
      locations.forEach(location => {
        if (!location.latitude || !location.longitude) return;
        
        const city = location.city || 'Unknown';
        if (!provinceCities[city]) provinceCities[city] = [];
        provinceCities[city].push(location);
      });

      // Create city points with aggregated data
      const cities = Object.entries(provinceCities)
        .filter(([_, locs]) => locs.length > 0)
        .map(([cityName, locs]) => {
          const avgLng = locs.reduce((sum, loc) => sum + (typeof loc.longitude === 'string' ? parseFloat(loc.longitude) : loc.longitude), 0) / locs.length;
          const avgLat = locs.reduce((sum, loc) => sum + (typeof loc.latitude === 'string' ? parseFloat(loc.latitude) : loc.latitude), 0) / locs.length;
          
          return {
            position: [avgLng, avgLat],
            cityName,
            count: locs.length,
            locations: locs
          };
        });

      setCityPoints(cities);

      // Set location points for selected city
      if (selectedCity) {
        const cityLocations = provinceCities[selectedCity] || [];
        setLocationPoints(cityLocations.map(loc => ({
          position: [
            typeof loc.longitude === 'string' ? parseFloat(loc.longitude) : loc.longitude,
            typeof loc.latitude === 'string' ? parseFloat(loc.latitude) : loc.latitude
          ],
          data: loc
        })));
      } else {
        setLocationPoints([]);
      }
    } else {
      setCityPoints([]);
      setLocationPoints([]);
      setSelectedCity(null);
    }
  }, [selectedProvince, selectedCity, locations]);

  const onViewStateChange = useCallback((info: any) => {
    setViewState(info.viewState);
    // Close location preview on map movement
    if (selectedLocation) {
      setSelectedLocation(null);
      setPreviewPosition(null);
    }
  }, [selectedLocation]);

  const onClickProvince = useCallback((info: any) => {
    if (info.object && info.object.properties) {
      const name = info.object.properties.name_en || info.object.properties.name;
      if (selectedProvince === name) {
        setSelectedProvince(null);
        setSelectedCity(null);
        const fallback = nationalCenterRef.current || { lng: 25.4858, lat: 42.7339, zoom: 6.5 };
        setViewState(prev => ({ ...prev, longitude: fallback.lng, latitude: fallback.lat, zoom: fallback.zoom, pitch: 0, transitionDuration: 550, transitionInterpolator: new FlyToInterpolator({ speed: 2.5 }) }));
        return;
      }
      setSelectedProvince(name);
      setSelectedCity(null);
      const c = centroid(info.object);
      const [lng, lat] = c.geometry.coordinates as [number, number];
      setViewState(prev => ({ ...prev, longitude: lng, latitude: lat, zoom: 8.5, pitch: 0, transitionDuration: 550, transitionInterpolator: new FlyToInterpolator({ speed: 2.5 }) }));
    }
  }, [selectedProvince]);

  const onClickCity = useCallback((info: any) => {
    if (info.object) {
      const cityName = info.object.cityName;
      if (selectedCity === cityName) {
        setSelectedCity(null);
        setViewState(prev => ({ ...prev, zoom: 8.5, transitionDuration: 500 }));
        return;
      }
      setSelectedCity(cityName);
      setViewState(prev => ({ 
        ...prev, 
        longitude: info.object.position[0], 
        latitude: info.object.position[1], 
        zoom: 11.5, 
        transitionDuration: 1000,
        transitionInterpolator: new FlyToInterpolator({ speed: 2 })
      }));
    }
  }, [selectedCity]);

  const onClickLocation = useCallback((info: any) => {
    if (info.object && info.pixel) {
      setSelectedLocation(info.object.data);
      setPreviewPosition({ x: info.pixel[0], y: info.pixel[1] });
    }
  }, []);

  const closeLocationPreview = useCallback(() => {
    setSelectedLocation(null);
    setPreviewPosition(null);
  }, []);

  const layers = [];
  
  // Province layer - always visible
  if (provinces) {
    layers.push(new GeoJsonLayer({
      id: 'provinces',
      data: provinces,
      pickable: true,
      filled: true,
      stroked: true,
      wireframe: false,
      extruded: false,
      getLineColor: [255, 255, 255, 120],
      getLineWidth: () => 1,
      lineWidthMinPixels: 1,
      getElevation: 0,
      getFillColor: f => {
        const isSelected = f.properties.name_en === selectedProvince || f.properties.name === selectedProvince;
        return isSelected ? [0, 0, 0, 0] : [16, 185, 129, 230]; // Dark green with 0.9 opacity
      },
      onClick: onClickProvince,
      updateTriggers: { getFillColor: selectedProvince }
    }));
  }

  // City markers - visible when province selected and zoom 7.5-11
  if (viewState.zoom >= 7.5 && viewState.zoom < 11 && cityPoints.length > 0 && selectedProvince) {
    layers.push(new ScatterplotLayer({
      id: 'cities',
      data: cityPoints,
      pickable: true,
      getPosition: d => d.position,
      getRadius: 8000,
      getFillColor: d => selectedCity === d.cityName ? [59, 130, 246, 255] : [37, 99, 235, 200], // Blue markers
      getLineColor: [255, 255, 255, 200],
      getLineWidth: 2,
      lineWidthMinPixels: 2,
      stroked: true,
      onClick: onClickCity,
      updateTriggers: { getFillColor: selectedCity }
    }));

    // City labels
    layers.push(new TextLayer({
      id: 'city-labels',
      data: cityPoints,
      pickable: false,
      getPosition: d => d.position,
      getText: d => `${d.cityName} (${d.count})`,
      getSize: 14,
      getColor: [255, 255, 255, 255],
      getAngle: 0,
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'bottom',
      getPixelOffset: [0, -15],
      backgroundColor: [0, 0, 0, 150],
      fontFamily: 'system-ui, sans-serif',
      fontWeight: 600
    }));
  }

  // Location markers - visible when city selected and zoom >= 11
  if (viewState.zoom >= 11 && locationPoints.length > 0 && selectedCity) {
    layers.push(new ScatterplotLayer({
      id: 'locations',
      data: locationPoints,
      pickable: true,
      getPosition: d => d.position,
      getRadius: 4000,
      getFillColor: [239, 68, 68, 220], // Red markers
      getLineColor: [255, 255, 255, 200],
      getLineWidth: 2,
      lineWidthMinPixels: 2,
      stroked: true,
      onClick: onClickLocation,
      updateTriggers: { getFillColor: selectedLocation }
    }));
  }

  if (!mapboxToken) {
    return (<div style={{ width: '100%', height: '600px', position: 'relative' }} className="flex items-center justify-center bg-muted"><p className="text-muted-foreground">Loading map...</p></div>);
  }

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: '0', left: '0', zIndex: 0 }} />
      <DeckGL 
        viewState={viewState} 
        controller={{ dragRotate: false }} 
        layers={layers} 
        onViewStateChange={onViewStateChange} 
        style={{ width: '100%', height: '100%', position: 'absolute', top: '0', left: '0', zIndex: '1' }} 
        getTooltip={({ object }) => { 
          if (object && object.properties) { 
            return object.properties.name_en || object.properties.name; 
          }
          if (object && object.cityName) {
            return `${object.cityName} (${object.count} locations)`;
          }
          return null; 
        }} 
      />
      
      {/* Location Preview */}
      {selectedLocation && previewPosition && (
        <LocationPreview
          location={selectedLocation}
          position={previewPosition}
          onClose={closeLocationPreview}
        />
      )}
    </div>
  );
}
