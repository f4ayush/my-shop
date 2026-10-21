"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const input =
  "w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";
const primary = "w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60";
const link = "text-sm text-brand hover:underline disabled:opacity-60";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { step: "phone" });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {state.step === "phone" ? (
        <>
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium">
              Mobile number
            </label>
            <div className="flex">
              <span className="rounded-l-md border border-r-0 border-slate-300 bg-slate-100 px-3 py-2 text-slate-600">
                +91
              </span>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={14}
                required
                defaultValue={state.phone?.slice(3)}
                placeholder="98765 43210"
                className={`${input} rounded-l-none`}
              />
            </div>
          </div>
          <button name="intent" value="send" disabled={pending} className={primary}>
            {pending ? "Sending…" : "Send code"}
          </button>
        </>
      ) : (
        <>
          {state.info && <p className="text-sm text-slate-600">{state.info}</p>}
          <div>
            <label htmlFor="code" className="mb-1 block text-sm font-medium">
              6-digit code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              className={`${input} tracking-[0.5em]`}
            />
          </div>
          <button name="intent" value="verify" disabled={pending} className={primary}>
            {pending ? "Verifying…" : "Verify and continue"}
          </button>
          <div className="flex justify-between">
            <button name="intent" value="change" formNoValidate disabled={pending} className={link}>
              Change number
            </button>
            <button name="intent" value="resend" formNoValidate disabled={pending} className={link}>
              Resend code
            </button>
          </div>
        </>
      )}

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
    </form>
  );
}
