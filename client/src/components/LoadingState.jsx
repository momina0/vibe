const LOADING_MESSAGES = [
  '🤖 Interpreting your vibe with AI...',
  '🔍 Scanning restaurants nearby...',
  '📍 Calculating distances...',
  '⭐ Fetching ratings & reviews...',
  '🍽️ Almost there...',
];

export default function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      {/* Spinner */}
      <div className="relative mb-8 h-20 w-20">
        <div className="absolute inset-0 rounded-full border-4 border-green-800" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-emerald-400" />
        <div className="absolute inset-0 flex items-center justify-center text-3xl">
          🍽️
        </div>
      </div>

      <p className="mb-2 text-xl font-semibold text-emerald-300">
        Finding your perfect spot...
      </p>
      <p className="text-sm text-green-600">This takes a few seconds</p>

      {/* Animated steps */}
      <div className="mt-8 space-y-2">
        {LOADING_MESSAGES.map((msg, i) => (
          <div
            key={i}
            className="animate-pulse text-center text-sm text-green-500"
            style={{ animationDelay: `${i * 0.4}s` }}
          >
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
}
