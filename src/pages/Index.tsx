import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import BulgariaMap from "@/components/BulgariaMap";
import FeaturedLocations from "@/components/FeaturedLocations";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <section className="py-16">
          <div className="container mx-auto px-4">
            <BulgariaMap />
          </div>
        </section>
        <FeaturedLocations />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
