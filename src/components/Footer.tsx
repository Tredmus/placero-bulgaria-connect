import { Mail, Phone, MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-background text-background py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Logo & Description */}
          <div className="space-y-4">
            <div className="flex items-center">
              <img src="/lovable-uploads/cfef3fb4-b93f-46d6-bb46-95813a08d122.png" alt="Placero logo" className="w-9" loading="lazy" />
              <span className="text-white font-bold -ml-1">Placero</span>
            </div>
            <p className="text-white/80">
              Водещата платформа за споделени работни пространства в България
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-white mb-4">Връзки</h3>
            <ul className="space-y-2 text-white/80">
              <li><a href="#" className="hover:text-primary transition-colors">Начало</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Локации</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Компании</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Новини</a></li>
            </ul>
          </div>

          {/* For Partners */}
          <div>
            <h3 className="font-semibold text-white mb-4">За партньори</h3>
            <ul className="space-y-2 text-white/80">
              <li><a href="#" className="hover:text-primary transition-colors">Станете партньор</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Цени</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Поддръжка</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Ресурси</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-white mb-4">Контакти</h3>
            <div className="space-y-3 text-white/80">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span>info@placero.bg</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4" />
                <span>+359 2 123 4567</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span>София, България</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/20 mt-8 pt-8 text-center text-white/60">
          <p>&copy; 2024 Placero. Всички права запазени.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;