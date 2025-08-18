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

interface MapContainerProps {
  className?: string;
}

export function MapContainer({ className }: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

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

    // Add sample markers
    const startMarker = L.marker([52.520008, 13.404954], {
      title: 'Start: Berlin'
    }).addTo(map);
    startMarker.bindPopup('<b>Start</b><br>Berlin, Deutschland');

    const endMarker = L.marker([48.856614, 2.3522219], {
      title: 'Ziel: Paris'
    }).addTo(map);
    endMarker.bindPopup('<b>Ziel</b><br>Paris, Frankreich');

    // Sample route polyline
    const routePoints: [number, number][] = [
      [52.520008, 13.404954], // Berlin
      [52.3676, 9.7320], // Hannover
      [51.2277, 6.7735], // Düsseldorf
      [50.9375, 6.9603], // Köln
      [50.1109, 8.6821], // Frankfurt
      [49.4521, 11.0767], // Nürnberg
      [48.1351, 11.5820], // München
      [48.856614, 2.3522219] // Paris
    ];

    const routePolyline = L.polyline(routePoints, {
      color: 'hsl(155, 75%, 40%)', // Using travel color from design system
      weight: 4,
      opacity: 0.8
    }).addTo(map);

    // Fit map to show the route
    map.fitBounds(routePolyline.getBounds(), { padding: [20, 20] });

    mapInstanceRef.current = map;

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

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