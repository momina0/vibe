import { useState } from 'react';
import axios from 'axios';
import RestaurantCard from './components/RestaurantCard.jsx';
import LoadingState from './components/LoadingState.jsx';

const PAKISTAN_CITIES = [
  'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Peshawar',
  'Quetta', 'Faisalabad', 'Multan', 'Sialkot', 'Hyderabad',
  'Abbottabad', 'Murree', 'Swat', 'Gilgit', 'Hunza',
  'Gujranwala', 'Bahawalpur', 'Sargodha', 'Sukkur', 'Larkana',
];

const VIBE_CHIPS = [
  { label: '🌙 Late Night Biryani', vibe: 'late night biryani spot, open after midnight' },
  { label: '👨‍👩‍👧 Family Dawat', vibe: 'big family dinner, authentic desi food, spacious and nice ambiance' },
  { label: '☕ Chai & Gossip', vibe: 'casual chai spot, relaxed, chill vibes for long conversations' },
  { label: '🔥 Karahi Night', vibe: 'fresh karahi, charcoal grill, outdoor seating, street-style' },
  { label: '💼 Business Lunch', vibe: 'professional setting, good food, quick service, formal' },
  { label: '💕 Romantic Dinner', vibe: 'romantic candle lit dinner, fine dining, intimate atmosphere' },
  { label: '🎉 Birthday Party', vibe: 'fun celebration, party vibes, great food for a group' },
  { label: '🍕 Chill With Dost', vibe: 'casual hangout with friends, burgers pizza, relaxed cafe' },
  { label: '🌅 Sunday Brunch', vibe: 'brunch, continental breakfast, good coffee, weekend vibes' },
  { label: '🍢 Street Food Fix', vibe: 'street food, gol gappay, chaat, pani puri, local Pakistani flavors' },
];

export default function App() {
  const [vibe, setVibe] = useState('');
  const [city, setCity] = useState('Karachi');
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | detecting | found | denied
  const [isLoading, setIsLoading] = useState(false);
  const [restaurants, setRestaurants] = useState(null);
  const [interpretation, setInterpretation] = useState(null);
  const [error, setError] = useState(null);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }
    setLocationStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus('found');
      },
      () => setLocationStatus('denied'),
      { timeout: 10000 }
    );
  };

  const handleSearch = async () => {
    if (!vibe.trim()) return;
    setIsLoading(true);
    setError(null);
    setRestaurants(null);
    setInterpretation(null);

    try {
      const { data } = await axios.post('/api/restaurants/search', {
        vibe: vibe.trim(),
        city,
        lat: userLocation?.lat,
        lng: userLocation?.lng,
      });
      setRestaurants(data.restaurants);
      setInterpretation(data.interpretation);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setRestaurants(null);
    setInterpretation(null);
    setError(null);
  };

  const locationButtonProps = {
    idle:      { text: '📍 Locate Me',    className: 'border-green-700 text-green-300 hover:border-emerald-500 hover:text-white' },
    detecting: { text: '⏳ Detecting...',  className: 'border-green-700 text-green-500 cursor-wait' },
    found:     { text: '✓ Located',       className: 'border-emerald-500 text-emerald-300 bg-emerald-900/30' },
    denied:    { text: '✗ Location Off',  className: 'border-red-700 text-red-400 bg-red-900/20' },
  }[locationStatus];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-emerald-950">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-green-800/50 bg-green-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🇵🇰</span>
            <div>
              <h1 className="text-xl font-bold leading-none text-white">VibeEats</h1>
              <p className="text-xs text-emerald-400">Pakistan's AI food guide</p>
            </div>
          </div>
          {restaurants && (
            <button
              onClick={handleReset}
              className="rounded-xl border border-green-700 px-4 py-2 text-sm text-green-300 transition-all hover:border-emerald-500 hover:text-white"
            >
              ← New Search
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* ── Search Panel ─────────────────────────────────────────────── */}
        {!restaurants && !isLoading && (
          <div className="mx-auto max-w-2xl">
            {/* Hero text */}
            <div className="mb-10 text-center">
              <h2 className="mb-3 text-5xl font-extrabold text-white">
                What's your vibe?
              </h2>
              <p className="text-lg text-green-300">
                Describe your mood & we'll find the perfect spot 🍽️
              </p>
            </div>

            {/* Vibe textarea */}
            <div className="relative mb-4">
              <textarea
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && handleSearch()}
                placeholder={`e.g. "late night karahi with friends on a rooftop"\nor "romantic dinner, candles, fancy vibes"`}
                rows={3}
                maxLength={500}
                className="w-full resize-none rounded-2xl border border-green-700 bg-green-950/60 p-4 pr-16 text-base text-white placeholder-green-700 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="absolute bottom-3 right-4 text-xs text-green-700">
                {vibe.length}/500
              </span>
            </div>

            {/* Vibe chips */}
            <div className="mb-6 flex flex-wrap gap-2">
              {VIBE_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => setVibe(chip.vibe)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                    vibe === chip.vibe
                      ? 'border-emerald-500 bg-emerald-600 text-white'
                      : 'border-green-700 bg-green-900/40 text-green-300 hover:border-emerald-600 hover:text-white'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* City + Location row */}
            <div className="mb-5 flex gap-3">
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="flex-1 rounded-xl border border-green-700 bg-green-950/60 px-4 py-3 text-white transition focus:border-emerald-500 focus:outline-none"
              >
                {PAKISTAN_CITIES.map((c) => (
                  <option key={c} value={c} className="bg-green-950">
                    {c}
                  </option>
                ))}
              </select>

              <button
                onClick={detectLocation}
                disabled={locationStatus === 'detecting'}
                className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${locationButtonProps.className}`}
              >
                {locationButtonProps.text}
              </button>
            </div>

            {locationStatus === 'found' && (
              <p className="mb-3 text-center text-xs text-emerald-400">
                📍 Got your location — will show nearest restaurants first
              </p>
            )}

            {/* Search button */}
            <button
              onClick={handleSearch}
              disabled={!vibe.trim()}
              className="w-full rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-green-900/50 disabled:text-green-700"
            >
              Find My Spot 🔍
            </button>

            {error && (
              <div className="mt-4 rounded-xl border border-red-700/40 bg-red-900/20 p-4 text-sm text-red-300">
                ⚠️ {error}
              </div>
            )}
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {isLoading && <LoadingState />}

        {/* ── Results ───────────────────────────────────────────────────── */}
        {restaurants && !isLoading && (
          <div>
            {/* AI Vibe Banner */}
            {interpretation && (
              <div className="mb-6 rounded-2xl border border-emerald-700/40 bg-emerald-900/30 p-4">
                <p className="text-xs font-medium text-emerald-400">🤖 AI understood your vibe as:</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  "{interpretation.vibeDescription}"
                </p>
                {interpretation.keywords?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {interpretation.keywords.map((k) => (
                      <span
                        key={k}
                        className="rounded-full border border-emerald-700/50 bg-emerald-800/40 px-2 py-0.5 text-xs text-emerald-300"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {restaurants.length === 0 ? (
              <div className="py-16 text-center">
                <p className="mb-2 text-5xl">🤔</p>
                <p className="text-lg text-green-400">
                  No restaurants found for this vibe in {city}.
                </p>
                <p className="mt-1 text-sm text-green-600">
                  Try a different description or city!
                </p>
                <button
                  onClick={handleReset}
                  className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-500"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-green-500">
                  Showing {restaurants.length} spots in {city}
                  {userLocation ? ' — sorted by distance' : ' — sorted by rating'}
                </p>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {restaurants.map((r, i) => (
                    <RestaurantCard key={r.id} restaurant={r} rank={i + 1} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      <footer className="mt-16 border-t border-green-900 py-6 text-center text-xs text-green-700">
        🇵🇰 VibeEats — AI-powered food recommendations across Pakistan
      </footer>
    </div>
  );
}
