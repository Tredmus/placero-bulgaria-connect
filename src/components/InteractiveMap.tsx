import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import * as turf from '@turf/turf';
import union from '@turf/union';

import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { useLocations } from '@/hooks/useLocations';

const GEOJSON_URL = '/data/bg_provinces.geojson';

const INITIAL_VIEW_STATE = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 6.5,
  pitch: 0,
  bearing: 0,
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

  // Load provinces
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then(data => setProvinces(data));
  }, []);

  // Build city/locations when a province is selected
useEffect(() => {
    if (!selectedProvince || !provinces) {
      setCityPoints([]);
      setLocationPoints([]);
      return;
    }

    const feat = provinces.features.find((f: any) =>
      f.properties.name_en === selectedProvince || f.properties.name === selectedProvince
    );

    if (!feat) {
      setCityPoints([]);
      setLocationPoints([]);
      return;
    }

    const filtered = locations.filter((l: any) => {
      const lat = Number((l as any).latitude);
      const lon = Number((l as any).longitude);
      if (isNaN(lat) || isNaN(lon)) return false;
      try {
        return booleanPointInPolygon([lon, lat] as any, feat as any);
      } catch {
        return false;
      }
    });

    const byCity: Record<string, any[]> = {};
    filtered.forEach(l => {
      const city = (l as any).city || '';
      if (!byCity[city]) byCity[city] = [];
      byCity[city].push(l as any);
    });

    setCityPoints(
      Object.entries(byCity).map(([city, pts]) => {
        const avg = (pts as any[]).reduce((acc, p: any) => {
          acc.longitude += +p.longitude; acc.latitude += +p.latitude; return acc;
        }, { longitude: 0, latitude: 0 });
        const n = (pts as any[]).length;
        return { position: [avg.longitude / n, avg.latitude / n], count: n, cityName: city, pts };
      })
    );

    setLocationPoints(
      filtered.map((l: any) => ({ position: [+l.longitude, +l.latitude], data: l }))
    );
  }, [selectedProvince, provinces, locations]);

  const onViewStateChange = useCallback((info: any) => setViewState(info.viewState), []);

  const onClickProvince = useCallback((info: any) => {
    const f = info.object;
    if (!f?.properties) return;
    const name = f.properties.name_en || f.properties.name;
    setSelectedProvince(name);
    try {
      const c = turf.centroid(f).geometry.coordinates;
      setViewState(v => ({
        ...v,
        longitude: c[0],
        latitude: c[1],
        zoom: 8,
        pitch: 45,
        transitionDuration: 800
      }));
    } catch {
      // fallback: no-op
    }
  }, []);

  // ---- Basemap + masking (no react-map-gl) ----
  // Bulgaria bbox polygon (used for outside mask)
  const bgBoundsPoly = useMemo(() => turf.bboxPolygon([19.3, 41.2, 28.6, 44.2]) as any, []);

  // Country polygon union (for masking outside BG)
const countryUnion = useMemo(() => {
    if (!provinces) return null;
    try {
      const feats = provinces.features;
      if (!feats || feats.length === 0) return null;
      let result: any = feats[0];
      for (let i = 1; i < feats.length; i++) {
        result = union(result as any, feats[i] as any);
      }
      return result;
    } catch {
      return null;
    }
  }, [provinces]);

  // Mask that hides everything outside Bulgaria by default,
  // or outside the currently selected province when one is selected.
const maskData = useMemo(() => {
    if (!countryUnion) return null;
    try {
      return (turf as any).difference(bgBoundsPoly as any, countryUnion as any) as any;
    } catch {
      return null;
    }
  }, [countryUnion, bgBoundsPoly]);

  // Spotlight mask: dim rest of Bulgaria when a province is selected
  const spotlightFeature = useMemo(() => {
    if (!selectedProvince || !provinces || !countryUnion) return null;
    const feat = provinces.features.find((f: any) =>
      f.properties.name_en === selectedProvince || f.properties.name === selectedProvince
    );
    if (!feat) return null;
    try {
      return (turf as any).difference(countryUnion as any, feat as any) as any;
    } catch {
      return null;
    }
  }, [selectedProvince, provinces, countryUnion]);

  // Build layers
  const layers = useMemo(() => {
    const out: any[] = [];

    const showBasemap = viewState.zoom >= 7.5 || !!selectedProvince;

    // 1) Basemap (OSM tiles) at bottom
    out.push(new TileLayer({
      id: 'basemap',
      data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      opacity: showBasemap ? 1 : 0
    }));

    // 2) Provinces
    if (provinces) {
      out.push(new GeoJsonLayer({
        id: 'provinces',
        data: provinces,
        pickable: true,
        filled: true,
        stroked: true,
        extruded: false,
        wireframe: false,
        opacity: 0.65,
        getLineColor: [40, 80, 80, 220],
        lineWidthMinPixels: 1,
        getFillColor: (f: any) =>
          (f.properties.name_en === selectedProvince || f.properties.name === selectedProvince)
            ? [34, 197, 94, 200]
            : [20, 120, 100, 130],
        onClick: onClickProvince,
        updateTriggers: { getFillColor: selectedProvince }
      }));
    }

    // 3) Cities (zoom >= 8)
    if (viewState.zoom >= 8 && cityPoints.length > 0) {
      out.push(new ScatterplotLayer({
        id: 'cities',
        data: cityPoints,
        pickable: true,
        getPosition: (d: any) => d.position,
        getRadius: (d: any) => Math.sqrt(d.count) * 3000,
        radiusUnits: 'meters',
        getFillColor: [230, 230, 230, 230],
        getLineColor: [35, 35, 35, 255],
        lineWidthMinPixels: 1,
        onClick: ({ object }: any) => object && setViewState(v => ({ ...v, longitude: object.position[0], latitude: object.position[1], zoom: 11, transitionDuration: 600 }))
      }));
    }

    // 4) Locations (zoom >= 12)
    if (viewState.zoom >= 12 && locationPoints.length > 0) {
      out.push(new ScatterplotLayer({
        id: 'locations',
        data: locationPoints,
        pickable: true,
        getPosition: (d: any) => d.position,
        getRadius: 1000,
        radiusUnits: 'meters',
        getFillColor: [255, 140, 0, 230],
        getLineColor: [35, 35, 35, 255],
        lineWidthMinPixels: 1,
        onClick: ({ object }: any) => object && alert(object.data.name)
      }));
    }

    // 5) Spotlight dim for rest of BG when a province is selected
    if (selectedProvince && spotlightFeature) {
      out.push(new GeoJsonLayer({
        id: 'province-spotlight-mask',
        data: spotlightFeature as any,
        filled: true,
        stroked: false,
        getFillColor: [10, 12, 16, 120]
      }));
    }

    // 6) Hard mask outside BG always on top
    if (maskData) {
      out.push(new GeoJsonLayer({
        id: 'outside-mask',
        data: maskData as any,
        filled: true,
        stroked: false,
        getFillColor: [10, 12, 16, 255]
      }));
    }

    return out;
  }, [provinces, selectedProvince, onClickProvince, viewState.zoom, cityPoints, locationPoints, spotlightFeature, maskData]);

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
<DeckGL
        viewState={viewState as any}
        controller={{ dragRotate: false, minZoom: 6, maxZoom: 14 }}
        layers={layers}
        onViewStateChange={onViewStateChange}
        getTooltip={({ object }) => object?.properties?.name_en || object?.properties?.name || null}
        style={{ width: '100%', height: '100%', background: '#0b0f14', borderRadius: '12px' }}
      />
    </div>
  );
}
