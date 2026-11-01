"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { uploadPrescriptionAction, type UploadState } from "@/app/(shop)/account/prescriptions/actions";
import { BRAND_NAME } from "@/lib/brand";
import { CheckIcon, UploadIcon } from "./icons";
import { btn, errorBox } from "./ui";

/**
 * Prescription upload with a drop zone. The real file input covers the zone (invisibly), so clicking or
 * dropping a file onto it works without any drag-and-drop script. "dark" is for the forest panel.
 */
export function PrescriptionUploadForm({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadPrescriptionAction, {});
  const [fileName, setFileName] = useState("");
  const dark = variant === "dark";

  if (dark && state.uploadedId) {
    return (
      <div className="flex flex-col gap-[18px] rounded-3xl bg-white p-7 text-ink" role="status">
        <div className="flex items-center gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-mint text-brand-dark">
            <CheckIcon size={22} strokeWidth={2.6} />
          </span>
          <div className="flex flex-col gap-0.5">
            <strong className="text-[17px]">Prescription uploaded</strong>
            <span className="text-sm text-muted">Choose it at checkout. Our pharmacist verifies it before packing.</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/search" className={btn("primary")}>
            Find your medicines
          </Link>
          <Link href="/account/prescriptions" className={btn("outline")}>
            My prescriptions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      action={action}
      // React resets the form after the action, so forget the chosen file's name too.
      onSubmit={() => setFileName("")}
      className={`flex flex-col gap-4 rounded-3xl border-2 border-dashed p-5 sm:p-7 ${dark ? "border-[#4F8F86] bg-forest-2 text-white" : "border-[#C9D8D5] bg-canvas"}`}
    >
      <div className="relative flex flex-col items-center gap-3 rounded-2xl py-2 text-center">
        <input
          id={`rx-file-${variant}`}
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,application/pdf"
          aria-label="Prescription file: photo or PDF, up to 5 MB"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
        />
        <span
          className={`flex size-14 items-center justify-center rounded-[18px] ${dark ? "bg-white text-forest" : "bg-amber-tint text-amber-ink"}`}
        >
          <UploadIcon size={26} />
        </span>
        <strong className="text-lg">{fileName ? "Ready to upload" : "Drop your prescription here"}</strong>
        <span className={`text-sm ${dark ? "text-mist" : "text-ink-2"}`}>
          {fileName || "JPG, PNG or PDF, up to 5 MB · only our pharmacists can see it"}
        </span>
        <span
          aria-hidden="true"
          className={`${btn(dark ? "light" : "dark")} mt-1.5 peer-hover:opacity-90 peer-focus-visible:ring-4 peer-focus-visible:ring-brand/40`}
        >
          {fileName ? "Choose a different file" : "Choose file"}
        </span>
      </div>
      {!dark && (
        <p className="text-center text-xs text-muted">
          Make sure the doctor’s name, registration number, date, medicines and signature are clearly visible.
        </p>
      )}
      <label className={`flex items-start gap-2.5 text-xs leading-relaxed ${dark ? "text-mist" : "text-ink-2"}`}>
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 shrink-0 accent-brand" />
        <span>
          I consent to {BRAND_NAME} storing this prescription and sharing it only with our registered pharmacist to
          verify and dispense my orders, as described in the privacy policy.
        </span>
      </label>
      <button disabled={pending} className={btn(dark ? "light" : "primary")}>
        {pending ? "Uploading…" : "Upload prescription"}
      </button>
      <div aria-live="polite">
        {state.error && <p className={errorBox}>{state.error}</p>}
        {state.uploadedId && (
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
            <CheckIcon size={18} strokeWidth={2.6} />
            Prescription uploaded.
          </p>
        )}
      </div>
    </form>
  );
}
