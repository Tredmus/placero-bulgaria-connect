import { Search, User, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="placero-glass border-b border-border/50 sticky top-0 z-50 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/60 rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <img src="/lovable-uploads/cfef3fb4-b93f-46d6-bb46-95813a08d122.png" alt="Placero logo" className="h-9 w-9 relative z-10 group-hover:scale-110 transition-transform" loading="eager" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Placero
            </span>
          </Link>

          {/* Search Bar */}
          <div className="hidden md:flex items-center space-x-2 flex-1 max-w-md mx-8">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Търсете работни пространства..."
                className="pl-10 placero-glass border-border/50 focus:border-primary/50 transition-all duration-300"
              />
            </div>
          </div>

          {/* Navigation & Auth */}
          <div className="flex items-center space-x-3">
            <Link to="/locations">
              <Button variant="ghost" className="font-medium hover:bg-primary/10 hover:text-primary transition-all">
                Локации
              </Button>
            </Link>
            <Link to="/articles">
              <Button variant="ghost" className="font-medium hover:bg-primary/10 hover:text-primary transition-all">
                Статии
              </Button>
            </Link>
            
            {user ? (
              <div className="flex items-center space-x-3">
                <Link to="/dashboard">
                  <Button variant="ghost" className="font-medium hover:bg-primary/10 hover:text-primary transition-all">
                    Табло
                  </Button>
                </Link>
                <span className="text-sm text-muted-foreground hidden sm:block font-medium">
                  Добре дошли!
                </span>
                <Button variant="outline" onClick={handleSignOut} className="placero-button-ghost">
                  <LogOut className="h-4 w-4 mr-2" />
                  Изход
                </Button>
              </div>
            ) : (
              <>
                <Link to="/auth?tab=signin">
                  <Button variant="outline" className="hidden sm:flex placero-button-ghost">
                    <User className="h-4 w-4 mr-2" />
                    Вход
                  </Button>
                </Link>
                <Link to="/auth?tab=signup">
                  <Button className="placero-button-primary group">
                    <Sparkles className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform" />
                    Станете партньор
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden mt-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Търсете работни пространства..."
              className="pl-10 placero-glass border-border/50 focus:border-primary/50 transition-all duration-300"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;