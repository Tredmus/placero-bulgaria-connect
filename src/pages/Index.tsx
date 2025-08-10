import HeroSection from "@/components/HeroSection";
import InteractiveMap from "@/components/InteractiveMap";
import InteractiveMap2 from "@/components/InteractiveMap2";
import InteractiveMap3 from "@/components/InteractiveMap3";
import FeaturedLocations from "@/components/FeaturedLocations";
import FeaturedArticles from "@/components/FeaturedArticles";
import BannerDisplay from "@/components/BannerDisplay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  return (
    <>
      <HeroSection />
      <section className="py-16">
        <div className="container mx-auto px-4">
          <Tabs defaultValue="map1" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="map1">Map Version 1</TabsTrigger>
              <TabsTrigger value="map2">Map Version 2</TabsTrigger>
              <TabsTrigger value="map3">Map Version 3</TabsTrigger>
            </TabsList>
            <TabsContent value="map1">
              <InteractiveMap />
            </TabsContent>
            <TabsContent value="map2">
              <InteractiveMap2 />
            </TabsContent>
            <TabsContent value="map3">
              <InteractiveMap3 />
            </TabsContent>
          </Tabs>
        </div>
      </section>
      <FeaturedLocations />
      <FeaturedArticles />
      <BannerDisplay />
    </>
  );
};

export default Index;
