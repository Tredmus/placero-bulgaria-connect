import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    if (!query || query.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Query must be at least 3 characters long' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the Mapbox token from Supabase secrets
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    
    if (!mapboxToken) {
      return new Response(
        JSON.stringify({ 
          error: 'Mapbox token not configured',
          message: 'Please add MAPBOX_PUBLIC_TOKEN to Supabase Edge Function Secrets' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Geocode the address using Mapbox Geocoding API
    // Restrict to Bulgaria using country filter
    const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
      `access_token=${mapboxToken}&` +
      `country=bg&` + // Restrict to Bulgaria
      `types=place,postcode,address&` +
      `limit=5&` +
      `language=bg`; // Bulgarian language

    console.log('Geocoding request for:', query);
    
    const response = await fetch(geocodingUrl);
    
    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('Geocoding results:', data.features?.length || 0, 'suggestions');

    return new Response(
      JSON.stringify(data),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in geocode-address function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})