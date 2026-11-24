import { engineLabel } from "@/lib/providers";

type E = Record<string, { score: number; mentioned: number; total: number }>;

export function EngineBars({ engines }: { engines: E }) {
  return (
    <ul className="space-y-4">
      {Object.entries(engines).map(([id, v]) => (
        <li key={id}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-semibold text-slate-800">{engineLabel(id)}</span>
            <span className="text-slate-500">
              <b className="text-slate-900">{v.score}</b>/100 · mentioned in {v.mentioned} of {v.total}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(v.score, 2)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
