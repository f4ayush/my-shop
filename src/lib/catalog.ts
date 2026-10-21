import { db } from "@/lib/db";
import { DrugSchedule } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export const PAGE_SIZE = 24;
const MAX_QUERY_LENGTH = 100;
const MAX_SEARCH_TERMS = 5;

// Only active products are shown, and Schedule X drugs must never be listed or sold online.
export const sellable = {
  isActive: true,
  schedule: { not: DrugSchedule.X },
} satisfies Prisma.ProductWhereInput;

// ─── List options (sort / Rx filter / page) from the URL ──

export type SortKey = "name" | "price_asc" | "price_desc";
export type RxFilter = "all" | "otc" | "rx";
export type ListOptions = { sort: SortKey; rx: RxFilter; page: number };
export type RawSearchParams = Record<string, string | string[] | undefined>;

export const SORT_LABELS: Record<SortKey, string> = {
  name: "Name (A–Z)",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};

export const RX_LABELS: Record<RxFilter, string> = {
  all: "All products",
  otc: "No prescription needed",
  rx: "Prescription medicines",
};

export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseListOptions(sp: RawSearchParams): ListOptions {
  const sort = firstParam(sp.sort);
  const rx = firstParam(sp.rx);
  const page = Number.parseInt(firstParam(sp.page) ?? "1", 10);
  return {
    sort: sort && sort in SORT_LABELS ? (sort as SortKey) : "name",
    rx: rx && rx in RX_LABELS ? (rx as RxFilter) : "all",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function parseQuery(sp: RawSearchParams): string {
  return (firstParam(sp.q) ?? "").trim().slice(0, MAX_QUERY_LENGTH);
}

const ORDER_BY: Record<SortKey, Prisma.ProductOrderByWithRelationInput[]> = {
  name: [{ name: "asc" }],
  price_asc: [{ pricePaise: "asc" }, { name: "asc" }],
  price_desc: [{ pricePaise: "desc" }, { name: "asc" }],
};

function rxWhere(rx: RxFilter): Prisma.ProductWhereInput {
  if (rx === "otc") return { requiresRx: false };
  if (rx === "rx") return { requiresRx: true };
  return {};
}

/** Every term must match the brand name, salt or manufacturer. */
export function searchWhere(q: string): Prisma.ProductWhereInput {
  const terms = q.split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TERMS);
  return {
    AND: terms.map((t) => ({
      OR: [
        { name: { contains: t, mode: "insensitive" } },
        { composition: { contains: t, mode: "insensitive" } },
        { manufacturer: { contains: t, mode: "insensitive" } },
      ],
    })),
  };
}

// ─── Product cards ───────────────────────────────────────

export function liveBatches() {
  // Expired stock is never counted as available.
  return {
    where: { expiryDate: { gt: new Date() } },
    select: { quantity: true, reserved: true },
  } satisfies Prisma.Product$batchesArgs;
}

function cardSelect() {
  return {
    id: true,
    slug: true,
    name: true,
    composition: true,
    packSize: true,
    mrpPaise: true,
    pricePaise: true,
    requiresRx: true,
    category: { select: { name: true, slug: true } },
    batches: liveBatches(),
  } satisfies Prisma.ProductSelect;
}

export function availableQty(batches: { quantity: number; reserved: number }[]): number {
  return batches.reduce((sum, b) => sum + Math.max(0, b.quantity - b.reserved), 0);
}

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  composition: string | null;
  packSize: string | null;
  mrpPaise: number;
  pricePaise: number;
  requiresRx: boolean;
  category: { name: string; slug: string };
  inStock: boolean;
};

function toCard({ batches, ...p }: Prisma.ProductGetPayload<{ select: ReturnType<typeof cardSelect> }>): ProductCardData {
  return { ...p, inStock: availableQty(batches) > 0 };
}

export type ProductPage = {
  items: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
};

export async function listProducts(where: Prisma.ProductWhereInput, opts: ListOptions): Promise<ProductPage> {
  const fullWhere: Prisma.ProductWhereInput = { AND: [sellable, where, rxWhere(opts.rx)] };
  const [rows, total] = await Promise.all([
    db.product.findMany({
      where: fullWhere,
      orderBy: ORDER_BY[opts.sort],
      skip: (opts.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: cardSelect(),
    }),
    db.product.count({ where: fullWhere }),
  ]);
  return {
    items: rows.map(toCard),
    total,
    page: opts.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// ─── Categories ──────────────────────────────────────────

export async function getCategories() {
  return db.category.findMany({
    orderBy: { name: "asc" },
    select: {
      name: true,
      slug: true,
      _count: { select: { products: { where: sellable } } },
    },
  });
}

export async function getCategoryBySlug(slug: string) {
  return db.category.findUnique({ where: { slug }, select: { id: true, name: true, slug: true } });
}

// ─── Product detail ──────────────────────────────────────

export async function getProductBySlug(slug: string) {
  const product = await db.product.findFirst({
    where: { slug, ...sellable },
    include: {
      category: { select: { name: true, slug: true } },
      batches: liveBatches(),
    },
  });
  if (!product) return null;
  const { batches, ...rest } = product;
  return { ...rest, availableQty: availableQty(batches) };
}

/** Other sellable products with the same salt, cheapest first. */
export async function getAlternatives(productId: string, composition: string | null): Promise<ProductCardData[]> {
  if (!composition) return [];
  const rows = await db.product.findMany({
    where: {
      ...sellable,
      id: { not: productId },
      composition: { equals: composition, mode: "insensitive" },
    },
    orderBy: { pricePaise: "asc" },
    take: 6,
    select: cardSelect(),
  });
  return rows.map(toCard);
}
