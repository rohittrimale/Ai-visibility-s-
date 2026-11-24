import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600">That page or report doesn't exist (or has expired).</p>
      <Link href="/" className="btn mt-6">Run a free check</Link>
    </div>
  );
}
