import { Flame } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "full" | "icon" | "text";
  className?: string;
}

export default function Logo({ size = "md", variant = "full", className = "" }: LogoProps) {
  const sizeClasses = {
    sm: { icon: "w-6 h-6", text: "text-lg", subtext: "text-xs" },
    md: { icon: "w-8 h-8", text: "text-xl", subtext: "text-sm" },
    lg: { icon: "w-12 h-12", text: "text-3xl", subtext: "text-base" },
    xl: { icon: "w-16 h-16", text: "text-4xl", subtext: "text-lg" },
  };

  const currentSize = sizeClasses[size];

  if (variant === "icon") {
    return (
      <div className={`relative ${className}`} data-testid="logo-icon">
        <div className="relative">
          <Flame className={`${currentSize.icon} text-primary`} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="w-1/2 h-1/2 bg-gradient-to-b from-accent to-secondary rotate-45 rounded-sm"
              style={{ marginTop: "20%" }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "text") {
    return (
      <div className={`flex flex-col leading-none ${className}`} data-testid="logo-text">
        <span className={`font-bold ${currentSize.text} text-secondary`}>DE</span>
        <span className={`font-extrabold ${currentSize.text} text-primary`}>GUSTA</span>
        <span className={`font-medium ${currentSize.subtext} text-primary tracking-[0.3em]`}>PIZZAS</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="logo-full">
      <div className="relative flex-shrink-0">
        <Flame className={`${currentSize.icon} text-primary`} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg viewBox="0 0 24 24" className="w-1/2 h-1/2" style={{ marginTop: "25%" }}>
            <polygon 
              points="12,4 4,20 20,20" 
              fill="url(#pizzaGradient)"
              stroke="none"
            />
            <circle cx="9" cy="14" r="1.2" fill="hsl(var(--primary))" />
            <circle cx="14" cy="16" r="1.2" fill="hsl(var(--primary))" />
            <circle cx="11" cy="17" r="1" fill="hsl(var(--primary))" />
            <defs>
              <linearGradient id="pizzaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--accent))" />
                <stop offset="100%" stopColor="hsl(var(--secondary))" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-semibold ${size === "sm" ? "text-sm" : size === "md" ? "text-base" : "text-lg"} text-secondary`}>
          DE
        </span>
        <span className={`font-bold ${currentSize.text} text-primary -mt-1`}>
          GUSTA
        </span>
        <span className={`font-medium ${size === "sm" ? "text-[8px]" : size === "md" ? "text-[10px]" : "text-xs"} text-primary tracking-[0.2em] -mt-0.5`}>
          PIZZAS
        </span>
      </div>
    </div>
  );
}
