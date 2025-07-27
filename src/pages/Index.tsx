import HeroSection from "@/components/HeroSection";
import BulgariaMap from "@/components/BulgariaMap";
import FeaturedLocations from "@/components/FeaturedLocations";

const Index = () => {
  return (
    <>
      <HeroSection />
      <section className="py-16">
        <div className="container mx-auto px-4">
          <BulgariaMap />
        </div>
      </section>
      <FeaturedLocations />
    </>
  );
};

export default Index;
