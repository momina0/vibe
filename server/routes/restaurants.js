import express from 'express';
import axios from 'axios';
import OpenAI from 'openai';

const router = express.Router();

// ── Haversine distance formula (returns km) ─────────────────────────────────
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

// ── GET /api/restaurants/photo?ref=... — proxy Google Places photos ──────────
router.get('/photo', async (req, res) => {
  const ref = req.query.ref;
  if (!ref || typeof ref !== 'string' || ref.length > 2000 || /[<>"']/.test(ref)) {
    return res.status(400).json({ error: 'Invalid photo reference' });
  }
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/photo',
      {
        params: { maxwidth: 800, photoreference: ref, key: process.env.GOOGLE_PLACES_API_KEY },
        responseType: 'stream',
        timeout: 10000,
      }
    );
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    response.data.pipe(res);
  } catch {
    res.status(404).json({ error: 'Photo not found' });
  }
});

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

  const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // ── Step 1: Let AI interpret the vibe ─────────────────────────────────
    let interpretation = {
      searchQuery: `restaurant ${cleanVibe} ${cleanCity} Pakistan`,
      vibeDescription: cleanVibe,
      keywords: ['restaurant', 'food', cleanCity],
      cuisineTypes: ['Pakistani'],
    };

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a food expert specializing in Pakistani restaurant culture across cities like Karachi, Lahore, Islamabad, Peshawar, etc.
Convert the user's vibe/mood into Google Places search parameters.
Return ONLY a valid JSON object with these fields:
- searchQuery: string — a Google Places text search (e.g., "best desi karahi Lahore Pakistan")
- vibeDescription: string — short friendly phrase of what you understood, max 12 words
- keywords: string[] — 3-5 relevant food/atmosphere keywords
- cuisineTypes: string[] — 2-3 cuisine categories`,
          },
          {
            role: 'user',
            content: `Vibe: "${cleanVibe}"\nCity: ${cleanCity}, Pakistan`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 300,
      });
      interpretation = JSON.parse(completion.choices[0].message.content);
    } catch (aiErr) {
      console.warn('AI interpretation failed, using fallback:', aiErr.message);
    }

    // ── Step 2: Fetch places from Google ─────────────────────────────────
    let placesResults = [];

    if (userLat !== null && userLng !== null) {
      // Nearby search (most accurate when user location is known)
      const nearbyRes = await axios.get(
        'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
        {
          params: {
            location: `${userLat},${userLng}`,
            radius: 5000,
            type: 'restaurant',
            keyword: (interpretation.keywords || []).join(' '),
            rankby: 'prominence',
            key: GOOGLE_KEY,
          },
          timeout: 12000,
        }
      );
      placesResults = nearbyRes.data.results || [];
    }

    // Text search (always run; fills gaps or acts as primary when no location)
    const textRes = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      {
        params: {
          query: interpretation.searchQuery,
          ...(userLat !== null && { location: `${userLat},${userLng}`, radius: 10000 }),
          key: GOOGLE_KEY,
        },
        timeout: 12000,
      }
    );
    const textResults = textRes.data.results || [];

    // Merge & deduplicate
    const seen = new Set(placesResults.map((r) => r.place_id));
    for (const r of textResults) {
      if (!seen.has(r.place_id)) {
        placesResults.push(r);
        seen.add(r.place_id);
      }
    }

    // ── Step 3: Fetch details for top 8 results ───────────────────────────
    const topPlaces = placesResults.slice(0, 8);

    const detailPromises = topPlaces.map(async (place) => {
      try {
        const detailRes = await axios.get(
          'https://maps.googleapis.com/maps/api/place/details/json',
          {
            params: {
              place_id: place.place_id,
              fields:
                'name,rating,user_ratings_total,formatted_address,geometry,reviews,photos,opening_hours,price_level,types,formatted_phone_number,website,url',
              key: GOOGLE_KEY,
            },
            timeout: 10000,
          }
        );

        const d = detailRes.data.result;
        if (!d) return null;

        const placeLat = d.geometry?.location?.lat;
        const placeLng = d.geometry?.location?.lng;
        const distance =
          userLat !== null && userLng !== null && placeLat && placeLng
            ? getDistance(userLat, userLng, placeLat, placeLng).toFixed(1)
            : null;

        const photoRef = d.photos?.[0]?.photo_reference || null;

        const SKIP_TYPES = new Set(['point_of_interest', 'establishment', 'food', 'premise']);
        const types = (d.types || []).filter((t) => !SKIP_TYPES.has(t)).slice(0, 3);

        return {
          id: place.place_id,
          name: d.name,
          rating: d.rating || null,
          totalRatings: d.user_ratings_total || 0,
          address: d.formatted_address || '',
          lat: placeLat,
          lng: placeLng,
          distance,
          reviews: (d.reviews || []).slice(0, 3).map((r) => ({
            author: r.author_name,
            rating: r.rating,
            text: r.text?.substring(0, 200) || '',
            time: r.relative_time_description,
          })),
          photoRef,
          isOpen: d.opening_hours?.open_now ?? null,
          priceLevel: d.price_level ?? null,
          types,
          phone: d.formatted_phone_number || null,
          website: d.website || null,
          mapsUrl: d.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        };
      } catch {
        return null;
      }
    });

    const settled = await Promise.allSettled(detailPromises);
    const restaurants = settled
      .filter((r) => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value)
      .sort((a, b) => {
        if (a.distance !== null && b.distance !== null) {
          return parseFloat(a.distance) - parseFloat(b.distance);
        }
        return (b.rating || 0) - (a.rating || 0);
      });

    res.json({ restaurants, interpretation });
  } catch (err) {
    console.error('Search error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch recommendations. Please try again.' });
  }
});

export default router;
