// ====================================================================
// IMPORTS
// ====================================================================
// React hooks for component state and lifecycle management
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
// Navigation hook for routing to location details
import { useNavigate } from 'react-router-dom';
// Mapbox GL JS for interactive maps
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
// Turf.js utilities for geospatial calculations
import centroid from '@turf/centroid'; // Calculate center points of geometries
import rewind from '@turf/rewind';     // Fix polygon winding order
import cleanCoords from '@turf/clean-coords'; // Remove duplicate coordinates
import union from '@turf/union';       // Merge overlapping geometries
import { bbox as turfBbox } from '@turf/turf'; // Calculate bounding boxes

// Custom hooks and utilities
import { useLocations } from '@/hooks/useLocations'; // Fetch location data
import { supabase } from '@/integrations/supabase/client'; // Supabase client for API calls
// UI components
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Building2, RotateCcw, Star, Wifi, Coffee, Car, Users } from 'lucide-react';

// ====================================================================
// CONSTANTS
// ====================================================================
// Path to the Bulgaria provinces GeoJSON file containing geographic boundaries
const GEOJSON_URL = '/data/bg_provinces.geojson';

// Configuration for all Bulgarian provinces with name mappings and search terms
// This allows matching locations to provinces using various name formats (Bulgarian/English)
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

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================
// Clean city names by removing suffixes like "Oblast", "Region" and extra text after commas
const cleanCity = (s = '') =>
  s.toLowerCase().replace(/област$/, '').replace(/region$/, '').replace(/,.*$/, '').trim();

// Format city names with proper capitalization (Title Case)
const formatCity = (s = '') =>
  s
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');

// Map amenity types to their corresponding icons for location details
const amenityIcons = { wifi: Wifi, coffee: Coffee, parking: Car, meeting: Users } as const;

// ====================================================================
// GEOMETRY HELPER FUNCTIONS
// ====================================================================
// These functions process and manipulate geographic data (GeoJSON)

// Type definition for polygon rings (array of coordinate pairs)
type Ring = [number, number][];

// Normalize and validate a GeoJSON FeatureCollection
// Filters out invalid geometries and ensures proper coordinate structure
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

// Merge multiple geographic features into a single unified geometry
// Uses Turf.js union operations to combine overlapping or adjacent areas
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

// Extract outer boundary rings from polygon/multipolygon geometries
// These are used to create "donut mask" effects for highlighting specific regions
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

// Create a "donut mask" geometry that highlights a specific province while dimming others
// When rawName is null, creates a mask that shows all of Bulgaria
// When rawName is provided, creates a mask that highlights only that province
function buildProvinceDonutMask(provincesFC: any, rawName: string | null) {
  // Define the world boundary as the outer ring (covers entire world)
  const worldRing: Ring = [
    [-180, -85],  // Southwest corner
    [180, -85],   // Southeast corner
    [180, 85],    // Northeast corner
    [-180, 85],   // Northwest corner
    [-180, -85],  // Close the ring
  ];

  // If no specific province is selected, create a mask showing all of Bulgaria
  if (!rawName) {
    const dissolvedAll = dissolve(provincesFC.features); // Merge all provinces
    const holes = outerRings(dissolvedAll?.geometry);    // Get Bulgaria's boundaries as holes
    let mask: any = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [worldRing, ...holes] }, // World with Bulgaria cut out
    };
    try {
      mask = rewind(cleanCoords(mask, { mutate: false }) as any, { reverse: false, mutate: false });
    } catch {}
    return mask;
  }

  // Find all features matching the specified province name
  const parts = provincesFC.features.filter((f: any) => {
    const nm = f.properties?.name ?? f.properties?.name_en;
    return nm === rawName;
  });
  const merged = dissolve(parts); // Combine multiple parts of the same province
  if (!merged) return null;

  // Create a mask that highlights only the selected province
  const holes = outerRings(merged.geometry); // Selected province boundaries as holes
  let mask: any = {
    type: 'Feature',
    properties: { province: rawName },
    geometry: { type: 'Polygon', coordinates: [worldRing, ...holes] }, // World with selected province cut out
  };
  try {
    mask = rewind(cleanCoords(mask, { mutate: false }) as any, { reverse: false, mutate: false });
  } catch {}
  return mask;
}

// ====================================================================
// MAIN COMPONENT
// ====================================================================

export default function InteractiveMapV1() {
  // ====================================================================
  // HOOKS AND DATA
  // ====================================================================
  const { locations } = useLocations(); // Get all location data from the API
  const navigate = useNavigate();        // Navigation for routing to location details

  // ====================================================================
  // REFS - DOM elements and Mapbox instances that persist across renders
  // ====================================================================
  const mapEl = useRef<HTMLDivElement>(null);              // Map container div
  const map = useRef<mapboxgl.Map | null>(null);           // Mapbox GL JS map instance
  const markers = useRef<mapboxgl.Marker[]>([]);           // Location markers array
  const markerById = useRef<Record<string, { marker: mapboxgl.Marker; bubble: HTMLDivElement }>>({});  // Quick marker lookup
  const hoverTooltipRef = useRef<HTMLDivElement | null>(null);     // Hover tooltip element
  const hoveredFeatureId = useRef<number | string | null>(null);   // Currently hovered province ID
  const bulgariaBoundsRef = useRef<mapboxgl.LngLatBounds | null>(null); // Bulgaria's bounding box for zoom constraints

  // ====================================================================
  // STATE - Component state for user interactions and selections
  // ====================================================================
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);  // Currently selected province (Bulgarian name)
  const selectedProvinceRef = useRef<string | null>(null);  // Ref version for map callbacks
  useEffect(() => {
    selectedProvinceRef.current = selectedProvince;
  }, [selectedProvince]);

  const [selectedRawName, setSelectedRawName] = useState<string | null>(null);    // Raw province name from GeoJSON
  const selectedRawNameRef = useRef<string | null>(null);   // Ref version for map callbacks
  useEffect(() => {
    selectedRawNameRef.current = selectedRawName;
  }, [selectedRawName]);

  const [selectedCity, setSelectedCity] = useState<string | null>(null);         // Currently selected city within province
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);   // Currently selected individual location

  // Data collections for different zoom levels
  const [provinceCities, setProvinceCities] = useState<Record<string, any[]>>({});  // Cities grouped by currently selected province
  const [provinceLocations, setProvinceLocations] = useState<any[]>([]);           // All locations in selected province
  const [cityLocations, setCityLocations] = useState<any[]>([]);                   // Locations in selected city

  // Map configuration and geographic data
  const [token, setToken] = useState<string>('');           // Mapbox access token
  const [provincesGeo, setProvincesGeo] = useState<any>(null);  // Bulgaria provinces GeoJSON data
  const [worldMask, setWorldMask] = useState<any>(null);    // Geometry for dimming non-selected areas

  // ====================================================================
  // COMPUTED DATA - Memoized calculations based on locations
  // ====================================================================
  // Group locations by province and calculate center coordinates for each province
  const provinceData = useMemo(() => {
    const map: Record<string, { locations: any[]; coordinates: [number, number] }> = {};
    PROVINCES.forEach((p) => {
      // Filter locations that belong to this province using search terms
      const locs = locations.filter((l) => {
        const c = cleanCity(l.city || '');
        return p.searchTerms.some((t) => c.includes(t) || t.includes(c));
      });
      // Only include provinces that have locations with valid coordinates
      const valid = locs.filter((l) => l.latitude && l.longitude);
      if (valid.length) {
        // Calculate average center point of all locations in this province
        const lat = valid.reduce((s, l) => s + Number(l.latitude), 0) / valid.length;
        const lng = valid.reduce((s, l) => s + Number(l.longitude), 0) / valid.length;
        map[p.name] = { locations: locs, coordinates: [lng, lat] };
      }
    });
    return map;
  }, [locations]);

  // ====================================================================
  // INITIALIZATION EFFECTS
  // ====================================================================
  // Initialize Mapbox access token (try Supabase first, fallback to hardcoded)
  useEffect(() => {
    (async () => {
      try {
        // Try to get token from Supabase edge function (preferred)
        const { data } = await supabase.functions.invoke('get-mapbox-token');
        const t =
          data?.token ||
          'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdзUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        mapboxgl.accessToken = t;
        setToken(t);
      } catch {
        // Fallback to hardcoded token if Supabase fails
        const t =
          'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdзUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        mapboxgl.accessToken = t;
        setToken(t);
      }
    })();
  }, []);

  // Load Bulgaria provinces GeoJSON data and create initial world mask
  useEffect(() => {
    (async () => {
      const raw = await fetch(GEOJSON_URL).then((r) => r.json());  // Fetch provinces GeoJSON
      const normalized = normalizeFC(raw);  // Clean and validate the data
      setProvincesGeo(normalized);

      // Create initial mask that shows all of Bulgaria (no province selected)
      const initialMask = buildProvinceDonutMask(normalized, null);
      setWorldMask(initialMask);
    })();
  }, []);

  // Update world mask when province selection changes (highlights selected province)
  useEffect(() => {
    if (!provincesGeo) return;
    const newMask = buildProvinceDonutMask(provincesGeo, selectedRawName);  // Create mask for selected province
    if (!newMask) return;
    setWorldMask(newMask);

    // Update the map layer with new mask geometry if map is ready
    if (map.current?.getSource('world-mask')) {
      (map.current.getSource('world-mask') as mapboxgl.GeoJSONSource).setData(newMask as any);
    }
  }, [selectedRawName, provincesGeo]);

  // Calculate Bulgaria's bounding box for zoom constraints (prevents zooming out of Bulgaria)
  useEffect(() => {
    if (!provincesGeo) return;
    try {
      const bb = turfBbox(provincesGeo) as [number, number, number, number];  // [west, south, east, north]
      bulgariaBoundsRef.current = new mapboxgl.LngLatBounds([bb[0], bb[1]], [bb[2], bb[3]]);
    } catch {}
  }, [provincesGeo]);

  // ====================================================================
  // MARKER MANAGEMENT FUNCTIONS
  // ====================================================================
  // Remove all location markers from the map (but keep city markers)
  const clearMarkers = () => {
    markers.current.forEach((m) => m.remove());  // Remove each marker from map
    markers.current = [];                        // Clear the markers array
    markerById.current = {};                     // Clear the lookup table
  };

  // Apply visual styling to marker bubbles (the colored circles)
  const styleMarker = (bubble: HTMLDivElement, isSelected: boolean, size = 28) => {
    bubble.style.width = `${size}px`;                              // Circular marker size
    bubble.style.height = `${size}px`;
    bubble.style.borderRadius = '50%';                          // Make it circular
    bubble.style.border = '2px solid #fff';                     // White border
    bubble.style.boxShadow = '0 2px 8px rgba(220,38,38,.35)';  // Red shadow effect
    bubble.style.cursor = 'pointer';                            // Show it's clickable
    bubble.style.transition = 'transform .12s ease';            // Smooth scaling animation
    bubble.style.transformOrigin = 'center';                    // Scale from center
    bubble.style.background = isSelected ? '#ef4444' : '#dc2626'; // Lighter red when selected
    bubble.style.transform = isSelected ? 'scale(1.22)' : 'scale(1)'; // Larger when selected
  };

  // Create a marker with both a circular bubble and text label
  const createLabeledMarkerRoot = (labelText: string) => {
    const root = document.createElement('div');  // Container for both label and bubble
    root.style.cssText = 'position:relative;width:0;height:0;pointer-events:auto;z-index:100;';
    
    const label = document.createElement('div');  // Text label showing below the marker
    label.textContent = labelText || '';
    label.style.cssText =
      'position:absolute;left:50%;bottom:8px;transform:translate(-50%,0);padding:2px 6px;border-radius:6px;font-size:12px;font-weight:700;color:#fff;background:rgba(0,0,0,.65);border:1px solid rgba(255,255,255,.14);white-space:nowrap;pointer-events:none;text-align:center;';
    root.appendChild(label);
    
    const bubble = document.createElement('div');  // Circular marker bubble
    bubble.style.position = 'absolute';
    bubble.style.left = '50%';
    bubble.style.top = '50%';
    bubble.style.transform = 'translate(-50%,-50%)';  // Center the bubble
    root.appendChild(bubble);
    return { root, bubble, label };
  };

  // ====================================================================
  // LOCATION MARKER FUNCTIONS
  // ====================================================================
  // Create markers for individual locations within a selected city
  const addLocationMarkers = (locs: any[]) => {
    if (!map.current) return;
    clearMarkers();  // Remove existing location markers
    locs.forEach((l) => {
      if (!l.latitude || !l.longitude) return;  // Skip locations without coordinates
      const { root, bubble } = createLabeledMarkerRoot(l.name || '');  // Create marker elements
      const isSel = selectedLocation && selectedLocation.id === l.id;  // Check if this location is selected
      styleMarker(bubble, !!isSel, 28);  // Apply styling based on selection state
      
      // Add hover effects to make markers interactive
      root.onmouseenter = () => {
        if (hoverTooltipRef.current) hoverTooltipRef.current.style.opacity = '0';  // Hide province tooltip
        if (!isSel) bubble.style.transform = 'scale(1.15)';  // Slight scale up on hover
        root.style.zIndex = '9999';  // Bring to front
      };
      root.onmouseleave = () => {
        if (!isSel) bubble.style.transform = 'scale(1)';  // Return to normal size
        root.style.zIndex = '100';
      };
      
      // Handle marker clicks to select individual locations
      root.addEventListener('click', (e) => {
        e.stopPropagation();  // Prevent map click events
        setSelectedLocation(l);
      });
      
      // Create Mapbox marker and add to map
      const mk = new mapboxgl.Marker({ element: root, anchor: 'center' })
        .setLngLat([+l.longitude, +l.latitude])
        .addTo(map.current!);
      markers.current.push(mk);  // Track marker for cleanup
      if (l.id != null) markerById.current[String(l.id)] = { marker: mk, bubble };  // Index by ID for quick access
    });
  };

  // Keep reference to all city markers so they're always visible (persistent across province selections)
  const allCityMarkersRef = useRef<mapboxgl.Marker[]>([]);

  // Create markers for all cities with their location counts
  // These markers remain visible at all zoom levels and show city names + location counts
  const addAllCityMarkers = () => {
    if (!map.current) return;
    
    // Clear existing all-city markers before creating new ones
    allCityMarkersRef.current.forEach((m) => m.remove());
    allCityMarkersRef.current = [];

    // Group all locations by city to calculate aggregated data
    const allCityMap: Record<string, any[]> = {};
    locations.forEach((l) => {
      const c = cleanCity(l.city || '');
      if (!c) return;
      (allCityMap[c] ||= []).push(l);  // Group locations by clean city name
    });

    // Create a marker for each city showing total location count
    Object.entries(allCityMap).forEach(([key, locs]) => {
      const valid = locs.filter((l) => l.latitude && l.longitude);  // Only use locations with coordinates
      if (!valid.length) return;
      
      // Calculate center point of all locations in this city
      const lat = valid.reduce((s, l) => s + Number(l.latitude), 0) / valid.length;
      const lng = valid.reduce((s, l) => s + Number(l.longitude), 0) / valid.length;

      const displayCity = formatCity(key);  // Format city name properly
      const labelText = `${displayCity} — ${locs.length} ${locs.length === 1 ? 'помещение' : 'помещения'}`;

      // Create larger marker for cities (34px vs 28px for locations)
      const { root, bubble, label } = createLabeledMarkerRoot(labelText);
      styleMarker(bubble, false, 34);  // Not selected by default, larger size
      label.style.fontSize = '13px';   // Slightly larger text for cities

      // Add hover effects for city markers
      root.onmouseenter = () => {
        bubble.style.transform = 'scale(1.12)';
        root.style.zIndex = '9999';
      };
      root.onmouseleave = () => {
        bubble.style.transform = 'scale(1)';
        root.style.zIndex = '100';
      };
      
      // Handle city marker clicks to drill down into specific cities
      root.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCitySelect(displayCity, locs);
      });

      const mk = new mapboxgl.Marker({ element: root, anchor: 'center' }).setLngLat([lng, lat]).addTo(map.current!);
      allCityMarkersRef.current.push(mk);  // Track for cleanup and visibility control
    });
  };

  // Update marker styling when location selection changes
  // This ensures selected markers are visually distinct (larger and different color)
  useEffect(() => {
    Object.entries(markerById.current).forEach(([id, { bubble }]) => {
      const isSel = selectedLocation && String(selectedLocation.id) === id;
      styleMarker(bubble, isSel, 28);  // Update styling based on selection state
    });
  }, [selectedLocation]);

  // ====================================================================
  // EVENT HANDLER FUNCTIONS
  // ====================================================================
  // Handle province selection (from clicking on province or province card)
  const handleProvinceSelect = useCallback(
    (provinceName: string, centerGuess?: [number, number], zoomOverride?: number) => {
      // Find province configuration by name (Bulgarian or English)
      const rec = PROVINCES.find((p) => p.name === provinceName) || PROVINCES.find((p) => p.nameEn === provinceName);
      if (!rec) return;

      // Filter all locations that belong to this province using search terms
      const locs = locations.filter((l) => {
        const c = cleanCity(l.city || '');
        return rec.searchTerms.some((t) => c.includes(t) || t.includes(c));
      });

      // Update state to reflect province selection
      setSelectedProvince(rec.name);          // Bulgarian display name
      setSelectedRawName(rec.nameEn ?? rec.name);  // Raw name for GeoJSON matching
      setSelectedCity(null);                  // Clear city selection
      setSelectedLocation(null);              // Clear location selection
      setProvinceLocations(locs);             // Store all locations in province

      // Group locations by city within this province
      const cityMap: Record<string, any[]> = {};
      locs.forEach((l) => {
        const c = cleanCity(l.city || '');
        if (!c) return;
        (cityMap[c] ||= []).push(l);
      });
      setProvinceCities(cityMap);

      // Keep city markers visible, only clear location-specific markers
      clearMarkers(); // Only clear location markers, not city markers

      // Animate to province view with appropriate zoom level
      const targetZoom = zoomOverride ?? 9;  // Default zoom for province view
      if (centerGuess) map.current?.flyTo({ center: centerGuess, zoom: targetZoom, pitch: 0, duration: 800 });
      else if (provinceData[rec.name])
        map.current?.flyTo({ center: provinceData[rec.name].coordinates, zoom: targetZoom, pitch: 0, duration: 800 });
    },
    [locations, provinceData]
  );

  // Handle city selection within a province (drill down to individual locations)
  const handleCitySelect = (city: string, locs: any[]) => {
    setSelectedCity(city);               // Update selected city
    setSelectedLocation(null);          // Clear any individual location selection
    setCityLocations(locs);             // Store locations in this city
    addLocationMarkers(locs);           // Add individual location markers
    
    // Hide the city marker for the selected city (since we're showing individual locations now)
    allCityMarkersRef.current.forEach(marker => {
      const element = marker.getElement();
      const label = element.querySelector('div') as HTMLDivElement;
      if (label && label.textContent?.includes(city)) {
        element.style.display = 'none';  // Hide the city marker
      }
    });
    
    // Calculate center point of locations and zoom in for detailed view
    const valid = locs.filter((l) => l.latitude && l.longitude);
    if (valid.length) {
      const lat = valid.reduce((s, l) => s + Number(l.latitude), 0) / valid.length;
      const lng = valid.reduce((s, l) => s + Number(l.longitude), 0) / valid.length;
      map.current?.flyTo({ center: [lng, lat], zoom: 12, pitch: 0, duration: 800 });  // Closer zoom for city view
    }
  };

  // Reset all selections and return to the full Bulgaria view
  const resetView = () => {
    // Clear all selections and return to initial state
    setSelectedProvince(null);
    setSelectedRawName(null);
    setSelectedCity(null);
    setSelectedLocation(null);
    setProvinceCities({});
    setProvinceLocations([]);
    setCityLocations([]);
    
    // Clear any hover states on provinces
    if (hoveredFeatureId.current !== null && map.current) {
      map.current.setFeatureState({ source: 'provinces', id: hoveredFeatureId.current }, { hover: false });
      hoveredFeatureId.current = null;
    }
    if (hoverTooltipRef.current) hoverTooltipRef.current.style.opacity = '0';
    
    clearMarkers(); // Only clear location markers, city markers stay visible
    
    // Show all city markers again (restore any that were hidden during city selection)
    allCityMarkersRef.current.forEach(marker => {
      marker.getElement().style.display = '';
    });
    
    // Return to full Bulgaria view
    if (bulgariaBoundsRef.current) {
      map.current?.fitBounds(bulgariaBoundsRef.current, { padding: 48, duration: 700 });
    } else {
      map.current?.flyTo({ center: [25.4858, 42.7339], zoom: 7, pitch: 0, bearing: 0, duration: 700 });
    }
  };

  // ====================================================================
  // MAP INITIALIZATION EFFECT
  // ====================================================================
  // Main effect that creates and configures the Mapbox map instance
  useEffect(() => {
    if (!mapEl.current || !token || !provincesGeo) return;  // Wait for all dependencies

    // Create the Mapbox map instance with initial configuration
    map.current = new mapboxgl.Map({
      container: mapEl.current,                    // DOM container element
      style: 'mapbox://styles/mapbox/dark-v11',    // Dark theme map style
      center: [25.4858, 42.7339],                  // Center on Bulgaria
      maxBounds: [
        [22.57, 41.23],  // SW corner [lng, lat] - constrain to Bulgaria area
        [28.60, 44.21]   // NE corner [lng, lat]
      ],
      zoom: 1,                                     // Start very zoomed out
      pitch: 0,                                    // No 3D tilt
      bearing: 0,                                  // North up
      renderWorldCopies: false,                    // Don't repeat the world
      maxZoom: 18,                                 // Allow very close zoom for location details
      minZoom: 1,                                  // Will be updated to fit Bulgaria
    });

    // Add zoom/pan controls to the map
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Create hover tooltip element for showing province names on hover
    const tooltip = document.createElement('div');
    tooltip.className = 'map-province-tooltip';
    tooltip.style.cssText = `
      position:absolute;pointer-events:none;z-index:30;
      background:rgba(0,0,0,.7);color:#fff;padding:6px 8px;
      border-radius:6px;font-size:12px;transform:translate(-50%,-120%);
      white-space:nowrap;opacity:0;transition:opacity .12s ease;
      border:1px solid rgba(255,255,255,.15);
      backdrop-filter:saturate(140%) blur(2px);
    `;
    hoverTooltipRef.current = tooltip;
    mapEl.current.appendChild(tooltip);  // Add to map container

    // Configure map layers and interactions when the map finishes loading
    map.current.on('load', () => {
      // Add provinces GeoJSON data as a source for rendering
      map.current!.addSource('provinces', { type: 'geojson', data: provincesGeo, generateId: true });

      // Add city markers immediately - these persist across all interactions
      addAllCityMarkers();

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
        'provinces-fill'
      );

      map.current!.on('mouseenter', 'provinces-fill', () => (map.current!.getCanvas().style.cursor = 'pointer'));
      map.current!.on('mouseleave', 'provinces-fill', () => (map.current!.getCanvas().style.cursor = ''));

      map.current!.on('mousemove', 'provinces-fill', (e: mapboxgl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
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

      map.current!.on('mouseleave', 'provinces-fill', () => {
        if (hoveredFeatureId.current !== null) {
          map.current!.setFeatureState({ source: 'provinces', id: hoveredFeatureId.current }, { hover: false });
        }
        hoveredFeatureId.current = null;
        if (hoverTooltipRef.current) hoverTooltipRef.current.style.opacity = '0';
      });

      map.current!.on('click', 'provinces-fill', (e) => {
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

      if (worldMask) {
        (map.current!.getSource('world-mask') as mapboxgl.GeoJSONSource).setData(worldMask as any);
      }

      // Fit and constrain the view so Bulgaria is always fully visible
      try {
        const bb = turfBbox(provincesGeo) as [number, number, number, number];
        bulgariaBoundsRef.current = new mapboxgl.LngLatBounds([bb[0], bb[1]], [bb[2], bb[3]]);
        const padding = 48;
        const cam = map.current!.cameraForBounds(bulgariaBoundsRef.current, { padding }) as any;
        const minZ = (cam && typeof cam.zoom === 'number') ? cam.zoom : map.current!.getZoom();
        map.current!.setMinZoom(minZ);
        map.current!.fitBounds(bulgariaBoundsRef.current, { padding, duration: 0 });

        const updateConstrainedBounds = () => {
          if (!map.current || !bulgariaBoundsRef.current) return;
          const view = map.current.getBounds();
          const vw = view.getEast() - view.getWest();
          const vh = view.getNorth() - view.getSouth();
          const bbounds = bulgariaBoundsRef.current;
          const minLng = bbounds.getWest() + vw / 2;
          const maxLng = bbounds.getEast() - vw / 2;
          const minLat = bbounds.getSouth() + vh / 2;
          const maxLat = bbounds.getNorth() - vh / 2;
          let sw: [number, number];
          let ne: [number, number];
          if (minLng > maxLng || minLat > maxLat) {
            // When viewport is larger than Bulgaria, use Bulgaria's full bounds instead of collapsing to a point
            sw = [bbounds.getWest(), bbounds.getSouth()];
            ne = [bbounds.getEast(), bbounds.getNorth()];
          } else {
            sw = [minLng, minLat];
            ne = [maxLng, maxLat];
          }
          map.current.setMaxBounds(new mapboxgl.LngLatBounds(sw, ne));
        };

        updateConstrainedBounds();
        map.current!.on('zoom', updateConstrainedBounds);
        map.current!.on('resize', updateConstrainedBounds);
      } catch {}
    });

    return () => {
      if (hoverTooltipRef.current) {
        hoverTooltipRef.current.remove();
        hoverTooltipRef.current = null;
      }
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      markerById.current = {};
      allCityMarkersRef.current.forEach((m) => m.remove());
      allCityMarkersRef.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, [token, provincesGeo]);

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
                    <Button
                      className="w-full"
                      onClick={() => navigate(`/locations/${selectedLocation.id}`)}
                    >
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
                      clearMarkers(); // Only clear location markers
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
