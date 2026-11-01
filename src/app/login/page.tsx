import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getPendingMfa } from "@/lib/auth/session";
import { firstParam, type RawSearchParams } from "@/lib/catalog";
import { safeNextPath } from "@/lib/safe-redirect";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const next = safeNextPath(firstParam((await searchParams).next));
  if (await getCurrentUser()) redirect(next);
  if (await getPendingMfa()) redirect(`/login/mfa?next=${encodeURIComponent(next)}`);

  return (
    <div className="flex flex-col gap-7">
      <LoginForm next={next} />
      <p className="text-[13px] leading-relaxed text-muted">
        By continuing you agree to our{" "}
        <Link href="/terms" className="text-brand hover:underline">
          Terms of use
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-brand hover:underline">
          Privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
