"use client";

import { useActionState } from "react";
import { approveAction, rejectAction, type ReviewState } from "./actions";

const input = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
const label = "mb-1 block text-sm font-medium";
const errorBox = "rounded-md bg-red-50 p-3 text-sm text-red-800";

type Props = {
  orderId: string;
  defaults: { doctorName?: string; issuedOn?: string; expiresAt?: string };
  today: string;
};

export function ReviewForms({ orderId, defaults, today }: Props) {
  const [approveState, approve, approving] = useActionState<ReviewState, FormData>(approveAction, {});
  const [rejectState, reject, rejecting] = useActionState<ReviewState, FormData>(rejectAction, {});
  const busy = approving || rejecting;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form action={approve} className="space-y-3 rounded-xl border border-green-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-green-800">Approve</h2>
        <input type="hidden" name="orderId" value={orderId} />
        <div>
          <label htmlFor="doctorName" className={label}>
            Prescribing doctor *
          </label>
          <input id="doctorName" name="doctorName" required defaultValue={defaults.doctorName} className={input} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="issuedOn" className={label}>
              Prescription date *
            </label>
            <input id="issuedOn" name="issuedOn" type="date" required max={today} defaultValue={defaults.issuedOn} className={input} />
          </div>
          <div>
            <label htmlFor="expiresAt" className={label}>
              Valid until
            </label>
            <input id="expiresAt" name="expiresAt" type="date" defaultValue={defaults.expiresAt} className={input} />
          </div>
        </div>
        <div>
          <label htmlFor="approveNotes" className={label}>
            Note to customer (optional)
          </label>
          <textarea id="approveNotes" name="notes" rows={2} maxLength={500} className={input} />
        </div>
        <button
          disabled={busy}
          className="w-full rounded-md bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-60"
        >
          {approving ? "Approving…" : "Approve & confirm order"}
        </button>
        {approveState.error && <p className={errorBox}>{approveState.error}</p>}
      </form>

      <form action={reject} className="space-y-3 rounded-xl border border-red-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-red-800">Reject</h2>
        <input type="hidden" name="orderId" value={orderId} />
        <div>
          <label htmlFor="reason" className={label}>
            Reason (shown to the customer) *
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={4}
            required
            minLength={5}
            maxLength={500}
            placeholder="e.g. The prescription is unreadable — please upload a clearer photo."
            className={input}
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="prescriptionInvalid" className="mt-0.5" />
          <span>The prescription itself is invalid (it can’t be reused for other orders)</span>
        </label>
        <button
          disabled={busy}
          className="w-full rounded-md bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-800 disabled:opacity-60"
        >
          {rejecting ? "Rejecting…" : "Reject order"}
        </button>
        {rejectState.error && <p className={errorBox}>{rejectState.error}</p>}
        <p className="text-xs text-slate-500">Rejecting releases the reserved stock.</p>
      </form>
    </div>
  );
}
