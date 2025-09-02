import { ArrowRight, Building2, Users, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import heroImage from "@/assets/hero-workspace.jpg";

const HeroSection = () => {
  const { user } = useAuth();
  
  return (
    <section className="relative min-h-screen bg-gradient-to-br from-background via-muted/10 to-accent/20 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(140,255,141,0.1),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      <div className="container mx-auto px-4 py-12 md:py-20 lg:py-32 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div className="space-y-10 placero-fade-in">
            <div className="space-y-6">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
                ✨ Най-доброто работно пространство в България
              </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl xl:text-7xl font-bold text-foreground leading-tight tracking-tight">
              Намерете идеалното
              <span className="text-transparent bg-gradient-to-r from-primary to-primary/80 bg-clip-text block">работно място</span>
            </div>
            <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground max-w-2xl leading-relaxed">
              Открийте и резервирайте най-добрите споделени работни пространства в България. От София до Варна - всички възможности на едно място.
            </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center sm:justify-start">
              <Link to="/locations" className="flex-1 sm:flex-initial">
                <Button size="lg" className="placero-button-primary group w-full sm:w-auto">
                  Разгледайте локации
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              {!user && (
                <Link to="/auth?tab=signup" className="flex-1 sm:flex-initial">
                  <Button size="lg" className="placero-button-secondary w-full sm:w-auto">
                    Станете партньор
                  </Button>
                </Link>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 justify-items-center md:justify-items-start">
              <div className="placero-glass placero-hover-lift w-full md:w-auto">
                <div className="flex items-center justify-between md:justify-start gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="text-2xl font-bold text-foreground">150+</div>
                  </div>
                  <div className="text-sm text-muted-foreground font-medium text-right md:text-left">Локации</div>
                </div>
              </div>
              <div className="placero-glass placero-hover-lift w-full md:w-auto">
                <div className="flex items-center justify-between md:justify-start gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="text-2xl font-bold text-foreground">5000+</div>
                  </div>
                  <div className="text-sm text-muted-foreground font-medium text-right md:text-left">Потребители</div>
                </div>
              </div>
              <div className="placero-glass placero-hover-lift w-full md:w-auto">
                <div className="flex items-center justify-between md:justify-start gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <Star className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="text-2xl font-bold text-foreground">4.8</div>
                  </div>
                  <div className="text-sm text-muted-foreground font-medium text-right md:text-left">Рейтинг</div>
                </div>
              </div>
            </div>
          </div>

          {/* Image */}
          <div className="relative placero-slide-up">
            <div className="relative">
              <div className="placero-card-hero overflow-hidden relative">
                <img
                  src={heroImage}
                  alt="Modern workspace"
                  className="w-full h-[300px] sm:h-[400px] lg:h-[600px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
              </div>
              
              {/* Floating badge */}
              <div className="absolute -bottom-8 -left-4 placero-card-hero p-6 placero-hover-glow">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-[var(--shadow-glow)]">
                    <Building2 className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="font-bold text-lg text-foreground">Нови локации</div>
                    <div className="text-muted-foreground font-medium">Всяка седмица</div>
                  </div>
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