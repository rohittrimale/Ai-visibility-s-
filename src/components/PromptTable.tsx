import { engineLabel } from "@/lib/providers";
import type { promptRows } from "@/lib/report";

export function PromptTable({ rows, engines }: { rows: ReturnType<typeof promptRows>; engines: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3 font-semibold">Customer question</th>
            {engines.map((e) => <th key={e} className="px-2 py-2 text-center font-semibold">{engineLabel(e)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.prompt} className="border-b border-slate-100 last:border-0">
              <td className="py-2.5 pr-3 text-slate-800">“{r.prompt}”</td>
              {engines.map((e) => {
                const c = r.engines[e];
                return (
                  <td key={e} className="px-2 py-2.5 text-center">
                    {c === undefined || c === null ? <span className="text-slate-300" title="No answer">–</span>
                      : c.mentioned ? <span className="rounded-full bg-green-50 px-2 py-0.5 font-semibold text-green-700">{c.position ? `#${c.position}` : "✓"}</span>
                      : <span className="text-slate-400">✗</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
