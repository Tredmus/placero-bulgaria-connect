import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import LocationCard from "./LocationCard";
import sofiaImage from "@/assets/location-sofia-1.jpg";
import plovdivImage from "@/assets/location-plovdiv-1.jpg";
import varnaImage from "@/assets/location-varna-1.jpg";

const FeaturedLocations = () => {
  const featuredLocations = [
    {
      id: "1",
      name: "Sofia Business Hub",
      company: "CoWork Bulgaria",
      city: "София",
      address: "бул. Витоша 100",
      image: sofiaImage,
      rating: 4.9,
      pricePerDay: 45,
      amenities: ["wifi", "coffee", "parking", "meeting"],
    },
    {
      id: "2",
      name: "Plovdiv Creative Space",
      company: "South Creative",
      city: "Пловдив",
      address: "ул. Княз Александър I 42",
      image: plovdivImage,
      rating: 4.7,
      pricePerDay: 35,
      amenities: ["wifi", "coffee", "meeting"],
    },
    {
      id: "3",
      name: "Varna Sea Office",
      company: "Black Sea Offices",
      city: "Варна",
      address: "бул. Приморски 15",
      image: varnaImage,
      rating: 4.8,
      pricePerDay: 40,
      amenities: ["wifi", "coffee", "parking"],
    },
    {
      id: "4",
      name: "Sofia Tech Center",
      company: "TechSpace BG",
      city: "София",
      address: "ул. Оборище 15",
      image: sofiaImage,
      rating: 4.6,
      pricePerDay: 50,
      amenities: ["wifi", "meeting", "parking"],
    },
    {
      id: "5",
      name: "Plovdiv Heritage Office",
      company: "Old Town Spaces",
      city: "Пловдив",
      address: "Старият град 8",
      image: plovdivImage,
      rating: 4.5,
      pricePerDay: 30,
      amenities: ["wifi", "coffee"],
    },
    {
      id: "6",
      name: "Varna Marina Office",
      company: "Coastal Cowork",
      city: "Варна",
      address: "пл. Независимост 1",
      image: varnaImage,
      rating: 4.7,
      pricePerDay: 42,
      amenities: ["wifi", "coffee", "meeting", "parking"],
    },
  ];

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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {featuredLocations.map((location) => (
            <LocationCard key={location.id} {...location} />
          ))}
        </div>

        <div className="text-center">
          <Button size="lg" variant="outline" className="group">
            Виж всички локации
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedLocations;