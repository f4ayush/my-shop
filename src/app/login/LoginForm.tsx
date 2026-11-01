"use client";

import { useActionState } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { btn, errorBox } from "@/components/ui";
import { loginAction, type LoginState } from "./actions";

const heading = "text-[32px] leading-tight font-extrabold tracking-[-0.03em]";
const label = "text-sm font-bold";
const textButton = "font-bold text-brand-dark hover:underline disabled:opacity-60";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { step: "phone" });

  return (
    <form action={action} className="flex flex-col gap-7">
      <input type="hidden" name="next" value={next} />

      {state.step === "phone" ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className={heading}>Sign in or sign up</h1>
            <p className="text-muted">We’ll send a one-time code to your mobile number. No password needed.</p>
          </div>
          <div className="flex flex-col gap-4">
            <label htmlFor="phone" className={label}>
              Mobile number
            </label>
            <div className="flex h-14 items-center overflow-hidden rounded-2xl border border-line-strong bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
              <span className="flex h-full items-center border-r border-line px-4 font-semibold text-ink-2">+91</span>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={14}
                required
                defaultValue={state.phone?.slice(3)}
                placeholder="10-digit number"
                className="h-full min-w-0 flex-1 bg-transparent px-4 text-base focus:outline-none"
              />
            </div>
            <button name="intent" value="send" disabled={pending} className={btn("primary", "lg")}>
              {pending ? "Sending…" : "Send code"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h1 className={heading}>Enter the code</h1>
            {state.info && <p className="text-muted">{state.info}</p>}
          </div>
          <div className="flex flex-col gap-4">
            <label htmlFor="code" className={label}>
              6-digit code
            </label>
            {/* One field rather than six boxes, so SMS autofill and screen readers work. */}
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
              className="h-[60px] w-full rounded-[14px] border-2 border-brand bg-white text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <button name="intent" value="verify" disabled={pending} className={btn("primary", "lg")}>
              {pending ? "Verifying…" : "Verify and continue"}
            </button>
            <p className="text-center text-sm text-muted">
              Didn’t get it?{" "}
              <button name="intent" value="resend" formNoValidate disabled={pending} className={textButton}>
                Resend code
              </button>
            </p>
          </div>
          {/* Shown first but placed after "Verify" in the DOM, so pressing Enter verifies. */}
          <button
            name="intent"
            value="change"
            formNoValidate
            disabled={pending}
            className={`${textButton} order-first -mb-5 flex h-11 items-center gap-1.5 self-start text-sm`}
          >
            <ChevronLeftIcon size={18} strokeWidth={2.4} />
            Change number
          </button>
        </>
      )}

      {state.error && (
        <p role="alert" className={errorBox}>
          {state.error}
        </p>
      )}
    </form>
  );
}
