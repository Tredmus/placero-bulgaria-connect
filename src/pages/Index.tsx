import HeroSection from "@/components/HeroSection";
import BulgariaMap from "@/components/BulgariaMap";
import FeaturedLocations from "@/components/FeaturedLocations";
import FeaturedArticles from "@/components/FeaturedArticles";
import BannerDisplay from "@/components/BannerDisplay";

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
      <FeaturedArticles />
      <BannerDisplay />
    </>
  );
};

export default Index;
