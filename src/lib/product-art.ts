// Illustrations stand in for product photos: the shape comes from the pack size and the colours from a
// stable hash of the product ID, so a product looks the same on its card, in the cart and on orders.

export type ArtKind = "tablets" | "capsules" | "bottle" | "other";
export type ArtTone = { tint: string; ink: string };

// Tint (background) and ink (pills/label) pairs from the design.
export const ART_TONES: readonly ArtTone[] = [
  { tint: "#E4F2EE", ink: "#0F766E" },
  { tint: "#EBEEFA", ink: "#4054B2" },
  { tint: "#FDF1E7", ink: "#C2611F" },
  { tint: "#FBF4DC", ink: "#B7860B" },
  { tint: "#FCECEF", ink: "#B4234A" },
  { tint: "#E9F4E6", ink: "#3F7D32" },
  { tint: "#F1ECFA", ink: "#6D4BC2" },
];

export function artKind(packSize: string | null | undefined): ArtKind {
  const s = (packSize ?? "").toLowerCase();
  // Containers first: "Bottle of 30 tablets" is a bottle.
  if (/bottle|\bjar\b|\btube\b|\bml\b|softgel/.test(s)) return "bottle";
  if (/capsule/.test(s)) return "capsules";
  if (/strip|tablet/.test(s)) return "tablets";
  return "other";
}

/** FNV-1a: cheap, stable across runs and runtimes. */
function hash(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function artTone(key: string): ArtTone {
  return ART_TONES[hash(key) % ART_TONES.length];
}
