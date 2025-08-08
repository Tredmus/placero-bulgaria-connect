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

const INITIAL_VIEW_STATE = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 6.5,
  pitch: 0,
  bearing: 0,
  transitionDuration: 0
};

export default function InteractiveMap() {
  const { locations } = useLocations();
  const [provinces, setProvinces] = useState<any>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [cityPoints, setCityPoints] = useState<any[]>([]);
  const [locationPoints, setLocationPoints] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const nationalCenterRef = useRef<{ lng: number; lat: number; zoom: number } | null>(null);

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

  useEffect(() => {
    if (!mapContainerRef.current || !mapboxToken || !provinces) return;
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      pitch: viewState.pitch,
      bearing: viewState.bearing,
      interactive: false
    });

    mapRef.current.on('load', () => {
      if (!mapRef.current || !provinces) return;
      if (!mapRef.current.getSource('all-provinces')) {
        mapRef.current.addSource('all-provinces', { type: 'geojson', data: provinces });
      }
      if (!mapRef.current.getSource('world-mask')) {
        mapRef.current.addSource('world-mask', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] } }
        });
      }
      if (!mapRef.current.getLayer('world-mask-layer')) {
        mapRef.current.addLayer({ id: 'world-mask-layer', type: 'fill', source: 'world-mask', paint: { 'fill-color': '#020817', 'fill-opacity': 1 } });
      }
      const layers = mapRef.current.getStyle().layers;
      const satelliteLayer = layers?.find(layer => layer.type === 'raster');
      if (satelliteLayer) {
        mapRef.current.setPaintProperty(satelliteLayer.id, 'raster-opacity', 0.8);
      }
      setMaskToAllProvinces();
    });

    return () => {
      clearMarkers();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapboxToken, provinces]);

  const setMaskToAllProvinces = useCallback(() => {
    if (!mapRef.current || !provinces) return;
    const worldRing: [number, number][] = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
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
    const maskWithAllProvinceHoles = { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [worldRing, ...holes] } };
    (mapRef.current.getSource('world-mask') as mapboxgl.GeoJSONSource)?.setData(maskWithAllProvinceHoles);
  }, [provinces]);

  useEffect(() => {
    setMaskToAllProvinces();
  }, [setMaskToAllProvinces, selectedProvince, provinces]);

  useEffect(() => {
    if (mapRef.current && viewState) {
      mapRef.current.jumpTo({ center: [viewState.longitude, viewState.latitude], zoom: viewState.zoom, pitch: viewState.pitch, bearing: viewState.bearing });
    }
  }, [viewState]);

  useEffect(() => {
    fetch(GEOJSON_URL).then(res => res.json()).then(data => setProvinces(data));
  }, []);

  useEffect(() => {
    if (!provinces) return;
    const [minX, minY, maxX, maxY] = bbox(provinces);
    const centerLng = (minX + maxX) / 2;
    const centerLat = (minY + maxY) / 2;
    const zoom = 6.5;
    nationalCenterRef.current = { lng: centerLng, lat: centerLat, zoom };
    setViewState(prev => ({ ...prev, longitude: centerLng, latitude: centerLat, zoom, pitch: 0, bearing: 0, transitionDuration: 0 }));
  }, [provinces]);

  // Clear all markers
  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
  };

  // Create styled city markers with modern design
  const createCityMarker = (cityName: string, count: number) => {
    const el = document.createElement('div');
    el.className = 'city-marker';
    el.style.cssText = `
      position: relative;
      cursor: pointer;
      transform-origin: center bottom;
      transition: all 0.3s ease;
      z-index: 100;
    `;
    
    el.innerHTML = `
      <div style="
        background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-foreground)));
        border: 2px solid hsl(var(--background));
        border-radius: 12px;
        padding: 8px 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        min-width: 80px;
        text-align: center;
        position: relative;
        backdrop-filter: blur(8px);
      ">
        <div style="
          color: hsl(var(--primary-foreground));
          font-weight: bold;
          font-size: 12px;
          line-height: 1.2;
        ">${cityName}</div>
        <div style="
          color: hsl(var(--muted-foreground));
          font-size: 10px;
          margin-top: 2px;
        ">${count} location${count > 1 ? 's' : ''}</div>
        <div style="
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 8px solid hsl(var(--primary));
        "></div>
      </div>
    `;
    
    el.addEventListener('mouseenter', () => {
      el.style.transform = 'scale(1.1) translateY(-4px)';
    });
    
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'scale(1) translateY(0)';
    });
    
    return el;
  };

  // Create styled location markers
  const createLocationMarker = (location: any) => {
    const el = document.createElement('div');
    el.className = 'location-marker';
    el.style.cssText = `
      width: 24px;
      height: 24px;
      background: hsl(var(--primary));
      border: 2px solid hsl(var(--background));
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      z-index: 50;
    `;
    
    el.addEventListener('mouseenter', () => {
      el.style.transform = 'scale(1.3)';
      el.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.4)';
    });
    
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'scale(1)';
      el.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
    });
    
    return el;
  };

  // Group locations by city and create city points
  useEffect(() => {
    if (selectedProvince) {
      const filtered = locations.filter(l => {
        if (!l.city || !l.latitude || !l.longitude) return false;
        const cityName = l.city.toLowerCase();
        const provinceName = selectedProvince.toLowerCase();
        return cityName.includes(provinceName) || provinceName.includes(cityName);
      });
      
      const cities: Record<string, any[]> = {};
      filtered.forEach(l => {
        const cityKey = l.city.split(',')[0].trim(); // Take first part before comma
        if (!cities[cityKey]) cities[cityKey] = [];
        cities[cityKey].push(l);
      });
      
      setCityPoints(Object.entries(cities).map(([city, pts]) => {
        const avg = pts.reduce((acc, p) => {
          acc.longitude += typeof p.longitude === 'string' ? parseFloat(p.longitude) : p.longitude;
          acc.latitude += typeof p.latitude === 'string' ? parseFloat(p.latitude) : p.latitude;
          return acc;
        }, { longitude: 0, latitude: 0 });
        avg.longitude /= pts.length;
        avg.latitude /= pts.length;
        return { position: [avg.longitude, avg.latitude], count: pts.length, cityName: city, pts };
      }));
    } else {
      setCityPoints([]);
    }
  }, [selectedProvince, locations]);

  // Update location points when city is selected
  useEffect(() => {
    if (selectedCity) {
      const cityData = cityPoints.find(c => c.cityName === selectedCity);
      if (cityData) {
        setLocationPoints(cityData.pts.map((l: any) => ({ 
          position: [
            typeof l.longitude === 'string' ? parseFloat(l.longitude) : l.longitude, 
            typeof l.latitude === 'string' ? parseFloat(l.latitude) : l.latitude
          ], 
          data: l 
        })));
      }
    } else {
      setLocationPoints([]);
    }
  }, [selectedCity, cityPoints]);

  // Add markers based on zoom level and selections
  useEffect(() => {
    if (!mapRef.current) return;
    
    clearMarkers();
    
    // Show city markers when province is selected but city is not
    if (selectedProvince && !selectedCity && cityPoints.length > 0) {
      cityPoints.forEach(cityPoint => {
        const el = createCityMarker(cityPoint.cityName, cityPoint.count);
        
        el.addEventListener('click', () => {
          setSelectedCity(cityPoint.cityName);
          setViewState(prev => ({ 
            ...prev, 
            longitude: cityPoint.position[0], 
            latitude: cityPoint.position[1], 
            zoom: 12, 
            transitionDuration: 800,
            transitionInterpolator: new FlyToInterpolator({ speed: 2 })
          }));
        });
        
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(cityPoint.position)
          .addTo(mapRef.current!);
        
        markersRef.current.push(marker);
      });
    }
    
    // Show location markers when city is selected
    if (selectedCity && locationPoints.length > 0) {
      locationPoints.forEach(locationPoint => {
        const el = createLocationMarker(locationPoint.data);
        
        el.addEventListener('click', () => {
          setSelectedLocation(locationPoint.data);
        });
        
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(locationPoint.position)
          .addTo(mapRef.current!);
        
        markersRef.current.push(marker);
      });
    }
  }, [selectedProvince, selectedCity, cityPoints, locationPoints]);

  const onViewStateChange = useCallback((info: any) => {
    setViewState(info.viewState);
  }, []);

  const onClickProvince = useCallback((info: any) => {
    if (info.object && info.object.properties) {
      const name = info.object.properties.name_en || info.object.properties.name;
      if (selectedProvince === name) {
        setSelectedProvince(null);
        setSelectedCity(null);
        setSelectedLocation(null);
        const fallback = nationalCenterRef.current || { lng: 25.4858, lat: 42.7339, zoom: 6.5 };
        setViewState(prev => ({ ...prev, longitude: fallback.lng, latitude: fallback.lat, zoom: fallback.zoom, pitch: 0, transitionDuration: 550, transitionInterpolator: new FlyToInterpolator({ speed: 2.5 }) }));
        return;
      }
      setSelectedProvince(name);
      setSelectedCity(null);
      setSelectedLocation(null);
      const c = centroid(info.object);
      const [lng, lat] = c.geometry.coordinates as [number, number];
      setViewState(prev => ({ ...prev, longitude: lng, latitude: lat, zoom: 8, pitch: 0, transitionDuration: 550, transitionInterpolator: new FlyToInterpolator({ speed: 2.5 }) }));
    }
  }, [selectedProvince]);

  const layers = [];
  if (provinces) {
    layers.push(new GeoJsonLayer({
      id: 'provinces',
      data: provinces,
      pickable: true,
      filled: true,
      stroked: true,
      wireframe: true,
      extruded: false,
      getLineColor: [255, 255, 255, 255] as [number, number, number, number],
      getLineWidth: () => 2,
      lineWidthMinPixels: 2,
      getElevation: 0,
      getFillColor: (f: any) => {
        const isSelected = f.properties.name_en === selectedProvince || f.properties.name === selectedProvince;
        return isSelected ? [0, 0, 0, 0] as [number, number, number, number] : [16, 185, 129, 200] as [number, number, number, number];
      },
      onClick: onClickProvince,
      updateTriggers: { getFillColor: selectedProvince }
    }));
  }

  if (!mapboxToken) {
    return (<div style={{ width: '100%', height: '600px', position: 'relative' }} className="flex items-center justify-center bg-muted"><p className="text-muted-foreground">Loading map...</p></div>);
  }

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: '0', left: '0', zIndex: 0 }} />
      <DeckGL viewState={viewState} controller={{ dragRotate: false }} layers={layers} onViewStateChange={onViewStateChange} style={{ width: '100%', height: '100%', position: 'absolute', top: '0', left: '0', zIndex: '1' }} getTooltip={({ object }) => { if (object && object.properties) { return object.properties.name_en || object.properties.name; } return null; }} />
    </div>
  );
}
