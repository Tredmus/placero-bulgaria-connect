import { User, LogOut, Sparkles, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import SearchDropdown from "@/components/SearchDropdown";
import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // For smooth open/close animation
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuMaxHeight, setMenuMaxHeight] = useState<number>(0);

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    if (isMobileMenuOpen) {
      // Measure and set the natural height so we can animate max-height
      setMenuMaxHeight(el.scrollHeight);
    } else {
      // Collapse to 0
      setMenuMaxHeight(0);
    }
  }, [isMobileMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="placero-glass border-b border-border/50 sticky top-0 z-50 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center group space-x-2">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/60 rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <img
                src="https://i.snipboard.io/wU9oRm.jpg"
                alt="Placero logo"
                className="h-9 w-9 relative z-10 group-hover:scale-110 transition-transform"
                loading="eager"
              />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Placero
            </span>
          </Link>

          {/* Search Bar */}
          <div className="hidden md:flex items-center space-x-2 flex-1 max-w-md mx-8">
            <SearchDropdown className="flex-1" />
          </div>

          {/* Desktop Navigation & Auth */}
          <div className="hidden md:flex items-center space-x-3">
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
                <span className="text-sm text-muted-foreground hidden lg:block font-medium">
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
                  <Button variant="outline" className="placero-button-ghost">
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

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              className="p-2"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden mt-4">
          <SearchDropdown />
        </div>

        {/* Mobile Menu (animated) */}
        <div
          id="mobile-menu"
          ref={menuRef}
          // Animation: max-height + opacity + translateY for slide-down/up feel
          style={{
            maxHeight: menuMaxHeight,
            transition: 'max-height 320ms ease, opacity 220ms ease, transform 220ms ease',
            opacity: isMobileMenuOpen ? 1 : 0,
            transform: isMobileMenuOpen ? 'translateY(0)' : 'translateY(-6px)',
            overflow: 'hidden',
          }}
          className="md:hidden mt-4"
        >
          <div className="placero-glass backdrop-blur-md border border-border/20 rounded-lg shadow-lg overflow-hidden">
            {/* EVEN SPACING FOR ALL LINKS (including auth) */}
            <nav className="flex flex-col p-4 gap-3">
              <Link to="/locations" onClick={closeMobileMenu}>
                <div className="w-full text-left py-3 px-4 rounded-lg font-medium hover:bg-primary/5 hover:text-primary transition-all">
                  Локации
                </div>
              </Link>
              <Link to="/articles" onClick={closeMobileMenu}>
                <div className="w-full text-left py-3 px-4 rounded-lg font-medium hover:bg-primary/5 hover:text-primary transition-all">
                  Статии
                </div>
              </Link>

              {user && (
                <Link to="/dashboard" onClick={closeMobileMenu}>
                  <div className="w-full text-left py-3 px-4 rounded-lg font-medium hover:bg-primary/5 hover:text-primary transition-all">
                    Табло
                  </div>
                </Link>
              )}

              {/* Divider */}
              <div className="border-t border-border/20 my-1" />

              {/* Auth area — same spacing as links */}
              {user ? (
                <button
                  onClick={() => {
                    handleSignOut();
                    closeMobileMenu();
                  }}
                  className="w-full text-left py-3 px-4 rounded-lg font-medium hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-start"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Изход
                </button>
              ) : (
                <>
                  <Link to="/auth?tab=signin" onClick={closeMobileMenu}>
                    <div className="w-full text-left py-3 px-4 rounded-lg font-medium hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-start">
                      <User className="h-4 w-4 mr-2" />
                      Вход
                    </div>
                  </Link>
                  <Link to="/auth?tab=signup" onClick={closeMobileMenu}>
                    <div className="w-full text-left py-3 px-4 rounded-lg font-medium bg-primary/10 hover:bg-primary/15 hover:text-primary transition-all flex items-center justify-start">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Станете партньор
                    </div>
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
