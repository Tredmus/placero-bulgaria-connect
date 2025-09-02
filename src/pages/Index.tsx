import HeroSection from "@/components/HeroSection";
import InteractiveMapTabs from "@/components/InteractiveMapTabs";
import FeaturedLocations from "@/components/FeaturedLocations";
import FeaturedArticles from "@/components/FeaturedArticles";
import BannerDisplay from "@/components/BannerDisplay";

const Index = () => {
  return (
    <>
      <HeroSection />
      <section className="py-8 md:py-16">
        <div className="md:container md:mx-auto md:px-4">
          <InteractiveMapTabs />
        </div>
      </section>
      <FeaturedLocations />
      <FeaturedArticles />
      <BannerDisplay />
    </>
  );
};

export default Index;
