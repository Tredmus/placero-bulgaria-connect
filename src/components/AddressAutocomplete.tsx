import { useState, useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, coordinates?: { lat: number; lng: number }) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

interface MapboxSuggestion {
  place_name: string;
  center: [number, number];
  properties: {
    short_code?: string;
  };
  strategy?: string;
  accuracy_score?: number;
  coordinates_display?: string;
}

const AddressAutocomplete = ({ 
  value, 
  onChange, 
  label = "Address", 
  placeholder = "Enter address...",
  className = ""
}: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const searchAddress = async () => {
      if (value.length < 3) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('geocode-address', {
          body: { query: value }
        });

        if (error) throw error;
        
        if (data?.features) {
          setSuggestions(data.features);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(searchAddress, 300);
    return () => clearTimeout(timeoutId);
  }, [value]);

  const handleSelectSuggestion = (suggestion: MapboxSuggestion) => {
    onChange(suggestion.place_name, {
      lat: suggestion.center[1],
      lng: suggestion.center[0]
    });
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <div className={`relative ${className}`}>
      {label && <Label htmlFor="address-input">{label}</Label>}
      <div className="relative">
        <Input
          id="address-input"
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          className="pl-10"
        />
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="p-3 hover:bg-secondary cursor-pointer border-b last:border-b-0"
            >
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {suggestion.place_name}
                  </p>
                  {suggestion.coordinates_display && (
                    <p className="text-xs text-muted-foreground">
                      📍 {suggestion.coordinates_display}
                    </p>
                  )}
                  {suggestion.accuracy_score && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className={`w-2 h-2 rounded-full ${
                        suggestion.accuracy_score > 0.8 ? 'bg-green-500' : 
                        suggestion.accuracy_score > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <span className="text-xs text-muted-foreground">
                        {suggestion.accuracy_score > 0.8 ? 'High' : 
                         suggestion.accuracy_score > 0.6 ? 'Medium' : 'Low'} accuracy
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;