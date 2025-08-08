import React from "react";

type LocationPreviewProps = {
  x: number;
  y: number;
  location: any;
  onClose: () => void;
};

const LocationPreview: React.FC<LocationPreviewProps> = ({ x, y, location, onClose }) => {
  if (!location) return null;

  const photo = location?.images?.[0]?.url || location?.image_url || location?.main_photo || undefined;
  const name = location?.name ?? "Location";
  const address = location?.address ?? location?.street ?? "";
  const price = location?.price ?? location?.price_per_hour ?? location?.price_per_day ?? undefined;
  const description = location?.description ?? location?.short_description ?? "";

  return (
    <div
      className="pointer-events-auto absolute z-50 w-80 max-w-[90vw] rounded-xl border bg-card text-card-foreground shadow-lg"
      style={{ left: x, top: y - 16 }}
      role="dialog"
      aria-label={`Preview of ${name}`}
    >
      <div className="flex items-start gap-3 p-3">
        {photo ? (
          <img
            src={photo}
            alt={`${name} main photo`}
            className="h-16 w-20 shrink-0 rounded-md object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-16 w-20 shrink-0 rounded-md bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold">{name}</h3>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close preview"
            >
              ✕
            </button>
          </div>
          {address && <p className="truncate text-xs text-muted-foreground">{address}</p>}
          <div className="mt-1 flex items-center justify-between">
            {price ? (
              <span className="text-xs font-medium">{price}</span>
            ) : (
              <span />
            )}
          </div>
          {description && (
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationPreview;
