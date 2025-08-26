import { useState } from "react";
import { Plus, Navigation, MapPin, Car, User, Settings, BarChart3, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
// 👉 Sonner-Toast (weil in App.tsx <Sonner /> montiert ist)
import { toast } from "sonner";

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
  geometry?: any; // GeoJSON LineString (LngLat) ODER [lat,lng][] im Fallback
  waypoints?: Waypoint[];
  // numerische Felder (optional)
  distanceMeters?: number;
  distanceKm?: number;
  durationSeconds?: number;
}

interface RouteSidebarProps {
  waypoints: Waypoint[];
  setWaypoints: (waypoints: Waypoint[]) => void;
  routeData: RouteData | null;
  setRouteData: (data: RouteData) => void;
  isCalculating: boolean;
  setIsCalculating: (calculating: boolean) => void;
}

// ---- Server-Response-Typen passend zur Supabase Function ----
type ServerRouteOk = {
  distance: string;
  duration: string;
  distanceMeters?: number;
  distanceKm?: number;
  durationSeconds?: number;
  distanceSource?: "summary" | "geometry";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  waypoints: Waypoint[];
  fallback?: false;
};

type ServerRouteFallback = {
  distance: string;
  duration: string;
  distanceMeters?: number;
  distanceKm?: number;
  durationSeconds?: number;
  geometry: [number, number][];
  waypoints: Waypoint[];
  fallback: true;
  errorMessage?: string;
  debug?: any;
};

type ServerRouteResponse = ServerRouteOk | ServerRouteFallback;

// ---- Helpers: Distanz client-seitig aus Geometrie berechnen ----
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function kmFromGeometry(geometry: any): number | null {
  try {
    // A) GeoJSON LineString [lon,lat][]
    if (geometry?.type === "LineString" && Array.isArray(geometry.coordinates)) {
      const coords = geometry.coordinates as [number, number][];
      let sum = 0;
      for (let i = 0; i < coords.length - 1; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[i + 1];
        if ([lon1, lat1, lon2, lat2].every(Number.isFinite)) {
          sum += haversineKm(lat1, lon1, lat2, lon2);
        }
      }
      return sum;
    }
    // B) Fallback: [lat,lng][]
    if (Array.isArray(geometry)) {
      const coords = geometry as [number, number][];
      let sum = 0;
      for (let i = 0; i < coords.length - 1; i++) {
        const [lat1, lon1] = coords[i];
        const [lat2, lon2] = coords[i + 1];
        if ([lon1, lat1, lon2, lat2].every(Number.isFinite)) {
          sum += haversineKm(lat1, lon1, lat2, lon2);
        }
      }
      return sum;
    }
  } catch {/* noop */}
  return null;
}

function formatKm(km: number | null | undefined): string {
  if (!Number.isFinite(km as number) || (km as number) <= 0) return "0,0 km";
  const v = km as number;
  const display = v >= 10 ? Math.round(v) : Number(v.toFixed(1));
  return `${String(display).replace(".", ",")} km`;
}

export function RouteSidebar({
  waypoints,
  setWaypoints,
  routeData,
  setRouteData,
  isCalculating,
  setIsCalculating,
}: RouteSidebarProps) {
  const [mode, setMode] = useState<"car" | "walking">("car");
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);
  const [fastestRoute, setFastestRoute] = useState(true);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  const addWaypoint = () => {
    const waypointNumber = waypoints.length - 1;
    const newWaypoint: Waypoint = {
      id: `waypoint-${Date.now()}`,
      label: `Zwischenziel ${waypointNumber}`,
      address: "",
    };
    const newWaypoints = [...waypoints];
    newWaypoints.splice(waypoints.length - 1, 0, newWaypoint);
    setWaypoints(newWaypoints);
  };

  const removeWaypoint = (id: string) => {
    setWaypoints(waypoints.filter((w) => w.id !== id));
  };

  const updateWaypointAddress = (id: string, address: string) => {
    setWaypoints(waypoints.map((w) => (w.id === id ? { ...w, address } : w)));
  };

  const calculateRoute = async () => {
    const startWaypoint = waypoints.find((w) => w.id === "start");
    const endWaypoint = waypoints.find((w) => w.id === "end");
    if (!startWaypoint?.address || !endWaypoint?.address) {
      toast.error("Bitte geben Sie Start- und Zieladresse ein.");
      return;
    }

    setIsCalculating(true);
    setFallbackNotice(null);

    try {
      const { data, error } = await supabase.functions.invoke<ServerRouteResponse>("calculate-route", {
        body: { waypoints, mode, avoidTolls, avoidHighways, fastestRoute },
      });

      // Debug-Toast mit den wichtigsten Feldern
      toast("Debug Route", 
        {
          description: (
            <pre className="whitespace-pre-wrap text-xs">
              distance: {data.distance ?? "?"}{"\n"}
              distanceKm: {(data as any).distanceKm ?? "?"}{"\n"}
              geom-type: {data.geometry?.type || (Array.isArray(data.geometry) ? "array" : "?")}
            </pre>
          ),
        }
      );

      if (error) throw new Error(error.message || "Unbekannter Serverfehler");
      if (!data) throw new Error("Leere Antwort vom Server");

      if (data.fallback) {
        const msg =
          data.errorMessage ??
          "ORS konnte keine Route liefern – es wird nur die Luftlinie angezeigt.";
        setFallbackNotice(msg);
        toast.message("Routenberechnung unvollständig", { description: msg });
        if (import.meta.env.DEV && (data as any).debug) {
          console.warn("[ORS DEBUG]", (data as any).debug);
        }
      } else {
        const src = (data as any).distanceSource === "geometry" ? "Geometrie" : "Zusammenfassung";
        toast.success("Route berechnet", {
          description: `Entfernung: ${data.distance} • Fahrzeit: ${data.duration} • Quelle: ${src}`,
        });
      }

      // --- Distanz-Absicherung im Frontend ---
      let distanceStr = data.distance ?? "0,0 km";
      const looksZero =
        !distanceStr ||
        distanceStr === "0,0 km" ||
        distanceStr === "0 km" ||
        distanceStr.startsWith("0");

      // Numerisch bevorzugen, sonst aus Geometrie
      let ensuredKm: number | undefined =
        typeof (data as any).distanceKm === "number"
          ? (data as any).distanceKm
          : kmFromGeometry((data as any).geometry) ?? undefined;

      if (looksZero && ensuredKm && ensuredKm > 0) {
        const fixed = formatKm(ensuredKm);
        if (fixed !== "0,0 km") {
          distanceStr = fixed;
          toast.info("Entfernung korrigiert", {
            description: `Aus Geometrie berechnet: ${fixed}`,
          });
        }
      }

      setRouteData({
        distance: distanceStr,
        duration: data.duration ?? "0min",
        instructions: data.instructions ?? [],
        geometry: data.geometry,
        waypoints: data.waypoints ?? waypoints,
        distanceMeters: (data as any).distanceMeters,
        distanceKm: ensuredKm ?? (data as any).distanceKm,
        durationSeconds: (data as any).durationSeconds,
      });

      console.log("Route berechnet:", data);
    } catch (err: any) {
      console.error("Fehler bei Routenberechnung:", err);
      toast.error("Fehler bei der Routenberechnung", {
        description: err?.message ?? String(err),
      });
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
              variant={mode === "car" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("car")}
              className="flex-1"
            >
              <Car className="h-4 w-4 mr-2" />
              Auto
            </Button>
            <Button
              variant={mode === "walking" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("walking")}
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
                <div
                  className={`w-3 h-3 rounded-full ${
                    index === 0 ? "bg-travel" : index === waypoints.length - 1 ? "bg-destructive" : "bg-primary"
                  }`}
                />
                <Label className="text-sm font-medium">{waypoint.label}</Label>
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
                placeholder="Adresse eingeben..."
                value={waypoint.address}
                onChange={(e) => updateWaypointAddress(waypoint.id, e.target.value)}
                className="text-sm"
              />
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addWaypoint} className="w-full mt-3">
            <Plus className="h-4 w-4 mr-2" />
            Zwischenziel hinzufügen
          </Button>
        </CardContent>
      </Card>

      {/* Route Options */}
      {mode === "car" && (
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
                {fastestRoute ? "Schnellste Route" : "Kürzeste Route"}
              </Label>
              <Switch id="fastest" checked={fastestRoute} onCheckedChange={setFastestRoute} />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="tolls" className="text-sm">Maut vermeiden</Label>
              <Switch id="tolls" checked={avoidTolls} onCheckedChange={setAvoidTolls} />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="highways" className="text-sm">Autobahnen vermeiden</Label>
              <Switch id="highways" checked={avoidHighways} onCheckedChange={setAvoidHighways} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calculate Button */}
      <Button size="lg" className="w-full" variant="navigation" onClick={calculateRoute} disabled={isCalculating}>
        <Navigation className="h-4 w-4 mr-2" />
        {isCalculating ? "Berechne Route..." : "Route berechnen"}
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
                <Badge variant="secondary">
                  {routeData.distance && routeData.distance !== "0,0 km"
                    ? routeData.distance
                    : typeof (routeData as any).distanceKm === "number"
                    ? `${(routeData as any).distanceKm.toFixed(1).replace(".", ",")} km`
                    : "–"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Fahrzeit:</span>
                <Badge variant="secondary">{routeData.duration}</Badge>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4">
              Klicken Sie auf &quot;Route berechnen&quot; um Routendetails zu sehen
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Zwischenziele:</span>
            <Badge variant="outline">{Math.max(0, waypoints.length - 2)}</Badge>
          </div>

          {fallbackNotice && (
            <div className="mt-2 flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              {fallbackNotice}
            </div>
          )}

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
