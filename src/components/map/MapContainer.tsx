import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Waypoint {
  id: string;
  label: string;
  address: string;
  lat?: number; // Leaflet-Order: [lat, lon]
  lng?: number;
}

type LatLng = [number, number];        // [lat, lon]   -> Leaflet
type LngLat = [number, number];        // [lon, lat]   -> ORS

type ORSLineString = {
  type: 'LineString';
  coordinates: LngLat[];
};

interface RouteData {
  distance: string;
  duration: string;
  instructions: string[];
  /**
   * Kann sein:
   * - ORS GeoJSON LineString: { type:'LineString', coordinates:[[lon,lat], ...] }
   * - Array von Punkten: [[lat,lon], ...] ODER [[lon,lat], ...]
   */
  geometry?: ORSLineString | Array<[number, number]>;
  waypoints?: Waypoint[];
}

interface MapContainerProps {
  className?: string;
  waypoints?: Waypoint[];
  routeData?: RouteData;
  isCalculating?: boolean;
}

/** Heuristik:
 * - Kommt ein Paar mit |x| > 90 ⇒ es ist sehr wahrscheinlich [lon,lat] (x = lon in [-180,180])
 * - Wir drehen dann auf [lat,lon] um (Leaflet erwartet [lat,lon]).
 */
function toLeafletLatLngs(
  geometry: ORSLineString | Array<[number, number]>
): LatLng[] {
  // ORS GeoJSON
  if (geometry && (geometry as any)?.type === 'LineString') {
    const line = geometry as ORSLineString;
    return line.coordinates
      .filter(
        (c) =>
          Array.isArray(c) &&
          c.length >= 2 &&
          Number.isFinite(c[0]) &&
          Number.isFinite(c[1])
      )
      .map<LatLng>(([lon, lat]) => [lat, lon]); // [lon,lat] -> [lat,lon]
  }

  // Array-Fallback
  const arr = geometry as Array<[number, number]>;
  const cleaned = arr.filter(
    (c) =>
      Array.isArray(c) &&
      c.length >= 2 &&
      Number.isFinite(c[0]) &&
      Number.isFinite(c[1])
  );

  if (cleaned.length === 0) return [];

  // Ermitteln, ob die Eingabe [lon,lat] ist (⇒ drehen)
  // Prüfen am ersten Punkt:
  const [x, y] = cleaned[0];
  const looksLikeLngLat = Math.abs(x) <= 180 && Math.abs(y) <= 90 && Math.abs(x) > 90; // x ~ lon kann bis 180, y ~ lat bis 90
  // Die obere Heuristik ist streng; besser: wenn x außerhalb Lat-Bereich
  const isLikelyLngLat = Math.abs(x) > 90 || Math.abs(y) > 90 ? Math.abs(x) > 90 : false;

  if (isLikelyLngLat || looksLikeLngLat) {
    // [lon,lat] -> [lat,lon]
    return cleaned.map<LatLng>(([lon, lat]) => [lat, lon]);
  } else {
    // bereits [lat,lon]
    return cleaned as LatLng[];
  }
}

export function MapContainer({
  className,
  waypoints = [],
  routeData,
  isCalculating,
}: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      center: [51.1657, 10.4515], // Germany center
      zoom: 6,
      zoomControl: true,
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Mock-Geocoder für deine Beispiel-Adressen (liefert [lat,lon] für Leaflet)
  const getCoordinatesForAddress = (address: string): [number, number] => {
    const addressMap: { [key: string]: [number, number] } = {
      berlin: [52.520008, 13.404954],
      paris: [48.856614, 2.3522219],
      münchen: [48.1351, 11.582],
      hamburg: [53.5511, 9.9937],
      köln: [50.9375, 6.9603],
      frankfurt: [50.1109, 8.6821],
      stuttgart: [48.7758, 9.1829],
      düsseldorf: [51.2277, 6.7735],
      hannover: [52.3676, 9.732],
      leipzig: [51.3397, 12.3731],
    };

    const addressLower = address.toLowerCase();
    for (const [key, coords] of Object.entries(addressMap)) {
      if (addressLower.includes(key)) return coords;
    }
    // Default: Deutschland-Mitte
    return [51.1657, 10.4515];
  };

  // Update map when waypoints or route data changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing markers and polyline
    markersRef.current.forEach((marker) => map.removeLayer(marker));
    markersRef.current = [];

    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    // Add markers for waypoints
    const validWaypoints = waypoints.filter((wp) => wp.address);
    if (validWaypoints.length === 0 && !routeData?.geometry) return;

    const bounds = L.latLngBounds([]);

    validWaypoints.forEach((waypoint, idx) => {
      const coords = getCoordinatesForAddress(waypoint.address); // [lat,lon]

      // Colors: start=grün, end=rot, sonst blau
      let iconColor = '#3b82f6';
      if (waypoint.id === 'start') iconColor = '#10b981';
      if (waypoint.id === 'end') iconColor = '#ef4444';

      const label =
        waypoint.id === 'start' ? 'S' : waypoint.id === 'end' ? 'Z' : String(idx + 1);

      const customIcon = L.divIcon({
        html: `<div style="background-color:${iconColor};width:24px;height:24px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#fff;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,.3);">${label}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12],
        className: 'custom-waypoint-icon',
      });

      const marker = L.marker(coords, { icon: customIcon }).addTo(map);
      marker.bindPopup(`<b>${waypoint.label}</b><br>${waypoint.address}`);

      markersRef.current.push(marker);
      bounds.extend(coords as any);
    });

    // Route (ORS oder Array)
    // Add route polyline if route is calculated
    if (routeData && routeData.geometry) {
      let routeCoords: [number, number][] = [];
    
      if (Array.isArray(routeData.geometry)) {
        // Fallback: [lat,lng][] (Luftlinie)
        routeCoords = routeData.geometry.filter(
          (c: any) =>
            Array.isArray(c) &&
            c.length >= 2 &&
            Number.isFinite(c[0]) &&
            Number.isFinite(c[1])
        );
      } else if (routeData.geometry?.type === "LineString" && Array.isArray(routeData.geometry.coordinates)) {
        // ORS GeoJSON: [[lon,lat], ...] -> für Leaflet drehen auf [lat,lng]
        routeCoords = routeData.geometry.coordinates
          .filter((c: any) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
          .map(([lon, lat]: [number, number]) => [lat, lon]);
      }
    
      if (routeCoords.length >= 2) {
        const polyline = L.polyline(routeCoords, {
          color: isCalculating ? "#94a3b8" : "hsl(155, 75%, 40%)",
          weight: 4,
          opacity: 0.9,
          dashArray: isCalculating ? "6 6" : undefined,
        }).addTo(map);
      
        polylineRef.current = polyline;
      
        const lineBounds = polyline.getBounds();
        if (lineBounds.isValid()) bounds.extend(lineBounds);
      }
    }

    // Fit map to show all markers/route
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [waypoints, routeData, isCalculating]);

  return (
    <div className={className}>
      <div
        ref={mapRef}
        className="w-full h-full rounded-lg shadow-md"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}
