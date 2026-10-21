import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { firstParam, type RawSearchParams } from "@/lib/catalog";
import { safeNextPath } from "@/lib/safe-redirect";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const next = safeNextPath(firstParam((await searchParams).next));
  if (await getCurrentUser()) redirect(next);

  return (
    <section className="mx-auto max-w-sm rounded-xl bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-bold">Log in or sign up</h1>
      <p className="mb-6 text-sm text-slate-600">We’ll text you a one-time code. No password needed.</p>
      <LoginForm next={next} />
    </section>
  );
}
