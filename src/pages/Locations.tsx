import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocations } from '@/hooks/useLocations';
import { Search, MapPin, Star, Wifi, Coffee, Car, Utensils, Building2 } from 'lucide-react';

const amenityIcons = {
  wifi: Wifi,
  coffee: Coffee,
  parking: Car,
  restaurant: Utensils,
};

const Locations = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  
  const { locations, loading, error } = useLocations({
    search: searchTerm,
    city: selectedCity,
    amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined
  });

  const cities = [...new Set(locations.map(location => location.city))];
  const availableAmenities = ['wifi', 'coffee', 'parking', 'restaurant'];

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenity) 
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Грешка при зареждане на локациите</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-4">Намерете вашето идеално работно място</h1>
        
        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Търсене на локации..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={selectedCity} onValueChange={(value) => setSelectedCity(value === 'all' ? '' : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Изберете град" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всички градове</SelectItem>
              {cities.map(city => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex gap-2 flex-wrap">
            {availableAmenities.map(amenity => (
              <Button
                key={amenity}
                variant={selectedAmenities.includes(amenity) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleAmenity(amenity)}
                className="capitalize"
              >
                {amenity}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-muted rounded-t-lg"></div>
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-muted-foreground">
              {locations.length} workspace{locations.length !== 1 ? 's' : ''} found
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map((location) => (
              <Card key={location.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/locations/${location.id}`)}>
                <div className="relative">
                  {(location.main_photo || (location.photos && location.photos.length > 0)) ? (
                    <img
                      src={location.main_photo || location.photos[0]}
                      alt={location.name}
                      className="w-full h-48 object-cover rounded-t-lg"
                    />
                  ) : (
                    <div className="w-full h-48 bg-muted rounded-t-lg flex items-center justify-center">
                      <Building2 className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  {location.rating > 0 && (
                    <Badge className="absolute top-2 right-2 bg-background/90">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      {location.rating}
                    </Badge>
                  )}
                </div>
                
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{location.name}</CardTitle>
                  <CardDescription className="flex items-center text-sm">
                    <MapPin className="h-3 w-3 mr-1" />
                    {location.address}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">
                      {location.companies?.name}
                    </span>
                    <span className="font-semibold">
                      {location.price_day} лв/ден • ≈ €{(Number(location.price_day)/1.95583).toFixed(2)} / ден
                    </span>
                  </div>
                  
                  {location.amenities && location.amenities.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {location.amenities.slice(0, 4).map((amenity) => {
                        const IconComponent = amenityIcons[amenity as keyof typeof amenityIcons];
                        return (
                          <Badge key={amenity} variant="secondary" className="text-xs">
                            {IconComponent && <IconComponent className="h-3 w-3 mr-1" />}
                            {amenity}
                          </Badge>
                        );
                      })}
                      {location.amenities.length > 4 && (
                        <Badge variant="secondary" className="text-xs">
                          +{location.amenities.length - 4} още
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {locations.length === 0 && !loading && (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">Няма намерени локации</h3>
              <p className="text-muted-foreground">
                Опитайте да промените критериите за търсене или проверете отново по-късно.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Locations;