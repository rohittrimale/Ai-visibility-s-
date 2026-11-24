export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-slate-500 ${className}`}>
      AI answers vary by user and location; this is an estimate.
    </p>
  );
}
