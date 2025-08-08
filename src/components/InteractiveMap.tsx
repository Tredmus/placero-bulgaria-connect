import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import bbox from '@turf/bbox';
import centroid from '@turf/centroid';

import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Building2, RotateCcw, Star, Wifi, Coffee, Car, Users } from 'lucide-react';

const GEOJSON_URL = '/data/bg_provinces.geojson';

/**
 * NOTE on province names:
 * - In the GeoJSON we expect "name" (BG) and optionally "name_en".
 * - For UI we map to Bulgarian via PROVINCES below when needed.
 */
const PROVINCES = [
  { name: 'София', nameEn: 'Sofia', searchTerms: ['софия', 'sofia'] },
  { name: 'Пловдив', nameEn: 'Plovdiv', searchTerms: ['пловдив', 'plovdiv'] },
  { name: 'Варна', nameEn: 'Varna', searchTerms: ['варна', 'varna', 'белослав', 'beloslav', 'девня', 'devnya'] },
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

const cleanCity = (s = '') =>
  s.toLowerCase().replace(/област$/, '').replace(/region$/, '').replace(/,.*$/, '').trim();

const amenityIcons = { wifi: Wifi, coffee: Coffee, parking: Car, meeting: Users } as const;

export default function InteractiveMap() {
  const { locations } = useLocations();

  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [token, setToken] = useState<string>('');
  const [provincesGeo, setProvincesGeo] = useState<any>(null);

  // Selection state (province -> city -> location)
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [provinceCities, setProvinceCities] = useState<Record<string, any[]>>({});
  const [provinceLocations, setProvinceLocations] = useState<any[]>([]);
  const [cityLocations, setCityLocations] = useState<any[]>([]);

  // --- HOVER state for provinces (Mapbox feature-state) ---
  // We use generateId:true on the GeoJSON source so each feature has a numeric id.
  const hoveredId = useRef<number | null>(null);
  const hoverPopup = useRef<mapboxgl.Popup | null>(null);

  // province meta built from real locations (for bottom list + centering)
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

  // token
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('get-mapbox-token');
        const t =
          data?.token ||
          'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        mapboxgl.accessToken = t;
        setToken(t);
      } catch {
        const t =
          'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        mapboxgl.accessToken = t;
        setToken(t);
      }
    })();
  }, []);

  // load provinces GeoJSON
  useEffect(() => {
    fetch(GEOJSON_URL).then((r) => r.json()).then(setProvincesGeo);
  }, []);

  // init single Mapbox map
  useEffect(() => {
    if (!mapEl.current || !token || !provincesGeo) return;

    map.current = new mapboxgl.Map({
      container: mapEl.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [25.4858, 42.7339],
      zoom: 6.5,
      pitch: 0,
      bearing: 0,
      renderWorldCopies: false,
      maxZoom: 18,
      minZoom: 5.5,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      // 1) WORLD MASK with holes for all provinces (keeps Map 1 look)
      const worldRing: [number, number][] = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
      const holes: [number, number][][] = [];
      for (const f of provincesGeo.features) {
        const g = f.geometry;
        if (!g) continue;
        if (g.type === 'Polygon') holes.push(g.coordinates[0] as [number, number][]);
        if (g.type === 'MultiPolygon') g.coordinates.forEach((poly: any) => holes.push(poly[0] as [number, number][]));
      }
      const mask = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [worldRing, ...holes] } };
      map.current!.addSource('world-mask', { type: 'geojson', data: mask });
      map.current!.addLayer({
        id: 'world-mask-layer',
        type: 'fill',
        source: 'world-mask',
        paint: { 'fill-color': '#020817', 'fill-opacity': 1 },
      });

      // 2) Provinces fill + outline (colored, clickable)
      //    We enable generateId so we can use feature-state for hover styling.
      if (!map.current!.getSource('provinces')) {
        map.current!.addSource('provinces', { type: 'geojson', data: provincesGeo, generateId: true });
      }

      // Base fill color is solid; we control visibility via fill-opacity w/ expressions
      map.current!.addLayer({
        id: 'provinces-fill',
        type: 'fill',
        source: 'provinces',
        paint: {
          // Opaque fill color; opacity handled below
          'fill-color': '#10b981',
          // Opacity rules:
          // - Selected province => 0 (fully transparent)
          // - Hovered province  => 0.5
          // - Default           => 0.78
          'fill-opacity': [
            'case',
            // selected province: compare BG or EN fallback against selectedProvince
            ['==', ['coalesce', ['get', 'name'], ['get', 'name_en']], selectedProvince ?? '___none___'],
            0,
            // hovered via feature-state
            ['boolean', ['feature-state', 'hover'], false],
            0.5,
            // default
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

      // --- Hover interactions (cursor + feature-state + tooltip) ---
      map.current!.on('mouseenter', 'provinces-fill', () => {
        map.current!.getCanvas().style.cursor = 'pointer';
      });

      map.current!.on('mousemove', 'provinces-fill', (e) => {
        if (!e.features?.length) return;
        const f = e.features[0];

        // Clear previous hover state
        if (hoveredId.current !== null) {
          map.current!.setFeatureState({ source: 'provinces', id: hoveredId.current }, { hover: false });
        }

        // Set new hover state
        hoveredId.current = f.id as number;
        if (hoveredId.current !== null) {
          map.current!.setFeatureState({ source: 'provinces', id: hoveredId.current }, { hover: true });
        }

        // Resolve Bulgarian label
        const rawName = (f.properties as any).name || (f.properties as any).name_en;
        const displayName =
          PROVINCES.find((p) => p.name === rawName || p.nameEn === rawName)?.name || rawName;

        // Create/update a lightweight popup near cursor
        if (!hoverPopup.current) {
          hoverPopup.current = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: [0, -8],
            className: 'province-tooltip', // optional: style via global CSS if desired
          });
        }
        hoverPopup.current
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-weight:600;font-size:13px;">${displayName}</div>`)
          .addTo(map.current!);
      });

      map.current!.on('mouseleave', 'provinces-fill', () => {
        map.current!.getCanvas().style.cursor = '';
        // Clear hover state
        if (hoveredId.current !== null) {
          map.current!.setFeatureState({ source: 'provinces', id: hoveredId.current }, { hover: false });
          hoveredId.current = null;
        }
        // Remove tooltip
        if (hoverPopup.current) {
          hoverPopup.current.remove();
          hoverPopup.current = null;
        }
      });

      // --- Click -> select province ---
      map.current!.on('click', 'provinces-fill', (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const rawName = (feat.properties as any).name || (feat.properties as any).name_en;
        const displayName =
          PROVINCES.find((p) => p.name === rawName || p.nameEn === rawName)?.name || rawName;
        const c = centroid(feat as any).geometry.coordinates as [number, number];
        handleProvinceSelect(displayName, c);
      });
    });

    return () => {
      // Cleanup markers & map
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      if (hoverPopup.current) {
        hoverPopup.current.remove();
        hoverPopup.current = null;
      }
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, provincesGeo]);

  // Keep province fill-opacity in sync with selection (selected => 0 opacity)
  useEffect(() => {
    if (!map.current?.getLayer('provinces-fill')) return;
    map.current.setPaintProperty('provinces-fill', 'fill-opacity', [
      'case',
      ['==', ['coalesce', ['get', 'name'], ['get', 'name_en']], selectedProvince ?? '___none___'],
      0,
      ['boolean', ['feature-state', 'hover'], false],
      0.5,
      0.78,
    ]);
  }, [selectedProvince]);

  // --- markers ---
  const clearMarkers = () => {
    markers.current.forEach((m) => m.remove());
    markers.current = [];
  };

  const addLocationMarkers = (locs: any[]) => {
    if (!map.current) return;
    clearMarkers();
    locs.forEach((l) => {
      if (!l.latitude || !l.longitude) return;
      const el = document.createElement('div');
      el.style.cssText = `
        width:28px;height:28px;background:#10b981;border:2px solid #fff;border-radius:50%;
        cursor:pointer;box-shadow:0 2px 8px rgba(16,185,129,.35);transition:transform .15s ease;
      `;
      el.onmouseenter = () => (el.style.transform = 'scale(1.18)');
      el.onmouseleave = () => (el.style.transform = 'scale(1)');
      el.onclick = () => setSelectedLocation(l);

      const mk = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([Number(l.longitude), Number(l.latitude)])
        .addTo(map.current!);
      markers.current.push(mk);
    });
  };

  // --- selection flows ---
  const handleProvinceSelect = useCallback(
    (provinceName: string, centerGuess?: [number, number]) => {
      const rec =
        PROVINCES.find((p) => p.name === provinceName) ||
        PROVINCES.find((p) => p.nameEn === provinceName);
      if (!rec) return;

      const locs = locations.filter((l) => {
        const c = cleanCity(l.city || '');
        return rec.searchTerms.some((t) => c.includes(t) || t.includes(c));
      });

      setSelectedProvince(rec.name);
      setSelectedCity(null);
      setSelectedLocation(null);
      setProvinceLocations(locs);

      // build cities
      const cityMap: Record<string, any[]> = {};
      locs.forEach((l) => {
        const c = cleanCity(l.city || '');
        if (!c) return;
        (cityMap[c] ||= []).push(l);
      });
      setProvinceCities(cityMap);

      addLocationMarkers(locs);

      // fly (zoom bumped from 8 -> 9 for a bit more detail)
      if (centerGuess) {
        map.current?.flyTo({ center: centerGuess, zoom: 9, pitch: 0, duration: 800 });
      } else if (provinceData[rec.name]) {
        map.current?.flyTo({ center: provinceData[rec.name].coordinates, zoom: 9, pitch: 0, duration: 800 });
      }
    },
    [locations, provinceData]
  );

  const handleCitySelect = (city: string, locs: any[]) => {
    setSelectedCity(city);
    setSelectedLocation(null);
    setCityLocations(locs);

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
    setSelectedCity(null);
    setSelectedLocation(null);
    setProvinceCities({});
    setProvinceLocations([]);
    setCityLocations([]);
    clearMarkers();
    map.current?.flyTo({ center: [25.4858, 42.7339], zoom: 6.5, pitch: 0, bearing: 0, duration: 700 });
  };

  if (!token) {
    return (
      <div className="bg-secondary/50 rounded-lg p-8 h-[600px] flex items-center justify-center">
        <p className="text-muted-foreground">Зареждане на картата…</p>
      </div>
    );
  }

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
          <div className="absolute top-4 left-4 z-10">
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
                    ? `${cityLocations.length} офиса`
                    : `${Object.keys(provinceCities).length} града, ${provinceLocations.length} офиса`}
                </Badge>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedLocation && (
          <div className="absolute top-4 right-4 z-20 w-80">
            <Card className="shadow-xl">
              <div className="relative">
                {selectedLocation.image && (
                  <img
                    src={selectedLocation.image}
                    alt={selectedLocation.name}
                    className="w-full h-32 objec
