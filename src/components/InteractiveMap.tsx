import React, { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RotateCcw, Building2, MapPin, Star, Wifi, Coffee, Car, Users } from 'lucide-react';

// --- CONFIG ---
const GEOJSON_URL = '/data/bg_provinces.geojson';
const BG_CENTER: [number, number] = [25.4858, 42.7339];

// Provinces list used for grouping locations by province
const bulgariaProvinces = [
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

// --- HELPERS ---
const cleanCityName = (city: string = '') =>
  city.toLowerCase().replace(/област$/, '').replace(/region$/, '').replace(/,.*$/, '').trim();

const amenityIcons = { wifi: Wifi, coffee: Coffee, parking: Car, meeting: Users } as const;

// --- COMPONENT ---
export default function InteractiveMap() {
  const { locations } = useLocations();

  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [token, setToken] = useState<string>('');

  const [geoProvinces, setGeoProvinces] = useState<any>(null); // for mask (Map 1 behavior)
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);

  const [provinceLocations, setProvinceLocations] = useState<any[]>([]);
  const [provinceCities, setProvinceCities] = useState<Record<string, any[]>>({});
  const [cityLocations, setCityLocations] = useState<any[]>([]);

  // token
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('get-mapbox-token');
        const t = data?.token || 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        mapboxgl.accessToken = t;
        setToken(t);
      } catch {
        const t = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        mapboxgl.accessToken = t;
        setToken(t);
      }
    })();
  }, []);

  // fetch provinces geojson for mask (Map 1)
  useEffect(() => {
    fetch(GEOJSON_URL).then(r => r.json()).then(setGeoProvinces).catch(() => {});
  }, []);

  // build province data from actual locations
  const provinceData = useMemo(() => {
    const map: Record<string, { locations: any[]; coordinates: [number, number] }> = {};
    bulgariaProvinces.forEach((prov) => {
      const locs = locations.filter((l) => {
        const city = cleanCityName(l.city || '');
        return prov.searchTerms.some((term) => city.includes(term) || term.includes(city));
      });
      const valid = locs.filter((l) => l.latitude && l.longitude);
      if (valid.length) {
        const avgLat = valid.reduce((s, l) => s + Number(l.latitude), 0) / valid.length;
        const avgLng = valid.reduce((s, l) => s + Number(l.longitude), 0) / valid.length;
        map[prov.name] = { locations: locs, coordinates: [avgLng, avgLat] };
      }
    });
    return map;
  }, [locations]);

  // init map
  useEffect(() => {
    if (!mapEl.current || !token) return;
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapEl.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: BG_CENTER,
      zoom: 6.5,
      pitch: 30,
      bearing: 0,
      renderWorldCopies: false,
      maxZoom: 18,
      minZoom: 5.5,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      // World mask: #020817 outside BG provinces (from Map 1)
      if (geoProvinces) addWorldMaskForAllProvinces(geoProvinces);

      // start with province markers
      drawProvinceMarkers();
    });

    return () => { clearMarkers(); map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, geoProvinces]);

  // helpers: markers
  const clearMarkers = () => { markers.current.forEach(m => m.remove()); markers.current = []; };

  const drawProvinceMarkers = () => {
    if (!map.current) return;
    clearMarkers();

    Object.entries(provinceData).forEach(([name, data]) => {
      if (!data || data.locations.length === 0) return;
      const count = data.locations.length;

      const el = document.createElement('div');
      el.style.cssText = `
        width:${Math.max(32, Math.min(80, count * 8))}px;height:${Math.max(32, Math.min(80, count * 8))}px;
        background:#10b981;border:3px solid #fff;border-radius:50%;cursor:pointer;
        display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:12px;line-height:1;
        box-shadow:0 4px 12px rgba(16,185,129,.4);transition:transform .2s ease, box-shadow .2s ease;
      `;
      el.innerHTML = `${count}<br/><span style="font-size:9px">${name}</span>`;
      el.onmouseenter = () => { el.style.transform = 'scale(1.08)'; el.style.boxShadow = '0 6px 18px rgba(16,185,129,.6)'; };
      el.onmouseleave = () => { el.style.transform = 'scale(1)'; el.style.boxShadow = '0 4px 12px rgba(16,185,129,.4)'; };
      el.onclick = () => handleProvinceSelect(name, data.locations, data.coordinates);

      const mk = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(data.coordinates)
        .addTo(map.current);
      markers.current.push(mk);
    });
  };

  const drawLocationMarkers = (locs: any[]) => {
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

  // world mask with “holes” for every BG province (Map 1 behavior)
  const addWorldMaskForAllProvinces = (provsGeo: any) => {
    if (!map.current) return;

    const worldRing: [number, number][] = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
    const holes: [number, number][][] = [];

    for (const f of provsGeo.features || []) {
      const g = f.geometry;
      if (!g) continue;
      if (g.type === 'Polygon') holes.push(g.coordinates[0] as [number, number][]);
      if (g.type === 'MultiPolygon') g.coordinates.forEach((poly: any) => holes.push(poly[0] as [number, number][]));
    }

    const mask = { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [worldRing, ...holes] } };

    if (!map.current.getSource('world-mask')) {
      map.current.addSource('world-mask', { type: 'geojson', data: mask });
      map.current.addLayer({
        id: 'world-mask-layer',
        type: 'fill',
        source: 'world-mask',
        paint: { 'fill-color': '#020817', 'fill-opacity': 1 },
      });
    } else {
      (map.current.getSource('world-mask') as mapboxgl.GeoJSONSource).setData(mask);
    }
  };

  // selection flows
  const handleProvinceSelect = (name: string, locs: any[], coords: [number, number]) => {
    setSelectedProvince(name);
    setSelectedCity(null);
    setSelectedLocation(null);
    setProvinceLocations(locs);

    // group to cities for the panel below
    const cityMap: Record<string, any[]> = {};
    locs.forEach((l) => {
      const c = cleanCityName(l.city);
      if (!c) return;
      (cityMap[c] ||= []).push(l);
    });
    setProvinceCities(cityMap);

    drawLocationMarkers(locs);

    map.current?.flyTo({ center: coords, zoom: 8, pitch: 60, duration: 1200 });
  };

  const handleCitySelect = (city: string, locs: any[]) => {
    setSelectedCity(city);
    setSelectedLocation(null);
    setCityLocations(locs);

    drawLocationMarkers(locs);

    const valid = locs.filter((l) => l.latitude && l.longitude);
    if (valid.length) {
      const avgLat = valid.reduce((s, l) => s + Number(l.latitude), 0) / valid.length;
      const avgLng = valid.reduce((s, l) => s + Number(l.longitude), 0) / valid.length;
      map.current?.flyTo({ center: [avgLng, avgLat], zoom: 12, pitch: 30, duration: 1000 });
    }
  };

  const resetView = () => {
    setSelectedProvince(null);
    setSelectedCity(null);
    setSelectedLocation(null);
    setProvinceLocations([]);
    setProvinceCities({});
    setCityLocations([]);

    drawProvinceMarkers();
    map.current?.flyTo({ center: BG_CENTER, zoom: 6.5, pitch: 30, bearing: 0, duration: 900 });
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold">Изберете регион</h3>
        {selectedProvince && (
          <Button onClick={resetView} variant="outline" className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Покажи всички региони
          </Button>
        )}
      </div>

      {/* Map */}
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

      {/* Province list */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-6">
        {bulgariaProvinces.map((p) => {
          const data = provinceData[p.name];
          if (!data || data.locations.length === 0) return null;
          const selected = selectedProvince === p.name;
          return (
            <div
              key={p.name}
              onClick={() => (selected ? resetView() : handleProvinceSelect(p.name, data.locations, data.coordinates))}
              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:scale-105 ${
                selected ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : ''
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

      {/* Cities list */}
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

      {/* Locations list (when a city is selected) */}
      {selectedCity && cityLocations.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-4">Офиси в {selectedCity}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cityLocations.map((l) => (
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
