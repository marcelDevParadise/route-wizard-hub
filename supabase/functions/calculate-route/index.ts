import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- Typen ---
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
  fastestRoute?: boolean;
}

// --- Utils ---
function calculateSimpleDistance(
  waypoints: Array<{ lat: number; lng: number }>,
): number {
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

async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${
        encodeURIComponent(address)
      }&limit=1&countrycodes=de`,
      {
        headers: {
          "User-Agent": "route-wizard-hub/1.0 (contact: your-email@example.com)",
        },
      },
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

// entfernt direkt aufeinanderfolgende Duplikate
function dedupeConsecutive(points: Array<{ lat: number; lng: number }>) {
  const out: Array<{ lat: number; lng: number }> = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last.lat !== p.lat || last.lng !== p.lng) out.push(p);
  }
  return out;
}

function almostEqual(a: number, b: number, tol = 1e-4) {
  return Math.abs(a - b) < tol;
}

// Haversine + Liniendistanz aus GeoJSON-LineString ([lon,lat])
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceFromLineStringKm(coords: [number, number][]) {
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

// --- Main Handler ---
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      waypoints,
      mode,
      avoidTolls,
      avoidHighways,
      fastestRoute,
    }: RouteRequest = await req.json();

    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      return new Response(
        JSON.stringify({
          fallback: true,
          errorMessage: "Mindestens 2 gültige Adressen erforderlich",
          geometry: [],
          waypoints: waypoints ?? [],
          distance: "0 km",
          duration: "0min",
          instructions: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
      }),
    );

    // Nur valide Punkte
    let valid = geocoded.filter((w) =>
      Number.isFinite(w.lat) && Number.isFinite(w.lng)
    ) as Array<Waypoint & { lat: number; lng: number }>;

    // Duplikate direkt hintereinander entfernen
    valid = dedupeConsecutive(valid);

    // Mindestens 2 unterschiedliche Punkte (mit Toleranz)
    if (
      valid.length < 2 ||
      (valid.length === 2 &&
        almostEqual(valid[0].lat, valid[1].lat) &&
        almostEqual(valid[0].lng, valid[1].lng))
    ) {
      return new Response(
        JSON.stringify({
          fallback: true,
          errorMessage:
            "Start und Ziel dürfen nicht identisch sein / zu wenig unterschiedliche Punkte haben",
          geometry: valid.map((w) => [w.lat, w.lng]),
          waypoints: valid,
          distance: "0 km",
          duration: "0min",
          instructions: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

    // ORS Request: GeoJSON-Endpoint verwenden
    const coordinates: [number, number][] = valid.map((w) => [w.lng, w.lat]); // [lon,lat]
    const orsRes = await fetch(
      `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
      {
        method: "POST",
        headers: {
          Authorization: orsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates,
          preference: fastestRoute ? "fastest" : "shortest",
          options: Object.keys(options).length ? options : undefined,
          instructions: true,
          units: "km",
        }),
      },
    );

    if (!orsRes.ok) {
      const txt = await orsRes.text();
      console.error("OpenRouteService error:", txt);
      const errMsg = (() => {
        try {
          const j = JSON.parse(txt);
          return j?.error?.message || j?.message || txt;
        } catch {
          return txt;
        }
      })();

      // -> Fallback Luftlinie
      const km = calculateSimpleDistance(valid);
      const mins = Math.round(km);

      return new Response(
        JSON.stringify({
          distance: `${Math.round(km).toLocaleString("de-DE")} km`,
          duration: mins >= 60
            ? `${Math.floor(mins / 60)}h ${mins % 60}min`
            : `${mins}min`,
          instructions: valid.map((wp, i) =>
            i === 0
              ? `1. Start in ${wp.address}`
              : i === valid.length - 1
              ? `${i + 1}. Ziel: ${wp.address}`
              : `${i + 1}. Weiter nach ${wp.address}`
          ),
          geometry: valid.map((w) => [w.lat, w.lng]), // Leaflet [lat,lng]
          waypoints: valid,
          fallback: true,
          errorMessage: `ORS HTTP ${orsRes.status}: ${errMsg}`,
          debug: {
            endpoint: `/v2/directions/${profile}/geojson`,
            profile,
            sentCoordinates: coordinates,
            reason: "http_error",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await orsRes.json();

    // ---- GeoJSON-Parsing (FeatureCollection) ----
    const feature = data?.features?.[0];
    if (
      !feature?.geometry ||
      feature.geometry.type !== "LineString" ||
      !Array.isArray(feature.geometry.coordinates)
    ) {
      console.warn("ORS returned no usable route, falling back.");
      const km = calculateSimpleDistance(valid);
      const mins = Math.round(km);

      return new Response(
        JSON.stringify({
          distance: `${km.toFixed(1).replace(".", ",")} km`,
          duration: mins >= 60
            ? `${Math.floor(mins / 60)}h ${mins % 60}min`
            : `${mins}min`,
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
          errorMessage: "ORS lieferte keine Route zwischen den Punkten.",
          debug: {
            endpoint: `/v2/directions/${profile}/geojson`,
            profile,
            sentCoordinates: coordinates,
            featureCount: Array.isArray(data?.features)
              ? data.features.length
              : 0,
            reason: "no_feature",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ----- Distanz/Dauer ermitteln -----
    const props = feature.properties ?? {};
    const summary = props.summary ?? {};

    // Distanz IMMER aus Geometrie summieren (statt summary.distance)
    let distanceMeters = Math.round(
      distanceFromLineStringKm(
        feature.geometry.coordinates as [number, number][],
      ) * 1000,
    );

    // Dauer: wenn summary.duration vorhanden, nimm sie; sonst grob schätzen
    let durationSeconds = Number(summary.duration);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      const km = distanceMeters / 1000;
      const speedKmh = profile === "foot-walking" ? 4.5 : 60;
      durationSeconds = Math.round((km / speedKmh) * 3600);
    }

    // Formatierung
    const distanceKm = distanceMeters / 1000;
    const durH = Math.floor(durationSeconds / 3600);
    const durM = Math.round((durationSeconds % 3600) / 60);

    const distanceStr = `${distanceKm.toFixed(1).replace(".", ",")} km`;
    const durationStr = durH > 0 ? `${durH}h ${durM}min` : `${durM}min`;

    const distanceSource: "geometry" = "geometry"; // explizit markieren

    // Turn-by-Turn
    const instructions: string[] = Array.isArray((props as any).segments)
      ? (props as any).segments.flatMap((segment: any) =>
          Array.isArray(segment?.steps)
            ? segment.steps.map(
                (step: any, i: number) => `${i + 1}. ${step.instruction}`,
              )
            : [],
        )
      : [];

    // GeoJSON LineString zurückgeben
    const lineString =
      feature.geometry?.type === "LineString" &&
      Array.isArray(feature.geometry?.coordinates)
        ? feature.geometry
        : { type: "LineString", coordinates: [] };

    const result = {
      distance: distanceStr,
      duration: durationStr,
      distanceMeters,
      distanceKm,
      durationSeconds,
      distanceSource,
      instructions,
      geometry: lineString,
      waypoints: valid,
      fallback: false,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in calculate-route function:", error);
    return new Response(
      JSON.stringify({
        error: error?.message ?? "Fehler bei der Routenberechnung",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
