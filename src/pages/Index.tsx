import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { RouteSidebar } from "@/components/sidebar/RouteSidebar";
import { MapContainer } from "@/components/map/MapContainer";

interface Waypoint {
  id: string;
  label: string;
  address: string;
  lat?: number;
  lng?: number;
}

interface RouteData {
  distance: string;
  duration: string;
  instructions: string[];
  geometry?: any;
  waypoints?: Waypoint[];
}

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { id: 'start', label: 'Start', address: 'Berlin, Deutschland' },
    { id: 'end', label: 'Ziel', address: 'Paris, Frankreich' }
  ]);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark', !isDark);
  };

  const handleMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Current position:', position.coords);
          // TODO: Update map center and add marker
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header 
        onToggleSidebar={toggleSidebar}
        onToggleTheme={toggleTheme}
        isDark={isDark}
        onMyLocation={handleMyLocation}
      />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} 
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'lg:relative' : 'lg:w-0 lg:overflow-hidden'}
          absolute lg:relative z-10 lg:z-auto
        `}>
          <RouteSidebar 
            waypoints={waypoints}
            setWaypoints={setWaypoints}
            routeData={routeData}
            setRouteData={setRouteData}
            isCalculating={isCalculating}
            setIsCalculating={setIsCalculating}
          />
        </div>
        
        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer 
            className="h-full w-full" 
            waypoints={waypoints}
            routeData={routeData}
            isCalculating={isCalculating}
          />
          
          {/* Mobile overlay when sidebar is open */}
          {sidebarOpen && (
            <div 
              className="lg:hidden absolute inset-0 bg-background/20 backdrop-blur-sm z-5"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
