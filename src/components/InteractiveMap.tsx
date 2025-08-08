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

// zoom gates (adjust if you want)
const CITY_ZOOM = 8;        // start showing city pins
const LOCATION_ZOOM = 12;   // switch to locations

export default function InteractiveMap() {
  const { locations } = useLocations();
  const [provinces, setProvinces] = useState<any>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);

  const [cityPoints, setCityPoints] = useState<any[]>([]);
  const [locationPoints, setLocationPoints] = useState<any[]>([]);

  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const nationalCenterRef = useRef<{ lng: number; lat: number; zoom: number } | null>(null);

  // ── Mapbox token ──────────────────────────────────────────────────────────────
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

  // ── Map init / mask ──────────────────────────────────────────────────────────
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
      if (!mapRef.current.getLayer('world-mask-layer')) {
        mapRef.current.addLayer({
          id: 'world-mask-layer',
          type: 'fill',
          source: 'world-mask',
          paint: { 'fill-color': '#020817', 'fill-opacity': 1 }
        });
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

    const maskWithAllProvinceHoles = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Polygon' as const, coordinates: [worldRing, ...holes] }
    };
    (mapRef.current.getSource('world-mask') as mapboxgl.GeoJSONSource)?.setData(maskWithAllProvinceHoles);
  }, [provinces]);

  useEffect(() => {
    setMaskToAllProvinces();
  }, [setMaskToAllProvinces, selectedProvince, provinces]);

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

  // ── GeoJSON + national center ────────────────────────────────────────────────
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then(data => setProvinces(data));
  }, []);

  useEffect(() => {
    if (!provinces) return;
    const [minX, minY, maxX, maxY] = bbox(provinces);
    const centerLng = (minX + maxX) / 2;
    const centerLat = (minY + maxY) / 2;
    const zoom = 6.5;
    nationalCenterRef.current = { lng: centerLng, lat: centerLat, zoom };
    setViewState(prev => ({
      ...prev,
      longitude: centerLng,
      latitude: centerLat,
      zoom,
      pitch: 0,
      bearing: 0,
      transitionDuration: 0
    }));
  }, [provinces]);

  // ── Build city + location data when province/city changes ───────────────────
  useEffect(() => {
    // Reset selected city if province cleared
    if (!selectedProvince) {
      setSelectedCity(null);
      setCityPoints([]);
      setLocationPoints([]);
      setSelectedLocation(null);
      return;
    }

    // Filter by province (IMPORTANT: was city === selectedProvince before)
    const inProvince = locations.filter(
      (l: any) =>
        l?.province === selectedProvince &&
        l?.latitude != null &&
        l?.longitude != null
    );

    // Group by city => city pins
    const byCity: Record<string, any[]> = {};
    inProvince.forEach(l => {
      const c = l.city || '';
      if (!byCity[c]) byCity[c] = [];
      byCity[c].push(l);
    });

    const newCityPoints = Object.entries(byCity).map(([city, pts]) => {
      const sum = pts.reduce(
        (acc, p: any) => {
          const lon = typeof p.longitude === 'string' ? parseFloat(p.longitude) : p.longitude;
          const lat = typeof p.latitude === 'string' ? parseFloat(p.latitude) : p.latitude;
          acc.lon += lon;
          acc.lat += lat;
          return acc;
        },
        { lon: 0, lat: 0 }
      );
      const center = [sum.lon / pts.length, sum.lat / pts.length] as [number, number];
      return { position: center, count: pts.length, cityName: city, pts };
    });

    setCityPoints(newCityPoints);

    // Locations to show:
    // - if a city is selected: only its locations
    // - else: all province locations (will only render once zoom >= LOCATION_ZOOM)
    const locsForNow =
      selectedCity && byCity[selectedCity] ? byCity[selectedCity] : inProvince;

    setLocationPoints(
      locsForNow.map((l: any) => ({
        position: [
          typeof l.longitude === 'string' ? parseFloat(l.longitude) : l.longitude,
          typeof l.latitude === 'string' ? parseFloat(l.latitude) : l.latitude
        ],
        data: l
      }))
    );
  }, [selectedProvince, selectedCity, locations]);

  // Clear selectedCity when zooming out below city zoom
  useEffect(() => {
    if (viewState.zoom < CITY_ZOOM && selectedProvince) {
      setSelectedProvince(null);
      setSelectedCity(null);
      setSelectedLocation(null);
    }
    // if we’re between CITY_ZOOM and LOCATION_ZOOM and had a selected city,
    // keep it; once we drop below CITY_ZOOM we reset province above.
  }, [viewState.zoom]); // eslint-disable-line

  const onViewStateChange = useCallback((info: any) => {
    setViewState(info.viewState);

    // Auto-toggle: when zoom crosses LOCATION_ZOOM while a province is selected,
    // city pins hide and location pins show. (Handled by conditional layer rendering)
  }, []);

  const onClickProvince = useCallback(
    (info: any) => {
      if (info.object && info.object.properties) {
        const name =
          info.object.properties.name_en || info.object.properties.name;

        // deselect if clicking the same province
        if (selectedProvince === name) {
          setSelectedProvince(null);
          setSelectedCity(null);
          setSelectedLocation(null);
          const fallback =
            nationalCenterRef.current || {
              lng: 25.4858,
              lat: 42.7339,
              zoom: 6.5
            };
          setViewState(prev => ({
            ...prev,
            longitude: fallback.lng,
            latitude: fallback.lat,
            zoom: fallback.zoom,
            pitch: 0,
            transitionDuration: 550,
            transitionInterpolator: new FlyToInterpolator({ speed: 2.5 })
          }));
          return;
        }

        // select province
        setSelectedProvince(name);
        setSelectedCity(null);
        setSelectedLocation(null);

        const c = centroid(info.object);
        const [lng, lat] = c.geometry.coordinates as [number, number];
        setViewState(prev => ({
          ...prev,
          longitude: lng,
          latitude: lat,
          zoom: CITY_ZOOM, // zoom to city level
          pitch: 0,
          transitionDuration: 550,
          transitionInterpolator: new FlyToInterpolator({ speed: 2.5 })
        }));
      }
    },
    [selectedProvince]
  );

  // ── Layers ──────────────────────────────────────────────────────────────────
  const layers: any[] = [];

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
        getLineColor: [255, 255, 255, 255],
        getLineWidth: () => 2,
        lineWidthMinPixels: 2,
        getElevation: 0,
        getFillColor: (f: any) => {
          const isSelected =
            f.properties.name_en === selectedProvince ||
            f.properties.name === selectedProvince;
          return isSelected ? [0, 0, 0, 0] : [16, 185, 129, 200];
        },
        onClick: onClickProvince,
        updateTriggers: { getFillColor: selectedProvince }
      })
    );
  }

  // Show city pins only when a province is selected and zoom is in [CITY_ZOOM, LOCATION_ZOOM)
  if (
    selectedProvince &&
    viewState.zoom >= CITY_ZOOM &&
    viewState.zoom < LOCATION_ZOOM &&
    cityPoints.length > 0
  ) {
    layers.push(
      new ScatterplotLayer({
        id: 'cities',
        data: cityPoints,
        pickable: true,
        getPosition: (d: any) => d.position,
        getRadius: (d: any) => Math.sqrt(d.count) * 5000,
        getFillColor: [0, 200, 140],
        onClick: (info: any) => {
          if (!info.object) return;
          const { cityName, position } = info.object;
          setSelectedCity(cityName);
          setSelectedLocation(null);
          setViewState(prev => ({
            ...prev,
            longitude: position[0],
            latitude: position[1],
            zoom: Math.max(prev.zoom, LOCATION_ZOOM), // jump to locations level
            transitionDuration: 600,
            transitionInterpolator: new FlyToInterpolator({ speed: 2.5 })
          }));
        },
        getTooltip: ({ object }: any) =>
          object ? `${object.cityName} · ${object.count}` : null
      })
    );
  }

  // Show location pins when a province is selected AND (zoom >= LOCATION_ZOOM OR a city is selected)
  if (
    selectedProvince &&
    (viewState.zoom >= LOCATION_ZOOM || selectedCity) &&
    locationPoints.length > 0
  ) {
    layers.push(
      new ScatterplotLayer({
        id: 'locations',
        data: locationPoints,
        pickable: true,
        getPosition: (d: any) => d.position,
        getRadius: 2000,
        getFillColor: [255, 0, 128],
        onClick: (info: any) => {
          if (!info.object) return;
          setSelectedLocation(info.object.data);
        },
        getTooltip: ({ object }: any) =>
          object?.data?.name ? object.data.name : null
      })
    );
  }

  if (!mapboxToken) {
    return (
      <div
        style={{ width: '100%', height: '600px', position: 'relative' }}
        className="flex items-center justify-center bg-muted"
      >
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      {/* Mapbox base */}
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

      {/* DeckGL on top */}
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
        getTooltip={({ object }: any) => {
          // Province tooltip (from GeoJsonLayer)
          if (object && object.properties) {
            return object.properties.name_en || object.properties.name;
          }
          return null;
        }}
      />

      {/* Minimal location preview */}
      {selectedLocation && (
        <div
          className="rounded-2xl shadow-xl p-4"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 2,
            background: 'rgba(2,8,23,0.94)',
            border: '1px solid rgba(255,255,255,0.08)',
            width: 360,
            maxWidth: '80%'
          }}
        >
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-white text-lg font-semibold">
              {selectedLocation.name || 'Локация'}
            </h4>
            <button
              onClick={() => setSelectedLocation(null)}
              className="text-slate-300 hover:text-white"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          {selectedLocation.address && (
            <div className="text-slate-300 text-sm mb-2">
              {selectedLocation.address}
            </div>
          )}
          {selectedLocation.price != null && (
            <div className="text-white font-bold">
              {selectedLocation.price} лв/ден
            </div>
          )}
        </div>
      )}
    </div>
  );
}
