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

// ── Foursquare category IDs for common Pakistani vibes ──────────────────────
// See: https://location.foursquare.com/developer/reference/categories
const VIBE_CATEGORY_MAP = {
  cafe:       '13032', // Café
  coffee:     '13032',
  chai:       '13032',
  rooftop:    '13065', // Restaurant (generic, filtered by query)
  fine:       '13064', // Fine Dining
  'fine dining': '13064',
  romantic:   '13064',
  fast:       '13145', // Fast Food
  burger:     '13145',
  pizza:      '13145',
  street:     '13306', // Street Food
  karahi:     '13065',
  bbq:        '13049', // BBQ
  grill:      '13049',
  bar:        '13003', // Bar (for mocktail/shisha spots etc.)
  shisha:     '13003',
  bakery:     '13002', // Bakery
  dessert:    '13040', // Dessert Shop
  ice:        '13040',
  biryani:    '13065',
  desi:       '13065',
};

function pickCategory(keywords = []) {
  const lower = keywords.map((k) => k.toLowerCase());
  for (const [key, cat] of Object.entries(VIBE_CATEGORY_MAP)) {
    if (lower.some((k) => k.includes(key))) return cat;
  }
  return '13065'; // default: Restaurant
}

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
  const FSQ_KEY = process.env.FOURSQUARE_API_KEY;
  const fsqHeaders = { Authorization: FSQ_KEY };

  // ── Step 1: Groq interprets the vibe with structured reasoning ───────────
  let interpretation = {
    searchQuery: `restaurant ${cleanVibe} ${cleanCity}`,
    searchQuery2: `${cleanCity} restaurant`,
    vibeDescription: cleanVibe,
    keywords: ['restaurant', cleanCity, 'Pakistan'],
    mustHave: [],
    avoid: [],
  };

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama3-8b-8192',
      messages: [
        {
          role: 'system',
          content: `You are a food expert specializing in Pakistani restaurant culture (Karachi, Lahore, Islamabad, Peshawar, Quetta, etc.).

Think step by step before answering:
1. What TYPE of place does this vibe call for? (e.g. rooftop cafe, desi dhaba, fine dining, fast food, street food)
2. What specific FOOD or CUISINE fits? (e.g. karahi, biryani, burgers, chai, continental)
3. What ATMOSPHERE matters? (e.g. quiet, lively, outdoor, family-friendly, romantic)

Return ONLY a valid JSON object with:
- searchQuery: string — primary search phrase for Foursquare (e.g. "rooftop cafe islamabad" or "desi karahi lahore")
- searchQuery2: string — an ALTERNATIVE, slightly different search phrase to catch more results (e.g. "karahi restaurant outdoor" or "coffee lounge islamabad")
- vibeDescription: string — friendly one-liner of what you understood, max 12 words
- keywords: string[] — 3-5 food/atmosphere keywords (lowercase)
- mustHave: string[] — 2-3 features this place MUST have to match the vibe (e.g. ["outdoor seating", "late night"])
- avoid: string[] — 1-2 things that would be a bad match (e.g. ["fast food", "noisy"])`,
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

  // ── Step 2: Dual Foursquare queries for broader coverage ─────────────────
  const categoryId = pickCategory(interpretation.keywords || []);

  const baseParams = {
    categories: categoryId,
    limit: 10,
    fields: 'fsq_id,name,geocodes,location,categories,distance,rating,stats,price,photos,hours,description',
  };

  if (userLat !== null && userLng !== null) {
    baseParams.ll = `${userLat},${userLng}`;
    baseParams.radius = 8000;
  } else {
    baseParams.near = `${cleanCity}, Pakistan`;
  }

  let places = [];
  try {
    // Run both queries in parallel
    const [res1, res2] = await Promise.allSettled([
      axios.get('https://api.foursquare.com/v3/places/search', {
        headers: fsqHeaders,
        params: { ...baseParams, query: interpretation.searchQuery || `restaurant ${cleanCity}` },
        timeout: 12000,
      }),
      axios.get('https://api.foursquare.com/v3/places/search', {
        headers: fsqHeaders,
        params: { ...baseParams, query: interpretation.searchQuery2 || `${cleanCity} restaurant`, categories: '13065' },
        timeout: 12000,
      }),
    ]);

    const set1 = res1.status === 'fulfilled' ? (res1.value.data.results || []) : [];
    const set2 = res2.status === 'fulfilled' ? (res2.value.data.results || []) : [];

    // Merge and deduplicate by fsq_id
    const seen = new Set();
    for (const p of [...set1, ...set2]) {
      if (!seen.has(p.fsq_id)) {
        seen.add(p.fsq_id);
        places.push(p);
      }
    }
  } catch (fsqErr) {
    console.error('Foursquare search error:', fsqErr.response?.data || fsqErr.message);
    return res
      .status(500)
      .json({ error: 'Could not fetch restaurants. Check your Foursquare API key.' });
  }

  // ── Step 3: Enrich top 10 with tips (visitor reviews) ───────────────────
  const enriched = await Promise.allSettled(
    places.slice(0, 10).map(async (place) => {
      let tips = [];
      try {
        const tipsRes = await axios.get(
          `https://api.foursquare.com/v3/places/${place.fsq_id}/tips`,
          {
            headers: fsqHeaders,
            params: { limit: 3, fields: 'text,created_at,agree_count' },
            timeout: 8000,
          }
        );
        tips = tipsRes.data.results || [];
      } catch {
        // Tips are optional
      }

      const geo = place.geocodes?.main;
      const placeLat = geo?.latitude ?? null;
      const placeLng = geo?.longitude ?? null;

      let distanceKm = null;
      if (place.distance != null) {
        distanceKm = (place.distance / 1000).toFixed(1);
      } else if (userLat !== null && userLng !== null && placeLat && placeLng) {
        distanceKm = getDistance(userLat, userLng, placeLat, placeLng).toFixed(1);
      }

      const photo = place.photos?.[0];
      const photoUrl = photo ? `${photo.prefix}800x600${photo.suffix}` : null;

      const rawRating = place.rating ?? null;
      const rating = rawRating !== null ? parseFloat((rawRating / 2).toFixed(1)) : null;

      const loc = place.location || {};
      const address = [loc.address, loc.locality || loc.city, loc.country]
        .filter(Boolean)
        .join(', ') || `${cleanCity}, Pakistan`;

      const types = (place.categories || []).map((c) => c.name).slice(0, 3);
      const tipTexts = tips.map((t) => (t.text || '').substring(0, 150)).join(' | ');

      return {
        id: place.fsq_id,
        name: place.name,
        rating,
        totalRatings: place.stats?.total_ratings ?? 0,
        address,
        lat: placeLat,
        lng: placeLng,
        distance: distanceKm,
        reviews: tips.map((t) => ({
          author: 'Visitor',
          rating: null,
          text: (t.text || '').substring(0, 200),
          time: t.created_at
            ? new Date(t.created_at * 1000).toLocaleDateString('en-PK', {
                month: 'short',
                year: 'numeric',
              })
            : '',
        })),
        photoUrl,
        isOpen: place.hours?.open_now ?? null,
        priceLevel: place.price ?? null,
        types,
        tipTexts, // used internally for AI scoring
        mapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(
          place.name + ' ' + cleanCity + ' Pakistan'
        )}`,
        // AI score fields — filled in Step 4
        vibeScore: null,
        vibeReason: null,
      };
    })
  );

  let restaurants = enriched
    .filter((r) => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);

  // ── Step 4: Groq AI re-ranks restaurants by vibe match ──────────────────
  // The AI reads each restaurant's name, type, and real visitor tips, then
  // scores how well it matches the original vibe — this is the key accuracy fix.
  try {
    const candidateList = restaurants.map((r, i) => ({
      index: i,
      name: r.name,
      types: r.types.join(', '),
      rating: r.rating,
      isOpen: r.isOpen,
      priceLevel: r.priceLevel,
      visitorTips: r.tipTexts || 'No tips available',
    }));

    const rankCompletion = await groq.chat.completions.create({
      model: 'llama3-8b-8192',
      messages: [
        {
          role: 'system',
          content: `You are a Pakistani food expert who judges how well restaurants match a customer's specific vibe/mood.

For each restaurant in the list, give:
- vibeScore: integer 1-10 (10 = perfect match, 1 = terrible match)
- vibeReason: string — one punchy sentence (max 12 words) explaining WHY it matches or doesn't

Be honest and critical. A "romantic" vibe should score fast food chains very low.
A "late night karahi" vibe should score upscale continental restaurants low.

Return ONLY a valid JSON object: { "scores": [ { "index": 0, "vibeScore": 8, "vibeReason": "..." }, ... ] }`,
        },
        {
          role: 'user',
          content: `User vibe: "${cleanVibe}"
What they want: ${interpretation.vibeDescription}
Must-have features: ${(interpretation.mustHave || []).join(', ') || 'none specified'}
Avoid: ${(interpretation.avoid || []).join(', ') || 'none specified'}

Restaurants to score:
${JSON.stringify(candidateList, null, 2)}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 600,
      temperature: 0.3,
    });

    const scoreData = JSON.parse(rankCompletion.choices[0].message.content);
    const scores = scoreData.scores || [];

    // Apply scores back to restaurants
    for (const s of scores) {
      if (restaurants[s.index]) {
        restaurants[s.index].vibeScore = s.vibeScore ?? null;
        restaurants[s.index].vibeReason = s.vibeReason ?? null;
      }
    }

    // Sort by vibeScore desc, fall back to rating
    restaurants.sort((a, b) => {
      const scoreDiff = (b.vibeScore || 0) - (a.vibeScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.rating || 0) - (a.rating || 0);
    });
  } catch (rankErr) {
    console.warn('Groq Step 4 re-ranking failed, falling back to distance/rating sort:', rankErr.message);
    restaurants.sort((a, b) => {
      if (a.distance !== null && b.distance !== null)
        return parseFloat(a.distance) - parseFloat(b.distance);
      return (b.rating || 0) - (a.rating || 0);
    });
  }

  // Strip internal-only tipTexts field before sending to client
  restaurants = restaurants.map(({ tipTexts, ...r }) => r);

  res.json({ restaurants, interpretation });
});

export default router;

