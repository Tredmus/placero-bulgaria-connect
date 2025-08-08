import React, { useEffect, useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin } from 'lucide-react';

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
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (data?.token) {
          setMapboxToken(data.token);
          mapboxgl.accessToken = data.token;
        } else {
          // Fallback token
          const token = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
          setMapboxToken(token);
          mapboxgl.accessToken = token;
        }
      } catch (error) {
        console.log('Edge function not available, using fallback token');
        const token = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG16bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        setMapboxToken(token);
        mapboxgl.accessToken = token;
      }
    };
    
    fetchMapboxToken();
  }, []);

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainerRef.current || !mapboxToken || !provinces) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      pitch: viewState.pitch,
      bearing: viewState.bearing,
      interactive: false // DeckGL will handle interactions
    });

    mapRef.current.on('load', () => {
      if (!mapRef.current || !provinces) return;

      // Add all provinces as a source for potential masking
      mapRef.current.addSource('all-provinces', {
        type: 'geojson',
        data: provinces
      });

      // Add world mask source (starts with full coverage to hide everything)
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

      // Add mask layer that covers everything outside selected province
      mapRef.current.addLayer({
        id: 'world-mask-layer',
        type: 'fill',
        source: 'world-mask',
        paint: {
          'fill-color': '#1a1a2e',
          'fill-opacity': 1
        }
      });

      // Set satellite layer elevation to appear below 3D provinces
      const layers = mapRef.current.getStyle().layers;
      const satelliteLayer = layers?.find(layer => layer.type === 'raster');
      
      if (satelliteLayer) {
        // Add custom properties to position satellite layer below provinces
        mapRef.current.setPaintProperty(satelliteLayer.id, 'raster-opacity', 0.8);
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapboxToken, provinces]);

  // Update mask when selected province changes
  useEffect(() => {
    if (!mapRef.current || !provinces) return;

    if (!selectedProvince) {
      // Hide all satellite imagery when no province is selected
      if (mapRef.current.getSource('world-mask')) {
        const fullMask = {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'Polygon' as const,
            coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]]
          }
        };

        (mapRef.current.getSource('world-mask') as mapboxgl.GeoJSONSource).setData(fullMask);
      }
      return;
    }

    // Find the selected province feature
    const selectedFeature = provinces.features.find(
      (feature: any) => 
        feature.properties.name_en === selectedProvince || 
        feature.properties.name === selectedProvince
    );

    if (!selectedFeature) return;

    // Create world bounds with selected province cut out
    const worldBounds = [
      [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
    ];

    const maskWithHole = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [worldBounds[0], ...selectedFeature.geometry.coordinates]
      }
    };

    // Update the mask to show only the selected province
    (mapRef.current.getSource('world-mask') as mapboxgl.GeoJSONSource).setData(maskWithHole);
  }, [selectedProvince, provinces]);

  // Sync Mapbox map with DeckGL viewState
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
    if (selectedProvince && !selectedCity) {
      // Group locations by city within the selected province
      const provinceCities: Record<string, any[]> = {};
      locations.forEach(l => {
        if (l.latitude && l.longitude) {
          const city = l.city || 'Unknown';
          if (!provinceCities[city]) provinceCities[city] = [];
          provinceCities[city].push(l);
        }
      });
      
      setCityPoints(
        Object.entries(provinceCities).map(([city, pts]) => {
          const avg = pts.reduce((acc, p) => {
            acc.longitude += typeof p.longitude === 'string' ? parseFloat(p.longitude) : p.longitude;
            acc.latitude += typeof p.latitude === 'string' ? parseFloat(p.latitude) : p.latitude;
            return acc;
          }, { longitude: 0, latitude: 0 });
          avg.longitude /= pts.length;
          avg.latitude /= pts.length;
          return { position: [avg.longitude, avg.latitude], count: pts.length, cityName: city, locations: pts };
        })
      );
      setLocationPoints([]);
    } else if (selectedCity) {
      // Show individual locations for selected city
      const cityLocations = locations.filter(l => 
        l.city === selectedCity && l.latitude && l.longitude
      );
      setLocationPoints(cityLocations.map(l => ({ 
        position: [
          typeof l.longitude === 'string' ? parseFloat(l.longitude) : l.longitude, 
          typeof l.latitude === 'string' ? parseFloat(l.latitude) : l.latitude
        ], 
        data: l 
      })));
      setCityPoints([]);
    } else {
      setCityPoints([]);
      setLocationPoints([]);
    }
  }, [selectedProvince, selectedCity, locations]);

  const onViewStateChange = useCallback((info: any) => {
    setViewState(info.viewState);
  }, []);

  const onClickProvince = useCallback((info: any) => {
    if (info.object && info.object.properties) {
      const name = info.object.properties.name_en || info.object.properties.name;
      setSelectedProvince(name);
      setSelectedCity(null);
      setSelectedLocation(null);

      // Calculate province center
      const bounds = info.object.geometry.coordinates[0];
      const center = bounds.reduce((acc: any, coord: any) => {
        acc[0] += coord[0];
        acc[1] += coord[1];
        return acc;
      }, [0, 0]);
      center[0] /= bounds.length;
      center[1] /= bounds.length;

      setViewState(prev => ({ 
        ...prev, 
        longitude: center[0], 
        latitude: center[1], 
        zoom: 8, 
        pitch: 0, 
        transitionDuration: 600 
      }));
    }
  }, []);

  const onClickCity = useCallback((info: any) => {
    if (info.object) {
      setSelectedCity(info.object.cityName);
      setSelectedLocation(null);
      setViewState(prev => ({ 
        ...prev, 
        longitude: info.object.position[0], 
        latitude: info.object.position[1], 
        zoom: 12, 
        pitch: 0, 
        transitionDuration: 600 
      }));
    }
  }, []);

  const onClickLocation = useCallback((info: any) => {
    if (info.object) {
      setSelectedLocation(info.object.data);
    }
  }, []);

  const layers = [];

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
        getLineColor: [255, 255, 255, 180],
        getLineWidth: () => 2,
        lineWidthMinPixels: 1,
        getFillColor: f => {
          const isSelected = f.properties.name_en === selectedProvince || f.properties.name === selectedProvince;
          return isSelected ? [34, 197, 94, 0] : [16, 185, 129, 230];
        },
        onClick: onClickProvince,
        updateTriggers: {
          getFillColor: selectedProvince
        }
      })
    );
  }

  // City markers (when province is selected but no city is selected)
  if ((selectedProvince && !selectedCity) || viewState.zoom >= 8) {
    if (cityPoints.length > 0) {
      layers.push(
        new ScatterplotLayer({
          id: 'cities',
          data: cityPoints,
          pickable: true,
          getPosition: d => d.position,
          getRadius: d => Math.max(8000, Math.sqrt(d.count) * 3000),
          getFillColor: [59, 130, 246, 200],
          getLineColor: [255, 255, 255, 255],
          getLineWidth: 3,
          stroked: true,
          onClick: onClickCity
        })
      );
    }
  }

  // Location markers (when city is selected or zoomed in enough)
  if ((selectedCity || viewState.zoom >= 12) && locationPoints.length > 0) {
    layers.push(
      new ScatterplotLayer({
        id: 'locations',
        data: locationPoints,
        pickable: true,
        getPosition: d => d.position,
        getRadius: 4000,
        getFillColor: [239, 68, 68, 220],
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 2,
        stroked: true,
        onClick: onClickLocation
      })
    );
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
      <div 
        ref={mapContainerRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'absolute',
          top: '0',
          left: '0',
          zIndex: 0
        }}
      />
      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={onViewStateChange}
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'absolute',
          top: '0',
          left: '0',
          zIndex: '1'
        }}
        getTooltip={({ object, layer }) => {
          if (layer?.id === 'provinces' && object?.properties) {
            return object.properties.name_en || object.properties.name;
          }
          if (layer?.id === 'cities' && object) {
            return `${object.cityName}: ${object.count} locations`;
          }
          if (layer?.id === 'locations' && object?.data) {
            return object.data.name;
          }
          return null;
        }}
      />
      
      {/* Location Info Card */}
      {selectedLocation && (
        <Card className="absolute top-4 right-4 w-80 max-w-sm bg-background/95 backdrop-blur-sm shadow-lg border z-10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">{selectedLocation.name}</h3>
                </div>
                
                {selectedLocation.image_url && (
                  <img 
                    src={selectedLocation.image_url} 
                    alt={selectedLocation.name}
                    className="w-full h-24 object-cover rounded-md mb-2"
                  />
                )}
                
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-medium">{selectedLocation.rating || 'N/A'}</span>
                  </div>
                  {selectedLocation.price && (
                    <Badge variant="secondary" className="text-xs">
                      ${selectedLocation.price}/night
                    </Badge>
                  )}
                </div>
                
                {selectedLocation.description && (
                  <p className="text-xs text-muted-foreground line-clamp-3 mb-2">
                    {selectedLocation.description}
                  </p>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{selectedLocation.city}</span>
                  <button 
                    onClick={() => setSelectedLocation(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}