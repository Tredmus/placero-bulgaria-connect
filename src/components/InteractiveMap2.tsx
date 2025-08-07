import React, { useEffect, useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import union from '@turf/union';

const GEOJSON_URL = '/data/bg_provinces.geojson';

const INITIAL_VIEW_STATE = {
  longitude: 25.4858,
  latitude: 42.7339,
  zoom: 6.5,
  pitch: 30,
  bearing: 0,
  transitionDuration: 0
};

export default function InteractiveMap() {
  const { locations } = useLocations();
  const [provinces, setProvinces] = useState(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [cityPoints, setCityPoints] = useState([]);
  const [locationPoints, setLocationPoints] = useState([]);
  const [elevationMap, setElevationMap] = useState({});
  const [mapboxToken, setMapboxToken] = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data } = await supabase.functions.invoke('get-mapbox-token');
        const token = data?.token || 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        setMapboxToken(token);
        mapboxgl.accessToken = token;
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
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      pitch: viewState.pitch,
      bearing: viewState.bearing,
      interactive: false
    });

    mapRef.current.on('load', () => {
      if (!mapRef.current || !provinces) return;

      mapRef.current.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14
      });

      mapRef.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

      mapRef.current.addSource('all-provinces', {
        type: 'geojson',
        data: provinces
      });

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

      mapRef.current.addLayer({
        id: 'world-mask-layer',
        type: 'fill-extrusion',
        source: 'world-mask',
        paint: {
          'fill-extrusion-color': '#1a1a2e',
          'fill-extrusion-height': 100000,
          'fill-extrusion-opacity': 1
        }
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapboxToken, provinces]);

  useEffect(() => {
    if (!mapRef.current || !provinces) return;
    if (!selectedProvince) {
      const fullMask = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]]
        }
      };
      mapRef.current.getSource('world-mask').setData(fullMask);
      return;
    }

    const selectedFeature = provinces.features.find(f => f.properties.name_en === selectedProvince || f.properties.name === selectedProvince);
    if (!selectedFeature) return;

    const worldBounds = [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]];
    const maskWithHole = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [worldBounds[0], ...selectedFeature.geometry.type === 'Polygon' ? selectedFeature.geometry.coordinates : selectedFeature.geometry.coordinates.flat()]
      }
    };
    mapRef.current.getSource('world-mask').setData(maskWithHole);
  }, [selectedProvince, provinces]);

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

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then(data => setProvinces(data));
  }, []);

  useEffect(() => {
    if (selectedProvince) {
      const filtered = locations.filter(l => l.city === selectedProvince && l.latitude && l.longitude);
      const cities = {};
      filtered.forEach(l => {
        const city = l.city || '';
        if (!cities[city]) cities[city] = [];
        cities[city].push(l);
      });
      setCityPoints(
        Object.entries(cities).map(([city, pts]) => {
          const ptsArray = pts as any[];
          const avg = ptsArray.reduce((acc, p) => {
            acc.longitude += parseFloat(p.longitude);
            acc.latitude += parseFloat(p.latitude);
            return acc;
          }, { longitude: 0, latitude: 0 });
          avg.longitude /= ptsArray.length;
          avg.latitude /= ptsArray.length;
          return { position: [avg.longitude, avg.latitude], count: ptsArray.length, cityName: city, pts: ptsArray };
        })
      );
      setLocationPoints(filtered.map(l => ({ position: [parseFloat(String(l.longitude || '0')), parseFloat(String(l.latitude || '0'))], data: l })));
    } else {
      setCityPoints([]);
      setLocationPoints([]);
    }
  }, [selectedProvince, locations]);

  const onViewStateChange = useCallback((info) => {
    setViewState(info.viewState);
  }, []);

  const animateElevation = (name) => {
    // Reset all provinces to base elevation first
    setElevationMap({ [name]: 20000 });
  };

  const onClickProvince = useCallback((info) => {
    if (info.object?.properties) {
      const name = info.object.properties.name_en || info.object.properties.name;
      setSelectedProvince(name);
      animateElevation(name);
      const coordinates = info.object.properties.centroid || info.object.geometry.coordinates[0][0];
      setViewState(prev => ({ ...prev, longitude: Number(coordinates[0]), latitude: Number(coordinates[1]), zoom: 8, pitch: 45, transitionDuration: 1000 }));
    }
  }, []);

  const layers = [];

  if (selectedProvince && provinces && mapboxToken) {
    const selectedFeature = provinces.features.find(f => f.properties.name_en === selectedProvince || f.properties.name === selectedProvince);
    if (selectedFeature) {
      layers.push(
        new TileLayer({
          id: 'raised-map-tiles',
          data: `https://a.tiles.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg?access_token=${mapboxToken}`,
          minZoom: 0,
          maxZoom: 19,
          tileSize: 256,
          renderSubLayers: props => new GeoJsonLayer({
            id: `${props.id}-mask`,
            data: selectedFeature,
            extruded: true,
            getElevation: () => 20000,
            getFillColor: [255, 255, 255, 255],
            getLineColor: [0, 0, 0],
            lineWidthMinPixels: 0
          })
        })
      );
    }
  }

  if (provinces) {
    layers.push(new GeoJsonLayer({
      id: 'provinces',
      data: provinces,
      pickable: true,
      filled: true,
      stroked: true,
      wireframe: true,
      extruded: true,
      getLineColor: [0, 0, 0, 255],
      getLineWidth: () => 1,
      lineWidthMinPixels: 1,
      getElevation: f => elevationMap[f.properties.name_en] || elevationMap[f.properties.name] || 10000,
      getFillColor: f => {
        const isSelected = f.properties.name_en === selectedProvince || f.properties.name === selectedProvince;
        return isSelected ? [34, 197, 94, 120] : [16, 185, 129, 80];
      },
      onClick: onClickProvince,
      updateTriggers: {
        getElevation: elevationMap,
        getFillColor: selectedProvince
      }
    }));
  }

  if (viewState.zoom >= 8 && cityPoints.length > 0) {
    layers.push(new ScatterplotLayer({
      id: 'cities',
      data: cityPoints,
      pickable: true,
      getPosition: d => d.position,
      getRadius: d => Math.sqrt(d.count) * 5000,
      getFillColor: [255, 140, 0],
      onClick: info => {
        if (info.object) {
          setViewState(prev => ({ ...prev, longitude: info.object.position[0], latitude: info.object.position[1], zoom: 12, transitionDuration: 1000 }));
        }
      }
    }));
  }

  if (viewState.zoom >= 12 && locationPoints.length > 0) {
    layers.push(new ScatterplotLayer({
      id: 'locations',
      data: locationPoints,
      pickable: true,
      getPosition: d => d.position,
      getRadius: 2000,
      getFillColor: [255, 0, 128],
      onClick: info => info.object && alert(info.object.data.name)
    }));
  }

  if (!mapboxToken) {
    return (
      <div style={{ width: '100%', height: '600px', position: 'relative' }} className="flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }} />
      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={onViewStateChange}
        style={{ width: '100%', height: '100%', position: 'absolute', top: '0px', left: '0px', zIndex: '1' }}
        getTooltip={({ object }) => object?.properties?.name_en || object?.properties?.name || null}
      />
    </div>
  );
}
