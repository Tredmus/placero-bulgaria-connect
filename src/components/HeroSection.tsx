import { ArrowRight, Building2, Users, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import heroImage from "@/assets/hero-workspace.jpg";

const HeroSection = () => {
  const { user } = useAuth();
  
  return (
    <section className="relative bg-background">
      <div className="container mx-auto px-4 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight">
                Намерете идеалното
                <span className="text-primary block">работно място</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-lg">
                Открийте и резервирайте най-добрите споделени работни пространства в България. От София до Варна - всички възможности на едно място.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/locations">
                <Button size="lg" className="placero-button-primary">
                  Разгледайте локации
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              {!user && (
                <Link to="/auth?tab=signup">
                  <Button size="lg" variant="outline">
                    Станете партньор
                  </Button>
                </Link>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-8">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground">150+</div>
                <div className="text-sm text-muted-foreground">Локации</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground">5000+</div>
                <div className="text-sm text-muted-foreground">Потребители</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Star className="h-8 w-8 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground">4.8</div>
                <div className="text-sm text-muted-foreground">Рейтинг</div>
              </div>
            </div>
          </div>

          {/* Image */}
          <div className="relative">
            <div className="placero-card-elevated overflow-hidden">
              <img
                src={heroImage}
                alt="Modern workspace"
                className="w-full h-[500px] object-cover"
              />
            </div>
            
            {/* Floating badge */}
            <div className="absolute -bottom-6 left-6 placero-card bg-background p-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Нови локации</div>
                  <div className="text-sm text-muted-foreground">Всяка седмица</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;