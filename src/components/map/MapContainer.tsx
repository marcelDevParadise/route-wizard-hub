import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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

interface MapContainerProps {
  className?: string;
  waypoints?: Waypoint[];
  routeData?: RouteData;
  isCalculating?: boolean;
}

export function MapContainer({ className, waypoints = [], routeData, isCalculating }: MapContainerProps) {
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
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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

  // Function to get coordinates for addresses (mock geocoding)
  const getCoordinatesForAddress = (address: string): [number, number] => {
    const addressMap: { [key: string]: [number, number] } = {
      'berlin': [52.520008, 13.404954],
      'paris': [48.856614, 2.3522219],
      'münchen': [48.1351, 11.5820],
      'hamburg': [53.5511, 9.9937],
      'köln': [50.9375, 6.9603],
      'frankfurt': [50.1109, 8.6821],
      'stuttgart': [48.7758, 9.1829],
      'düsseldorf': [51.2277, 6.7735],
      'hannover': [52.3676, 9.7320],
      'leipzig': [51.3397, 12.3731]
    };

    const addressLower = address.toLowerCase();
    for (const [key, coords] of Object.entries(addressMap)) {
      if (addressLower.includes(key)) {
        return coords;
      }
    }
    
    // Default to Germany center if address not found
    return [51.1657, 10.4515];
  };

  // Update map when waypoints or route data changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing markers and polyline
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];
    
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    // Add markers for waypoints with addresses
    const validWaypoints = waypoints.filter(wp => wp.address);
    if (validWaypoints.length === 0) return;

    const bounds = L.latLngBounds([]);

    validWaypoints.forEach((waypoint, index) => {
      const coords = getCoordinatesForAddress(waypoint.address);
      
      // Create custom icons based on waypoint type
      let iconColor = '#3b82f6'; // blue for waypoints
      if (waypoint.id === 'start') iconColor = '#10b981'; // green for start
      if (waypoint.id === 'end') iconColor = '#ef4444'; // red for end

      const customIcon = L.divIcon({
        html: `<div style="background-color: ${iconColor}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
          ${waypoint.id === 'start' ? 'S' : waypoint.id === 'end' ? 'Z' : index}
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12],
        className: 'custom-waypoint-icon'
      });

      const marker = L.marker(coords, { icon: customIcon }).addTo(map);
      marker.bindPopup(`<b>${waypoint.label}</b><br>${waypoint.address}`);
      
      markersRef.current.push(marker);
      bounds.extend(coords);
    });

    // Add route polyline if route is calculated
    if (routeData && validWaypoints.length >= 2) {
      const routeCoords = validWaypoints.map(wp => getCoordinatesForAddress(wp.address));
      
      const polyline = L.polyline(routeCoords, {
        color: 'hsl(155, 75%, 40%)', // travel color
        weight: 4,
        opacity: 0.8
      }).addTo(map);
      
      polylineRef.current = polyline;
      
      // Extend bounds to include the route
      polyline.getBounds().isValid() && bounds.extend(polyline.getBounds());
    }

    // Fit map to show all markers/route
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }

  }, [waypoints, routeData]);

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