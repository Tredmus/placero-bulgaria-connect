import React, { useEffect, useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import * as turf from '@turf/turf';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const GEOJSON_URL = '/data/bg_provinces.geojson';

const INITIAL_VIEW_STATE = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 6.5,
  pitch: 0, // no tilt
  bearing: 0,
  transitionDuration: 0
};

type CityPoint = {
  position: [number, number];
  count: number;
  cityName: string;
  pts: any[];
};

type LocationPoint = {
  position: [number, number];
  data: any;
};

export default function InteractiveMap() {
  const { locations } = useLocations();

  const [provinces, setProvinces] = useState<any>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

  const [cityPoints, setCityPoints] = useState<CityPoint[]>([]);
  const [locationPoints, setLocationPoints] = useState<LocationPoint[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);

  // mapbox
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // ---------------------------
  // Helpers
  // ---------------------------
  const provinceMatch = (loc: any, provName: string) => {
    const val = `${loc.province || loc.region || ''}`.toLowerCase();
    return (
      val.includes(provName.toLowerCase()) ||
      provName.toLowerCase().includes(val)
    );
  };

  const avgLngLat = (pts: any[]) => {
    const sum = pts.reduce(
      (acc, p) => {
        const lng = typeof p.longitude === 'string' ? parseFloat(p.longitude) : p.longitude;
        const lat = typeof p.latitude === 'string' ? parseFloat(p.latitude) : p.latitude;
        return { lng: acc.lng + lng, lat: acc.lat + lat, n: acc.n + 1 };
      },
      { lng: 0, lat: 0, n: 0 }
    );
    return sum.n ? [sum.lng / sum.n, sum.lat / sum.n] as [number, number] : null;
  };

  // ---------------------------
  // Boot
  // ---------------------------
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then(data => setProvinces(data));
  }, []);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-mapbox-token');
        const tok =
          data?.token ??
          'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        setMapboxToken(tok);
        mapboxgl.accessToken = tok;
      } catch {
        const tok =
          'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        setMapboxToken(tok);
        mapboxgl.accessToken = tok;
      }
    };
    fetchMapboxToken();
  }, []);

  // Initialize Mapbox map (as a background raster)
  useEffect(() => {
    if (!mapContainerRef.current || !mapboxToken || !provinces) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      pitch: 0, // enforce flat
      bearing: viewState.bearing,
      interactive: false
    });

    mapRef.current.on('load', () => {
      if (!mapRef.current || !provinces) return;

      // 1) Add provinces source (not used for drawing by Mapbox, just in case)
      if (!mapRef.current.getSource('all-provinces')) {
        mapRef.current.addSource('all-provinces', {
          type: 'geojson',
          data: provinces
        });
      }

      // 2) Add world mask source
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

      // 3) Add mask layer (outside: dark, inside (hole): map is visible)
      if (!mapRef.current.getLayer('world-mask-layer')) {
        mapRef.current.addLayer({
          id: 'world-mask-layer',
          type: 'fill',
          source: 'world-mask',
          paint: {
            'fill-color': '#0b0f14',
            'fill-opacity': 1
          }
        });
      }
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, provinces]);

  // Update mask when province changes
  useEffect(() => {
    if (!mapRef.current || !provinces) return;

    const fullMask = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]]
      }
    };

    if (!selectedProvince) {
      (mapRef.current.getSource('world-mask') as mapboxgl.GeoJSONSource)?.setData(fullMask);
      return;
    }

    const selectedFeature = provinces.features.find(
      (f: any) =>
        f.properties.name_en === selectedProvince ||
        f.properties.name === selectedProvince
    );

    if (!selectedFeature) {
      (mapRef.current.getSource('world-mask') as mapboxgl.GeoJSONSource)?.setData(fullMask);
      return;
    }

    // world polygon with province hole
    const maskWithHole = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          fullMask.geometry.coordinates[0],
          ...selectedFeature.geometry.coordinates // holes
        ]
      }
    };

    (mapRef.current.getSource('world-mask') as mapboxgl.GeoJSONSource)?.setData(maskWithHole);
  }, [selectedProvince, provinces]);

  // Sync Mapbox camera
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.jumpTo({
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      pitch: 0,
      bearing: viewState.bearing
    });
  }, [viewState]);

  // Recompute cities/locations when province toggles
  useEffect(() => {
    if (!selectedProvince) {
      setCityPoints([]);
      setLocationPoints([]);
      setSelectedLocation(null);
      return;
    }

    const filtered = locations.filter(
      (l: any) => l.latitude && l.longitude && provinceMatch(l, selectedProvince)
    );

    // group by city
    const byCity: Record<string, any[]> = {};
    filtered.forEach(l => {
      const key = `${l.city || ''}`.trim() || '—';
      if (!byCity[key]) byCity[key] = [];
      byCity[key].push(l);
    });

    const cities: CityPoint[] = Object.entries(byCity).map(([city, pts]) => {
      const avg = avgLngLat(pts)!;
      return { position: avg, count: pts.length, cityName: city, pts };
    });

    setCityPoints(cities);
    setLocationPoints(
      filtered.map((l: any) => ({
        position: [
          typeof l.longitude === 'string' ? parseFloat(l.longitude) : l.longitude,
          typeof l.latitude === 'string' ? parseFloat(l.latitude) : l.latitude
        ],
        data: l
      }))
    );
  }, [selectedProvince, locations]);

  // interactions
  const onViewStateChange = useCallback((info: any) => {
    setViewState(v => ({ ...v, ...info.viewState, pitch: 0 })); // keep flat
  }, []);

  const flyToProvince = (feature: any) => {
    const center = turf.centroid(feature).geometry.coordinates as [number, number];
    setViewState(v => ({
      ...v,
      longitude: center[0],
      latitude: center[1],
      zoom: 8, // comfortable province zoom
      pitch: 0,
      transitionDuration: 1000
    }));
  };

  const onClickProvince = useCallback((info: any) => {
    const f = info?.object;
    if (!f?.properties) return;

    const name = f.properties.name_en || f.properties.name;
    setSelectedProvince(name);
    flyToProvince(f);
  }, []);

  // city click -> zoom in
  const onClickCity = useCallback((info: any) => {
    const obj = info?.object as CityPoint | undefined;
    if (!obj) return;
    setViewState(v => ({
      ...v,
      longitude: obj.position[0],
      latitude: obj.position[1],
      zoom: 11,
      pitch: 0,
      transitionDuration: 800
    }));
  }, []);

  // location click -> popup
  const onClickLocation = useCallback((info: any) => {
    const obj = info?.object as LocationPoint | undefined;
    if (!obj) return;
    setSelectedLocation(obj.data);
  }, []);

  // ---------------------------
  // Layers
  // ---------------------------
  const layers: any[] = [];

  // Provinces (flat, dark teal; selected becomes transparent)
  if (provinces) {
    layers.push(
      new GeoJsonLayer({
        id: 'provinces',
        data: provinces,
        pickable: true,
        filled: true,
        stroked: true,
        wireframe: false,
        extruded: false,
        getLineColor: [32, 88, 84, 220],
        lineWidthMinPixels: 1,
        getFillColor: (f: any) => {
          const isSelected =
            f.properties.name_en === selectedProvince ||
            f.properties.name === selectedProvince;
          // default: rich teal (opaque); selected: fully transparent to reveal map
          return isSelected ? [0, 0, 0, 0] : [14, 100, 85, 230];
        },
        onClick: onClickProvince,
        updateTriggers: { getFillColor: [selectedProvince] }
      })
    );
  }

  // City markers (only when province selected & zoom >= 8)
  if (selectedProvince && viewState.zoom >= 8 && cityPoints.length > 0) {
    // dot
    layers.push(
      new ScatterplotLayer({
        id: 'cities-dots',
        data: cityPoints,
        pickable: true,
        getPosition: (d: CityPoint) => d.position,
        getRadius: (d: CityPoint) => Math.max(900, Math.sqrt(d.count) * 1200),
        radiusMinPixels: 6,
        radiusMaxPixels: 22,
        getFillColor: [230, 245, 240, 255], // light
        getLineColor: [16, 120, 110, 255], // teal ring
        lineWidthMinPixels: 2,
        onClick: onClickCity
      })
    );

    // count label
    layers.push(
      new TextLayer({
        id: 'cities-labels',
        data: cityPoints,
        getPosition: (d: CityPoint) => d.position,
        getText: (d: CityPoint) => `${d.cityName} • ${d.count}`,
        getSize: 12,
        getColor: [220, 235, 230, 255],
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'top',
        getPixelOffset: [0, 12]
      })
    );
  }

  // Location markers (zoom >= 11)
  if (selectedProvince && viewState.zoom >= 11 && locationPoints.length > 0) {
    layers.push(
      new ScatterplotLayer({
        id: 'locations',
        data: locationPoints,
        pickable: true,
        getPosition: (d: LocationPoint) => d.position,
        getRadius: 180,
        radiusMinPixels: 4,
        radiusMaxPixels: 10,
        getFillColor: [255, 255, 255, 255],
        getLineColor: [16, 120, 110, 255],
        lineWidthMinPixels: 1.5,
        onClick: onClickLocation
      })
    );
  }

  // ---------------------------
  // UI
  // ---------------------------
  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center bg-muted" style={{ width: '100%', height: '600px' }}>
        <p className="text-muted-foreground">Loading map…</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      {/* Mapbox background */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          zIndex: 0
        }}
      />

      {/* Deck.gl overlay */}
      <DeckGL
        viewState={viewState}
        controller={{ dragRotate: false }} // disable tilt
        layers={layers}
        onViewStateChange={onViewStateChange}
        style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 1 }}
        getTooltip={({ object }: any) =>
          object?.properties?.name_en || object?.properties?.name || null
        }
      />

      {/* Location popup */}
      {selectedLocation && (
        <div
          style={{
            position: 'absolute',
            right: 16,
            top: 16,
            width: 320,
            zIndex: 3,
            borderRadius: 12,
            background: 'rgba(13,18,23,0.9)',
            border: '1px solid rgba(36,66,64,0.6)',
            overflow: 'hidden',
            boxShadow: '0 12px 30px rgba(0,0,0,0.35)'
          }}
        >
          {selectedLocation.image && (
            <img
              src={selectedLocation.image}
              alt={selectedLocation.name}
              style={{ width: '100%', height: 140, objectFit: 'cover' }}
            />
          )}
          <div style={{ padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{selectedLocation.name}</div>
            {selectedLocation.address && (
              <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 8 }}>
                {selectedLocation.address}
              </div>
            )}
            {selectedLocation.description && (
              <div style={{ opacity: 0.8, fontSize: 13, lineHeight: 1.4 }}>
                {selectedLocation.description}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => setSelectedLocation(null)}
                style={{
                  border: '1px solid rgba(60,90,85,0.8)',
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: 'transparent',
                  color: '#cfe7df',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
