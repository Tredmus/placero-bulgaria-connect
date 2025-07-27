import { Search, User, Building2, LogOut } from "lucide-react";
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
    <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <Building2 className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">Placero</span>
          </Link>

          {/* Search Bar */}
          <div className="hidden md:flex items-center space-x-2 flex-1 max-w-md mx-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search workspaces..."
                className="pl-10 bg-secondary border-border"
              />
            </div>
          </div>

          {/* Navigation & Auth */}
          <div className="flex items-center space-x-3">
            <Link to="/locations">
              <Button variant="ghost">Workspaces</Button>
            </Link>
            
            {user ? (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-muted-foreground hidden sm:block">
                  Welcome back!
                </span>
                <Button variant="outline" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <Link to="/auth?tab=signin">
                  <Button variant="outline" className="hidden sm:flex">
                    <User className="h-4 w-4 mr-2" />
                    Login
                  </Button>
                </Link>
                <Link to="/auth?tab=signup">
                  <Button className="placero-button-primary">
                    Become a Partner
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search workspaces..."
              className="pl-10 bg-secondary border-border"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;