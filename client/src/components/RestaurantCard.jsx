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
  const [imgError, setImgError] = useState(false);

  const photoSrc = r.photoRef && !imgError
    ? `/api/restaurants/photo?ref=${encodeURIComponent(r.photoRef)}`
    : null;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-xl transition-transform hover:-translate-y-0.5 hover:shadow-2xl">
      {/* Photo area */}
      <div className="relative h-48 flex-shrink-0 overflow-hidden bg-gradient-to-br from-green-800 to-emerald-900">
        {photoSrc ? (
          <img
            src={photoSrc}
            alt={r.name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl opacity-60">
            🍽️
          </div>
        )}

        {/* Rank badge */}
        <div className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white shadow">
          #{rank}
        </div>

        {/* Open/Closed */}
        {r.isOpen !== null && (
          <div
            className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-bold shadow ${
              r.isOpen ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {r.isOpen ? '● Open' : '● Closed'}
          </div>
        )}

        {/* Distance */}
        {r.distance !== null && (
          <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            📍 {r.distance} km away
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-4">
        {/* Name + Price */}
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <h3 className="flex-1 text-base font-bold leading-tight text-gray-900">{r.name}</h3>
          {r.priceLevel != null && (
            <span className="flex-shrink-0 text-sm font-medium text-emerald-600">
              {PRICE_LABELS[r.priceLevel] || ''}
            </span>
          )}
        </div>

        {/* Stars + review count */}
        <div className="mb-2 flex items-center gap-2">
          <Stars rating={r.rating} />
          {r.totalRatings > 0 && (
            <span className="text-xs text-gray-400">({r.totalRatings.toLocaleString()} reviews)</span>
          )}
        </div>

        {/* Cuisine type tags */}
        {r.types.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {r.types.map((t) => (
              <span
                key={t}
                className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700"
              >
                {TYPE_LABELS[t] || t.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Address */}
        <p className="mb-3 line-clamp-2 flex-1 text-sm leading-relaxed text-gray-500">
          📌 {r.address}
        </p>

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
        <div className="mt-auto flex gap-2 pt-2">
          <a
            href={r.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            🗺️ Get Directions
          </a>
          {r.phone && (
            <a
              href={`tel:${r.phone}`}
              title={r.phone}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-600 transition hover:bg-gray-50"
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
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-gray-600 transition hover:bg-gray-50"
            >
              🌐
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
