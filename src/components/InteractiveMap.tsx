import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import bbox from '@turf/bbox';
import centroid from '@turf/centroid';
import { FlyToInterpolator } from '@deck.gl/core';
import { booleanPointInPolygon, point } from '@turf/turf';
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

// Zoom thresholds
const CITY_ZOOM_MIN = 7.5;
const LOCATION_ZOOM_MIN = 11;

// Colors (approximate to design system dark green)
type RGB = [number, number, number];
type RGBA = [number, number, number, number];
const GREEN_DARK: RGB = [12, 94, 64]; // dark green
const GREEN_MAIN: RGB = [16, 185, 129]; // brand green for pins
const WHITE_RGB: RGB = [255, 255, 255];
const PINK_RGB: RGB = [255, 64, 128];
const rgba = (c: RGB, a: number): RGBA => [c[0], c[1], c[2], a];

export default function InteractiveMap() {
  const { locations } = useLocations();
  const [provinces, setProvinces] = useState<any>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [cityPoints, setCityPoints] = useState<any[]>([]);
  const [locationPoints, setLocationPoints] = useState<any[]>([]);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [previewXY, setPreviewXY] = useState<{ x: number; y: number } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const deckRef = useRef<any>(null);
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

  // Initialize Mapbox map (non-interactive, used as basemap)
  useEffect(() => {
    if (!mapContainerRef.current || !mapboxToken || !provinces) return;
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      pitch: viewState.pitch,
      bearing: viewState.bearing,
      interactive: false,
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapboxToken, provinces]);

  // Load provinces
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then((res) => res.json())
      .then((data) => setProvinces(data));
  }, []);

  // Fit initial center using provinces bbox
  useEffect(() => {
    if (!provinces) return;
    const [minX, minY, maxX, maxY] = bbox(provinces);
    const centerLng = (minX + maxX) / 2;
    const centerLat = (minY + maxY) / 2;
    const zoom = 6.5;
    nationalCenterRef.current = { lng: centerLng, lat: centerLat, zoom };
    setViewState((prev) => ({
      ...prev,
      longitude: centerLng,
      latitude: centerLat,
      zoom,
      pitch: 0,
      bearing: 0,
      transitionDuration: 0,
    }));
  }, [provinces]);

  // Sync mapbox camera
  useEffect(() => {
    if (mapRef.current && viewState) {
      mapRef.current.jumpTo({
        center: [viewState.longitude, viewState.latitude],
        zoom: viewState.zoom,
        pitch: viewState.pitch,
        bearing: viewState.bearing,
      });
    }
  }, [viewState]);

  // Helper: Find province feature by name
  const findProvinceFeature = useCallback(
    (name: string | null) => {
      if (!name || !provinces) return null;
      const f = provinces.features.find(
        (feat: any) => feat.properties?.name_en === name || feat.properties?.name === name
      );
      return f || null;
    },
    [provinces]
  );

  // Auto-select province when zoomed in enough and center falls within it
  useEffect(() => {
    if (!provinces) return;
    if (viewState.zoom >= CITY_ZOOM_MIN) {
      const p = point([viewState.longitude, viewState.latitude]);
      const match = provinces.features.find((feat: any) => {
        if (!feat.geometry) return false;
        try {
          return booleanPointInPolygon(p, feat as any);
        } catch {
          return false;
        }
      });
      const name = match?.properties?.name_en || match?.properties?.name || null;
      if (name && name !== selectedProvince) {
        setSelectedProvince(name);
        setSelectedCity(null);
      }
    } else {
      // Back to national view
      if (selectedProvince) {
        setSelectedProvince(null);
        setSelectedCity(null);
      }
    }
  }, [viewState, provinces, selectedProvince]);

  // Build city and location points when province/city changes
  useEffect(() => {
    if (!selectedProvince || !provinces) {
      setCityPoints([]);
      setLocationPoints([]);
      return;
    }

    const provinceFeature = findProvinceFeature(selectedProvince);
    if (!provinceFeature) return;

    const inProvince = locations.filter((l) => {
      const lng = typeof l.longitude === 'string' ? parseFloat(l.longitude) : l.longitude;
      const lat = typeof l.latitude === 'string' ? parseFloat(l.latitude) : l.latitude;
      if (lng == null || lat == null) return false;
      try {
        return booleanPointInPolygon(point([lng, lat]), provinceFeature as any);
      } catch {
        return false;
      }
    });

    // Group by city
    const byCity: Record<string, { count: number; sumLng: number; sumLat: number; items: any[] }> = {};
    inProvince.forEach((l) => {
      const city = (l.city as string) || 'Unknown';
      const lng = typeof l.longitude === 'string' ? parseFloat(l.longitude) : l.longitude;
      const lat = typeof l.latitude === 'string' ? parseFloat(l.latitude) : l.latitude;
      if (lng == null || lat == null) return;
      if (!byCity[city]) byCity[city] = { count: 0, sumLng: 0, sumLat: 0, items: [] };
      byCity[city].count += 1;
      byCity[city].sumLng += lng;
      byCity[city].sumLat += lat;
      byCity[city].items.push(l);
    });

    const cities = Object.entries(byCity).map(([city, data]) => {
      const avgLng = data.sumLng / data.count;
      const avgLat = data.sumLat / data.count;
      return {
        cityName: city,
        count: data.count,
        position: [avgLng, avgLat] as [number, number],
        items: data.items,
      };
    });
    setCityPoints(cities);

    // Locations for either whole province or selected city
    const locs = selectedCity ? byCity[selectedCity]?.items ?? [] : inProvince;
    const points = locs.map((l) => ({
      position: [
        typeof l.longitude === 'string' ? parseFloat(l.longitude) : l.longitude,
        typeof l.latitude === 'string' ? parseFloat(l.latitude) : l.latitude,
      ] as [number, number],
      data: l,
    }));
    setLocationPoints(points);
  }, [selectedProvince, selectedCity, locations, provinces, findProvinceFeature]);

  // Update preview pixel position when camera changes
  useEffect(() => {
    if (!selectedLocation || !mapRef.current) return;
    const lng = typeof selectedLocation.longitude === 'string' ? parseFloat(selectedLocation.longitude) : selectedLocation.longitude;
    const lat = typeof selectedLocation.latitude === 'string' ? parseFloat(selectedLocation.latitude) : selectedLocation.latitude;
    if (lng == null || lat == null) return;
    const pt = mapRef.current.project([lng, lat]);
    setPreviewXY({ x: pt.x, y: pt.y });
  }, [selectedLocation, viewState]);

  const onViewStateChange = useCallback((info: any) => {
    setViewState(info.viewState);
  }, []);

  const onClickProvince = useCallback(
    (info: any) => {
      if (info.object && info.object.properties) {
        const name = info.object.properties.name_en || info.object.properties.name;
        setSelectedProvince(name);
        setSelectedCity(null);
        const c = centroid(info.object);
        const [lng, lat] = c.geometry.coordinates as [number, number];
        setViewState((prev) => ({
          ...prev,
          longitude: lng,
          latitude: lat,
          zoom: Math.max(prev.zoom, 8),
          pitch: 0,
          transitionDuration: 550,
          transitionInterpolator: new FlyToInterpolator({ speed: 2.5 }),
        }));
      }
    },
    []
  );

  const onClickCity = useCallback((info: any) => {
    if (!info.object) return;
    const { position, cityName } = info.object;
    setSelectedCity(cityName);
    setViewState((prev) => ({
      ...prev,
      longitude: position[0],
      latitude: position[1],
      zoom: Math.max(prev.zoom, 12),
      transitionDuration: 550,
      transitionInterpolator: new FlyToInterpolator({ speed: 2.5 }),
    }));
  }, []);

  const onClickLocation = useCallback((info: any) => {
    if (!info.object) return;
    const { data, position } = info.object;
    setSelectedLocation(data);
    if (mapRef.current) {
      const pt = mapRef.current.project(position as [number, number]);
      setPreviewXY({ x: pt.x, y: pt.y - 10 });
    }
  }, []);

  // Layer building
  const layers = useMemo(() => {
    const list: any[] = [];
    if (provinces) {
      list.push(
        new GeoJsonLayer({
          id: 'provinces',
          data: provinces,
          pickable: true,
          filled: true,
          stroked: true,
          extruded: false,
          getLineColor: [255, 255, 255, 255] as [number, number, number, number],
          getLineWidth: 2,
          lineWidthMinPixels: 2,
          getFillColor: (f: any) => {
            const isSelected = f.properties.name_en === selectedProvince || f.properties.name === selectedProvince;
            return isSelected ? [12, 94, 64, 140] as [number, number, number, number] : [12, 94, 64, 230] as [number, number, number, number];
          },
          onClick: onClickProvince,
          updateTriggers: { getFillColor: selectedProvince },
        })
      );
    }

    // Determine visibility based on zoom
    const showCities = selectedProvince && viewState.zoom >= CITY_ZOOM_MIN && viewState.zoom < LOCATION_ZOOM_MIN;
    const showLocations = selectedProvince && viewState.zoom >= LOCATION_ZOOM_MIN;

    if (showCities && cityPoints.length > 0) {
      // City pins: green circles with white ring + label with city name and count
      list.push(
        new ScatterplotLayer({
          id: 'cities',
          data: cityPoints,
          pickable: true,
          getPosition: (d: any) => d.position,
          radiusUnits: 'pixels',
          getRadius: (d: any) => Math.min(24, 10 + Math.sqrt(d.count) * 2),
          getFillColor: [16, 185, 129, 220] as [number, number, number, number],
          stroked: true,
          getLineColor: [255, 255, 255, 240] as [number, number, number, number],
          getLineWidth: 2,
          onClick: onClickCity,
          parameters: { depthTest: false },
        })
      );
      list.push(
        new TextLayer({
          id: 'city-labels',
          data: cityPoints,
          pickable: false,
          getPosition: (d: any) => d.position,
          getText: (d: any) => `${d.cityName} · ${d.count}`,
          getSize: 14,
          getColor: [255, 255, 255, 230],
          background: true,
          getBackgroundColor: [0, 0, 0, 140],
          getTextAnchor: 'start',
          getAlignmentBaseline: 'center',
          getPixelOffset: [18, 0],
          parameters: { depthTest: false },
        })
      );
    }

    if (showLocations && locationPoints.length > 0) {
      list.push(
        new ScatterplotLayer({
          id: 'locations',
          data: locationPoints,
          pickable: true,
          getPosition: (d: any) => d.position,
          radiusUnits: 'pixels',
          getRadius: 7,
          getFillColor: [255, 64, 128, 230] as [number, number, number, number],
          stroked: true,
          getLineColor: [255, 255, 255, 240] as [number, number, number, number],
          getLineWidth: 2,
          onClick: onClickLocation,
          parameters: { depthTest: false },
        })
      );
    }

    return list;
  }, [provinces, selectedProvince, viewState.zoom, cityPoints, locationPoints, onClickProvince, onClickCity, onClickLocation]);

  const closePreview = useCallback(() => {
    setSelectedLocation(null);
    setPreviewXY(null);
  }, []);

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
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}
      />
      <DeckGL
        ref={deckRef}
        viewState={viewState}
        controller={{ dragRotate: false }}
        layers={layers}
        onViewStateChange={onViewStateChange}
        style={{ width: '100%', height: '100%', position: 'absolute', top: '0', left: '0', zIndex: '1' }}
        getTooltip={({ object }) => {
          if (!object) return null;
          if (object.properties) {
            return object.properties.name_en || object.properties.name;
          }
          if (object.cityName) return `${object.cityName} · ${object.count}`;
          if (object.data?.name) return object.data.name;
          return null;
        }}
      />
      {selectedLocation && previewXY ? (
        <LocationPreview x={previewXY.x} y={previewXY.y} location={selectedLocation} onClose={closePreview} />
      ) : null}
    </div>
  );
}
