// ================================================================================================
// IMPORTS AND EXTERNAL DEPENDENCIES
// ================================================================================================

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import centroid from '@turf/centroid';
import rewind from '@turf/rewind';
import cleanCoords from '@turf/clean-coords';
import union from '@turf/union';

import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Building2, RotateCcw, Star, Wifi, Coffee, Car, Users } from 'lucide-react';

// ================================================================================================
/** CONSTANTS AND CONFIGURATION */
// ================================================================================================

const GEOJSON_URL = '/data/bg_provinces.geojson';
const BG_BOUNDS = new mapboxgl.LngLatBounds([22.2, 41.1], [28.8, 44.4]);

const PROVINCES = [
  { name: 'София Град', nameEn: 'Sofia Grad', searchTerms: ['софия', 'sofia'] },
  { name: 'София Област', nameEn: 'Sofia Oblast', searchTerms: ['софия', 'sofia'] },
  { name: 'Пловдив', nameEn: 'Plovdiv', searchTerms: ['пловдив', 'plovdiv'] },
  { name: 'Варна', nameEn: 'Varna', searchTerms: ['варна', 'varna', 'белослав', 'beloslav', 'девня', 'devnya', 'суворово', 'suvorovo'] },
  { name: 'Бургас', nameEn: 'Burgas', searchTerms: ['бургас', 'burgas'] },
  { name: 'Русе', nameEn: 'Ruse', searchTerms: ['русе', 'ruse'] },
  { name: 'Стара Загора', nameEn: 'Stara Zagora', searchTerms: ['стара загора', 'stara zagora'] },
  { name: 'Плевен', nameEn: 'Pleven', searchTerms: ['плевен', 'pleven'] },
  { name: 'Сливен', nameEn: 'Sliven', searchTerms: ['сливен', 'sliven'] },
  { name: 'Благоевград', nameEn: 'Blagoevgrad', searchTerms: ['благоевград', 'blagoevgrad'] },
  { name: 'Велико Търново', nameEn: 'Veliko Tarnovo', searchTerms: ['велико търново', 'veliko tarnovo'] },
  { name: 'Видин', nameEn: 'Vidin', searchTerms: ['видин', 'vidin'] },
  { name: 'Враца', nameEn: 'Vratsa', searchTerms: ['враца', 'vratsa'] },
  { name: 'Габрово', nameEn: 'Gabrovo', searchTerms: ['габрово', 'gabrovo'] },
  { name: 'Добрич', nameEn: 'Dobrich', searchTerms: ['добрич', 'dobrich'] },
  { name: 'Кърджали', nameEn: 'Kardzhali', searchTerms: ['кърджали', 'kardzhali'] },
  { name: 'Кюстендил', nameEn: 'Kyustendil', searchTerms: ['кюстендил', 'kyustendil'] },
  { name: 'Ловеч', nameEn: 'Lovech', searchTerms: ['ловеч', 'lovech'] },
  { name: 'Монтана', nameEn: 'Montana', searchTerms: ['монтана', 'montana'] },
  { name: 'Пазарджик', nameEn: 'Pazardzhik', searchTerms: ['пазарджик', 'pazardzhik'] },
  { name: 'Перник', nameEn: 'Pernik', searchTerms: ['перник', 'pernik'] },
  { name: 'Разград', nameEn: 'Razgrad', searchTerms: ['разград', 'razgrad'] },
  { name: 'Шумен', nameEn: 'Shumen', searchTerms: ['шумен', 'shumen'] },
  { name: 'Силистра', nameEn: 'Silistra', searchTerms: ['силистра', 'silistra'] },
  { name: 'Смолян', nameEn: 'Smolyan', searchTerms: ['смолян', 'smolyan'] },
  { name: 'Хаскрво', nameEn: 'Haskovo', searchTerms: ['хаскрво', 'haskovo'] },
  { name: 'Търговище', nameEn: 'Targovishte', searchTerms: ['търговище', 'targovishte'] },
  { name: 'Ямбол', nameEn: 'Yambol', searchTerms: ['ямбол', 'yambol'] },
];

// ================================================================================================
// UTILITY
// ================================================================================================

const cleanCity = (s = '') =>
  s.toLowerCase().replace(/област$/, '').replace(/region$/, '').replace(/,.*$/, '').trim();

const formatCity = (s = '') =>
  s
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');

const amenityIcons = { wifi: Wifi, coffee: Coffee, parking: Car, meeting: Users } as const;

// Build a city->locations map from an array of locations
const buildCityMap = (locs: any[]) => {
  const map: Record<string, any[]> = {};
  locs.forEach((l) => {
    const c = cleanCity(l.city || '');
    if (!c) return;
    (map[c] ||= []).push(l);
  });
  return map;
};

// ================================================================================================
// GEOMETRY HELPERS
// ================================================================================================

type Ring = [number, number][];

function normalizeFC(raw: any) {
  if (!raw || raw.type !== 'FeatureCollection') {
    return { type: 'FeatureCollection', features: [] as any[] };
  }
  const features = (raw.features || [])
    .filter((f: any) => {
      const t = f?.geometry?.type;
      return t === 'Polygon' || t === 'MultiPolygon';
    })
    .map((f: any) => {
      let g = cleanCoords(f, { mutate: false }) as any;
      try {
        g = rewind(g, { reverse: false, mutate: false });
      } catch {}
      return g;
    });
  return { type: 'FeatureCollection', features };
}

function dissolve(features: any[]) {
  if (!features.length) return null;
  let acc = features[0];
  for (let i = 1; i < features.length; i++) {
    try {
      acc = union(acc, features[i]) as any;
    } catch {}
  }
  try {
    acc = rewind(cleanCoords(acc, { mutate: false }) as any, { reverse: false, mutate: false });
  } catch {}
  return acc;
}

function outerRings(geom: any): Ring[] {
  const out: Ring[] = [];
  if (!geom) return out;
  if (geom.type === 'Polygon') {
    if (geom.coordinates?.[0]) out.push(geom.coordinates[0]);
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates || []) if (poly?.[0]) out.push(poly[0]);
  }
  return out;
}

function buildProvinceDonutMask(provincesFC: any, rawName: string | null) {
  const worldRing: Ring = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];

  if (!rawName) {
    const dissolvedAll = dissolve(provincesFC.features);
    const holes = outerRings(dissolvedAll?.geometry);
    let mask: any = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [worldRing, ...holes] },
    };
    try {
      mask = rewind(cleanCoords(mask, { mutate: false }) as any, { reverse: false, mutate: false });
    } catch {}
    return mask;
  }

  const parts = provincesFC.features.filter((f: any) => {
    const nm = f.properties?.name ?? f.properties?.name_en;
    return nm === rawName;
  });
  const merged = dissolve(parts);
  if (!merged) return null;

  const holes = outerRings(merged.geometry);
  let mask: any = {
    type: 'Feature',
    properties: { province: rawName },
    geometry: { type: 'Polygon', coordinates: [worldRing, ...holes] },
  };
  try {
    mask = rewind(cleanCoords(mask, { mutate: false }) as any, { reverse: false, mutate: false });
  } catch {}
  return mask;
}

// ================================================================================================
// MAIN COMPONENT
// ================================================================================================

export default function InteractiveMapV1() {
  const { locations } = useLocations();
  const navigate = useNavigate();

  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  // Keep city vs location markers separate for fast updates
  const cityMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const locationMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const markerById = useRef<Record<string, { marker: mapboxgl.Marker; bubble: HTMLDivElement }>>({});

  const hoverTooltipRef = useRef<HTMLDivElement | null>(null);
  const hoveredFeatureId = useRef<number | string | null>(null);

  // min-zoom “floor” state (computed from viewport)
  const defaultMinZoomRef = useRef<number>(6.5);
  const defaultCenterRef = useRef<mapboxgl.LngLatLike>({ lng: 25.4858, lat: 42.7339 });
  const defaultViewBoundsRef = useRef<mapboxgl.LngLatBoundsLike | null>(null);
  const snappingRef = useRef(false); // Animation state for smooth zoom

  // Throttle tooltip updates to 1 per frame
  const tooltipRaf = useRef(false);

  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const selectedProvinceRef = useRef<string | null>(null);
  useEffect(() => { selectedProvinceRef.current = selectedProvince; }, [selectedProvince]);

  const [selectedRawName, setSelectedRawName] = useState<string | null>(null);
  const selectedRawNameRef = useRef<string | null>(null);
  useEffect(() => { selectedRawNameRef.current = selectedRawName; }, [selectedRawName]);

  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const selectedCityRef = useRef<string | null>(null);
  useEffect(() => { selectedCityRef.current = selectedCity; }, [selectedCity]);

  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);

  const [provinceCities, setProvinceCities] = useState<Record<string, any[]>>({});
  const [provinceLocations, setProvinceLocations] = useState<any[]>([]);
  const [cityLocations, setCityLocations] = useState<any[]>([]);

  const [token, setToken] = useState<string>('');
  const [provincesGeo, setProvincesGeo] = useState<any>(null);
  const [worldMask, setWorldMask] = useState<any>(null);
  const [mapReady, setMapReady] = useState<boolean>(false);

  // Precompute province data from locations
  const provinceData = useMemo(() => {
    const map: Record<string, { locations: any[]; coordinates: [number, number] }> = {};
    PROVINCES.forEach((p) => {
      const locs = locations.filter((l) => {
        const c = cleanCity(l.city || '');
        return p.searchTerms.some((t) => c.includes(t) || t.includes(c));
      });
      const valid = locs.filter((l) => l.latitude && l.longitude);
      if (valid.length) {
        const lat = valid.reduce((s, l) => s + Number(l.latitude), 0) / valid.length;
        const lng = valid.reduce((s, l) => s + Number(l.longitude), 0) / valid.length;
        map[p.name] = { locations: locs, coordinates: [lng, lat] };
      }
    });
    return map;
  }, [locations]);

  // All cities map (used when no province is selected)
  const allCityMap = useMemo(() => buildCityMap(locations), [locations]);

  // INIT: token + geojson
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('get-mapbox-token');
        const t = data?.token || 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdзUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        mapboxgl.accessToken = t;
        setToken(t);
      } catch {
        const t = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdзUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        mapboxgl.accessToken = t;
        setToken(t);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const raw = await fetch(GEOJSON_URL).then((r) => r.json());
      const normalized = normalizeFC(raw);
      setProvincesGeo(normalized);
      const initialMask = buildProvinceDonutMask(normalized, null);
      setWorldMask(initialMask);
    })();
  }, []);

  useEffect(() => {
    if (!provincesGeo) return;
    const newMask = buildProvinceDonutMask(provincesGeo, selectedRawName);
    if (!newMask) return;
    setWorldMask(newMask);
    if (map.current?.getSource('world-mask')) {
      (map.current.getSource('world-mask') as mapboxgl.GeoJSONSource).setData(newMask as any);
    }
  }, [selectedRawName, provincesGeo]);

  // MARKERS ------------------------------------------------------------------

  const clearCityMarkers = () => {
    cityMarkersRef.current.forEach((m) => m.remove());
    cityMarkersRef.current = [];
  };

  const clearLocationMarkers = () => {
    locationMarkersRef.current.forEach((m) => m.remove());
    locationMarkersRef.current = [];
    markerById.current = {};
  };

  const clearAllMarkers = () => {
    clearCityMarkers();
    clearLocationMarkers();
  };

  const styleMarker = (bubble: HTMLDivElement, isSelected: boolean, size = 28, isLocation = false) => {
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.borderRadius = '50%';
    bubble.style.border = '2px solid #fff';
    bubble.style.cursor = 'pointer';
    bubble.style.transition = 'transform .12s ease';
    bubble.style.transformOrigin = 'center';

    if (isLocation) {
      bubble.style.boxShadow = '0 2px 8px rgba(16,185,129,.35)';
      bubble.style.background = isSelected ? '#059669' : '#10b981';
    } else {
      bubble.style.boxShadow = '0 2px 8px rgba(239,68,68,.35)';
      bubble.style.background = isSelected ? '#dc2626' : '#ef4444';
    }
    bubble.style.transform = isSelected ? 'scale(1.22)' : 'scale(1)';
  };

  // Center-safe marker DOM: pin centered on coordinate, label positioned below
  const createLabeledMarkerRoot = (labelText: string, countText?: string) => {
    const root = document.createElement('div');
    // Root remains size-less so Mapbox's anchor math doesn't interfere
    root.style.cssText = 'position:relative;width:0;height:0;pointer-events:auto;z-index:2;';

    // An inner wrapper that positions the bubble centered, with label flowing below
    const inner = document.createElement('div');
    inner.style.cssText = [
      'position:absolute',
      'left:0',
      'top:0',
      'transform:translate(-50%,-14px)', // Center horizontally, offset vertically so bubble sits on coordinate
      'display:flex',
      'flex-direction:column',
      'align-items:center',             // keeps label perfectly centered under bubble
      'pointer-events:auto',
    ].join(';');

    // Bubble (positioned naturally inside the flex column)
    const bubble = document.createElement('div');
    
    // Add count text inside the bubble if provided
    if (countText) {
      bubble.textContent = countText;
      bubble.style.cssText += [
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'font-size:12px',
        'font-weight:700',
        'color:#fff',
        'text-shadow:0 1px 2px rgba(0,0,0,0.5)',
      ].join(';');
    }

    // Label (flows naturally below bubble with margin)
    const label = document.createElement('div');
    label.textContent = labelText || '';
    label.style.cssText = [
      'margin-top:8px',
      'padding:2px 6px',
      'border-radius:6px',
      'font-size:12px',
      'font-weight:700',
      'color:#fff',
      'background:rgba(0,0,0,.65)',
      'border:1px solid rgba(255,255,255,.14)',
      'white-space:nowrap',
      'pointer-events:none',
      'text-align:center',
    ].join(';');

    inner.appendChild(bubble);
    inner.appendChild(label);
    root.appendChild(inner);

    return { root, bubble, label };
  };

  const addLocationMarkers = (locs: any[]) => {
    if (!map.current) return;
    clearLocationMarkers();

    locs.forEach((l) => {
      if (!l.latitude || !l.longitude) return;
      const { root, bubble, label } = createLabeledMarkerRoot(l.name || '');
      root.dataset.type = 'location';
      const isSel = selectedLocation && selectedLocation.id === l.id;
      styleMarker(bubble, !!isSel, 28, true);

      root.onmouseenter = () => {
        if (hoverTooltipRef.current) hoverTooltipRef.current.style.opacity = '0';
        if (!isSel) bubble.style.transform = 'scale(1.15)';
        root.style.zIndex = '100';
        // Make label background solid for better readability
        label.style.background = 'rgba(0,0,0,.9)';
      };
      root.onmouseleave = () => {
        if (!isSel) bubble.style.transform = 'scale(1)';
        root.style.zIndex = '2';
        // Restore semi-transparent background
        label.style.background = 'rgba(0,0,0,.65)';
      };
      root.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedLocation(l);
      });

      const mk = new mapboxgl.Marker({ element: root, anchor: 'center' })
        .setLngLat([+l.longitude, +l.latitude])
        .addTo(map.current!);
      locationMarkersRef.current.push(mk);
      if (l.id != null) markerById.current[String(l.id)] = { marker: mk, bubble };
    });
  };

  const addCityMarkers = (cityMap: Record<string, any[]>, hiddenCityName?: string) => {
    if (!map.current) return;
    clearCityMarkers();

    Object.entries(cityMap).forEach(([key, locs]) => {
      const displayCity = formatCity(key);
      if (hiddenCityName && hiddenCityName === displayCity) return;

      const valid = locs.filter((l) => l.latitude && l.longitude);
      if (!valid.length) return;
      const lat = valid.reduce((s, l) => s + Number(l.latitude), 0) / valid.length;
      const lng = valid.reduce((s, l) => s + Number(l.longitude), 0) / valid.length;
      const labelText = displayCity;
      const countText = String(locs.length);
      const { root, bubble, label } = createLabeledMarkerRoot(labelText, countText);
      root.dataset.type = 'city';
      styleMarker(bubble, false, 34);
      label.style.fontSize = '13px';

      root.onmouseenter = () => {
        bubble.style.transform = 'scale(1.12)';
        root.style.zIndex = '100';
        // Make label background solid for better readability
        label.style.background = 'rgba(0,0,0,.9)';
      };
      root.onmouseleave = () => {
        bubble.style.transform = 'scale(1)';
        root.style.zIndex = '2';
        // Restore semi-transparent background
        label.style.background = 'rgba(0,0,0,.65)';
      };
      root.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCitySelect(displayCity, locs);
      });

      const mk = new mapboxgl.Marker({ element: root, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(map.current!);
      cityMarkersRef.current.push(mk);
    });
  };

  // Re-style location markers when selectedLocation changes
  useEffect(() => {
    Object.entries(markerById.current).forEach(([id, { bubble }]) => {
      const isSel = selectedLocation && String(selectedLocation.id) === id;
      styleMarker(bubble, isSel, 28, true);
    });
  }, [selectedLocation]);

  // Show all city pins when locations and map are ready and no province selected
  useEffect(() => {
    if (!locations.length || !mapReady || selectedProvince) return;
    addCityMarkers(allCityMap);
  }, [locations, mapReady, selectedProvince, allCityMap]);

  // PROVINCE / CITY HANDLERS -------------------------------------------------

  const handleProvinceSelect = useCallback(
    (provinceName: string, centerGuess?: [number, number], zoomOverride?: number) => {
      const rec = PROVINCES.find((p) => p.name === provinceName) || PROVINCES.find((p) => p.nameEn === provinceName);
      if (!rec) return;

      const locs = locations.filter((l) => {
        const c = cleanCity(l.city || '');
        return rec.searchTerms.some((t) => c.includes(t) || t.includes(c));
      });

      setSelectedProvince(rec.name);
      setSelectedRawName(rec.nameEn ?? rec.name);
      setSelectedCity(null);
      setSelectedLocation(null);
      setProvinceLocations(locs);

      const cityMap = buildCityMap(locs);
      setProvinceCities(cityMap);
      addCityMarkers(cityMap);

      const targetZoom = zoomOverride ?? 9;
      if (centerGuess) {
        map.current?.flyTo({ center: centerGuess, zoom: targetZoom, pitch: 0, duration: 800 });
      } else if (provinceData[rec.name]) {
        map.current?.flyTo({ center: provinceData[rec.name].coordinates, zoom: targetZoom, pitch: 0, duration: 800 });
      }
    },
    [locations, provinceData]
  );

  const handleCitySelect = (city: string, locs: any[]) => {
    // Auto-select the province if none is selected
    if (!selectedProvince) {
      const cleanedCity = cleanCity(city);
      const matchingProvince = PROVINCES.find((p) =>
        p.searchTerms.some((term) => cleanedCity.includes(term) || term.includes(cleanedCity))
      );
      if (matchingProvince) {
        setSelectedProvince(matchingProvince.name);
        setSelectedRawName(matchingProvince.nameEn ?? matchingProvince.name);

        const provinceLocs = locations.filter((l) => {
          const c = cleanCity(l.city || '');
          return matchingProvince.searchTerms.some((t) => c.includes(t) || t.includes(c));
        });
        setProvinceLocations(provinceLocs);
        setProvinceCities(buildCityMap(provinceLocs));
      }
    }

    setSelectedCity(city);
    setSelectedLocation(null);
    setCityLocations(locs);

    // Show city markers while hiding the selected city’s pin to avoid collision
    if (selectedProvince) {
      addCityMarkers(provinceCities, city);
    } else {
      addCityMarkers(allCityMap, city);
    }

    // Then add location markers (after city markers so they remain)
    addLocationMarkers(locs);

    const valid = locs.filter((l) => l.latitude && l.longitude);
    if (valid.length) {
      const lat = valid.reduce((s, l) => s + Number(l.latitude), 0) / valid.length;
      const lng = valid.reduce((s, l) => s + Number(l.longitude), 0) / valid.length;
      map.current?.flyTo({ center: [lng, lat], zoom: 12, pitch: 0, duration: 800 });
    }
  };

  const resetView = () => {
    setSelectedProvince(null);
    setSelectedRawName(null);
    setSelectedCity(null);
    setSelectedLocation(null);
    setProvinceCities({});
    setProvinceLocations([]);
    setCityLocations([]);

    if (hoveredFeatureId.current !== null && map.current) {
      map.current.setFeatureState({ source: 'provinces', id: hoveredFeatureId.current }, { hover: false });
      hoveredFeatureId.current = null;
    }
    if (hoverTooltipRef.current) hoverTooltipRef.current.style.opacity = '0';

    // Restore city pins for all cities
    addCityMarkers(allCityMap);
    clearLocationMarkers();

    // Snap to the computed floor
    map.current?.easeTo({
      center: defaultCenterRef.current as mapboxgl.LngLatLike,
      zoom: defaultMinZoomRef.current,
      pitch: 0,
      bearing: 0,
      duration: 500
    });
  };

  // MAP INIT + CAMERA LOCK ---------------------------------------------------
  useEffect(() => {
    if (!mapEl.current || !token || !provincesGeo) return;

    map.current = new mapboxgl.Map({
      container: mapEl.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [25.4858, 42.7339], // temporary, overridden below
      zoom: 6.5,                  // temporary
      pitch: 0,
      bearing: 0,
      renderWorldCopies: false,
      maxZoom: 18,
      fadeDuration: 0
    });

    // Compute/apply exact “floor” BEFORE first paint
    const cam = map.current.cameraForBounds(BG_BOUNDS, { padding: 24 })!;
    defaultMinZoomRef.current = cam.zoom;
    defaultCenterRef.current = cam.center as mapboxgl.LngLatLike;
    map.current.jumpTo({ center: cam.center, zoom: cam.zoom, bearing: 0, pitch: 0 });
    map.current.setMinZoom(cam.zoom);

    // Store the exact min-zoom viewport as panning box when zoomed in
    const vb = map.current.getBounds().toArray();
    defaultViewBoundsRef.current = [
      [vb[0][0], vb[0][1]],
      [vb[1][0], vb[1][1]]
    ];

    // Controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'map-province-tooltip';
    tooltip.style.cssText = `
      position:absolute;pointer-events:none;z-index:30;
      background:rgba(0,0,0,.7);color:#fff;padding:6px 8px;
      border-radius:6px;font-size:12px;transform:translate(-50%, -120%);
      white-space:nowrap;opacity:0;transition:opacity .12s ease;
      border:1px solid rgba(255,255,255,.15);
      backdrop-filter:saturate(140%) blur(2px);
    `;
    hoverTooltipRef.current = tooltip;
    mapEl.current.appendChild(tooltip);

    // Wheel behavior (around center + gentle step)
    map.current.scrollZoom.enable();
    (map.current.scrollZoom as any).setAround?.('center');
    (map.current.scrollZoom as any).setWheelZoomRate?.(1 / 600);

    // Smooth animated zoom behavior
    const FLOOR = () => defaultMinZoomRef.current;
    const isAtFloor = () => Math.abs(map.current!.getZoom() - FLOOR()) <= 1e-3;

    const enableConstrainedPan = () => {
      map.current!.dragPan.enable();
      (map.current!.keyboard as any)?.enable?.();
      if (defaultViewBoundsRef.current) map.current!.setMaxBounds(defaultViewBoundsRef.current);
    };
    const disablePanAtFloor = () => {
      map.current!.dragPan.disable();
      (map.current!.keyboard as any)?.disable?.();
      map.current!.setMaxBounds(null);
    };
    const snapToFloorAnimated = () => {
      if (snappingRef.current) return;
      snappingRef.current = true;
      disablePanAtFloor();
      map.current!.stop(); // stop wheel inertia immediately
      map.current!.easeTo({
        center: defaultCenterRef.current as mapboxgl.LngLatLike,
        zoom: FLOOR(),
        pitch: 0,
        bearing: 0,
        duration: 550,
        easing: (t) => t * (2 - t) // easeOutQuad-ish
      });
    };

    const onZoom = () => {
      const z = map.current!.getZoom();
      if (z <= FLOOR() + 0.02) {
        if (!isAtFloor()) snapToFloorAnimated();
      } else {
        snappingRef.current = false;
        enableConstrainedPan();
      }
    };

    const onMoveEnd = () => {
      if (isAtFloor()) {
        disablePanAtFloor();
        map.current!.jumpTo({
          center: defaultCenterRef.current as mapboxgl.LngLatLike,
          zoom: FLOOR(),
          pitch: 0,
          bearing: 0
        });
        snappingRef.current = false;
      }
    };

    onZoom();
    map.current.on('zoom', onZoom);
    map.current.on('moveend', onMoveEnd);

    // Layers & sources on load
    map.current.on('load', () => {
      map.current!.addSource('provinces', { type: 'geojson', data: provincesGeo, generateId: true });

      map.current!.addLayer({
        id: 'provinces-fill',
        type: 'fill',
        source: 'provinces',
        paint: {
          'fill-color': [
            'case',
            ['==', ['coalesce', ['get', 'name'], ['get', 'name_en']], selectedRawNameRef.current ?? '___none___'],
            'rgba(0,0,0,0)',
            'rgba(16,185,129,1)',
          ],
          'fill-opacity': [
            'case',
            ['==', ['coalesce', ['get', 'name'], ['get', 'name_en']], selectedRawNameRef.current ?? '___none___'],
            0,
            ['boolean', ['feature-state', 'hover'], false],
            0.4,
            0.78,
          ],
          'fill-outline-color': '#ffffff',
        },
      });

      map.current!.addLayer({
        id: 'provinces-outline',
        type: 'line',
        source: 'provinces',
        paint: { 'line-color': '#ffffff', 'line-width': 2 },
      });

      // Invisible hit layer on top for reliable interactions
      map.current!.addLayer({
        id: 'provinces-hit',
        type: 'fill',
        source: 'provinces',
        paint: { 'fill-color': '#000000', 'fill-opacity': 0.001 }
      });

      // World mask (under provinces)
      const worldRing: Ring = [
        [-180, -85],
        [180, -85],
        [180, 85],
        [-180, 85],
        [-180, -85],
      ];
      const placeholder = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [worldRing] },
      } as any;

      map.current!.addSource('world-mask', { type: 'geojson', data: placeholder });
      map.current!.addLayer(
        {
          id: 'world-mask-layer',
          type: 'fill',
          source: 'world-mask',
          paint: { 'fill-color': '#020817', 'fill-opacity': 1 },
        },
        'provinces-fill' // mask below provinces
      );

      if (worldMask) {
        (map.current!.getSource('world-mask') as mapboxgl.GeoJSONSource).setData(worldMask as any);
      }

      setMapReady(true);

      // Interactions (bind to hit layer)
      map.current!.on('mouseenter', 'provinces-hit', () => (map.current!.getCanvas().style.cursor = 'pointer'));
      map.current!.on('mouseleave', 'provinces-hit', () => (map.current!.getCanvas().style.cursor = ''));

      map.current!.on('mousemove', 'provinces-hit', (e: mapboxgl.MapLayerMouseEvent) => {
        if (tooltipRaf.current) return;
        tooltipRaf.current = true;

        const f = e.features?.[0];
        requestAnimationFrame(() => {
          tooltipRaf.current = false;
          if (!f) return;

          if (hoveredFeatureId.current !== null && hoveredFeatureId.current !== f.id) {
            map.current!.setFeatureState({ source: 'provinces', id: hoveredFeatureId.current }, { hover: false });
          }

          hoveredFeatureId.current = f.id as number | string;
          map.current!.setFeatureState({ source: 'provinces', id: hoveredFeatureId.current }, { hover: true });

          const rawName = (f.properties as any).name || (f.properties as any).name_en;
          const displayName =
            PROVINCES.find((p) => p.name === rawName || p.nameEn === rawName)?.name || rawName || '';

          if (selectedRawNameRef.current && rawName === selectedRawNameRef.current) {
            if (hoverTooltipRef.current) hoverTooltipRef.current.style.opacity = '0';
            return;
          }

          if (hoverTooltipRef.current) {
            const { point } = e;
            hoverTooltipRef.current.textContent = displayName;
            hoverTooltipRef.current.style.left = `${point.x}px`;
            hoverTooltipRef.current.style.top = `${point.y}px`;
            hoverTooltipRef.current.style.opacity = '1';
          }
        });
      });

      map.current!.on('mouseleave', 'provinces-hit', () => {
        if (hoveredFeatureId.current !== null) {
          map.current!.setFeatureState({ source: 'provinces', id: hoveredFeatureId.current }, { hover: false });
        }
        hoveredFeatureId.current = null;
        if (hoverTooltipRef.current) hoverTooltipRef.current.style.opacity = '0';
      });

      map.current!.on('click', 'provinces-hit', (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const rawName = (feat.properties as any).name || (feat.properties as any).name_en;
        const displayName = PROVINCES.find((p) => p.name === rawName || p.nameEn === rawName)?.name || rawName;

        if (selectedRawNameRef.current && selectedRawNameRef.current === rawName) {
          resetView();
          return;
        }

        setSelectedProvince(displayName);
        setSelectedRawName(rawName);
        const c = centroid(feat as any).geometry.coordinates as [number, number];
        handleProvinceSelect(displayName, c, 9);
      });
    });

    // Recalculate camera floor on resize (no flicker)
    const onResize = () => {
      if (!map.current) return;
      const cam2 = map.current.cameraForBounds(BG_BOUNDS, { padding: 24 })!;
      defaultMinZoomRef.current = cam2.zoom;
      defaultCenterRef.current = cam2.center as mapboxgl.LngLatLike;
      map.current.setMinZoom(cam2.zoom);

      // recompute the min-zoom viewport bounds without changing user zoom if > min
      const wasZoom = map.current.getZoom();
      const wasCenter = map.current.getCenter();

      // temporarily jump to min view to read its bounds
      map.current.jumpTo({ center: cam2.center, zoom: cam2.zoom, bearing: 0, pitch: 0 });
      const rb = map.current.getBounds().toArray();
      defaultViewBoundsRef.current = [
        [rb[0][0], rb[0][1]],
        [rb[1][0], rb[1][1]]
      ];

      // restore previous camera if user was zoomed in
      if (wasZoom > cam2.zoom + 1e-6) {
        map.current.jumpTo({ center: wasCenter, zoom: wasZoom, bearing: 0, pitch: 0 });
        if (defaultViewBoundsRef.current) {
          map.current.setMaxBounds(defaultViewBoundsRef.current);
        }
      } else {
        // if at floor, ensure perfect snap
        map.current.jumpTo({ center: cam2.center, zoom: cam2.zoom, bearing: 0, pitch: 0 });
      }
    };
    map.current.on('resize', onResize);

    return () => {
      if (hoverTooltipRef.current) {
        hoverTooltipRef.current.remove();
        hoverTooltipRef.current = null;
      }
      clearAllMarkers();
      if (map.current) {
        map.current.off('resize', onResize);
        map.current.remove();
      }
      map.current = null;
    };
  }, [token, provincesGeo]);

  // DYNAMIC STYLE ------------------------------------------------------------
  useEffect(() => {
    if (!map.current?.getLayer('provinces-fill')) return;
    map.current.setPaintProperty('provinces-fill', 'fill-color', [
      'case',
      ['==', ['coalesce', ['get', 'name'], ['get', 'name_en']], selectedRawName ?? '___none___'],
      'rgba(0,0,0,0)',
      'rgba(16,185,129,1)',
    ]);
    map.current.setPaintProperty('provinces-fill', 'fill-opacity', [
      'case',
      ['==', ['coalesce', ['get', 'name'], ['get', 'name_en']], selectedRawName ?? '___none___'],
      0,
      ['boolean', ['feature-state', 'hover'], false],
      0.4,
      0.78,
    ]);
  }, [selectedRawName]);

  useEffect(() => {
    if (!map.current || !worldMask) return;
    const src = map.current.getSource('world-mask') as mapboxgl.GeoJSONSource | undefined;
    if (src) src.setData(worldMask as any);
  }, [worldMask]);

  // UI HELPERS ---------------------------------------------------------------
  const pluralize = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const needsVav = (city: string | null) => {
    if (!city) return false;
    const ch = city.trim().charAt(0).toLowerCase();
    return ch === 'в' || ch === 'ф';
  };
  const getMainImage = (loc: any) =>
    loc?.image || loc?.main_image_url || (Array.isArray(loc?.photos) && loc.photos[0]?.url) || null;

  if (!token) {
    return (
      <div className="bg-secondary/50 rounded-lg p-8 h-[600px] flex items-center justify-center">
        <p className="text-muted-foreground">Зареждане на картата…</p>
      </div>
    );
  }

  // RENDER -------------------------------------------------------------------
  return (
    <div className="bg-secondary/50 rounded-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold">Изберете регион</h3>
        {selectedProvince && (
          <Button onClick={resetView} variant="outline" className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Покажи всички региони
          </Button>
        )}
      </div>

      <div className="relative">
        <div ref={mapEl} className="w-full h-[600px] rounded-lg overflow-hidden border border-border shadow-lg" />

        {(selectedProvince || selectedCity) && (
          <div className="absolute top-4 left-4 z-20">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div className="flex flex-col">
                    {selectedCity ? (
                      <>
                        <span className="font-bold text-lg">{selectedCity}</span>
                        <span className="text-sm text-muted-foreground">{selectedProvince}</span>
                      </>
                    ) : (
                      <span className="font-bold text-lg">{selectedProvince}</span>
                    )}
                  </div>
                </div>
                <Badge variant="secondary">
                  {selectedCity
                    ? `${cityLocations.length} ${pluralize(cityLocations.length, 'помещение', 'помещения')}`
                    : `${Object.keys(provinceCities).length} ${pluralize(
                        Object.keys(provinceCities).length,
                        'град',
                        'града'
                      )}, ${provinceLocations.length} ${pluralize(provinceLocations.length, 'помещение', 'помещения')}`}
                </Badge>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedLocation && (
          <div className="absolute top-4 right-4 z-20 w-80">
            <Card className="shadow-xl overflow-hidden">
              <div className="relative">
                {(() => {
                  const src = getMainImage(selectedLocation);
                  return src ? (
                    <img
                      src={src}
                      alt={selectedLocation.name}
                      className="w-full h-36 object-cover"
                      loading="lazy"
                    />
                  ) : null;
                })()}
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 bg-background/80 hover:bg-background"
                  onClick={() => setSelectedLocation(null)}
                >
                  ×
                </Button>
              </div>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedLocation.name}</h3>
                    {selectedLocation.companies?.name && (
                      <p className="text-sm text-muted-foreground">{selectedLocation.companies.name}</p>
                    )}
                  </div>

                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{selectedLocation.address}</span>
                  </div>

                  {selectedLocation.amenities?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedLocation.amenities.slice(0, 4).map((a: string) => {
                        const Icon = (amenityIcons as any)[a];
                        return (
                          <div key={a} className="flex items-center text-xs text-muted-foreground">
                            {Icon && <Icon className="h-3 w-3 mr-1" />}
                            <span className="capitalize">{a}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    {selectedLocation.price_day && (
                      <div>
                        <span className="text-lg font-semibold">{selectedLocation.price_day}лв</span>
                        <span className="text-sm text-muted-foreground">/ден</span>
                      </div>
                    )}
                    {selectedLocation.rating && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {selectedLocation.rating}
                      </Badge>
                    )}
                  </div>

                  <div className="pt-1">
                    <Button className="w-full" onClick={() => navigate(`/locations/${selectedLocation.id}`)}>
                      Виж повече
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-6">
        {PROVINCES.map((p) => {
          const data = provinceData[p.name];
          if (!data || data.locations.length === 0) return null;
          const isSelected = selectedProvince === p.name;
          return (
            <div
              key={p.name}
              onClick={() => (isSelected ? resetView() : handleProvinceSelect(p.name, data.coordinates))}
              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:scale-105 ${
                isSelected ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : ''
              }`}
            >
              <div className="text-center">
                <h4 className="font-semibold text-sm">{p.name}</h4>
                <p className="text-xs text-muted-foreground">
                  {data.locations.length} {data.locations.length === 1 ? 'помещение' : 'помещения'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {selectedProvince && Object.keys(provinceCities).length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-4">Градове в област {selectedProvince}</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(provinceCities).map(([cityKey, locs]) => {
              const displayCity = formatCity(cityKey);
              const isActive = selectedCity === displayCity;
              return (
                <div
                  key={cityKey}
                  onClick={() => {
                    if (isActive) {
                      setSelectedCity(null);
                      setSelectedLocation(null);
                      addCityMarkers(provinceCities);
                      // Return to province view when toggling off a city
                      if (selectedProvince && provinceData[selectedProvince]) {
                        map.current?.flyTo({
                          center: provinceData[selectedProvince].coordinates,
                          zoom: 9,
                          pitch: 0,
                          duration: 800
                        });
                      }
                    } else {
                      handleCitySelect(displayCity, locs);
                    }
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:border-secondary hover:bg-secondary/5 hover:scale-105 ${
                    isActive ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : ''
                  }`}
                >
                  <div className="text-center">
                    <h5 className="font-semibold text-sm">{displayCity}</h5>
                    <p className="text-xs text-muted-foreground">
                      {locs.length} {locs.length === 1 ? 'помещение' : 'помещения'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedCity && cityLocations.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-4">
            {`Помещения ${needsVav(selectedCity) ? 'във' : 'в'} ${selectedCity}`}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cityLocations.map((l) => {
              const isSelected = selectedLocation && selectedLocation.id === l.id;
              return (
                <Card
                  key={l.id}
                  className={`transition-shadow cursor-pointer hover:shadow-lg ${
                    isSelected ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : ''
                  }`}
                  onClick={() => setSelectedLocation(l)}
                >
                  <CardContent className="p-4">
                    <h5 className="font-semibold mb-2">{l.name}</h5>
                    <div className="flex items-center text-sm text-muted-foreground mb-2">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span>{l.address}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      {l.price_day && <Badge variant="outline">{l.price_day} лв./ден</Badge>}
                      {l.rating && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {l.rating}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
