import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Star, MapPin, Wifi, Coffee, Car, Users, ArrowLeft, Printer, UtensilsCrossed, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocations } from "@/hooks/useLocations";

const amenityIcons = {
  wifi: Wifi,
  coffee: Coffee,
  parking: Car,
  meeting: Users,
  printer: Printer,
  kitchen: UtensilsCrossed,
  balcony: MapPin,
  "24h_access": Clock,
};

const LocationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { getLocationById } = useLocations();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchLocation = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const locationData = await getLocationById(id);
        setLocation(locationData);
      } catch (err) {
        setError("Failed to load location details");
        console.error("Error fetching location:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-96 bg-muted rounded-lg mb-6"></div>
            <div className="h-8 bg-muted rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-muted rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Location Not Found</h1>
          <p className="text-muted-foreground mb-6">{error || "The location you're looking for doesn't exist."}</p>
          <Link to="/locations">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Locations
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/locations">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Locations
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="aspect-video rounded-lg overflow-hidden">
              <img
                src={location.main_photo || location.photos?.[0] || "/placeholder.svg"}
                alt={location.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = "/placeholder.svg";
                }}
              />
            </div>
            {location.photos && location.photos.length > 1 && (
              <div className="grid grid-cols-2 gap-4">
                {location.photos.slice(1, 3).map((photo, index) => (
                  <div key={index} className="aspect-video rounded-lg overflow-hidden">
                    <img
                      src={photo}
                      alt={`${location.name} ${index + 2}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Location Details */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-foreground">{location.name}</h1>
                {location.rating && (
                  <Badge className="bg-background/90 text-foreground">
                    <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                    {location.rating}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                {location.companies?.logo && (
                  <img
                    src={location.companies.logo}
                    alt={location.companies.name}
                    className="h-8 w-8 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <p className="text-lg text-muted-foreground">{location.companies?.name}</p>
              </div>
            </div>

            <div className="flex items-center text-muted-foreground">
              <MapPin className="h-5 w-5 mr-2" />
              <span>{location.address}, {location.city}</span>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Description</h3>
              <p className="text-muted-foreground leading-relaxed">
                {location.description || "A great workspace for your productivity needs."}
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Amenities</h3>
              <div className="grid grid-cols-2 gap-3">
                {location.amenities?.map((amenity) => {
                  const IconComponent = amenityIcons[amenity as keyof typeof amenityIcons];
                  return (
                    <div key={amenity} className="flex items-center text-muted-foreground">
                      {IconComponent && <IconComponent className="h-4 w-4 mr-2" />}
                      <span className="capitalize">{amenity.replace('_', ' ')}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-foreground mb-4">Pricing</h3>
                <div className="space-y-3">
                  {location.price_day && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Daily rate:</span>
                      <span className="font-semibold text-foreground">{location.price_day}лв/ден</span>
                    </div>
                  )}
                  {location.price_week && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Weekly rate:</span>
                      <span className="font-semibold text-foreground">{location.price_week}лв/седмица</span>
                    </div>
                  )}
                  {location.price_month && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly rate:</span>
                      <span className="font-semibold text-foreground">{location.price_month}лв/месец</span>
                    </div>
                  )}
                </div>
                <Button className="w-full mt-6">
                  Contact for Booking
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LocationDetail;