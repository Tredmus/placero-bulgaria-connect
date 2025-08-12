import React, { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";

interface LightboxGalleryProps {
  images: Array<string | { url?: string; src?: string; alt?: string }>
  open: boolean
  initialIndex?: number
  onOpenChange: (open: boolean) => void
}

const LightboxGallery: React.FC<LightboxGalleryProps> = ({ images, open, initialIndex = 0, onOpenChange }) => {
  const [api, setApi] = useState<CarouselApi | null>(null)
  const [current, setCurrent] = useState(initialIndex)

  const normalized = (images || [])
    .map((img) => (typeof img === "string" ? { src: img } : { src: img.src || img.url, alt: img.alt }))
    .filter((i) => !!i.src) as { src: string; alt?: string }[]

  useEffect(() => {
    if (open && api && typeof initialIndex === "number") {
      setCurrent(initialIndex)
      api.scrollTo(initialIndex)
    }
  }, [open, api, initialIndex])

  useEffect(() => {
    if (!api) return
    const onSelect = () => setCurrent(api.selectedScrollSnap())
    api.on("select", onSelect)
    return () => {
      api.off("select", onSelect)
    }
  }, [api])

  if (!normalized.length) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[96vw] md:w-[90vw] md:max-w-[90vw] p-0 bg-transparent border-none shadow-none">
        <div className="relative w-full">
          <Carousel setApi={setApi} opts={{ loop: true, dragFree: false, align: "start" }} className="w-full">
            <CarouselContent>
              {normalized.map((img, idx) => (
                <CarouselItem key={idx} className="w-full">
                  <div className="flex items-center justify-center h-[70vh] sm:h-[80vh] bg-background/60 rounded-md">
                    <img
                      src={img.src}
                      alt={img.alt || `Gallery image ${idx + 1}`}
                      className="max-h-full max-w-full object-contain"
                      loading={idx === 0 ? "eager" : "lazy"}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-4 top-1/2 -translate-y-1/2 placero-glass" />
            <CarouselNext className="right-4 top-1/2 -translate-y-1/2 placero-glass" />
          </Carousel>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs px-2 py-1 rounded placero-glass">
            {current + 1} / {normalized.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default LightboxGallery
