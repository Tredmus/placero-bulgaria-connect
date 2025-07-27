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
      <Card className="placero-card hover:placero-card-elevated cursor-pointer group">
      <div className="relative overflow-hidden rounded-t">
        <img
          src={image}
          alt={name}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-200"
        />
        <div className="absolute top-3 right-3">
          <Badge className="bg-background/90 text-foreground">
            <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
            {rating}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-lg text-foreground">{name}</h3>
            <p className="text-sm text-muted-foreground">{company}</p>
          </div>

          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mr-1" />
            <span>{address}, {city}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {amenities.slice(0, 4).map((amenity) => {
              const IconComponent = amenityIcons[amenity as keyof typeof amenityIcons];
              return (
                <div key={amenity} className="flex items-center text-xs text-muted-foreground">
                  {IconComponent && <IconComponent className="h-3 w-3 mr-1" />}
                  <span className="capitalize">{amenity}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <span className="text-lg font-semibold text-foreground">{pricePerDay}лв</span>
              <span className="text-sm text-muted-foreground">/ден</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
};

export default LocationCard;