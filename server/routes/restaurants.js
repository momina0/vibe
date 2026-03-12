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

  const FSQ_KEY = process.env.FOURSQUARE_API_KEY;
  const fsqHeaders = { Authorization: FSQ_KEY };

  // ── Step 1: Groq AI interprets the vibe (FREE) ──────────────────────────
  let interpretation = {
    searchQuery: `restaurant ${cleanVibe} ${cleanCity}`,
    vibeDescription: cleanVibe,
    keywords: ['restaurant', cleanCity, 'Pakistan'],
  };

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama3-8b-8192',
      messages: [
        {
          role: 'system',
          content: `You are a food expert specializing in Pakistani restaurant culture (Karachi, Lahore, Islamabad, Peshawar, Quetta, etc.).
Convert the user's vibe/mood into restaurant search parameters.
Return ONLY a valid JSON object with:
- searchQuery: string — a short search phrase for the restaurant type (e.g. "desi karahi lahore" or "rooftop cafe islamabad")
- vibeDescription: string — short friendly phrase of what you understood, max 12 words
- keywords: string[] — 3-5 food/atmosphere keywords`,
        },
        {
          role: 'user',
          content: `Vibe: "${cleanVibe}"\nCity: ${cleanCity}, Pakistan`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 250,
      temperature: 0.7,
    });
    interpretation = JSON.parse(completion.choices[0].message.content);
  } catch (aiErr) {
    console.warn('Groq AI interpretation failed, using fallback:', aiErr.message);
  }

  // ── Step 2: Foursquare Places Search (FREE — 1000 calls/day) ────────────
  const searchParams = {
    query: interpretation.searchQuery || `restaurant ${cleanCity}`,
    categories: '13065', // Foursquare "Restaurant" category
    limit: 10,
    fields: 'fsq_id,name,geocodes,location,categories,distance,rating,stats,price,photos,hours',
  };

  if (userLat !== null && userLng !== null) {
    searchParams.ll = `${userLat},${userLng}`;
    searchParams.radius = 5000;
  } else {
    searchParams.near = `${cleanCity}, Pakistan`;
  }

  let places = [];
  try {
    const searchRes = await axios.get(
      'https://api.foursquare.com/v3/places/search',
      { headers: fsqHeaders, params: searchParams, timeout: 12000 }
    );
    places = searchRes.data.results || [];
  } catch (fsqErr) {
    console.error('Foursquare search error:', fsqErr.response?.data || fsqErr.message);
    return res
      .status(500)
      .json({ error: 'Could not fetch restaurants. Check your Foursquare API key.' });
  }

  // ── Step 3: Enrich top 8 with tips (visitor reviews) ────────────────────
  const enriched = await Promise.allSettled(
    places.slice(0, 8).map(async (place) => {
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

      // Distance: prefer FSQ-provided metres, else compute from coords
      let distanceKm = null;
      if (place.distance != null) {
        distanceKm = (place.distance / 1000).toFixed(1);
      } else if (userLat !== null && userLng !== null && placeLat && placeLng) {
        distanceKm = getDistance(userLat, userLng, placeLat, placeLng).toFixed(1);
      }

      // Foursquare CDN photos have direct HTTPS URLs — no proxy needed
      const photo = place.photos?.[0];
      const photoUrl = photo ? `${photo.prefix}800x600${photo.suffix}` : null;

      // FSQ rating is 0–10 → convert to 0–5
      const rawRating = place.rating ?? null;
      const rating = rawRating !== null ? parseFloat((rawRating / 2).toFixed(1)) : null;

      const loc = place.location || {};
      const address = [loc.address, loc.locality || loc.city, loc.country]
        .filter(Boolean)
        .join(', ') || `${cleanCity}, Pakistan`;

      const types = (place.categories || []).map((c) => c.name).slice(0, 3);

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
        photoUrl,                // direct CDN URL
        isOpen: place.hours?.open_now ?? null,
        priceLevel: place.price ?? null,
        types,
        mapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(
          place.name + ' ' + cleanCity + ' Pakistan'
        )}`,
      };
    })
  );

  const restaurants = enriched
    .filter((r) => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value)
    .sort((a, b) => {
      if (a.distance !== null && b.distance !== null)
        return parseFloat(a.distance) - parseFloat(b.distance);
      return (b.rating || 0) - (a.rating || 0);
    });

  res.json({ restaurants, interpretation });
});

export default router;
