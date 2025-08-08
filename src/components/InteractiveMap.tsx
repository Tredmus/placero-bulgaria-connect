import React, { useEffect, useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import union from '@turf/union';
import bbox from '@turf/bbox';
import centroid from '@turf/centroid';
import { FlyToInterpolator } from '@deck.gl/core';

const GEOJSON_URL = '/data/bg_provinces.geojson';

/**
 * Initial camera for Bulgaria
 */
const INITIAL_VIEW_STATE = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 6.5,
  pitch: 0,
  bearing: 0,
  transitionDuration: 0
};

export default function InteractiveMap() {
  // ---- DATA STATE ----
  const { locations } = useLocations(); // Your locations from backend
  const [provinces, setProvinces] = useState<any>(null); // Bulgaria provinces GeoJSON
  const [mapboxToken, setMapboxToken] = useState<string | null>(null); // Mapbox token for the raster basemap

  // ---- MAP/VIEW STATE ----
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE); // DeckGL camera state
  const nationalCenterRef = useRef<{ lng: number; lat: number; zoom: number } | null>(null); // Remember whole-country center/zoom

  // Selection & hover
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null); // Selected province name (en/bg)
  const [hoveredProvinceId, setHoveredProvinceId] = useState<string | number | null>(null); // Feature id used to style hover

  // City & location pin datasets (built after selecting a province)
  const [cityPoints, setCityPoints] = useState<any[]>([]);
  const [locationPoints, setLocationPoints] = useState<any[]>([]);

  // Mapbox GL instance (used as the basemap under DeckGL)
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // Unused but kept if you plan future elevation styling / unions
  const [elevationMap, setElevationMap] = useState<Record<string, number>>({});

  // ------------------------------------------------------------
  // 1) Fetch Mapbox token (from Supabase function; fallback to public token)
  // ------------------------------------------------------------
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-mapbox-token');
        if (data?.token) {
          setMapboxToken(data.token);
          mapboxgl.accessToken = data.token;
        } else {
          const token = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
          setMapboxToken(token);
          mapboxgl.accessToken = token;
        }
      } catch {
        const token = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        setMapboxToken(token);
        mapboxgl.accessToken = token;
      }
    };
    fetchMapboxToken();
  }, []);

  // ------------------------------------------------------------
  // 2) Initialize Mapbox basemap once we have token & provinces
  //    We also add a "world mask" so only Bulgaria area reveals the map
  // ------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || !mapboxToken || !provinces) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      pitch: viewState.pitch,
      bearing: viewState.bearing,
      interactive: false // all interactions handled by DeckGL
    });

    mapRef.current.on('load', () => {
      if (!mapRef.current || !provinces) return;

      // Source with all provinces (for the mask)
      if (!mapRef.current.getSource('all-provinces')) {
        mapRef.current.addSource('all-provinces', { type: 'geojson', data: provinces });
      }

      // A big world polygon to act as a mask background
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

      // Paint the world mask the same as page background so map looks “floating”
      if (!mapRef.current.getLayer('world-mask-layer')) {
        mapRef.current.addLayer({
          id: 'world-mask-layer',
          type: 'fill',
          source: 'world-mask',
          paint: { 'fill-color': '#020817', 'fill-opacity': 1 }
        });
      }

      // Make underlying raster (if any) a bit visible
      const layers = mapRef.current.getStyle().layers;
      const raster = layers?.find(layer => layer.type === 'raster');
      if (raster) {
        mapRef.current.setPaintProperty(raster.id, 'raster-opacity', 0.8);
      }

      // Initialize the mask to show the basemap only through Bulgarian provinces
      setMaskToAllProvinces();
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapboxToken, provinces]);

  // ------------------------------------------------------------
  // 3) Build a mask with holes for every province (so basemap shows only there)
  // ------------------------------------------------------------
  const setMaskToAllProvinces = useCallback(() => {
    if (!mapRef.current || !provinces) return;

    const worldRing: [number, number][] = [
      [-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]
    ];

    // Each province outer ring becomes a "hole" in the world mask
    const holes: [number, number][][] = [];
    for (const feat of provinces.features) {
      const geom = feat.geometry;
      if (!geom) continue;

      if (geom.type === 'Polygon') {
        if (Array.isArray(geom.coordinates[0])) {
          holes.push(geom.coordinates[0] as [number, number][]);
        }
      } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) {
          if (Array.isArray(poly[0])) {
            holes.push(poly[0] as [number, number][]);
          }
        }
      }
    }

    const maskWithAllProvinceHoles = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Polygon' as const, coordinates: [worldRing, ...holes] }
    };

    (mapRef.current.getSource('world-mask') as mapboxgl.GeoJSONSource)?.setData(maskWithAllProvinceHoles);
  }, [provinces]);

  // Re-apply mask if provinces/selection change
  useEffect(() => {
    setMaskToAllProvinces();
  }, [setMaskToAllProvinces, selectedProvince, provinces]);

  // Keep Mapbox camera in sync with DeckGL camera
  useEffect(() => {
    if (mapRef.current && viewState) {
      mapRef.current.jumpTo({
        center: [viewState.longitude, viewState.latitude],
        zoom: viewState.zoom,
        pitch: viewState.pitch,
        bearing: viewState.bearing
      });
    }
  }, [viewState]);

  // ------------------------------------------------------------
  // 4) Load provinces GeoJSON and center camera on Bulgaria
  // ------------------------------------------------------------
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then(data => setProvinces(data));
  }, []);

  useEffect(() => {
    if (!provinces) return;

    // Center roughly on Bulgaria using bbox
    const [minX, minY, maxX, maxY] = bbox(provinces);
    const centerLng = (minX + maxX) / 2;
    const centerLat = (minY + maxY) / 2;
    const zoom = 6.5;

    nationalCenterRef.current = { lng: centerLng, lat: centerLat, zoom };

    setViewState(prev => ({
      ...prev,
      longitude: centerLng,
      latitude: centerLat,
      zoom,
      pitch: 0,
      bearing: 0,
      transitionDuration: 0
    }));
  }, [provinces]);

  // ------------------------------------------------------------
  // 5) Build city and location datasets once a province is selected
  // ------------------------------------------------------------
  useEffect(() => {
    if (selectedProvince) {
      const filtered = locations.filter(
        l => l.city === selectedProvince && l.latitude && l.longitude
      );

      // Group by city to make "city pins"
      const cities: Record<string, any[]> = {};
      filtered.forEach(l => {
        const city = l.city || '';
        if (!cities[city]) cities[city] = [];
        cities[city].push(l);
      });

      // Compute city centroids (average of its locations)
      setCityPoints(
        Object.entries(cities).map(([city, pts]) => {
          const avg = pts.reduce(
            (acc, p) => {
              acc.longitude += typeof p.longitude === 'string' ? parseFloat(p.longitude) : p.longitude;
              acc.latitude += typeof p.latitude === 'string' ? parseFloat(p.latitude) : p.latitude;
              return acc;
            },
            { longitude: 0, latitude: 0 }
          );
          avg.longitude /= pts.length;
          avg.latitude /= pts.length;

          return { position: [avg.longitude, avg.latitude], count: pts.length, cityName: city, pts };
        })
      );

      // Raw location pins
      setLocationPoints(
        filtered.map(l => ({
          position: [
            typeof l.longitude === 'string' ? parseFloat(l.longitude) : l.longitude,
            typeof l.latitude === 'string' ? parseFloat(l.latitude) : l.latitude
          ],
          data: l
        }))
      );
    } else {
      setCityPoints([]);
      setLocationPoints([]);
    }
  }, [selectedProvince, locations]);

  // DeckGL camera change
  const onViewStateChange = useCallback((info: any) => {
    setViewState(info.viewState);
  }, []);

  // ------------------------------------------------------------
  // 6) Province click = select/deselect + camera fly
  //     * Zoom bumped from 8 -> 8.8 as requested
  // ------------------------------------------------------------
  const onClickProvince = useCallback(
    (info: any) => {
      if (info.object && info.object.properties) {
        const name =
          info.object.properties.name_en ||
          info.object.properties.name;

        // Clicking same province again -> deselect and reset to national view
        if (selectedProvince === name) {
          setSelectedProvince(null);
          const fallback = nationalCenterRef.current || { lng: 25.4858, lat: 42.7339, zoom: 6.5 };
          setViewState(prev => ({
            ...prev,
            longitude: fallback.lng,
            latitude: fallback.lat,
            zoom: fallback.zoom,
            pitch: 0,
            transitionDuration: 550,
            transitionInterpolator: new FlyToInterpolator({ speed: 2.5 })
          }));
          return;
        }

        // Select a new province
        setSelectedProvince(name);

        // Fly to province centroid
        const c = centroid(info.object);
        const [lng, lat] = c.geometry.coordinates as [number, number];

        setViewState(prev => ({
          ...prev,
          longitude: lng,
          latitude: lat,
          zoom: 8.8, // <- stronger zoom
          pitch: 0,
          transitionDuration: 550,
          transitionInterpolator: new FlyToInterpolator({ speed: 2.5 })
        }));
      }
    },
    [selectedProvince]
  );

  // ------------------------------------------------------------
  // 7) Layers
  //    - Provinces (hover + select styles)
  //    - City pins (zoom >= 8)
  //    - Location pins (zoom >= 12)
  // ------------------------------------------------------------
  const layers: any[] = [];

  if (provinces) {
    layers.push(
      new GeoJsonLayer({
        id: 'provinces',
        data: provinces,
        pickable: true,
        filled: true,
        stroked: true,
        wireframe: true,
        extruded: false,

        // White borders
        getLineColor: [255, 255, 255, 255],
        getLineWidth: () => 2,
        lineWidthMinPixels: 2,

        // Fill color logic:
        // - Selected: fully transparent (see-through to basemap)
        // - Hovered (and not selected): 50% opacity
        // - Default: solid accent fill
        getFillColor: (f: any) => {
          const isSelected =
            f.properties.name_en === selectedProvince ||
            f.properties.name === selectedProvince;

          // IMPORTANT: if your GeoJSON has `name_bg`, you can also check that against selectedProvince
          // e.g., (f.properties.name_bg === selectedProvince)

          if (isSelected) {
            return [0, 0, 0, 0]; // transparent
          }

          // Use feature id or fallback to index to determine hover match
          const id = f.id ?? f.properties?.id ?? f.properties?.code ?? f.properties?.name_en ?? f.properties?.name;
          const isHovered = hoveredProvinceId != null && hoveredProvinceId === id;

          // Base color: teal-ish; adjust alpha for hover/non-hover
          // Non-hover alpha ~200, hover alpha ~128 (about 50%)
          return isHovered ? [16, 185, 129, 128] : [16, 185, 129, 200];
        },

        // Track hovered feature so we can style it
        onHover: (info: any) => {
          if (info.object) {
            const f = info.object;
            const id = f.id ?? f.properties?.id ?? f.properties?.code ?? f.properties?.name_en ?? f.properties?.name;
            setHoveredProvinceId(id);
          } else {
            setHoveredProvinceId(null);
          }
        },

        onClick: onClickProvince,

        // Recalculate when these change
        updateTriggers: {
          getFillColor: [selectedProvince, hoveredProvinceId]
        }
      })
    );
  }

  // City “cluster” pins (only when zoomed in enough and we have data)
  if (viewState.zoom >= 8 && cityPoints.length > 0) {
    layers.push(
      new ScatterplotLayer({
        id: 'cities',
        data: cityPoints,
        pickable: true,
        getPosition: (d: any) => d.position,
        getRadius: (d: any) => Math.sqrt(d.count) * 5000,
        getFillColor: [255, 140, 0],
        onClick: (info: any) => {
          if (info.object) {
            setViewState(prev => ({
              ...prev,
              longitude: info.object.position[0],
              latitude: info.object.position[1],
              zoom: 12,
              transitionDuration: 1000
            }));
          }
        }
      })
    );
  }

  // Individual location pins (only when zoomed further)
  if (viewState.zoom >= 12 && locationPoints.length > 0) {
    layers.push(
      new ScatterplotLayer({
        id: 'locations',
        data: locationPoints,
        pickable: true,
        getPosition: (d: any) => d.position,
        getRadius: 2000,
        getFillColor: [255, 0, 128],
        onClick: (info: any) => info.object && alert(info.object.data.name)
      })
    );
  }

  // ------------------------------------------------------------
  // 8) Render
  // ------------------------------------------------------------
  if (!mapboxToken) {
    return (
      <div
        style={{ width: '100%', height: '600px', position: 'relative' }}
        className="flex items-center justify-center bg-muted"
      >
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      {/* Mapbox basemap lives underneath DeckGL */}
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%', position: 'absolute', top: '0', left: '0', zIndex: 0 }}
      />

      <DeckGL
        viewState={viewState}
        controller={{ dragRotate: false }}
        layers={layers}
        onViewStateChange={onViewStateChange}
        style={{ width: '100%', height: '100%', position: 'absolute', top: '0', left: '0', zIndex: 1 }}

        /**
         * Tooltip prefers Bulgarian name.
         * If your GeoJSON uses a different field, replace `name_bg` below.
         * Fallbacks: `name`, then `name_en`.
         */
        getTooltip={({ object }) => {
          if (object && object.properties) {
            return object.properties.name_bg || object.properties.name || object.properties.name_en;
          }
          return null;
        }}
      />
    </div>
  );
}
