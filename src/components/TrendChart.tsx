/** Dependency-free SVG line chart of score over time (used on the paid dashboard). */
export function TrendChart({ points }: { points: { date: string; score: number }[] }) {
  if (points.length === 0) return <p className="text-sm text-slate-500">No checks yet.</p>;
  const W = 600, H = 180, P = 28;
  const x = (i: number) => (points.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (points.length - 1));
  const y = (s: number) => H - P - (s / 100) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.score)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Visibility score over time">
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="#e2e8f0" />
          <text x={4} y={y(g) + 4} fontSize="11" fill="#64748b">{g}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.score)} r="4" fill="#2563eb"><title>{`${p.date}: ${p.score}`}</title></circle>
          {(i === 0 || i === points.length - 1) && (
            <text x={x(i)} y={H - 6} fontSize="11" fill="#64748b" textAnchor={i === 0 ? "start" : "end"}>{p.date}</text>
          )}
        </g>
      ))}
    </svg>
  );
}
