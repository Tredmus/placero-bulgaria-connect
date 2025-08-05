import HeroSection from "@/components/HeroSection";
import PlaceroMap from "@/components/PlaceroMap";
import FeaturedLocations from "@/components/FeaturedLocations";
import FeaturedArticles from "@/components/FeaturedArticles";
import BannerDisplay from "@/components/BannerDisplay";

const Index = () => {
  return (
    <>
      <HeroSection />
      <section className="py-16">
        <div className="container mx-auto px-4">
          <PlaceroMap />
        </div>
      </section>
      <FeaturedLocations />
      <FeaturedArticles />
      <BannerDisplay />
    </>
  );
};

export default Index;
