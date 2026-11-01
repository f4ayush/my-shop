import { artKind, artTone, type ArtKind } from "@/lib/product-art";

const ROWS = [28, 49, 70];
const CAPSULE_ACCENT = "#F3B34A";

// Each shape is drawn at a size that suits it: strips are wide, bottles tall, the capsule small.
const SIZES: Record<"card" | "hero", Record<ArtKind, string>> = {
  card: {
    tablets: "w-[112px] sm:w-[160px]",
    capsules: "w-[112px] sm:w-[160px]",
    bottle: "w-[78px] sm:w-[120px]",
    other: "w-[54px] sm:w-[88px]",
  },
  hero: { tablets: "w-[62%]", capsules: "w-[62%]", bottle: "w-[44%]", other: "w-[34%]" },
};

type ArtProps = {
  id: string;
  packSize: string | null;
  variant?: "card" | "hero";
  /** Set when the art is the main image of a page; cards leave it decorative. */
  label?: string;
};

/** Product illustration: a blister strip, a bottle or a capsule, in the product's colours. */
export function ProductArt({ id, packSize, variant = "card", label }: ArtProps) {
  const { ink } = artTone(id);
  const kind = artKind(packSize);
  const className = SIZES[variant][kind];
  const a11y = label ? ({ role: "img", "aria-label": label } as const) : ({ "aria-hidden": true } as const);

  if (kind === "bottle") {
    return (
      <svg viewBox="0 0 120 120" className={className} {...a11y}>
        <rect x="44" y="14" width="32" height="16" rx="4" fill="#10201E" />
        <rect x="34" y="30" width="52" height="78" rx="14" fill="#FFFFFF" />
        <rect x="34" y="52" width="52" height="32" fill={ink} />
        <rect x="44" y="62" width="32" height="4" rx="2" fill="#FFFFFF" />
        <rect x="44" y="70" width="20" height="4" rx="2" fill="#FFFFFF" opacity=".7" />
      </svg>
    );
  }

  if (kind === "tablets" || kind === "capsules") {
    const capsules = kind === "capsules";
    const cols = capsules ? [30, 67, 104] : [32, 62, 92];
    const w = capsules ? 26 : 22;
    return (
      <svg viewBox="0 0 160 110" className={className} {...a11y}>
        <rect x="18" y="14" width="124" height="82" rx="12" fill="#FFFFFF" transform="rotate(-8 80 55)" />
        <g transform="rotate(-8 80 55)">
          {ROWS.flatMap((y, r) =>
            cols.map((x, c) => {
              // The last blister is empty.
              const last = r === ROWS.length - 1 && c === cols.length - 1;
              return (
                <g key={`${r}-${c}`} opacity={last ? 0.25 : 1}>
                  <rect x={x} y={y} width={w} height="12" rx="6" fill={ink} />
                  {capsules && !last && <rect x={x + w / 2} y={y} width={w / 2} height="12" fill={CAPSULE_ACCENT} />}
                </g>
              );
            }),
          )}
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} {...a11y}>
      <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)" fill={ink} />
    </svg>
  );
}

/** Small tinted tile with a capsule glyph, for cart lines, order items and lists. */
export function ProductThumb({ id, className = "size-14 rounded-[14px]" }: { id: string; className?: string }) {
  const { tint, ink } = artTone(id);
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center ${className}`} style={{ background: tint }}>
      <svg viewBox="0 0 24 24" className="w-[56%]">
        <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)" fill={ink} />
      </svg>
    </span>
  );
}
