import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import * as turf from '@turf/turf';
import { useLocations } from '@/hooks/useLocations';

const GEOJSON_URL = '/data/bg_provinces.geojson';

const INITIAL_VIEW_STATE = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 6.6,
  minZoom: 5.5,
  maxZoom: 14,
  pitch: 0,
  bearing: 0,
  transitionDuration: 0
};

export default function InteractiveMap() {
  const { locations } = useLocations();

  const [provinces, setProvinces] = useState<any>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [hoveredProvinceId, setHoveredProvinceId] = useState<string | number | null>(null);

  // Pre-computed points (we keep your 3-level idea, but show them only at zoom thresholds)
  const [cityPoints, setCityPoints] = useState<any[]>([]);
  const [locationPoints, setLocationPoints] = useState<any[]>([]);

  // Load provinces
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(data => setProvinces(data));
  }, []);

  // When a province is selected, derive cities/locations from your dataset
  useEffect(() => {
    if (!selectedProvince) {
      setCityPoints([]);
      setLocationPoints([]);
      return;
    }

    const filtered = locations.filter(l => l.province === selectedProvince && l.latitude && l.longitude);
    const byCity: Record<string, any[]> = {};
    filtered.forEach(l => {
      const city = (l.city || '').trim();
      if (!byCity[city]) byCity[city] = [];
      byCity[city].push(l);
    });

    const cities = Object.entries(byCity).map(([city, pts]) => {
      const avg = pts.reduce(
        (acc, p) => ({
          longitude: acc.longitude + Number(p.longitude),
          latitude: acc.latitude + Number(p.latitude)
        }),
        { longitude: 0, latitude: 0 }
      );
      const n = (pts as any[]).length;
      return {
        cityName: city,
        count: n,
        position: [avg.longitude / n, avg.latitude / n],
        pts
      };
    });

    setCityPoints(cities);
    setLocationPoints(
      filtered.map(l => ({
        position: [Number(l.longitude), Number(l.latitude)],
        data: l
      }))
    );
  }, [selectedProvince, locations]);

  const onViewStateChange = useCallback(({ viewState: vs }) => setViewState(vs), []);

  // Zoom-to-fit helper
  const flyToBbox = useCallback((feature: any) => {
    const [minX, minY, maxX, maxY] = turf.bbox(feature);
    // basic "fit bounds" to keep it simple/minimal
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    // Heuristic zoom based on bbox size
    const dx = Math.abs(maxX - minX);
    const dy = Math.abs(maxY - minY);
    const size = Math.max(dx, dy);
    const targetZoom =
      size > 6 ? 6.7 :
      size > 4 ? 7.3 :
      size > 3 ? 7.7 :
      size > 2 ? 8.3 :
      9;

    setViewState(v => ({
      ...v,
      longitude: cx,
      latitude: cy,
      zoom: targetZoom,
      pitch: 0,
      bearing: 0,
      transitionDuration: 800
    }));
  }, []);

  // Province interactions
  const onClickProvince = useCallback((info: any) => {
    const f = info?.object;
    if (!f) return;
    const name = f.properties?.name_en || f.properties?.name;
    setSelectedProvince(name);
    flyToBbox(f);
  }, [flyToBbox]);

  const onHoverProvince = useCallback((info: any) => {
    setHoveredProvinceId(info?.object?.id ?? null);
  }, []);

  // Colors (minimalist, dark UI friendly)
  const colorFillDefault = [20, 120, 100, 160];
  const colorFillSelected = [34, 197, 94, 180];
  const colorFillHover = [30, 160, 140, 200];
  const colorStroke = [10, 50, 50, 220];

  const layers = useMemo(() => {
    const out: any[] = [];

    if (provinces) {
      out.push(
        new GeoJsonLayer({
          id: 'provinces-fill',
          data: provinces,
          pickable: true,
          stroked: true,
          filled: true,
          extruded: false,
          getLineColor: colorStroke,
          lineWidthMinPixels: 1,
          getFillColor: (f: any) => {
            const n = f.properties?.name_en || f.properties?.name;
            if (n === selectedProvince) return colorFillSelected;
            if (f.id === hoveredProvinceId) return colorFillHover;
            return colorFillDefault;
          },
          onClick: onClickProvince,
          onHover: onHoverProvince,
          updateTriggers: {
            getFillColor: [selectedProvince, hoveredProvinceId]
          }
        })
      );
    }

    // Cities (appear when zoomed-in a little)
    if (viewState.zoom >= 8 && cityPoints.length > 0) {
      out.push(
        new ScatterplotLayer({
          id: 'cities',
          data: cityPoints,
          pickable: true,
          getPosition: (d: any) => d.position,
          getRadius: (d: any) => Math.sqrt(d.count) * 3000,
          radiusUnits: 'meters',
          getFillColor: [200, 200, 200, 220],
          getLineColor: [30, 30, 30, 255],
          lineWidthMinPixels: 1,
          onClick: ({ object }) => {
            if (!object) return;
            setViewState(v => ({
              ...v,
              longitude: object.position[0],
              latitude: object.position[1],
              zoom: 11,
              transitionDuration: 600
            }));
          }
        })
      );
    }

    // Individual locations (appear deeper)
    if (viewState.zoom >= 11 && locationPoints.length > 0) {
      out.push(
        new ScatterplotLayer({
          id: 'locations',
          data: locationPoints,
          pickable: true,
          getPosition: (d: any) => d.position,
          getRadius: 1200,
          radiusUnits: 'meters',
          getFillColor: [255, 140, 0, 230],
          getLineColor: [35, 35, 35, 255],
          lineWidthMinPixels: 1,
          onClick: ({ object }) => object && alert(object.data.name)
        })
      );
    }

    return out;
  }, [
    provinces,
    selectedProvince,
    hoveredProvinceId,
    viewState.zoom,
    cityPoints,
    locationPoints
  ]);

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      <DeckGL
        viewState={viewState}
        controller={{ dragRotate: false }}
        layers={layers}
        onViewStateChange={onViewStateChange}
        getTooltip={({ object }) =>
          object?.properties?.name_en || object?.properties?.name || null
        }
        style={{
          width: '100%',
          height: '100%',
          // subtle background that works with your dark UI
          background: 'linear-gradient(180deg, rgba(10,14,18,1) 0%, rgba(10,14,18,1) 60%, rgba(6,8,10,1) 100%)',
          borderRadius: 12
        }}
      />
    </div>
  );
}
