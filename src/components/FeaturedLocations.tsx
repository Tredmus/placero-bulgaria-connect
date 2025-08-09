import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocations } from "@/hooks/useLocations";
import { MapPin, Star, Wifi, Coffee, Car, Utensils, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import sofiaImage from "@/assets/location-sofia-1.jpg";
import plovdivImage from "@/assets/location-plovdiv-1.jpg";
import varnaImage from "@/assets/location-varna-1.jpg";

const amenityIcons = {
  wifi: Wifi,
  coffee: Coffee,
  parking: Car,
  restaurant: Utensils,
  meeting: Utensils,
};


const FeaturedLocations = () => {
  const { locations, loading, error } = useLocations();
  
  // Use real data from database
  const displayLocations = locations?.slice(0, 3) || [];

  return (
    <section className="py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Препоръчани локации
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Открийте най-популярните работни пространства, избрани от нашата общност
          </p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-64 bg-muted rounded-t-lg"></div>
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-3 bg-muted rounded w-2/3 mb-4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {displayLocations.map((location) => (
              <Link key={location.id} to={`/locations/${location.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
                  <div className="relative">
                    <img
                      src={location.main_photo || location.photos?.[0] || "/placeholder.svg"}
                      alt={location.name}
                      className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                    <Badge className="absolute top-4 right-4 bg-background/90">
                      <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                      {location.rating}
                    </Badge>
                  </div>
                  
                  <CardHeader>
                    <CardTitle className="text-xl">{location.name}</CardTitle>
                    <CardDescription className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      {location.address}, {location.city}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent>
                    {location.description && (
                      <p className="text-muted-foreground mb-4 line-clamp-2">
                        {location.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl font-bold text-primary">
                        {location.price_day} лв
                        <span className="text-sm font-normal text-muted-foreground">/ден</span>
                        <span className="block text-sm font-normal text-muted-foreground">≈ €{(Number(location.price_day)/1.95583).toFixed(2)} / ден</span>
                      </span>
                      <span className="text-sm text-muted-foreground">
                        от {location.companies?.name}
                      </span>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      {location.amenities?.slice(0, 4).map((amenity) => {
                        const IconComponent = amenityIcons[amenity as keyof typeof amenityIcons];
                        return (
                          <Badge key={amenity} variant="secondary" className="text-xs">
                            {IconComponent && <IconComponent className="h-3 w-3 mr-1" />}
                            {amenity}
                          </Badge>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <div className="text-center">
          <Link to="/locations">
            <Button size="lg" variant="outline" className="group">
              Виж всички локации
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FeaturedLocations;