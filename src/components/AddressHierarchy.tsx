import { useState, useEffect } from "react";
import { MapPin, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { BULGARIA_PROVINCES, findCitiesByProvince, type Province, type City } from "@/data/bulgariaDivisions";

interface AddressHierarchyProps {
  provinceValue: string;
  cityValue: string;
  addressValue: string;
  onProvinceChange: (value: string) => void;
  onCityChange: (value: string, coordinates?: { lat: number; lng: number }) => void;
  onAddressChange: (value: string, coordinates?: { lat: number; lng: number }) => void;
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

const AddressHierarchy = ({ 
  provinceValue,
  cityValue,
  addressValue,
  onProvinceChange,
  onCityChange,
  onAddressChange,
  className = ""
}: AddressHierarchyProps) => {
  const [cities, setCities] = useState<City[]>([]);
  const [addressSuggestions, setAddressSuggestions] = useState<MapboxSuggestion[]>([]);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [openProvince, setOpenProvince] = useState(false);
  const [openCity, setOpenCity] = useState(false);

  // Update cities when province changes
  useEffect(() => {
    if (provinceValue) {
      const provinceCities = findCitiesByProvince(provinceValue);
      setCities(provinceCities);
      
      // Clear city and address when province changes
      if (cityValue) {
        onCityChange('');
      }
      if (addressValue) {
        onAddressChange('');
      }
    } else {
      setCities([]);
    }
  }, [provinceValue]);

  // Search addresses when city is selected and address is typed
  useEffect(() => {
    const searchAddress = async () => {
      if (!cityValue || addressValue.length < 3) {
        setAddressSuggestions([]);
        return;
      }

      setIsLoadingAddress(true);
      try {
        // Combine city and address for better geocoding results
        const searchQuery = `${addressValue}, ${cityValue}, ${provinceValue}, Bulgaria`;
        
        const { data, error } = await supabase.functions.invoke('geocode-address', {
          body: { query: searchQuery }
        });

        if (error) throw error;
        
        if (data?.features) {
          // Filter results to only show those that contain the city name
          const filteredSuggestions = data.features.filter((suggestion: MapboxSuggestion) =>
            suggestion.place_name.toLowerCase().includes(cityValue.toLowerCase())
          );
          setAddressSuggestions(filteredSuggestions);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        setAddressSuggestions([]);
      } finally {
        setIsLoadingAddress(false);
      }
    };

    const timeoutId = setTimeout(searchAddress, 300);
    return () => clearTimeout(timeoutId);
  }, [addressValue, cityValue, provinceValue]);

  const handleCitySelect = (selectedCity: string) => {
    onCityChange(selectedCity);
    
    // Clear address when city changes
    if (addressValue) {
      onAddressChange('');
    }
  };

  const handleAddressSelect = (suggestion: MapboxSuggestion) => {
    onAddressChange(suggestion.place_name, {
      lat: suggestion.center[1],
      lng: suggestion.center[0]
    });
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Province Selection */}
      <div className="space-y-2">
        <Label htmlFor="province-select">Област *</Label>
        <Popover open={openProvince} onOpenChange={setOpenProvince}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openProvince}
              className="w-full justify-between"
            >
              {provinceValue || "Изберете област..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder="Търсете област..." />
              <CommandList>
                <CommandEmpty>Няма намерена област.</CommandEmpty>
                <CommandGroup>
                  {BULGARIA_PROVINCES.map((province) => (
                    <CommandItem
                      key={province.code}
                      value={province.name}
                      onSelect={(currentValue) => {
                        onProvinceChange(currentValue === provinceValue ? "" : currentValue);
                        setOpenProvince(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          provinceValue === province.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {province.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* City Selection */}
      <div className="space-y-2">
        <Label htmlFor="city-select">Населено място *</Label>
        <Popover open={openCity} onOpenChange={setOpenCity}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openCity}
              className={cn("w-full justify-between", !provinceValue && "opacity-50")}
              disabled={!provinceValue}
            >
              {cityValue || (!provinceValue ? "Първо изберете област..." : "Изберете населено място...")}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder="Търсете населено място..." />
              <CommandList>
                <CommandEmpty>Няма намерено населено място.</CommandEmpty>
                <CommandGroup>
                  {cities.map((city, index) => (
                    <CommandItem
                      key={index}
                      value={city.name}
                      onSelect={(currentValue) => {
                        handleCitySelect(currentValue === cityValue ? "" : currentValue);
                        setOpenCity(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          cityValue === city.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {city.name} ({city.type})
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Address Input */}
      <div className="space-y-2">
        <Label htmlFor="address-input">Адрес *</Label>
        <div className="relative">
          <Input
            id="address-input"
            type="text"
            value={addressValue}
            onChange={(e) => {
              onAddressChange(e.target.value);
              setShowAddressSuggestions(true);
            }}
            onFocus={() => setShowAddressSuggestions(true)}
            onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 200)}
            placeholder={
              !cityValue 
                ? "Първо изберете град..." 
                : "Въведете адрес..."
            }
            className="pl-10"
            disabled={!cityValue}
          />
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          {isLoadingAddress && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Address Suggestions */}
        {showAddressSuggestions && addressSuggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
            {addressSuggestions.map((suggestion, index) => (
              <div
                key={index}
                onClick={() => handleAddressSelect(suggestion)}
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
                          {suggestion.accuracy_score > 0.8 ? 'Висока' : 
                           suggestion.accuracy_score > 0.6 ? 'Средна' : 'Ниска'} точност
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
    </div>
  );
};

export default AddressHierarchy;