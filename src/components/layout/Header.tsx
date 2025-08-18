import { MapPin, Menu, Sun, Moon, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface HeaderProps {
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
  onMyLocation: () => void;
}

export function Header({ onToggleSidebar, onToggleTheme, isDark, onMyLocation }: HeaderProps) {
  return (
    <header className="h-16 bg-nav-surface border-b border-nav-border flex items-center justify-between px-4 relative z-20">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Navigation className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">RouteNow</h1>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onMyLocation}
          className="hidden sm:flex items-center gap-2"
        >
          <MapPin className="h-4 w-4" />
          Mein Standort
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleTheme}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}