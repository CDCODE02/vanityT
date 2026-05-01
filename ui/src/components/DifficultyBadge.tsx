export function DifficultyBadge({ prefix, suffix }: { prefix: string, suffix: string }) {
  const totalChars = prefix.length + suffix.length;
  
  if (totalChars === 0) return null;

  // difficulty = 16^N combinations
  let difficultyLevel = 'Easy';
  let color = 'text-green-400 bg-green-400/10 border-green-400/20';
  let estimate = 'Less than a second';

  if (totalChars > 7) {
    difficultyLevel = 'Extreme';
    color = 'text-red-400 bg-red-400/10 border-red-400/20';
    estimate = 'Days or weeks';
  } else if (totalChars > 5) {
    difficultyLevel = 'Hard';
    color = 'text-orange-400 bg-orange-400/10 border-orange-400/20';
    estimate = 'Minutes to hours';
  } else if (totalChars > 3) {
    difficultyLevel = 'Medium';
    color = 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    estimate = 'A few seconds';
  }

  // Calculate rough combinations
  const combinations = Math.pow(16, totalChars);
  const formattedCombos = combinations.toLocaleString();

  return (
    <div className={`mt-4 p-3 rounded-lg border ${color} flex flex-col sm:flex-row sm:items-center justify-between text-sm transition-all`}>
      <div className="flex items-center space-x-2">
        <span className="font-semibold uppercase tracking-wider">{difficultyLevel}</span>
        <span className="opacity-75 hidden sm:inline">•</span>
        <span className="opacity-90 font-mono">1 in {formattedCombos}</span>
      </div>
      <div className="mt-1 sm:mt-0 opacity-75">
        Est: {estimate}
      </div>
    </div>
  );
}
