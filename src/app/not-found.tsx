import Link from "next/link";

export default function NotFound() {
  return (
    <section className="rounded-xl bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600">This product or page isn’t available.</p>
      <Link href="/" className="mt-4 inline-block text-brand hover:underline">
        Back to home
      </Link>
    </section>
  );
}
