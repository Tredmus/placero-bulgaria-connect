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

  // selection state
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [provinceCities, setProvinceCities] = useState<Record<string, any[]>>({});
  const [provinceLocations, setProvinceLocations] = useState<any[]>([]);
  const [cityLocations, setCityLocations] = useState<any[]>([]);

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
      if (!map.current!.getSource('provinces')) {
        map.current!.addSource('provinces', { type: 'geojson', data: provincesGeo });
      }
      map.current!.addLayer({
        id: 'provinces-fill',
        type: 'fill',
        source: 'provinces',
        paint: {
          'fill-color': [
            'case',
            ['==', ['coalesce', ['get', 'name'], ['get', 'name_en']], selectedProvince ?? '___none___'],
            'rgba(0,0,0,0)', // selected = transparent
            'rgba(16,185,129,0.78)', // green
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

      // hover cursor
      map.current!.on('mouseenter', 'provinces-fill', () => (map.current!.getCanvas().style.cursor = 'pointer'));
      map.current!.on('mouseleave', 'provinces-fill', () => (map.current!.getCanvas().style.cursor = ''));

      // click -> select province
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
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, provincesGeo]);

  // keep province color in sync with selection
  useEffect(() => {
    if (!map.current?.getLayer('provinces-fill')) return;
    map.current.setPaintProperty('provinces-fill', 'fill-color', [
      'case',
      ['==', ['coalesce', ['get', 'name'], ['get', 'name_en']], selectedProvince ?? '___none___'],
      'rgba(0,0,0,0)',
      'rgba(16,185,129,0.78)',
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

      // fly
      if (centerGuess) {
        map.current?.flyTo({ center: centerGuess, zoom: 8, pitch: 0, duration: 800 });
      } else if (provinceData[rec.name]) {
        map.current?.flyTo({ center: provinceData[rec.name].coordinates, zoom: 8, pitch: 0, duration: 800 });
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
                <p className="text-xs text-muted-foreground">{data.locations.length} офиса</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cities */}
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

      {/* Locations */}
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
