"use client";
export function PrintButton() {
  return <button onClick={() => window.print()} className="btn-ghost no-print">Download PDF / Print</button>;
}
