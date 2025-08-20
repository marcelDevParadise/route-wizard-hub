import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  mode: 'car' | 'walking';
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  fastestRoute?: boolean;
}

// Geocoding function using Nominatim (free)
async function geocodeAddress(address: string): Promise<{lat: number, lng: number} | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
    );
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { waypoints, mode, avoidTolls, avoidHighways, fastestRoute }: RouteRequest = await req.json();
    
    console.log('Calculating route for waypoints:', waypoints.map(w => w.address));

    // Get OpenRouteService API key
    const orsApiKey = Deno.env.get('OPENROUTE_SERVICE_API_KEY');
    if (!orsApiKey) {
      throw new Error('OpenRouteService API key not configured');
    }

    // Geocode all waypoints that don't have coordinates
    const geocodedWaypoints = await Promise.all(
      waypoints.map(async (waypoint) => {
        if (waypoint.lat && waypoint.lng) {
          return waypoint;
        }
        
        const coords = await geocodeAddress(waypoint.address);
        if (coords) {
          return { ...waypoint, lat: coords.lat, lng: coords.lng };
        }
        return waypoint;
      })
    );

    // Filter out waypoints without coordinates
    const validWaypoints = geocodedWaypoints.filter(w => w.lat && w.lng);
    
    if (validWaypoints.length < 2) {
      throw new Error('Mindestens 2 gültige Adressen erforderlich');
    }

    // Prepare coordinates for OpenRouteService
    const coordinates = validWaypoints.map(w => [w.lng, w.lat]);
    
    // Map mode to OpenRouteService profile
    const profile = mode === 'walking' ? 'foot-walking' : 'driving-car';
    
    // Build options for car mode
    const options: any = {};
    if (mode === 'car') {
      options.avoid_features = [];
      if (avoidTolls) options.avoid_features.push('tollways');
      if (avoidHighways) options.avoid_features.push('highways');
      
      // Note: OpenRouteService uses different optimization approach
      // The fastest/shortest preference is handled by the profile itself
    }

    // Call OpenRouteService Directions API
    const orsResponse = await fetch(
      `https://api.openrouteservice.org/v2/directions/${profile}`,
      {
        method: 'POST',
        headers: {
          'Authorization': orsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates,
          ...(Object.keys(options).length > 0 && { options }),
          format: 'json',
          instructions: true,
          geometry: true,
        }),
      }
    );

    if (!orsResponse.ok) {
      const errorText = await orsResponse.text();
      console.error('OpenRouteService error:', errorText);
      throw new Error(`Routing service error: ${orsResponse.status}`);
    }

    const orsData = await orsResponse.json();
    
    if (!orsData.routes || orsData.routes.length === 0) {
      throw new Error('Keine Route gefunden');
    }

    const route = orsData.routes[0];
    const summary = route.summary;
    
    // Convert distance from meters to kilometers
    const distanceKm = Math.round(summary.distance / 1000);
    
    // Convert duration from seconds to hours and minutes
    const durationHours = Math.floor(summary.duration / 3600);
    const durationMinutes = Math.round((summary.duration % 3600) / 60);
    
    // Extract turn-by-turn instructions
    const instructions = route.segments.flatMap((segment: any) => 
      segment.steps.map((step: any, index: number) => 
        `${index + 1}. ${step.instruction}`
      )
    );

    // Decode geometry for route visualization
    const geometry = route.geometry;

    const result = {
      distance: `${distanceKm.toLocaleString('de-DE')} km`,
      duration: durationHours > 0 
        ? `${durationHours}h ${durationMinutes}min`
        : `${durationMinutes}min`,
      instructions,
      geometry,
      waypoints: validWaypoints,
    };

    console.log('Route calculated successfully:', {
      distance: result.distance,
      duration: result.duration,
      waypointCount: validWaypoints.length
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in calculate-route function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Fehler bei der Routenberechnung' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});