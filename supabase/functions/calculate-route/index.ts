import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Waypoint {
  id: string;
  label: string;
  address: string;
  lat?: number;
  lng?: number;
}

interface RouteRequest {
  waypoints: Waypoint[];
  mode: "car" | "walking";
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  fastestRoute?: boolean; // ORS nutzt Präferenzen im Profil; Feld wird aktuell nicht verwendet
}

// --- Utils ---
function calculateSimpleDistance(waypoints: Array<{ lat: number; lng: number }>): number {
  if (waypoints.length < 2) return 0;
  let totalKm = 0;
  const R = 6371; // km
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    const dLat = ((to.lat - from.lat) * Math.PI) / 180;
    const dLng = ((to.lng - from.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((from.lat * Math.PI) / 180) *
        Math.cos((to.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalKm += R * c;
  }
  return totalKm;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // Nominatim braucht eine aussagekräftige User-Agent/Referer Policy
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { "User-Agent": "route-wizard-hub/1.0 (contact: your-email@example.com)" } }
    );
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch (err) {
    console.error("Geocoding error:", err);
    return null;
  }
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { waypoints, mode, avoidTolls, avoidHighways }: RouteRequest = await req.json();

    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      return new Response(
        JSON.stringify({ error: "Mindestens 2 gültige Adressen erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orsApiKey = Deno.env.get("OPENROUTE_SERVICE_API_KEY");
    if (!orsApiKey) throw new Error("OpenRouteService API key not configured");

    // Geocoding fehlender Koordinaten
    const geocoded = await Promise.all(
      waypoints.map(async (wp) => {
        if (Number.isFinite(wp.lat) && Number.isFinite(wp.lng)) return wp;
        const coords = await geocodeAddress(wp.address);
        return coords ? { ...wp, ...coords } : wp;
      })
    );

    // Nur valide Punkte
    const valid = geocoded.filter((w) => Number.isFinite(w.lat) && Number.isFinite(w.lng)) as Array<
      Waypoint & { lat: number; lng: number }
    >;

    if (valid.length < 2) {
      return new Response(
        JSON.stringify({ error: "Mindestens 2 geokodierte Adressen erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ORS-Profile & Optionen
    const profile = mode === "walking" ? "foot-walking" : "driving-car";
    const options: Record<string, unknown> = {};
    if (profile === "driving-car") {
      const avoid: string[] = [];
      if (avoidTolls) avoid.push("tollways");
      if (avoidHighways) avoid.push("highways");
      if (avoid.length) options.avoid_features = avoid;
    }

    // ORS Request: ERZINGE GeoJSON als Geometrie!
    const coordinates: [number, number][] = valid.map((w) => [w.lng, w.lat]); // [lon,lat]
    const orsRes = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}`, {
      method: "POST",
      headers: {
        Authorization: orsApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates,                 // [[lon,lat], ...]
        options: Object.keys(options).length ? options : undefined,
        instructions: true,
        geometry: true,
        geometry_format: "geojson",  // << wichtig: liefert LineString + coordinates
        units: "km",
      }),
    });

    if (!orsRes.ok) {
      const txt = await orsRes.text();
      console.error("OpenRouteService error:", txt);
      // -> Fallback Luftlinie (klar markiert)
      const km = calculateSimpleDistance(valid);
      const mins = Math.round((km / 60) * 60); // 60 km/h ≈ 1 km/min
      return new Response(
        JSON.stringify({
          distance: `${Math.round(km).toLocaleString("de-DE")} km`,
          duration: mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}min` : `${mins}min`,
          instructions: valid.map((wp, i) =>
            i === 0
              ? `1. Start in ${wp.address}`
              : i === valid.length - 1
              ? `${i + 1}. Ziel: ${wp.address}`
              : `${i + 1}. Weiter nach ${wp.address}`
          ),
          // bewusst einfache Verbindungslinie (Leaflet erwartet [lat,lng])
          geometry: valid.map((w) => [w.lat, w.lng]),
          waypoints: valid,
          fallback: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await orsRes.json();

    // Harte Validierung der ORS-Antwort
    if (!data?.routes?.length || !data.routes[0]?.geometry) {
      console.warn("ORS returned no usable route, falling back.");
      const km = calculateSimpleDistance(valid);
      const mins = Math.round((km / 60) * 60);
      return new Response(
        JSON.stringify({
          distance: `${Math.round(km).toLocaleString("de-DE")} km`,
          duration: mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}min` : `${mins}min`,
          instructions: valid.map((wp, i) =>
            i === 0
              ? `1. Start in ${wp.address}`
              : i === valid.length - 1
              ? `${i + 1}. Ziel: ${wp.address}`
              : `${i + 1}. Weiter nach ${wp.address}`
          ),
          geometry: valid.map((w) => [w.lat, w.lng]),
          waypoints: valid,
          fallback: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const route = data.routes[0];
    // ORS liefert dank geometry_format=geojson:
    // route.geometry = { type: 'LineString', coordinates: [[lon,lat], ...] }

    const distanceKm = Math.round((route?.summary?.distance ?? 0) / 1000);
    const durSec = route?.summary?.duration ?? 0;
    const durH = Math.floor(durSec / 3600);
    const durM = Math.round((durSec % 3600) / 60);

    // Turn-by-Turn
    const instructions: string[] = Array.isArray(route?.segments)
      ? route.segments.flatMap((segment: any) =>
          Array.isArray(segment?.steps)
            ? segment.steps.map((step: any, i: number) => `${i + 1}. ${step.instruction}`)
            : []
        )
      : [];

    // === Wichtig: Gib das **GeoJSON LineString** nach vorn ===
    const lineString =
      route.geometry?.type === "LineString" && Array.isArray(route.geometry?.coordinates)
        ? route.geometry
        : { type: "LineString", coordinates: [] };

    const result = {
      distance: `${distanceKm.toLocaleString("de-DE")} km`,
      duration: durH > 0 ? `${durH}h ${durM}min` : `${durM}min`,
      instructions,
      geometry: lineString, // <-- GeoJSON (LngLat). Frontend dreht für Leaflet nach [lat,lng].
      waypoints: valid,
      fallback: false,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in calculate-route function:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Fehler bei der Routenberechnung" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
