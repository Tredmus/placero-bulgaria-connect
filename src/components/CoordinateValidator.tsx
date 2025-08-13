import { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CoordinateValidatorProps {
  latitude: number | null;
  longitude: number | null;
  address: string;
  onCoordinatesChange: (lat: number, lng: number) => void;
}

export function CoordinateValidator({ 
  latitude, 
  longitude, 
  address, 
  onCoordinatesChange 
}: CoordinateValidatorProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [manualLat, setManualLat] = useState<string>(latitude?.toString() || '');
  const [manualLng, setManualLng] = useState<string>(longitude?.toString() || '');

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        setMapboxToken(data.token);
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
      }
    };
    fetchToken();
  }, []);

  // Initialize map when token is available
  useEffect(() => {
    if (!mapboxToken || !mapContainer.current || map.current) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: longitude && latitude ? [longitude, latitude] : [25.4858, 42.7339], // Bulgaria center
      zoom: longitude && latitude ? 15 : 7
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add click handler to set coordinates
    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      updateCoordinates(lat, lng);
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Update marker when coordinates change
  useEffect(() => {
    if (!map.current) return;
    
    // Remove existing marker
    if (marker.current) {
      marker.current.remove();
    }

    // Only add marker if we have valid coordinates
    if (latitude && longitude) {

      // Add new marker
      marker.current = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([longitude, latitude])
        .addTo(map.current);

      // Fly to location
      map.current.flyTo({
        center: [longitude, latitude],
        zoom: 15,
        duration: 1000
      });

      // Update manual inputs
      setManualLat(latitude.toFixed(6));
      setManualLng(longitude.toFixed(6));
    }
  }, [latitude, longitude]);

  const updateCoordinates = (lat: number, lng: number) => {
    onCoordinatesChange(lat, lng);
  };

  const handleManualUpdate = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      updateCoordinates(lat, lng);
    }
  };

  const centerOnBulgaria = () => {
    if (!map.current) return;
    map.current.flyTo({
      center: [25.4858, 42.7339],
      zoom: 7,
      duration: 1000
    });
  };

  if (!mapboxToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Coordinate Validator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading map...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Coordinate Validator
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Verify the location is accurate. Click on the map to adjust the position.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map container */}
        <div 
          ref={mapContainer} 
          className="w-full h-64 rounded-lg border"
          style={{ minHeight: '256px' }}
        />
        
        {/* Current coordinates display */}
        {latitude && longitude && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-sm">
              Current: <strong>{latitude.toFixed(6)}, {longitude.toFixed(6)}</strong>
            </span>
          </div>
        )}

        {/* Manual coordinate input */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="manual-lat">Latitude</Label>
            <Input
              id="manual-lat"
              type="number"
              step="0.000001"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              placeholder="42.7339"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-lng">Longitude</Label>
            <Input
              id="manual-lng"
              type="number"
              step="0.000001"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
              placeholder="25.4858"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            type="button" 
            onClick={handleManualUpdate}
            variant="outline"
          >
            Update from Manual Input
          </Button>
          <Button 
            type="button" 
            onClick={centerOnBulgaria}
            variant="outline"
          >
            Center on Bulgaria
          </Button>
        </div>

        {/* Address context */}
        {address && (
          <div className="text-sm text-muted-foreground">
            <strong>Address:</strong> {address}
          </div>
        )}
      </CardContent>
    </Card>
  );
}