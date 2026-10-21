"use client";

import Link from "next/link";
import { useActionState } from "react";
import { mfaAction, type MfaState } from "./actions";

const input =
  "w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";
const primary = "w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60";

export function MfaForm({ mode, next }: { mode: "enroll" | "verify"; next: string }) {
  const [state, action, pending] = useActionState<MfaState, FormData>(mfaAction, {});

  if (state.signedOut) {
    return (
      <div className="space-y-4">
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className={`${primary} block text-center`}>
          Log in again
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="intent" value={mode} />
      <div>
        <label htmlFor="code" className="mb-1 block text-sm font-medium">
          {mode === "enroll" ? "6-digit code from the app" : "Authenticator code or recovery code"}
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode={mode === "enroll" ? "numeric" : "text"}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          required
          autoFocus
          className={`${input} tracking-[0.3em]`}
        />
      </div>
      {mode === "enroll" && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="saved" required className="mt-1" />
          <span>I’ve saved my recovery codes somewhere safe.</span>
        </label>
      )}
      <button disabled={pending} className={primary}>
        {pending ? "Checking…" : mode === "enroll" ? "Turn on and continue" : "Verify and continue"}
      </button>
      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
    </form>
  );
}
