import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { FlyToInterpolator } from '@deck.gl/core';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import bbox from '@turf/bbox';
import centroid from '@turf/centroid';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point as turfPoint } from '@turf/helpers';

import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';

const GEOJSON_URL = '/data/bg_provinces.geojson';

// ---- Zoom thresholds ----
const ZOOM_PROVINCE_SELECTED = 7.6; // when reached, auto-select the province at view center
const ZOOM_SHOW_CITIES = 8.0; // show city pins when province is selected and zoom >= this
const ZOOM_SHOW_LOCATIONS = 11.5; // show location pins when zoom >= this (and hide city pins)

const INITIAL_VIEW_STATE = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 6.5,
  pitch: 0,
  bearing: 0,
  transitionDuration: 0
};

// Small UI chip for the preview box header badges
const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center text-xs font-semibold px-2 py-1 rounded-md bg-white/10 border border-white/15 backdrop-blur">
    {children}
  </span>
);

export default function InteractiveMap() {
  const { locations } = useLocations();

  // Geo & map state
  const [provinces, setProvinces] = useState<any>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // Pins data
  const [cityPoints, setCityPoints] = useState<any[]>([]);
  const [locationPoints, setLocationPoints] = useState<any[]>([]);

  // Mapbox backing map (masked satellite)
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const nationalCenterRef = useRef<{ lng: number; lat: number; zoom: number } | null>(null);

  // Preview state (for clicked location)
  const [preview, setPreview] = useState<{
    x: number;
    y: number;
    data: any | null;
  } | null>(null);

  // ---------- MAPBOX TOKEN ----------
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-mapbox-token');
        if (data?.token) {
          setMapboxToken(data.token);
          mapboxgl.accessToken = data.token;
          return;
        }
      } catch {}
      const fallback = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
      setMapboxToken(fallback);
      mapboxgl.accessToken = fallback;
    };
    fetchMapboxToken();
  }, []);

  // ---------- LOAD PROVINCES ----------
  useEffect(() => {
    fetch(GEOJSON_URL).then(res => res.json()).then(data => setProvinces(data));
  }, []);

  // ---------- CENTER ON BULGARIA ----------
  useEffect(() => {
    if (!provinces) return;
    const [minX, minY, maxX, maxY] = bbox(provinces);
    const centerLng = (minX + maxX) / 2;
    const centerLat = (minY + maxY) / 2;
    const zoom = 6.5;
    nationalCenterRef.current = { lng: centerLng, lat: centerLat, zoom };
    setViewState(v => ({ ...v, longitude: centerLng, latitude: centerLat, zoom, pitch: 0, bearing: 0, transitionDuration: 0 }));
  }, [provinces]);

  // ---------- BACKGROUND MAPBOX (masked satellite) ----------
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
      if (!mapRef.current) return;

      // 1) World mask source & layer (#020817 solid background)
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

      // Slightly fade satellite for better contrast under pins
      const layers = mapRef.current.getStyle().layers;
      const raster = layers?.find(l => l.type === 'raster');
      if (raster) mapRef.current.setPaintProperty(raster.id, 'raster-opacity', 0.85);

      // Cut holes for ALL Bulgarian provinces (so satellite shows only within BG borders)
      setMaskToAllProvinces();
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, provinces]);

  // Update mapbox camera when deck view changes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.jumpTo({
        center: [viewState.longitude, viewState.latitude],
        zoom: viewState.zoom,
        pitch: viewState.pitch,
        bearing: viewState.bearing
      });
    }
  }, [viewState]);

  // Build the mask (BG only) by carving province holes from the world polygon
  const setMaskToAllProvinces = useCallback(() => {
    if (!mapRef.current || !provinces) return;

    const worldRing: [number, number][] = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
    const holes: [number, number][][] = [];

    for (const feat of provinces.features) {
      const g = feat.geometry;
      if (!g) continue;
      if (g.type === 'Polygon') {
        holes.push(g.coordinates[0] as [number, number][]);
      } else if (g.type === 'MultiPolygon') {
        for (const poly of g.coordinates) holes.push(poly[0] as [number, number][]);
      }
    }

    const maskWithAllProvinceHoles = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Polygon' as const, coordinates: [worldRing, ...holes] }
    };

    (mapRef.current.getSource('world-mask') as mapboxgl.GeoJSONSource)?.setData(maskWithAllProvinceHoles);
  }, [provinces]);

  // ---------- Auto-select province by zoom + center point ----------
  const pickProvinceByCenter = useCallback(() => {
    if (!provinces) return null;
    const p = turfPoint([viewState.longitude, viewState.latitude]);
    for (const feat of provinces.features) {
      if (booleanPointInPolygon(p, feat)) return feat.properties.name_en || feat.properties.name;
    }
    return null;
  }, [provinces, viewState.longitude, viewState.latitude]);

  useEffect(() => {
    if (!provinces) return;

    if (viewState.zoom >= ZOOM_PROVINCE_SELECTED) {
      // If nothing explicitly selected, pick by center
      if (!selectedProvince) {
        const name = pickProvinceByCenter();
        if (name) setSelectedProvince(name);
      }
    } else {
      // Zoomed out — clear selections
      if (selectedProvince) setSelectedProvince(null);
      if (selectedCity) setSelectedCity(null);
    }
  }, [viewState.zoom, provinces, pickProvinceByCenter, selectedProvince, selectedCity]);

  // ---------- Utilities ----------
  const provinceFeatureByName = useCallback((name: string | null) => {
    if (!name || !provinces) return null;
    return provinces.features.find((f: any) => (f.properties.name_en === name || f.properties.name === name)) || null;
  }, [provinces]);

  // Resolve the province name for a location (uses location.province if present, else spatial test)
  const resolveProvinceForLocation = useCallback((loc: any) => {
    if (loc.province) return loc.province;
    if (!provinces || !loc.longitude || !loc.latitude) return null;
    const p = turfPoint([Number(loc.longitude), Number(loc.latitude)]);
    for (const feat of provinces.features) {
      if (booleanPointInPolygon(p, feat)) return feat.properties.name_en || feat.properties.name;
    }
    return null;
  }, [provinces]);

  // ---------- Build City & Location points whenever selection/zoom changes ----------
  useEffect(() => {
    if (!provinces || !selectedProvince) {
      setCityPoints([]);
      setLocationPoints([]);
      return;
    }

    // Filter locations within the selected province
    const inProvince = locations.filter(l => {
      const prov = resolveProvinceForLocation(l);
      return prov === selectedProvince;
    });

    // If a city is selected and we're deeply zoomed, filter to it. Otherwise keep all.
    const visibleForLocations = (selectedCity && viewState.zoom >= ZOOM_SHOW_LOCATIONS)
      ? inProvince.filter(l => (l.city || '').toLowerCase() === selectedCity?.toLowerCase())
      : inProvince;

    // CITY LAYER DATA (aggregated)
    const cityGroups: Record<string, any[]> = {};
    inProvince.forEach(l => {
      const c = (l.city || '').trim();
      if (!c || !l.latitude || !l.longitude) return;
      if (!cityGroups[c]) cityGroups[c] = [];
      cityGroups[c].push(l);
    });

    const cityPts = Object.entries(cityGroups).map(([cityName, pts]) => {
      const avg = pts.reduce((acc: any, p: any) => {
        acc.lng += Number(p.longitude);
        acc.lat += Number(p.latitude);
        return acc;
      }, { lng: 0, lat: 0 });
      const n = (pts as any[]).length;
      return {
        cityName,
        count: n,
        position: [avg.lng / n, avg.lat / n] as [number, number]
      };
    });

    setCityPoints(cityPts);

    // LOCATION LAYER DATA (individual pins)
    const locPts = visibleForLocations
      .filter(l => l.latitude && l.longitude)
      .map(l => ({
        position: [Number(l.longitude), Number(l.latitude)] as [number, number],
        data: l
      }));

    setLocationPoints(locPts);
  }, [locations, provinces, selectedProvince, selectedCity, viewState.zoom, resolveProvinceForLocation]);

  // ---------- Interactions ----------
  const onViewStateChange = useCallback((info: any) => {
    setViewState(info.viewState);
  }, []);

  const onClickProvince = useCallback((info: any) => {
    if (!info.object || !info.object.properties) return;
    const name = info.object.properties.name_en || info.object.properties.name;
    if (selectedProvince === name) {
      // Deselect + zoom out to national view
      const fallback = nationalCenterRef.current || { lng: 25.4858, lat: 42.7339, zoom: 6.5 };
      setSelectedProvince(null);
      setSelectedCity(null);
      setPreview(null);
      setViewState(v => ({
        ...v,
        longitude: fallback.lng,
        latitude: fallback.lat,
        zoom: fallback.zoom,
        pitch: 0,
        transitionDuration: 550,
        transitionInterpolator: new FlyToInterpolator({ speed: 2.5 })
      }));
      return;
    }

    setSelectedProvince(name);
    setSelectedCity(null);
    setPreview(null);

    // Fly to province centroid and show cities
    const c = centroid(info.object);
    const [lng, lat] = c.geometry.coordinates as [number, number];
    setViewState(v => ({
      ...v,
      longitude: lng,
      latitude: lat,
      zoom: Math.max(ZOOM_SHOW_CITIES + 0.5, 8.5),
      pitch: 0,
      transitionDuration: 600,
      transitionInterpolator: new FlyToInterpolator({ speed: 2.2 })
    }));
  }, [selectedProvince]);

  const onClickCity = useCallback((info: any) => {
    if (!info.object) return;
    setSelectedCity(info.object.cityName);
    setPreview(null);
    setViewState(v => ({
      ...v,
      longitude: info.object.position[0],
      latitude: info.object.position[1],
      zoom: Math.max(ZOOM_SHOW_LOCATIONS + 0.2, 12.2),
      transitionDuration: 600,
      transitionInterpolator: new FlyToInterpolator({ speed: 2.0 })
    }));
  }, []);

  const onClickLocation = useCallback((info: any) => {
    if (!info.object) return;
    const { x, y } = info; // screen coords from deck.gl picking
    setPreview({ x, y, data: info.object.data });
  }, []);

  // Close preview on ESC
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  // ---------- Layers ----------
  const layers = useMemo(() => {
    const arr: any[] = [];

    if (provinces) {
      arr.push(new GeoJsonLayer({
        id: 'provinces',
        data: provinces,
        pickable: true,
        filled: true,
        stroked: true,
        extruded: false,
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 2,
        lineWidthMinPixels: 2,
        getFillColor: (f: any) => {
          const isSel = (f.properties.name_en === selectedProvince || f.properties.name === selectedProvince);
          return isSel ? [0, 0, 0, 0] : [16, 185, 129, 200];
        },
        onClick: onClickProvince,
        updateTriggers: { getFillColor: selectedProvince }
      }));
    }

    // CITY PINS (only when zoom in province level, and locations are not shown)
    const showCities = (viewState.zoom >= ZOOM_SHOW_CITIES && viewState.zoom < ZOOM_SHOW_LOCATIONS && selectedProvince);
    if (showCities && cityPoints.length > 0) {
      // Base circle
      arr.push(new ScatterplotLayer({
        id: 'cities-dots',
        data: cityPoints,
        pickable: true,
        radiusUnits: 'pixels',
        getRadius: (d: any) => Math.min(64, 18 + Math.sqrt(d.count) * 6),
        getLineColor: [255, 255, 255, 220],
        getLineWidth: 2,
        lineWidthUnits: 'pixels',
        getFillColor: [14, 165, 233, 220], // cyan-ish
        getPosition: (d: any) => d.position,
        onClick: onClickCity
      }));
      // Label with count
      arr.push(new TextLayer({
        id: 'cities-labels',
        data: cityPoints,
        pickable: true,
        getPosition: (d: any) => d.position,
        getText: (d: any) => `${d.cityName} • ${d.count}`,
        getSize: 16,
        sizeUnits: 'pixels',
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'top',
        getPixelOffset: [0, 14],
        getColor: [255, 255, 255, 255],
        onClick: onClickCity
      }));
    }

    // LOCATION PINS (only when zoomed enough)
    const showLocations = (viewState.zoom >= ZOOM_SHOW_LOCATIONS && selectedProvince);
    if (showLocations && locationPoints.length > 0) {
      arr.push(new ScatterplotLayer({
        id: 'locations-dots',
        data: locationPoints,
        pickable: true,
        radiusUnits: 'pixels',
        getRadius: 8,
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 2,
        lineWidthUnits: 'pixels',
        getFillColor: [236, 72, 153, 220], // pink-ish
        getPosition: (d: any) => d.position,
        onClick: onClickLocation
      }));
    }

    return arr;
  }, [provinces, selectedProvince, viewState.zoom, cityPoints, locationPoints, onClickProvince, onClickCity, onClickLocation]);

  if (!mapboxToken) {
    return (
      <div style={{ width: '100%', height: 600 }} className="flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">Loading map…</p>
      </div>
    );
  }

  // --- Preview card (compact) ---
  const Preview = () => {
    if (!preview?.data) return null;
    const l = preview.data;
    return (
      <div
        className="fixed z-50 w-[320px] max-w-[90vw] rounded-2xl border border-white/15 bg-[#0B1220]/95 shadow-xl backdrop-blur p-4"
        style={{ left: Math.min(preview.x + 12, window.innerWidth - 340), top: Math.min(preview.y - 12, window.innerHeight - 280) }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex gap-3">
          {l.image && (
            <img src={l.image} alt={l.name} className="h-20 w-28 rounded-lg object-cover" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-white truncate">{l.name}</h4>
              {l.pricePerDay && <Badge>{l.pricePerDay} лв/ден</Badge>}
            </div>
            <p className="text-xs text-white/70 truncate">{l.address}{l.city ? `, ${l.city}` : ''}</p>
          </div>
        </div>
        {l.description && (
          <p className="mt-2 text-sm text-white/80 line-clamp-3">{l.description}</p>
        )}
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-white/10 border border-white/15 hover:bg-white/15 transition"
            onClick={() => setPreview(null)}
          >
            Close
          </button>
          {l.id && (
            <a
              href={`/locations/${l.id}`}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary text-white hover:opacity-90 transition"
            >
              View details
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ width: '100%', height: 600, position: 'relative' }}>
      {/* Background satellite masked to Bulgaria */}
      <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      {/* DeckGL overlay */}
      <DeckGL
        viewState={viewState}
        controller={{ dragRotate: false }}
        layers={layers}
        onViewStateChange={onViewStateChange}
        onClick={() => { /* clicking empty map closes preview */ if (preview) setPreview(null); }}
        getTooltip={({ object }) => {
          // Province hover tooltip only (keep pins clean)
          if (object && object.properties) return object.properties.name_en || object.properties.name;
          return null;
        }}
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
      />

      {/* Location preview */}
      {preview && <Preview />}
    </div>
  );
}
