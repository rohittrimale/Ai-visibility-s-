import { scoreLabel } from "@/lib/scoring";

export function ScoreRing({ score, size = 168 }: { score: number; size?: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const color = score >= 70 ? "#16a34a" : score >= 40 ? "#d97706" : "#dc2626";
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`Visibility score ${score} out of 100`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <div className="text-4xl font-extrabold tabular-nums text-slate-900">{score}</div>
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>{scoreLabel(score)}</div>
      </div>
    </div>
  );
}
