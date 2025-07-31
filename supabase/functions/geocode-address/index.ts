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

    // Try multiple search strategies for better accuracy
    const searchStrategies = [
      // Original query
      query,
      // Add "ul." prefix for street addresses
      query.toLowerCase().includes('ul.') ? query : `ul. ${query}`,
      // Try with different formatting
      query.replace(/\s+/g, ' ').trim(),
      // Add Bulgaria context if not present
      query.toLowerCase().includes('bulgaria') ? query : `${query}, Bulgaria`
    ];

    console.log('Geocoding request for:', query);
    console.log('Trying strategies:', searchStrategies);
    
    let allResults = [];
    
    for (const searchQuery of searchStrategies) {
      const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?` +
        `access_token=${mapboxToken}&` +
        `country=bg&` + // Restrict to Bulgaria
        `types=place,postcode,address&` +
        `limit=3&` +
        `language=bg`; // Bulgarian language

      try {
        const response = await fetch(geocodingUrl);
        
        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            // Add strategy info and accuracy score to each result
            const enrichedFeatures = data.features.map((feature, index) => ({
              ...feature,
              strategy: searchQuery,
              accuracy_score: 1 - (index * 0.1), // Higher score for first results
              coordinates_display: `${feature.center[1].toFixed(6)}, ${feature.center[0].toFixed(6)}`
            }));
            allResults.push(...enrichedFeatures);
          }
        }
      } catch (error) {
        console.error(`Strategy "${searchQuery}" failed:`, error);
      }
    }
    
    // Remove duplicates and sort by accuracy
    const uniqueResults = allResults.filter((result, index, self) => 
      index === self.findIndex(r => 
        Math.abs(r.center[0] - result.center[0]) < 0.001 && 
        Math.abs(r.center[1] - result.center[1]) < 0.001
      )
    ).sort((a, b) => b.accuracy_score - a.accuracy_score).slice(0, 5);
    
    const data = { features: uniqueResults };
    
    console.log('Geocoding results:', data.features?.length || 0, 'suggestions with strategies');

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