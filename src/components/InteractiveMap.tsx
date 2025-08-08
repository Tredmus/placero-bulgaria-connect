import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { FlyToInterpolator } from '@deck.gl/core';
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

const INITIAL_VIEW_STATE = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 6.5,
  pitch: 0,
  bearing: 0,
  transitionDuration: 0
};

// Province dictionary used to map locations → provinces and to render the bottom list
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

// ---------- helpers ----------
const cleanCity = (s = '') =>
  s.toLowerCase().replace(/област$/, '').replace(/region$/, '').replace(/,.*$/, '').trim();

const matchProvinceRecord = (nameFromGeo?: string) => {
  const key = (nameFromGeo || '').toLowerCase();
  return PROVINCES.find(
    p => p.name.toLowerCase() === key || p.nameEn.toLowerCase() === key
  );
};

const amenityIcons = { wifi: Wifi, coffee: Coffee, parking: Car, meeting: Users } as const;

// ---------- component ----------
export default function InteractiveMap() {
  const { locations } = useLocations();

  // Deck + Mapbox state/refs
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [provincesGeo, setProvincesGeo] = useState<any>(null);
  const mapboxTokenRef = useRef<string | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const nationalCenterRef = useRef<{ lng: number; lat: number; zoom: number } | null>(null);

  // Selection state (Map2 UX)
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null); // display name
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [provinceCities, setProvinceCities] = useState<Record<string, any[]>>({});
  const [provinceLocations, setProvinceLocations] = useState<any[]>([]);
  const [cityLocations, setCityLocations] = useState<any[]>([]);

  // provinceData for bottom buttons (built from existing locations)
  const provinceData = useMemo(() => {
    const map: Record<string, { locations: any[]; coordinates: [number, number] }> = {};
    PROVINCES.forEach(p => {
      const locs = locations.filter(l => {
        const c = cleanCity(l.city || '');
        return p.searchTerms.some(t => c.includes(t) || t.includes(c));
      });
      const valid = locs.filter(l => l.latitude && l.longitude);
      if (valid.length) {
        const lat = valid.reduce((s, l) => s + Number(l.latitude), 0) / valid.length;
        const lng = valid.reduce((s, l) => s + Number(l.longitude), 0) / valid.length;
        map[p.name] = { locations: locs, coordinates: [lng, lat] };
      }
    });
    return map;
  }, [locations]);

  // Mapbox token
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('get-mapbox-token');
        const t =
          data?.token ||
          'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        mapboxgl.accessToken = t;
        mapboxTokenRef.current = t;
      } catch {
        const t =
          'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        mapboxgl.accessToken = t;
        mapboxTokenRef.current = t;
      }
    })();
  }, []);

  // Load provinces GeoJSON (for colored provinces)
  useEffect(() => {
    fetch(GEOJSON_URL).then(r => r.json()).then(setProvincesGeo);
  }, []);

  // Init Mapbox (mask + markers host)
  useEffect(() => {
    if (!mapEl.current || !mapboxTokenRef.current || !provincesGeo) return;

    mapRef.current = new mapboxgl.Map({
      container: mapEl.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom,
      interactive: false
    });

    mapRef.current.on('load', () => {
      // world mask with BG provinces as holes
      const worldRing: [number, number][] = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
      const holes: [number, number][][] = [];
      for (const f of provincesGeo.features) {
        const g = f.geometry;
        if (!g) continue;
        if (g.type === 'Polygon') holes.push(g.coordinates[0] as [number, number][]);
        if (g.type === 'MultiPolygon') g.coordinates.forEach((poly: any) => holes.push(poly[0] as [number, number][]));
      }
      const mask = { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [worldRing, ...holes] } };

      mapRef.current!.addSource('world-mask', { type: 'geojson', data: mask });
      mapRef.current!.addLayer({
        id: 'world-mask-layer',
        type: 'fill',
        source: 'world-mask',
        paint: { 'fill-color': '#020817', 'fill-opacity': 1 }
      });
    });

    return () => mapRef.current?.remove();
  }, [provincesGeo]);

  // Center Bulgaria and store national view
  useEffect(() => {
    if (!provincesGeo) return;
    const [minX, minY, maxX, maxY] = bbox(provincesGeo);
    const centerLng = (minX + maxX) / 2;
    const centerLat = (minY + maxY) / 2;
    const zoom = 6.5;
    nationalCenterRef.current = { lng: centerLng, lat: centerLat, zoom };
    setViewState(v => ({ ...v, longitude: centerLng, latitude: centerLat, zoom, pitch: 0, bearing: 0 }));
  }, [provincesGeo]);

  // ---------- markers helpers ----------
  const clearMarkers = () => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
  };

  const addLocationMarkers = (locs: any[]) => {
    if (!mapRef.current) return;
    clearMarkers();
    locs.forEach(l => {
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
        .addTo(mapRef.current!);
      markersRef.current.push(mk);
    });
  };

  // ---------- selection flows ----------
  const handleProvinceSelect = useCallback(
    (provinceName: string, center?: [number, number]) => {
      const record =
        PROVINCES.find(p => p.name === provinceName) ||
        PROVINCES.find(p => p.nameEn === provinceName);
      if (!record) return;

      // locations in province
      const locs = locations.filter(l => {
        const c = cleanCity(l.city || '');
        return record.searchTerms.some(t => c.includes(t) || t.includes(c));
      });
      setSelectedProvince(record.name);
      setSelectedCity(null);
      setSelectedLocation(null);
      setProvinceLocations(locs);

      const cityMap: Record<string, any[]> = {};
      locs.forEach(l => {
        const c = cleanCity(l.city || '');
        if (!c) return;
        (cityMap[c] ||= []).push(l);
      });
      setProvinceCities(cityMap);

      addLocationMarkers(locs);

      // fly
      if (center) {
        setViewState(v => ({
          ...v,
          longitude: center[0],
          latitude: center[1],
          zoom: 8,
          pitch: 0,
          transitionDuration: 550,
          transitionInterpolator: new FlyToInterpolator({ speed: 2.5 })
        }));
      }
    },
    [locations]
  );

  const handleCitySelect = (city: string, locs: any[]) => {
    setSelectedCity(city);
    setSelectedLocation(null);
    setCityLocations(locs);

    addLocationMarkers(locs);

    const valid = locs.filter(l => l.latitude && l.longitude);
    if (valid.length) {
      const lat = valid.reduce((s, l) => s + Number(l.latitude), 0) / valid.length;
      const lng = valid.reduce((s, l) => s + Number(l.longitude), 0) / valid.length;
      setViewState(v => ({
        ...v,
        longitude: lng,
        latitude: lat,
        zoom: 12,
        pitch: 0,
        transitionDuration: 600,
        transitionInterpolator: new FlyToInterpolator({ speed: 2.5 })
      }));
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
    const fallback = nationalCenterRef.current || { lng: 25.4858, lat: 42.7339, zoom: 6.5 };
    setViewState(v => ({
      ...v,
      longitude: fallback.lng,
      latitude: fallback.lat,
      zoom: fallback.zoom,
      pitch: 0,
      transitionDuration: 550,
      transitionInterpolator: new FlyToInterpolator({ speed: 2.5 })
    }));
  };

  // ---------- Deck.GL layers (colored provinces kept!) ----------
  const onClickProvince = useCallback(
    (info: any) => {
      if (!info.object?.properties) return;
      const nameRaw = info.object.properties.name || info.object.properties.name_en;
      const nameDisplay = matchProvinceRecord(nameRaw)?.name || nameRaw;

      if (selectedProvince === nameDisplay) {
        resetView();
        return;
      }

      const c = centroid(info.object).geometry.coordinates as [number, number];
      handleProvinceSelect(nameDisplay, c);
    },
    [selectedProvince, handleProvinceSelect]
  );

  const deckLayers = [];
  if (provincesGeo) {
    deckLayers.push(
      new GeoJsonLayer({
        id: 'provinces-colored',
        data: provincesGeo,
        pickable: true,
        filled: true,
        stroked: true,
        extruded: false,
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 2,
        lineWidthMinPixels: 2,
        getFillColor: (f: any) => {
          const nm = matchProvinceRecord(f.properties.name || f.properties.name_en)?.name ||
            f.properties.name || f.properties.name_en;
          const isSelected = nm === selectedProvince;
          // selected transparent, others green
          return isSelected ? [0, 0, 0, 0] : [16, 185, 129, 200];
        },
        onClick: onClickProvince,
        updateTriggers: { getFillColor: selectedProvince }
      })
    );
  }

  // ---------- UI ----------
  if (!mapboxTokenRef.current) {
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
        {/* Mapbox substrate with mask */}
        <div ref={mapEl} className="w-full h-[600px] rounded-lg overflow-hidden border border-border shadow-lg" />

        {/* DeckGL on top for colored provinces */}
        <DeckGL
          viewState={viewState}
          controller={{ dragRotate: false }}
          layers={deckLayers}
          onViewStateChange={({ viewState: vs }) => setViewState(vs)}
          style={{ position: 'absolute', inset: 0 }}
          getTooltip={({ object }) => {
            const nm =
              object &&
              (matchProvinceRecord(object.properties?.name || object.properties?.name_en)?.name ||
                object?.properties?.name ||
                object?.properties?.name_en);
            return nm || null;
          }}
        />

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
                    className="w-full h-32 object-cover rounded-t-lg"
                  />
                )}
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
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Province list (bottom) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-6">
        {PROVINCES.map(p => {
          const data = provinceData[p.name];
          if (!data || data.locations.length === 0) return null;
          const isSelected = selectedProvince === p.name;
          return (
            <div
              key={p.name}
              onClick={() => {
                if (isSelected) resetView();
                else handleProvinceSelect(p.name, data.coordinates);
              }}
              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:scale-105 ${
                isSelected ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : ''
              }`}
            >
              <div className="text-center">
                <h4 className="font-semibold text-sm">{p.name}</h4>
                <p className="text-xs text-muted-foreground">{data.locations.length} офиса</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cities in province */}
      {selectedProvince && !selectedCity && Object.keys(provinceCities).length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-4">Градове в {selectedProvince}</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(provinceCities).map(([city, locs]) => (
              <div
                key={city}
                onClick={() => handleCitySelect(city, locs)}
                className="p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:border-secondary hover:bg-secondary/5 hover:scale-105"
              >
                <div className="text-center">
                  <h5 className="font-semibold text-sm">{city}</h5>
                  <p className="text-xs text-muted-foreground">{locs.length} офиса</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locations in city */}
      {selectedCity && cityLocations.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-4">Офиси в {selectedCity}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cityLocations.map(l => (
              <Card key={l.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedLocation(l)}>
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
