'use client';

interface Props {
  current: number;
  total: number;
  currentType: string | null;
  done: boolean;
}

export default function AgentThoughtLog({ current, total, currentType, done }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 20) : 0; // 0–20 cells

  return (
    <div
      className={`
        overflow-hidden transition-all duration-500
        ${done ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'}
      `}
    >
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-3">
        <p className="text-sm font-medium text-blue-800 mb-2">
          {current === 0
            ? 'Starting analysis…'
            : `Analyzing clause ${current} of ${total}${currentType ? ` — ${currentType}` : ''}`}
        </p>

        {/* 20-cell segmented progress bar — no inline styles */}
        <div className="flex gap-0.5">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-sm transition-colors duration-300 ${
                i < pct ? 'bg-blue-500' : 'bg-blue-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
