import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "header" | "footer" | "default";
  showText?: boolean;
  className?: string;
  imgClassName?: string;
  textClassName?: string;
}

const LOGO_SRC = "/lovable-uploads/5d41ff1a-8e93-4fb0-aea0-34921a2888ae.png";

const Logo: React.FC<LogoProps> = ({
  variant = "default",
  showText = true,
  className,
  imgClassName,
  textClassName,
}) => {
  if (variant === "header") {
    return (
      <div className={cn("flex items-center space-x-3", className)}>
        <div className="relative h-9">
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/60 rounded-xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
          <img
            src={LOGO_SRC}
            alt="Placero logo"
            className={cn(
              "h-9 w-auto relative z-10 object-contain group-hover:scale-110 transition-transform",
              imgClassName
            )}
            loading="eager"
          />
        </div>
        {showText && (
          <span className={cn("text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text", textClassName)}>
            Placero
          </span>
        )}
      </div>
    );
  }

  if (variant === "footer") {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <img
          src={LOGO_SRC}
          alt="Placero logo"
          className={cn("h-8 w-auto object-contain", imgClassName)}
          loading="lazy"
        />
        {showText && <span className={cn("font-bold", textClassName)}>Placero</span>}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <img
        src={LOGO_SRC}
        alt="Placero logo"
        className={cn("h-6 w-auto object-contain", imgClassName)}
      />
      {showText && <span className={cn("font-semibold", textClassName)}>Placero</span>}
    </div>
  );
};

export default Logo;
