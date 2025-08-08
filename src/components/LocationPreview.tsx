import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Star } from 'lucide-react';

interface LocationPreviewProps {
  location: any;
  position: { x: number; y: number };
  onClose: () => void;
}

export default function LocationPreview({ location, position, onClose }: LocationPreviewProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />
      
      {/* Preview Card */}
      <Card 
        className="fixed z-50 w-80 shadow-lg border bg-background"
        style={{
          left: Math.min(position.x - 160, window.innerWidth - 320 - 20),
          top: Math.max(position.y - 250, 20),
        }}
        onClick={handleCardClick}
      >
        <CardContent className="p-4">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/80 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            ×
          </button>

          {/* Main image */}
          {location.main_image && (
            <div className="w-full h-32 rounded-lg overflow-hidden mb-3">
              <img 
                src={location.main_image} 
                alt={location.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Location info */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg leading-tight">{location.name}</h3>
            
            {/* Rating */}
            {location.rating && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium">{location.rating}</span>
              </div>
            )}

            {/* Address */}
            {location.address && (
              <div className="flex items-start gap-1">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground">{location.address}</span>
              </div>
            )}

            {/* Price */}
            {location.price_per_night && (
              <div className="text-lg font-semibold text-primary">
                ${location.price_per_night}<span className="text-sm font-normal text-muted-foreground">/night</span>
              </div>
            )}

            {/* Description */}
            {location.description && (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {location.description}
              </p>
            )}

            {/* Amenities */}
            {location.amenities && location.amenities.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {location.amenities.slice(0, 3).map((amenity: string, index: number) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-muted rounded-full text-xs text-muted-foreground"
                  >
                    {amenity}
                  </span>
                ))}
                {location.amenities.length > 3 && (
                  <span className="px-2 py-1 bg-muted rounded-full text-xs text-muted-foreground">
                    +{location.amenities.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}