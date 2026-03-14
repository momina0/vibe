import { useState } from 'react';

const TYPE_LABELS = {
  restaurant: 'Restaurant',
  cafe: 'Café',
  bakery: 'Bakery',
  bar: 'Bar',
  meal_takeaway: 'Takeaway',
  meal_delivery: 'Delivery',
  fast_food_restaurant: 'Fast Food',
  chinese_restaurant: 'Chinese',
  pizza_restaurant: 'Pizza',
  seafood_restaurant: 'Seafood',
  steak_house: 'Steak House',
  dessert_shop: 'Desserts',
  ice_cream_shop: 'Ice Cream',
};

const PRICE_LABELS = ['Free', '₨', '₨₨', '₨₨₨', '₨₨₨₨'];

function Stars({ rating, size = 'sm' }) {
  if (!rating) return <span className="text-xs text-gray-400">No rating</span>;
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const textSize = size === 'sm' ? 'text-sm' : 'text-xs';
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => {
        let char = '☆';
        let color = 'text-gray-500';
        if (i < full) { char = '★'; color = 'text-amber-400'; }
        else if (i === full && half) { char = '★'; color = 'text-amber-300'; }
        return (
          <span key={i} className={`${textSize} ${color}`}>{char}</span>
        );
      })}
      <span className="ml-1 text-sm font-semibold text-gray-800">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function RestaurantCard({ restaurant: r, rank }) {
  const [showReviews, setShowReviews] = useState(false);

  // Determine score color
  const scoreColor =
    r.vibeScore >= 8 ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
    : r.vibeScore >= 5 ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30'
    : r.vibeScore != null ? 'bg-slate-700/50 text-slate-300 border-slate-600'
    : null;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/10 hover:bg-white/[0.04] hover:shadow-indigo-500/10">
      
      {/* Top Action Row: Rank & Score */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/10 text-sm font-bold text-indigo-400 ring-1 ring-indigo-500/20">
          {rank}
        </div>
        
        <div className="flex items-center gap-2">
          {r.distance !== null && (
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-400 ring-1 ring-white/10">
              {r.distance} km
            </span>
          )}
          {r.vibeScore != null && (
            <div className={`rounded-full border px-3 py-1 text-xs font-bold ${scoreColor}`}>
              ✧ {r.vibeScore}/10 Match
            </div>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col">
        {/* Name + Price */}
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="flex-1 text-xl font-semibold tracking-tight text-white group-hover:text-indigo-300 transition-colors">{r.name}</h3>
          <div className="flex flex-col items-end gap-1">
            {r.isOpen !== null && (
              <span className={`text-[10px] uppercase tracking-wider font-bold ${r.isOpen ? 'text-emerald-400' : 'text-slate-500'}`}>
                {r.isOpen ? 'Open Now' : 'Closed'}
              </span>
            )}
            {r.priceLevel != null && (
              <span className="flex-shrink-0 text-sm font-medium text-slate-400">
                {PRICE_LABELS[r.priceLevel] || ''}
              </span>
            )}
          </div>
        </div>

        {/* AI Vibe Reason */}
        {r.vibeReason && (
          <div className="mb-4 relative rounded-xl bg-blue-900/20 p-4 border border-blue-500/20">
            <div className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] shadow-lg shadow-blue-500/40">
              ✨
            </div>
            <p className="text-sm font-medium text-blue-100/90 leading-relaxed">
              {r.vibeReason}
            </p>
          </div>
        )}

        {/* Stars + review count */}
        {r.rating != null && (
          <div className="mb-3 flex items-center gap-2">
            <Stars rating={r.rating} />
            {r.totalRatings > 0 && (
              <span className="text-xs text-slate-400">({r.totalRatings.toLocaleString()} reviews)</span>
            )}
          </div>
        )}

        {/* Cuisine type tags */}
        {r.types.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {r.types.map((t) => (
              <span
                key={t}
                className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 ring-1 ring-white/10"
              >
                {TYPE_LABELS[t] || t.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Address */}
        <div className="mb-5 flex flex-1 items-start gap-2 text-sm text-slate-400">
          <span className="mt-0.5 opacity-60">📍</span>
          <p className="leading-relaxed">{r.address}</p>
        </div>

        {/* Reviews toggle */}
        {r.reviews.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setShowReviews((s) => !s)}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              {showReviews ? '▲ Hide reviews' : `▼ Read ${r.reviews.length} review${r.reviews.length > 1 ? 's' : ''}`}
            </button>

            {showReviews && (
              <div className="mt-2 space-y-2">
                {r.reviews.map((review, i) => (
                  <div key={i} className="rounded-lg bg-gray-50 p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700">{review.author}</span>
                      <Stars rating={review.rating} size="xs" />
                      <span className="ml-auto text-xs text-gray-400">{review.time}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-gray-600">
                      {review.text || '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-auto flex w-full gap-2 pt-2 border-t border-white/5">
          <a
            href={r.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 py-3 text-sm font-medium text-white ring-1 ring-white/10 transition-all hover:bg-white/10 hover:ring-white/20"
          >
            <span>Directions</span> ↗
          </a>
          {r.phone && (
            <a
              href={`tel:${r.phone}`}
              title={r.phone}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-lg ring-1 ring-white/10 transition-all hover:bg-white/10 hover:ring-white/20"
            >
              📞
            </a>
          )}
          {r.website && (
            <a
              href={r.website}
              target="_blank"
              rel="noopener noreferrer"
              title="Website"
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-lg ring-1 ring-white/10 transition-all hover:bg-white/10 hover:ring-white/20"
            >
              🌐
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
