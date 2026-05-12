export function DifficultyBadge({ prefix, suffix }: { prefix: string, suffix: string }) {
  const totalChars = prefix.length + suffix.length;
  
  if (totalChars === 0) return null;

  // Base speed for estimation (500,000 hashes/sec)
  const baseSpeed = 500000;
  const combinations = Math.pow(16, totalChars);
  const estimatedSeconds = combinations / baseSpeed;

  let difficultyLevel = 'Easy';
  let color = 'text-green-400 bg-green-400/10 border-green-400/20';
  let estimate = '';

  if (estimatedSeconds < 1) {
    estimate = 'Instant';
  } else if (estimatedSeconds < 60) {
    estimate = `${Math.ceil(estimatedSeconds)}s`;
  } else if (estimatedSeconds < 3600) {
    estimate = `~${Math.ceil(estimatedSeconds / 60)}m`;
  } else if (estimatedSeconds < 86400) {
    estimate = `~${(estimatedSeconds / 3600).toFixed(1)}h`;
  } else {
    estimate = `~${(estimatedSeconds / 86400).toFixed(1)}d`;
  }

  // Set levels
  if (totalChars > 7) {
    difficultyLevel = 'Extreme';
    color = 'text-red-400 bg-red-400/10 border-red-400/20';
  } else if (totalChars > 5) {
    difficultyLevel = 'Hard';
    color = 'text-orange-400 bg-orange-400/10 border-orange-400/20';
  } else if (totalChars > 3) {
    difficultyLevel = 'Medium';
    color = 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
  }

  const formattedCombos = combinations.toLocaleString();

  return (
    <div className={`mt-4 p-3 rounded-lg border ${color} flex flex-col sm:flex-row sm:items-center justify-between text-sm transition-all animate-in fade-in slide-in-from-top-2`}>
      <div className="flex items-center space-x-2">
        <span className="font-semibold uppercase tracking-wider">{difficultyLevel}</span>
        <span className="opacity-75 hidden sm:inline">•</span>
        <span className="opacity-90 font-mono">1 in {formattedCombos}</span>
      </div>
      <div className="mt-1 sm:mt-0 font-medium">
        Est: <span className="font-bold">{estimate}</span>
      </div>
    </div>
  );
}
