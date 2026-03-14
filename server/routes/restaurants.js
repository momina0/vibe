import express from 'express';
import axios from 'axios';
import Groq from 'groq-sdk';

const router = express.Router();

// ── Haversine distance (km) ──────────────────────────────────────────────────
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Sanitize user input ──────────────────────────────────────────────────────
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'`]/g, '').substring(0, 500).trim();
}

// ── Delay helper to prevent Overpass API rate limits ─────────────────────────
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── POST /api/restaurants/search ─────────────────────────────────────────────
router.post('/search', async (req, res) => {
  const { vibe, city, lat, lng } = req.body;

  if (!vibe || !city) {
    return res.status(400).json({ error: 'Vibe and city are required' });
  }

  const cleanVibe = sanitize(vibe);
  const cleanCity = sanitize(city);
  const userLat = lat && !isNaN(parseFloat(lat)) ? parseFloat(lat) : null;
  const userLng = lng && !isNaN(parseFloat(lng)) ? parseFloat(lng) : null;

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // ── Step 1: Groq interprets the vibe into OpenStreetMap tags ────────────
  let interpretation = {
    vibeDescription: cleanVibe,
    osmTags: { amenity: 'restaurant' },
    fallbackTags: { amenity: 'cafe' },
    mustHave: [],
    avoid: [],
  };

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a food expert specializing in Pakistani restaurant culture (Karachi, Lahore, Islamabad, Faisalabad, etc.).
We are using OpenStreetMap (Overpass API) to find restaurants.

Think step by step before answering:
1. What TYPE of place does this vibe call for?
   - OpenStreetMap tags examples: {"amenity": "cafe"}, {"amenity": "restaurant", "cuisine": "pakistani"}, {"amenity": "restaurant", "cuisine": "burger"}, {"amenity": "fast_food"}, {"amenity": "ice_cream"}.
2. What is a broader fallback tag if the first one yields no results? (e.g. just {"amenity": "restaurant"})

Return ONLY a valid JSON object with:
- vibeDescription: string — friendly one-liner of what you understood (max 12 words)
- osmTags: object — exact OpenStreetMap tags to search for (e.g. {"amenity": "cafe"})
- fallbackTags: object — broader OpenStreetMap tags if the first fails (e.g. {"amenity": "restaurant"})
- mustHave: string[] — 2-3 features this place MUST have to match the vibe
- avoid: string[] — 1-2 things that would be a bad match`,
        },
        {
          role: 'user',
          content: `Vibe: "${cleanVibe}"\nCity: ${cleanCity}, Pakistan`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 400,
      temperature: 0.5,
    });
    interpretation = JSON.parse(completion.choices[0].message.content);
  } catch (aiErr) {
    console.warn('Groq Step 1 failed, using fallback:', aiErr.message);
  }

  // Helper to build Overpass API query
  const buildOverpassQuery = (tags, areaName, lat, lng, radius = 5000) => {
    const tagFilters = Object.entries(tags).map(([k, v]) => `["${k}"="${v}"]`).join('');
    
    if (lat !== null && lng !== null) {
      // Search around GPS coordinates
      return `
        [out:json][timeout:25];
        nwr${tagFilters}(around:${radius},${lat},${lng});
        out center;
      `;
    } else {
      // Search by city name
      return `
        [out:json][timeout:25];
        area["name:en"="${areaName}"]->.searchArea;
        (
          area["name"="${areaName}"]->.searchArea;
        );
        nwr${tagFilters}(area.searchArea);
        out center;
      `;
    }
  };

  // ── Step 2: Query OpenStreetMap via Overpass API ─────────────────────────
  let overpassElements = [];
  
  try {
    // Increase base radius to 15km to find better spots even if further away
    const query1 = buildOverpassQuery(interpretation.osmTags || { amenity: 'restaurant' }, cleanCity, userLat, userLng, 15000);
    
    let response = await axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(query1)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    overpassElements = response.data.elements || [];

    // Fallback if no results
    if (overpassElements.length === 0 && interpretation.fallbackTags) {
      await delay(1000); // polite delay
      const query2 = buildOverpassQuery(interpretation.fallbackTags, cleanCity, userLat, userLng, 20000);
      response = await axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(query2)}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      overpassElements = response.data.elements || [];
    }
    
    // Ultimate fallback: Just any restaurant/cafe
    if (overpassElements.length === 0) {
      await delay(1000);
      const query3 = buildOverpassQuery({ amenity: 'restaurant' }, cleanCity, null, null); 
      response = await axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(query3)}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      overpassElements = response.data.elements || [];
    }

  } catch (osmErr) {
    console.error('Overpass API error:', osmErr.message);
    return res.status(500).json({ error: 'Could not fetch restaurants from maps.' });
  }

  // Filter out results without names and format them
  let places = overpassElements
    .filter(e => e.tags && e.tags.name)
    .map(e => {
       const placeLat = e.lat || e.center?.lat;
       const placeLng = e.lon || e.center?.lon;
       
       let distanceKm = null;
       if (userLat !== null && userLng !== null && placeLat && placeLng) {
         distanceKm = getDistance(userLat, userLng, placeLat, placeLng).toFixed(1);
       }
       
       const tags = e.tags;
       const address = [tags['addr:street'], tags['addr:city'] || cleanCity, 'Pakistan']
         .filter(Boolean).join(', ');

       const types = [tags.amenity, tags.cuisine].filter(Boolean);

       return {
         id: e.id.toString(),
         name: tags.name,
         rating: null, // OSM doesn't have ratings natively
         totalRatings: 0,
         address,
         lat: placeLat,
         lng: placeLng,
         distance: distanceKm,
         reviews: [], // No visitor reviews in OSM
         photoUrl: null, // Hard to get reliably from OSM
         isOpen: tags.opening_hours ? true : null, // Simplification
         priceLevel: null,
         phone: tags.phone || tags['contact:phone'] || null,
         website: tags.website || tags['contact:website'] || null,
         types,
         mapsUrl: `https://www.google.com/maps/search/?api=1&query=${placeLat},${placeLng}`,
         vibeScore: null,
         vibeReason: null,
       };
    });

  // Unique by name and distance logic
  const uniquePlaces = [];
  const seenNames = new Set();
  for (const p of places) {
    if (!seenNames.has(p.name.toLowerCase())) {
      seenNames.add(p.name.toLowerCase());
      uniquePlaces.push(p);
    }
  }

  // Pre-sort by distance to feed the closest ones to Groq initially, but we allow 25 now
  uniquePlaces.sort((a, b) => {
    if (a.distance !== null && b.distance !== null) return parseFloat(a.distance) - parseFloat(b.distance);
    return 0;
  });

  // Take top 25 so AI has more to choose from
  let restaurants = uniquePlaces.slice(0, 25);

  // ── Step 3: Groq AI re-ranks restaurants by vibe match ──────────────────
  try {
    const candidateList = restaurants.map((r, i) => ({
      index: i,
      name: r.name,
      types: r.types.join(', '),
      distance: r.distance + ' km',
      description: r.description
    }));

    if (candidateList.length > 0) {
      const rankCompletion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a Pakistani food expert who judges how well restaurants match a customer's specific vibe/mood.
  
  For each restaurant in the list, give:
  - vibeScore: integer 1-10 (10 = perfect match, 1 = terrible match)
  - vibeReason: string — one punchy sentence (max 12 words) explaining WHY it matches or doesn't
  
  Return ONLY a valid JSON object: { "scores": [ { "index": 0, "vibeScore": 8, "vibeReason": "..." }, ... ] }`
          },
          {
            role: 'user',
            content: `User vibe: "${cleanVibe}"
What they want: ${interpretation.vibeDescription}
Must-haves: ${(interpretation.mustHave || []).join(', ') || 'none specified'}

Restaurants:
${JSON.stringify(candidateList, null, 2)}`
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 600,
        temperature: 0.3,
      });

      const scoreData = JSON.parse(rankCompletion.choices[0].message.content);
      const scores = scoreData.scores || [];

      for (const s of scores) {
        if (restaurants[s.index]) {
          restaurants[s.index].vibeScore = s.vibeScore ?? null;
          restaurants[s.index].vibeReason = s.vibeReason ?? null;
        }
      }

      // Sort by vibeScore desc entirely! Distance is only a tie-breaker.
      restaurants.sort((a, b) => {
        const scoreDiff = (b.vibeScore || 0) - (a.vibeScore || 0);
        if (scoreDiff !== 0) return scoreDiff; // STRICT priority to AI Vibe Score
        
        // Tie-breaker: closest first
        if (a.distance !== null && b.distance !== null) return parseFloat(a.distance) - parseFloat(b.distance);
        return 0;
      });
      
      // Cut back down to top 15 after AI has ranked them all
      restaurants = restaurants.slice(0, 15);
    }
  } catch (rankErr) {
    console.warn('Groq Step 3 re-ranking failed:', rankErr.message);
  }

  res.json({ restaurants, interpretation });
});

export default router;
