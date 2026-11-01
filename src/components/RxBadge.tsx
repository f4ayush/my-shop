/** "Rx required" chip: white on product art, amber elsewhere. */
export function RxBadge({ onArt = false, className = "" }: { onArt?: boolean; className?: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs leading-none font-bold text-amber-ink ${onArt ? "bg-white" : "bg-amber-tint"} ${className}`}
    >
      <abbr title="Prescription" className="no-underline">
        Rx
      </abbr>{" "}
      required
    </span>
  );
}
