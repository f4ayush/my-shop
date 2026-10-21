"use client";

import { useActionState } from "react";
import { uploadPrescriptionAction, type UploadState } from "@/app/account/prescriptions/actions";

export function PrescriptionUploadForm() {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadPrescriptionAction, {});

  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="rx-file" className="mb-1 block text-sm font-medium">
          Prescription (photo or PDF, up to 5 MB)
        </label>
        <input
          id="rx-file"
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,application/pdf"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">
          Make sure the doctor’s name, registration number, date, medicines and signature are clearly visible.
        </p>
      </div>
      <label className="flex items-start gap-2 text-xs text-slate-700">
        <input type="checkbox" name="consent" required className="mt-0.5" />
        <span>
          I consent to My Pharmacy storing this prescription and sharing it only with our registered pharmacist to
          verify and dispense my orders, as described in the privacy policy.
        </span>
      </label>
      <button
        disabled={pending}
        className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand hover:text-white disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload prescription"}
      </button>
      <div aria-live="polite">
        {state.error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
        {state.uploadedId && <p className="text-sm text-green-700">✓ Prescription uploaded.</p>}
      </div>
    </form>
  );
}
