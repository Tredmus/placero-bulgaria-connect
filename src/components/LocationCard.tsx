import { Star, MapPin, Wifi, Coffee, Car, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface LocationCardProps {
  id: string;
  name: string;
  company: string;
  city: string;
  address: string;
  image: string;
  rating: number;
  pricePerDay: number;
  amenities: string[];
}

const amenityIcons = {
  wifi: Wifi,
  coffee: Coffee,
  parking: Car,
  meeting: Users,
};

const LocationCard = ({
  id,
  name,
  company,
  city,
  address,
  image,
  rating,
  pricePerDay,
  amenities,
}: LocationCardProps) => {
  return (
    <Link to={`/locations/${id}`}>
      <Card className="placero-card-elevated placero-hover-lift cursor-pointer group h-full overflow-hidden">
      <div className="relative overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-56 object-cover group-hover:scale-110 transition-all duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
        <div className="absolute top-4 right-4">
          <Badge className="placero-glass px-3 py-1.5 border-0 font-semibold">
            <Star className="h-4 w-4 mr-1.5 fill-yellow-400 text-yellow-400" />
            {rating}
          </Badge>
        </div>
        <div className="absolute bottom-4 left-4">
          <Badge className="placero-glass px-3 py-1.5 border-0 font-bold text-foreground">
            {pricePerDay}лв<span className="text-muted-foreground font-medium">/ден</span>
          </Badge>
        </div>
      </div>

      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-bold text-xl text-foreground mb-1 group-hover:text-primary transition-colors">{name}</h3>
            <p className="text-muted-foreground font-medium">{company}</p>
          </div>

          <div className="flex items-center text-muted-foreground">
            <MapPin className="h-4 w-4 mr-2 text-primary" />
            <span className="text-sm">{address}, {city}</span>
          </div>

          <div className="flex flex-wrap gap-3">
            {amenities.slice(0, 4).map((amenity) => {
              const IconComponent = amenityIcons[amenity as keyof typeof amenityIcons];
              return (
                <div key={amenity} className="flex items-center px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50">
                  {IconComponent && <IconComponent className="h-4 w-4 mr-2 text-primary" />}
                  <span className="text-sm font-medium text-foreground capitalize">{amenity}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
};

export default LocationCard;