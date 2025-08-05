import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useLocations } from '@/hooks/useLocations';
import { Button } from '@/components/ui/button';
import { RotateCcw, MapPin, Loader2 } from 'lucide-react';
import * as turf from '@turf/turf';

interface PlaceroMapProps {
  onProvinceSelect?: (provinceName: string) => void;
}

const PlaceroMap = ({ onProvinceSelect }: PlaceroMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [workspaceMarkers, setWorkspaceMarkers] = useState<mapboxgl.Marker[]>([]);
  const { locations } = useLocations({});

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
          const token = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
          setMapboxToken(token);
          mapboxgl.accessToken = token;
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        // Fallback token
        const token = 'pk.eyJ1IjoidHJlZG11cyIsImEiOiJjbWRucG12bzgwOXk4Mm1zYzZhdzUxN3RzIn0.xyTx89WCMVApexqZGNC8rw';
        setMapboxToken(token);
        mapboxgl.accessToken = token;
      }
    };
    
    fetchMapboxToken();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [25.4858, 42.7339], // Center of Bulgaria
      zoom: 6.1,
      pitch: 45,
      bearing: -17.6,
      antialias: true,
      maxZoom: 18,
      minZoom: 4
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setIsLoading(false);
      loadBulgariaProvinces();
    });

    map.current.on('error', (e) => {
      console.error('Map error:', e);
      setIsLoading(false);
    });

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [mapboxToken]);

  // Load Bulgaria provinces GeoJSON
  const loadBulgariaProvinces = async () => {
    if (!map.current) return;

    try {
      // Add provinces source
      map.current.addSource('provinces', {
        type: 'geojson',
        data: '/data/bg_provinces.geojson'
      });

      // Add province fill-extrusion layer
      map.current.addLayer({
        id: 'province-extrusion',
        type: 'fill-extrusion',
        source: 'provinces',
        paint: {
          'fill-extrusion-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            'hsl(158, 64%, 52%)',  // Placero green on hover
            'hsl(158, 64%, 42%)'   // Default Placero green
          ],
          'fill-extrusion-height': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            500000,
            0
          ],
          'fill-extrusion-opacity': 0.6
        }
      });

      // Add province outline
      map.current.addLayer({
        id: 'province-outline',
        type: 'line',
        source: 'provinces',
        paint: {
          'line-color': 'hsl(158, 64%, 62%)',
          'line-width': 2,
          'line-opacity': 0.8
        }
      });

      // Add click handler
      map.current.on('click', 'province-extrusion', handleProvinceClick);
      
      // Add hover effects
      map.current.on('mouseenter', 'province-extrusion', handleProvinceHover);
      map.current.on('mouseleave', 'province-extrusion', handleProvinceLeave);

      // Change cursor on hover
      map.current.on('mouseenter', 'province-extrusion', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'province-extrusion', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });

    } catch (error) {
      console.error('Error loading provinces:', error);
    }
  };

  let hoveredProvinceId: string | null = null;

  const handleProvinceHover = (e: any) => {
    if (!map.current) return;
    
    if (e.features.length > 0) {
      if (hoveredProvinceId !== null) {
        map.current.setFeatureState(
          { source: 'provinces', id: hoveredProvinceId },
          { hover: false }
        );
      }
      hoveredProvinceId = e.features[0].id;
      map.current.setFeatureState(
        { source: 'provinces', id: hoveredProvinceId },
        { hover: true }
      );
    }
  };

  const handleProvinceLeave = () => {
    if (!map.current) return;
    
    if (hoveredProvinceId !== null) {
      map.current.setFeatureState(
        { source: 'provinces', id: hoveredProvinceId },
        { hover: false }
      );
    }
    hoveredProvinceId = null;
  };

  const handleProvinceClick = async (e: any) => {
    if (!map.current) return;

    const feature = e.features[0];
    const provinceName = feature.properties.name;
    
    // Calculate center of the province
    const center = turf.center(feature).geometry.coordinates as [number, number];

    // Elevate the clicked province
    map.current.setPaintProperty('province-extrusion', 'fill-extrusion-height', [
      'case',
      ['==', ['get', 'name'], provinceName],
      500000,
      0
    ]);

    // Zoom to province
    map.current.flyTo({ 
      center, 
      zoom: 8,
      pitch: 60,
      duration: 1500
    });

    setSelectedProvince(provinceName);
    onProvinceSelect?.(provinceName);

    // Fetch workspaces in this province
    await fetchWorkspacesInProvince(provinceName);
  };

  const fetchWorkspacesInProvince = async (provinceName: string) => {
    // Clear existing workspace markers
    removeAllMarkers();

    // Filter locations that match the province
    const provinceLocations = locations.filter(location => {
      if (!location.city) return false;
      
      // Simple matching - you can improve this with better province-city mapping
      const cityLower = location.city.toLowerCase();
      const provinceLower = provinceName.toLowerCase();
      
      return cityLower.includes(provinceLower) || 
             provinceLower.includes(cityLower.split(' ')[0]);
    });

    // Add markers for locations in this province
    addWorkspaceMarkers(provinceLocations);
  };

  const addWorkspaceMarkers = (workspaces: any[]) => {
    if (!map.current) return;

    const newMarkers: mapboxgl.Marker[] = [];

    workspaces.forEach(workspace => {
      if (!workspace.latitude || !workspace.longitude) return;

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'workspace-marker';
      el.style.cssText = `
        width: 20px;
        height: 20px;
        background: linear-gradient(135deg, hsl(158, 64%, 52%) 0%, hsl(158, 64%, 42%) 100%);
        border: 2px solid hsl(var(--background));
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        transition: all 0.3s ease;
        transform-origin: center;
      `;

      // Add hover effect
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)';
        el.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.6)';
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
      });

      // Create popup
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        className: 'workspace-popup'
      }).setHTML(`
        <div class="p-3 min-w-[200px]">
          <h3 class="font-semibold text-base mb-2">${workspace.name}</h3>
          <p class="text-sm text-muted-foreground mb-2">${workspace.address}</p>
          ${workspace.price_day ? `<p class="text-sm font-medium">От ${workspace.price_day}лв/ден</p>` : ''}
        </div>
      `);

      // Create marker
      const marker = new mapboxgl.Marker(el)
        .setLngLat([parseFloat(workspace.longitude), parseFloat(workspace.latitude)])
        .setPopup(popup)
        .addTo(map.current!);

      newMarkers.push(marker);
    });

    setWorkspaceMarkers(newMarkers);
  };

  const removeAllMarkers = () => {
    workspaceMarkers.forEach(marker => marker.remove());
    setWorkspaceMarkers([]);
  };

  const resetView = () => {
    if (!map.current) return;

    // Reset province elevation
    map.current.setPaintProperty('province-extrusion', 'fill-extrusion-height', 0);

    // Reset camera
    map.current.flyTo({
      center: [25.4858, 42.7339],
      zoom: 6.1,
      pitch: 45,
      bearing: -17.6,
      duration: 1500
    });

    setSelectedProvince(null);
    removeAllMarkers();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-card/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-lg font-medium">Loading premium map...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          Discover Bulgaria's Coworking Revolution
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Click on any province to explore premium workspaces in immersive 3D
        </p>
      </div>

      {/* Map Container */}
      <div className="relative bg-card/30 rounded-xl overflow-hidden shadow-2xl border border-border/50">
        <div ref={mapContainer} className="w-full h-[600px]" />
        
        {/* Reset Button */}
        {selectedProvince && (
          <div className="absolute top-6 left-6 space-y-3">
            <div className="bg-card/95 backdrop-blur-md rounded-lg p-4 shadow-lg border border-border/50">
              <div className="flex items-center gap-3 mb-3">
                <MapPin className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-semibold text-lg">{selectedProvince}</h3>
                  <p className="text-sm text-muted-foreground">
                    {workspaceMarkers.length} coworking spaces
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={resetView}
                className="w-full"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Back to overview
              </Button>
            </div>
          </div>
        )}

        {/* Map Attribution */}
        <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-card/80 backdrop-blur-sm rounded px-2 py-1">
          Powered by Mapbox
        </div>
      </div>

      {/* Interactive Hint */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          💡 Tip: Hover over provinces to see them glow, click to explore workspaces in stunning 3D
        </p>
      </div>

      <style>{`
        .workspace-popup .mapboxgl-popup-content {
          background: hsl(var(--card));
          color: hsl(var(--card-foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        
        .workspace-popup .mapboxgl-popup-tip {
          border-top-color: hsl(var(--card));
        }
        
        .workspace-marker {
          will-change: transform;
        }
      `}</style>
    </div>
  );
};

export default PlaceroMap;