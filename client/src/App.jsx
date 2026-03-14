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
  { label: ' Late Night Biryani', vibe: 'late night biryani spot, open after midnight' },
  { label: ' Family Dawat', vibe: 'big family dinner, authentic desi food, spacious and nice ambiance' },
  { label: ' Chai & Gossip', vibe: 'casual chai spot, relaxed, chill vibes for long conversations' },
  { label: ' Karahi Night', vibe: 'fresh karahi, charcoal grill, outdoor seating, street-style' },
  { label: ' Business Lunch', vibe: 'professional setting, good food, quick service, formal' },
  { label: ' Romantic Dinner', vibe: 'romantic candle lit dinner, fine dining, intimate atmosphere' },
  { label: ' Birthday Party', vibe: 'fun celebration, party vibes, great food for a group' },
  { label: ' Chill With Dost', vibe: 'casual hangout with friends, burgers pizza, relaxed cafe' },
  { label: ' Sunday Brunch', vibe: 'brunch, continental breakfast, good coffee, weekend vibes' },
  { label: ' Street Food Fix', vibe: 'street food, gol gappay, chaat, pani puri, local Pakistani flavors' },
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
    idle: { text: '📍 Locate Me', className: 'border-green-700 text-green-300 hover:border-emerald-500 hover:text-white' },
    detecting: { text: '⏳ Detecting...', className: 'border-green-700 text-green-500 cursor-wait' },
    found: { text: '✓ Located', className: 'border-emerald-500 text-emerald-300 bg-emerald-900/30' },
    denied: { text: '✗ Location Off', className: 'border-red-700 text-red-400 bg-red-900/20' },
  }[locationStatus];

  return (
    <div className="min-h-screen bg-[#030720] text-slate-300">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#030720]/90 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between px-6 py-4">
          <div className="flex items-center">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">VibeEats</h1>
              <p className="text-xs font-medium text-blue-300">Pakistan's AI food guide</p>
            </div>
          </div>
          {restaurants && (
            <button
              onClick={handleReset}
              className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white"
            >
              ← New Search
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 md:py-20">
        {/* ── Search Panel ─────────────────────────────────────────────── */}
        {!restaurants && !isLoading && (
          <div className="mx-auto max-w-2xl">
            {/* Hero text */}
            <div className="mb-12 text-center">
              <div className="inline-flex mb-6 items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
                <span className="mr-2 flex h-2 w-2 rounded-full bg-blue-500"></span>
                Powered by OpenStreetMap & AI
              </div>
              <h2 className="mb-4 text-5xl md:text-6xl font-extrabold tracking-tight text-white">
                Find Your Vibe.
              </h2>
              <p className="text-lg text-slate-400 font-medium">
                Describe your mood, and we'll find the perfect spot for you.
              </p>
            </div>

            {/* Vibe textarea */}
            <div className="relative mb-6">
              <textarea
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && handleSearch()}
                placeholder={`e.g. "late night karahi with friends on a rooftop"\nor "romantic dinner, candles, fancy vibes"`}
                rows={3}
                maxLength={500}
                className="w-full resize-none rounded-3xl border border-white/10 bg-white/5 p-6 pr-16 text-lg text-white placeholder-slate-500 shadow-2xl backdrop-blur-xl transition focus:border-indigo-500/50 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              />
              <span className="absolute bottom-5 right-6 text-xs text-slate-500 font-medium">
                {vibe.length}/500
              </span>
            </div>

            {/* Vibe chips */}
            <div className="mb-8 flex flex-wrap gap-2 justify-center">
              {VIBE_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => setVibe(chip.vibe)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${vibe === chip.vibe
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300 shadow-lg shadow-indigo-500/20'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* City + Location row */}
            <div className="mb-6 flex flex-col sm:flex-row gap-3">
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white font-medium shadow-inner backdrop-blur-xl transition focus:border-indigo-500/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {PAKISTAN_CITIES.map((c) => (
                  <option key={c} value={c} className="bg-slate-900">
                    {c}
                  </option>
                ))}
              </select>

              <button
                onClick={detectLocation}
                disabled={locationStatus === 'detecting'}
                className={`rounded-2xl px-6 py-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${locationStatus === 'found' ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50' :
                  locationStatus === 'detecting' ? 'bg-white/5 text-slate-400 cursor-wait ring-1 ring-white/10' :
                    'bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/20'
                  }`}
              >
                {locationStatus === 'found' ? '✓ Located' : locationStatus === 'detecting' ? '⏳ Detecting...' : '📍 Auto-Locate'}
              </button>
            </div>

            {locationStatus === 'found' && (
              <p className="mb-6 text-center text-sm font-medium text-emerald-400/80">
                ✨ Found your location — sorting by distance
              </p>
            )}

            {/* Search button */}
            <button
              onClick={handleSearch}
              disabled={!vibe.trim()}
              className="w-full rounded-2xl bg-blue-500 py-5 text-lg font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] hover:bg-blue-400 disabled:pointer-events-none disabled:opacity-50"
            >
              Analyze Vibe
            </button>

            {error && (
              <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-center text-sm font-medium text-red-400 backdrop-blur-md">
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {isLoading && <LoadingState />}

        {/* ── Results ───────────────────────────────────────────────────── */}
        {restaurants && !isLoading && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* AI Vibe Banner */}
            {interpretation && (
              <div className="mb-10 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-xs text-indigo-400 ring-1 ring-indigo-500/30">
                        🤖
                      </span>
                      <p className="text-sm font-semibold uppercase tracking-wider text-indigo-400">AI Interpretation</p>
                    </div>
                    <p className="text-2xl font-bold tracking-tight text-white">
                      "{interpretation.vibeDescription}"
                    </p>
                  </div>
                  {interpretation.mustHave?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {interpretation.mustHave.map((k) => (
                        <span
                          key={k}
                          className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 ring-1 ring-white/10 backdrop-blur-md"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {restaurants.length === 0 ? (
              <div className="rounded-3xl border border-white/5 bg-white/[0.02] py-20 text-center backdrop-blur-xl">
                <p className="mb-4 text-6xl opacity-80">🔭</p>
                <p className="text-2xl font-bold text-white mb-2">
                  No spots found matching this vibe in {city}.
                </p>
                <p className="font-medium text-slate-400">
                  Try adjusting your description or searching a broader area.
                </p>
                <button
                  onClick={handleReset}
                  className="mt-8 rounded-full bg-white/10 px-8 py-3 font-semibold text-white ring-1 ring-white/20 transition-all hover:bg-white/20 hover:scale-105"
                >
                  Start Over
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Top Recommendations</h3>
                  <p className="text-sm font-medium text-slate-400 bg-white/5 px-3 py-1.5 rounded-full ring-1 ring-white/10">
                    Showing {restaurants.length} spots {userLocation ? '• Sorted by distance' : ''}
                  </p>
                </div>
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

      <footer className="mt-20 border-t border-white/5 bg-slate-950/50 py-8 text-center backdrop-blur-xl">
        <p className="text-sm font-medium text-slate-500">
          VibeEats ✨ AI-powered discovery across Pakistan
        </p>
      </footer>
    </div>
  );
}
