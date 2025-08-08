import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, TileLayer } from '@deck.gl/layers';
import * as turf from '@turf/turf';
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
    if (!selectedProvince) {
      setCityPoints([]);
      setLocationPoints([]);
      return;
    }

    const filtered = locations.filter(l => l.province === selectedProvince && l.latitude && l.longitude);

    const byCity: Record<string, any[]> = {};
    filtered.forEach(l => {
      const city = l.city || '';
      if (!byCity[city]) byCity[city] = [];
      byCity[city].push(l);
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
      filtered.map(l => ({ position: [+l.longitude, +l.latitude], data: l }))
    );
  }, [selectedProvince, locations]);

  const onViewStateChange = useCallback((info: any) => setViewState(info.viewState), []);

  const onClickProvince = useCallback((info: any) => {
    const f = info.object;
    if (!f?.properties) return;
    const name = f.properties.name_en || f.properties.name;
    setSelectedProvince(name);
    const [minX, minY, maxX, maxY] = turf.bbox(f);
    const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
    const size = Math.max(maxX - minX, maxY - minY);
    const targetZoom = size > 5 ? 7.0 : size > 3 ? 7.6 : size > 2 ? 8.2 : 9.0;
    setViewState(v => ({ ...v, longitude: cx, latitude: cy, zoom: targetZoom, transitionDuration: 800 }));
  }, []);

  // ---- Basemap + masking (no react-map-gl) ----
  // World bbox polygon (covers screen)
  const worldPoly = useMemo(() => turf.bboxPolygon([-180, -85, 180, 85]) as any, []);

  // Country polygon union (for masking outside BG)
  const countryUnion = useMemo(() => {
    if (!provinces) return null;
    try { return turf.union(...provinces.features) as any; } catch { return null; }
  }, [provinces]);

  // Mask that hides everything outside Bulgaria by default,
  // or outside the currently selected province when one is selected.
  const maskData = useMemo(() => {
    if (!countryUnion) return null;
    if (!selectedProvince) {
      return turf.difference(worldPoly, countryUnion);
    }
    const feat = provinces.features.find((f: any) =>
      f.properties.name_en === selectedProvince || f.properties.name === selectedProvince
    );
    if (!feat) return turf.difference(worldPoly, countryUnion);
    return turf.difference(worldPoly, feat);
  }, [countryUnion, worldPoly, provinces, selectedProvince]);

  // Build layers
  const layers = useMemo(() => {
    const out: any[] = [];

    // Basemap (OSM tiles)
    out.push(new TileLayer({
      id: 'basemap',
      data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      opacity: 1
    }));

    // Mask outside BG / outside selected province
    if (maskData) {
      out.push(new GeoJsonLayer({
        id: 'mask',
        data: maskData,
        filled: true,
        stroked: false,
        getFillColor: [10, 12, 16, 255]
      }));
    }

    if (provinces) {
      out.push(new GeoJsonLayer({
        id: 'provinces',
        data: provinces,
        pickable: true,
        filled: true,
        stroked: true,
        extruded: false,
        getLineColor: [40, 80, 80, 220],
        lineWidthMinPixels: 1,
        getFillColor: (f: any) =>
          (f.properties.name_en === selectedProvince || f.properties.name === selectedProvince)
            ? [34, 197, 94, 140]
            : [20, 120, 100, 90],
        onClick: onClickProvince,
        updateTriggers: { getFillColor: selectedProvince }
      }));
    }

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

    if (viewState.zoom >= 11 && locationPoints.length > 0) {
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

    return out;
  }, [maskData, provinces, selectedProvince, onClickProvince, viewState.zoom, cityPoints, locationPoints]);

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      <DeckGL
        viewState={viewState}
        controller={{ dragRotate: false }}
        layers={layers}
        onViewStateChange={onViewStateChange}
        getTooltip={({ object }) => object?.properties?.name_en || object?.properties?.name || null}
        style={{ width: '100%', height: '100%', background: '#0b0f14', borderRadius: 12 }}
      />
    </div>
  );
}
