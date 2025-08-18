import { useState } from "react";
import { Plus, Navigation, MapPin, Car, User, Settings, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

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
}

interface RouteSidebarProps {
  waypoints: Waypoint[];
  setWaypoints: (waypoints: Waypoint[]) => void;
  routeData: RouteData | null;
  setRouteData: (data: RouteData) => void;
  isCalculating: boolean;
  setIsCalculating: (calculating: boolean) => void;
}

export function RouteSidebar({ 
  waypoints, 
  setWaypoints, 
  routeData, 
  setRouteData, 
  isCalculating, 
  setIsCalculating 
}: RouteSidebarProps) {
  const [mode, setMode] = useState<'car' | 'walking'>('car');
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);
  const [fastestRoute, setFastestRoute] = useState(true);

  const addWaypoint = () => {
    const waypointNumber = waypoints.length - 1;
    const newWaypoint: Waypoint = {
      id: `waypoint-${Date.now()}`,
      label: `Zwischenziel ${waypointNumber}`,
      address: ''
    };
    
    // Insert before the last item (destination)
    const newWaypoints = [...waypoints];
    newWaypoints.splice(waypoints.length - 1, 0, newWaypoint);
    setWaypoints(newWaypoints);
  };

  const removeWaypoint = (id: string) => {
    setWaypoints(waypoints.filter(w => w.id !== id));
  };

  const updateWaypointAddress = (id: string, address: string) => {
    setWaypoints(waypoints.map(w => 
      w.id === id ? { ...w, address } : w
    ));
  };

  const calculateRoute = async () => {
    // Validate that start and end addresses are filled
    const startWaypoint = waypoints.find(w => w.id === 'start');
    const endWaypoint = waypoints.find(w => w.id === 'end');
    
    if (!startWaypoint?.address || !endWaypoint?.address) {
      alert('Bitte geben Sie Start- und Zieladresse ein.');
      return;
    }

    setIsCalculating(true);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // TODO: Implement actual routing API call
      // For now, update with sample data based on current waypoints
      const waypointCount = waypoints.length - 2; // Exclude start and end
      const baseDistance = 500 + waypointCount * 150; // km
      const baseDuration = Math.floor(baseDistance / 80); // hours at ~80km/h
      
      setRouteData({
        distance: `${baseDistance.toLocaleString('de-DE')} km`,
        duration: `${baseDuration}h ${Math.floor((baseDistance % 80) * 0.75)}min`,
        instructions: [
          `1. Starten Sie in ${startWaypoint.address}`,
          ...waypoints
            .filter(w => w.id !== 'start' && w.id !== 'end' && w.address)
            .map((w, i) => `${i + 2}. Fahren Sie nach ${w.address}`),
          `${waypoints.length}. Erreichen Sie Ihr Ziel in ${endWaypoint.address}`
        ]
      });
      
      console.log('Route berechnet:', { mode, waypoints, avoidTolls, avoidHighways, fastestRoute });
    } catch (error) {
      console.error('Fehler bei Routenberechnung:', error);
      alert('Fehler bei der Routenberechnung. Bitte versuchen Sie es erneut.');
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="w-80 bg-nav-surface border-r border-nav-border h-full overflow-y-auto p-4 space-y-6">
      {/* Mode Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Navigation className="h-4 w-4" />
            Routenmodus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={mode === 'car' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('car')}
              className="flex-1"
            >
              <Car className="h-4 w-4 mr-2" />
              Auto
            </Button>
            <Button
              variant={mode === 'walking' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('walking')}
              className="flex-1"
            >
              <User className="h-4 w-4 mr-2" />
              Zu Fuß
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Waypoints */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Routenpunkte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {waypoints.map((waypoint, index) => (
            <div key={waypoint.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  index === 0 ? 'bg-travel' : 
                  index === waypoints.length - 1 ? 'bg-destructive' : 
                  'bg-primary'
                }`} />
                <Label className="text-sm font-medium">
                  {waypoint.label}
                </Label>
                {index > 0 && index < waypoints.length - 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeWaypoint(waypoint.id)}
                    className="ml-auto h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </Button>
                )}
              </div>
              <Input
                placeholder={`Adresse eingeben...`}
                value={waypoint.address}
                onChange={(e) => updateWaypointAddress(waypoint.id, e.target.value)}
                className="text-sm"
              />
            </div>
          ))}
          
          <Button
            variant="outline"
            size="sm"
            onClick={addWaypoint}
            className="w-full mt-3"
          >
            <Plus className="h-4 w-4 mr-2" />
            Zwischenziel hinzufügen
          </Button>
        </CardContent>
      </Card>

      {/* Route Options */}
      {mode === 'car' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />
              Routenoptionen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="fastest" className="text-sm">
                {fastestRoute ? 'Schnellste Route' : 'Kürzeste Route'}
              </Label>
              <Switch
                id="fastest"
                checked={fastestRoute}
                onCheckedChange={setFastestRoute}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="tolls" className="text-sm">Maut vermeiden</Label>
              <Switch
                id="tolls"
                checked={avoidTolls}
                onCheckedChange={setAvoidTolls}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="highways" className="text-sm">Autobahnen vermeiden</Label>
              <Switch
                id="highways"
                checked={avoidHighways}
                onCheckedChange={setAvoidHighways}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calculate Button */}
      <Button 
        size="lg" 
        className="w-full" 
        variant="navigation"
        onClick={calculateRoute}
        disabled={isCalculating}
      >
        <Navigation className="h-4 w-4 mr-2" />
        {isCalculating ? 'Berechne Route...' : 'Route berechnen'}
      </Button>

      {/* Dashboard Link */}
      <Link to="/dashboard">
        <Button variant="outline" size="sm" className="w-full">
          <BarChart3 className="h-4 w-4 mr-2" />
          Gespeicherte Routen
        </Button>
      </Link>

      {/* Route Results */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Routendetails</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {routeData ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Entfernung:</span>
                <Badge variant="secondary">{routeData.distance}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Fahrzeit:</span>
                <Badge variant="secondary">{routeData.duration}</Badge>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4">
              Klicken Sie auf "Route berechnen" um Routendetails zu sehen
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Zwischenziele:</span>
            <Badge variant="outline">{waypoints.length - 2}</Badge>
          </div>
          
          <Separator className="my-3" />
          
          {routeData ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Navigation</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                {routeData.instructions.map((instruction, index) => (
                  <div key={index}>{instruction}</div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}