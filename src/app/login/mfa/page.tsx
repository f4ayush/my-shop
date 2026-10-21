import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOrCreateSetup } from "@/lib/auth/mfa";
import { getCurrentUser, getPendingMfa } from "@/lib/auth/session";
import { groupSecret, otpauthUri } from "@/lib/auth/totp";
import { firstParam, type RawSearchParams } from "@/lib/catalog";
import { maskPhone } from "@/lib/phone";
import { safeNextPath } from "@/lib/safe-redirect";
import { logoutAction } from "../actions";
import { MfaForm } from "./MfaForm";

export const metadata: Metadata = { title: "Staff verification", robots: { index: false } };

// Second sign-in step for pharmacists and admins, after the SMS code.
export default async function MfaPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const next = safeNextPath(firstParam((await searchParams).next));
  const pending = await getPendingMfa();
  if (!pending) redirect((await getCurrentUser()) ? next : `/login?next=${encodeURIComponent(next)}`);

  const enrolling = !pending.user.totpEnabled;
  const setup = enrolling ? await getOrCreateSetup(pending) : null;

  return (
    <section className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-bold">{enrolling ? "Set up your authenticator app" : "Staff verification"}</h1>
      {setup ? (
        <div className="mb-6 space-y-3 text-sm text-slate-600">
          <p>Staff accounts need a second step. Use an authenticator app such as Google Authenticator or Microsoft Authenticator.</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              In the app, choose <strong>Add account → Enter a setup key</strong>. Account: <strong>My Pharmacy</strong>{" "}
              ({maskPhone(pending.user.phone)}), type <strong>Time-based</strong>.
            </li>
            <li>
              Setup key:
              <code className="mt-1 block select-all rounded-md bg-slate-100 p-2 text-center font-mono text-base tracking-wider text-slate-900">
                {groupSecret(setup.secret)}
              </code>
              <a href={otpauthUri(setup.secret, maskPhone(pending.user.phone), "My Pharmacy")} className="text-brand hover:underline">
                On this phone? Open in the authenticator app
              </a>
            </li>
            <li>
              Save these recovery codes somewhere safe and private. Each works once if you lose your phone, and they
              won’t be shown again:
              <ul className="mt-1 grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-2 font-mono text-slate-900" aria-label="Recovery codes">
                {setup.recoveryCodes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          <p className="text-xs">Don’t share this key or screenshot it. Anyone with it can make your codes.</p>
        </div>
      ) : (
        <p className="mb-6 text-sm text-slate-600">
          Enter the 6-digit code from your authenticator app. Lost your phone? Use one of your recovery codes.
        </p>
      )}
      <MfaForm mode={enrolling ? "enroll" : "verify"} next={next} />
      <form action={logoutAction} className="mt-4 text-center">
        <button className="text-sm text-slate-500 hover:underline">Cancel and sign out</button>
      </form>
    </section>
  );
}
