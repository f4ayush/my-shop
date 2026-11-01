import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";
import { btn, card } from "@/components/ui";

// Rendered outside the (shop) layout, so it brings its own header and footer.
export default function NotFound() {
  return (
    <SiteShell>
      <section className={`${card} mx-auto max-w-xl p-10 text-center`}>
        <h1 className="text-3xl font-extrabold tracking-[-0.03em]">Page not found</h1>
        <p className="mt-2 text-muted">This product or page isn’t available.</p>
        <Link href="/" className={`${btn("primary")} mt-6`}>
          Back to home
        </Link>
      </section>
    </SiteShell>
  );
}
