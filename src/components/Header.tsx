import { Home, MapPin, FileText, User as UserIcon, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import SearchDropdown from "@/components/SearchDropdown";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Helper for active state in bottom nav
  const isActive = (to: string | string[]) => {
    const paths = Array.isArray(to) ? to : [to];
    return paths.some((p) => location.pathname.startsWith(p));
  };

  return (
    <>
      {/* TOP HEADER */}
      <header className="placero-glass border-b border-border/50 sticky top-0 z-50 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center group space-x-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/60 rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
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

            {/* Desktop nav + auth */}
            <div className="hidden md:flex items-center gap-3">
              <NavLink to="/locations">
                <Button variant="ghost" className="font-medium hover:bg-primary/10 hover:text-primary transition-all">
                  Локации
                </Button>
              </NavLink>
              <NavLink to="/articles">
                <Button variant="ghost" className="font-medium hover:bg-primary/10 hover:text-primary transition-all">
                  Статии
                </Button>
              </NavLink>

              {user ? (
                <div className="flex items-center gap-3">
                  <NavLink to="/dashboard">
                    <Button variant="ghost" className="font-medium hover:bg-primary/10 hover:text-primary transition-all">
                      Профил
                    </Button>
                  </NavLink>
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
                  <NavLink to="/auth?tab=signin">
                    <Button variant="outline" className="placero-button-ghost">
                      Вход
                    </Button>
                  </NavLink>
                  <NavLink to="/auth?tab=signup">
                    <Button className="placero-button-primary group">
                      <Sparkles className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform" />
                      Станете партньор
                    </Button>
                  </NavLink>
                </>
              )}
            </div>
          </div>

          {/* Search: separate row on mobile, in-header on desktop */}
          <div className="mt-4 md:mt-6">
            <div className="md:flex md:items-center md:space-x-2 md:max-w-xl">
              <SearchDropdown className="w-full" />
            </div>
          </div>
        </div>
      </header>

      {/* BOTTOM NAV (mobile only) */}
      <nav
        className={`md:hidden fixed left-0 right-0 z-50
          ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}
        `}
        style={{
          bottom: "max(env(safe-area-inset-bottom), 0px)",
          transition: "transform 220ms ease, opacity 220ms ease",
        }}
      >
        <div className="mx-auto max-w-screen-md px-3 pb-[env(safe-area-inset-bottom)]">
          <div className="placero-glass border border-border/40 rounded-2xl shadow-lg backdrop-blur-xl">
            <ul className="grid grid-cols-4">
              {/* Home */}
              <li>
                <NavLink
                  to="/"
                  className={`flex flex-col items-center justify-center py-2.5 gap-1 ${
                    isActive("/") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Home className="h-5 w-5" />
                  <span className="text-[11px] font-medium">Начало</span>
                </NavLink>
              </li>

              {/* Locations */}
              <li>
                <NavLink
                  to="/locations"
                  className={`flex flex-col items-center justify-center py-2.5 gap-1 ${
                    isActive("/locations") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <MapPin className="h-5 w-5" />
                  <span className="text-[11px] font-medium">Локации</span>
                </NavLink>
              </li>

              {/* Articles */}
              <li>
                <NavLink
                  to="/articles"
                  className={`flex flex-col items-center justify-center py-2.5 gap-1 ${
                    isActive("/articles") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <FileText className="h-5 w-5" />
                  <span className="text-[11px] font-medium">Статии</span>
                </NavLink>
              </li>

              {/* Profile (goes to dashboard if logged in, else to auth) */}
              <li>
                <button
                  onClick={() => navigate(user ? "/dashboard" : "/auth?tab=signin")}
                  className={`w-full flex flex-col items-center justify-center py-2.5 gap-1 ${
                    isActive(["/dashboard", "/auth"]) ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <UserIcon className="h-5 w-5" />
                  <span className="text-[11px] font-medium">Профил</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Header;
