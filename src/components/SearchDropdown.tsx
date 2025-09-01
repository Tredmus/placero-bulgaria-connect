import React, { useState, useEffect, useRef } from "react";
import { Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useLocations } from "@/hooks/useLocations";
import { useDebounce } from "@/hooks/useDebounce";

interface SearchDropdownProps {
  className?: string;
  placeholder?: string;
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({ 
  className = "", 
  placeholder = "Търсете работни пространства..." 
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { locations, loading } = useLocations({
    search: debouncedSearchTerm,
  });

  const filteredLocations = locations.slice(0, 5); // Show max 5 results

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLocationClick = (locationId: string) => {
    navigate(`/locations/${locationId}`);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsOpen(value.length > 0);
  };

  return (
    <div className={`relative group ${className}`} ref={dropdownRef}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 group-focus-within:text-primary transition-colors z-10" />
      <Input
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => searchTerm.length > 0 && setIsOpen(true)}
        placeholder={placeholder}
        className="pl-10 placero-glass border-border/50 focus:border-primary/50 transition-all duration-300"
      />
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg backdrop-blur-xl z-50 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Търсене...
            </div>
          ) : filteredLocations.length > 0 ? (
            <div className="py-2">
              {filteredLocations.map((location) => (
                <button
                  key={location.id}
                  onClick={() => handleLocationClick(location.id)}
                  className="w-full p-3 hover:bg-muted/50 transition-colors text-left flex items-start gap-3"
                >
                  <div className="flex-shrink-0">
                    {location.companies?.logo ? (
                      <img
                        src={location.companies.logo}
                        alt={`${location.companies.name} лого`}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {location.name}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {location.address}
                    </div>
                    {location.companies?.name && (
                      <div className="text-xs text-muted-foreground truncate mt-1">
                        {location.companies.name}
                      </div>
                    )}
                  </div>
                  {location.price_day && (
                    <div className="text-sm font-medium text-primary">
                      {location.price_day}лв/ден
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : debouncedSearchTerm.length > 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              Няма намерени резултати
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default SearchDropdown;