import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { LEGAL_LINKS } from "@/lib/legal-links";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {!BUSINESS.legalReviewed && (
        <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Draft template — not yet reviewed by a lawyer. Details in [brackets] must be completed before going live.
        </p>
      )}
      <article className="rounded-xl bg-white p-6 text-sm leading-relaxed text-slate-800 shadow-sm sm:p-8 [&_h1]:mb-1 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_ul]:mb-3">
        {children}
      </article>
      <nav aria-label="Policies" className="flex flex-wrap gap-4 text-sm">
        {LEGAL_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-brand hover:underline">
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
