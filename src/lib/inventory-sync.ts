import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { DrugSchedule } from "@/generated/prisma/enums";
import { parseStockFile, type ImportRow, type RowIssue } from "@/lib/inventory-import";

const PREVIEW_TTL_MS = 30 * 60_000;
const LIST_LIMIT = 100;
const UNCATEGORISED = { slug: "uncategorised", name: "Uncategorised" };
/** GST used for new draft items whose file row has none — staff must check it before activating. */
const DRAFT_DEFAULT_GST = 12;

export type ImportSummary = {
  totalLines: number;
  validRows: number;
  errors: RowIssue[];
  errorCount: number;
  warnings: RowIssue[];
  warningCount: number;
  newSkus: string[];
  newSkuCount: number;
  priceChanges: { sku: string; fromPaise: number; toPaise: number }[];
  priceChangeCount: number;
  batchesToZero: number;
  applied?: { productsCreated: number; productsUpdated: number; batchesUpserted: number; batchesZeroed: number; pricesCappedToMrp: number };
};

export class ImportError extends Error {}

/** Validates an uploaded stock file and stores it as a preview. Nothing in the catalogue changes yet. */
export async function createImportPreview(p: {
  userId: string;
  fileName: string;
  text: string;
  fullSnapshot: boolean;
}): Promise<string> {
  const parsed = parseStockFile(p.text);
  if (parsed.missingColumns.length > 0) {
    throw new ImportError(
      `The file is missing these columns: ${parsed.missingColumns.join(", ")}. Download the template to see the expected headers.`,
    );
  }
  if (parsed.rows.length === 0) {
    throw new ImportError(
      parsed.errors.length ? `No valid rows. First problem — line ${parsed.errors[0].line}: ${parsed.errors[0].message}` : "The file has no rows.",
    );
  }

  const skus = [...new Set(parsed.rows.map((r) => r.sku))];
  const existing = await db.product.findMany({ where: { sku: { in: skus } }, select: { sku: true, pricePaise: true } });
  const priceBySku = new Map(existing.map((e) => [e.sku, e.pricePaise]));
  const newSkus = skus.filter((s) => !priceBySku.has(s));

  const priceChanges = new Map<string, { sku: string; fromPaise: number; toPaise: number }>();
  for (const r of parsed.rows) {
    const current = priceBySku.get(r.sku);
    if (current !== undefined && r.pricePaise !== null && r.pricePaise !== current) {
      priceChanges.set(r.sku, { sku: r.sku, fromPaise: current, toPaise: r.pricePaise });
    }
  }

  let batchesToZero = 0;
  if (p.fullSnapshot) {
    const inFile = new Set(parsed.rows.map((r) => `${r.sku}|${r.batchNo}`.toLowerCase()));
    const stocked = await db.inventoryBatch.findMany({
      where: { quantity: { gt: 0 } },
      select: { batchNo: true, product: { select: { sku: true } } },
    });
    batchesToZero = stocked.filter((b) => !inFile.has(`${b.product.sku}|${b.batchNo}`.toLowerCase())).length;
  }

  const summary: ImportSummary = {
    totalLines: parsed.totalLines,
    validRows: parsed.rows.length,
    errors: parsed.errors.slice(0, LIST_LIMIT),
    errorCount: parsed.errors.length,
    warnings: parsed.warnings.slice(0, LIST_LIMIT),
    warningCount: parsed.warnings.length,
    newSkus: newSkus.slice(0, LIST_LIMIT),
    newSkuCount: newSkus.length,
    priceChanges: [...priceChanges.values()].slice(0, LIST_LIMIT),
    priceChangeCount: priceChanges.size,
    batchesToZero,
  };

  const record = await db.inventoryImport.create({
    data: {
      createdById: p.userId,
      fileName: p.fileName.slice(0, 200),
      fullSnapshot: p.fullSnapshot,
      summary,
      rows: parsed.rows,
    },
    select: { id: true },
  });
  return record.id;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

/** Applies a preview to the catalogue and stock in one transaction. Each preview can be applied once. */
export async function applyImport(importId: string, userId: string): Promise<ImportSummary> {
  // Claim it atomically so a double click can't apply it twice.
  const claimed = await db.inventoryImport.updateMany({
    where: { id: importId, status: "PREVIEW", createdAt: { gt: new Date(Date.now() - PREVIEW_TTL_MS) } },
    data: { status: "APPLYING" },
  });
  if (claimed.count !== 1) throw new ImportError("This preview has expired or was already used. Upload the file again.");

  const record = await db.inventoryImport.findUniqueOrThrow({ where: { id: importId } });
  const rows = record.rows as unknown as ImportRow[];
  const summary = record.summary as unknown as ImportSummary;

  try {
    const applied = await db.$transaction(
      async (tx) => {
        const counts = { productsCreated: 0, productsUpdated: 0, batchesUpserted: 0, batchesZeroed: 0, pricesCappedToMrp: 0 };
        const category = await tx.category.upsert({ where: { slug: UNCATEGORISED.slug }, update: {}, create: UNCATEGORISED });

        const products = new Map(
          (
            await tx.product.findMany({
              where: { sku: { in: [...new Set(rows.map((r) => r.sku))] } },
              select: { id: true, sku: true, pricePaise: true, mrpPaise: true },
            })
          ).map((p) => [p.sku, p]),
        );
        const touchedBatchIds: string[] = [];
        const updatedSkus = new Set<string>();

        for (const r of rows) {
          let product = products.get(r.sku);
          if (!product) {
            // Unknown item: a hidden, prescription-only draft until staff review its details.
            const name = r.name ?? r.sku;
            const created = await tx.product.create({
              data: {
                sku: r.sku,
                name,
                slug: `${slugify(name) || "item"}-${randomBytes(3).toString("hex")}`,
                manufacturer: r.manufacturer,
                packSize: r.packSize,
                mrpPaise: r.mrpPaise ?? 0,
                pricePaise: r.pricePaise ?? r.mrpPaise ?? 0,
                hsnCode: r.hsnCode,
                gstRate: r.gstRate ?? DRAFT_DEFAULT_GST,
                schedule: DrugSchedule.H,
                requiresRx: true,
                isActive: false,
                categoryId: category.id,
              },
              select: { id: true, sku: true, pricePaise: true, mrpPaise: true },
            });
            products.set(r.sku, created);
            product = created;
            counts.productsCreated++;
          } else if (!updatedSkus.has(r.sku)) {
            const mrp = r.mrpPaise ?? product.mrpPaise;
            let price = r.pricePaise ?? product.pricePaise;
            if (price > mrp) {
              price = mrp; // never list above MRP
              counts.pricesCappedToMrp++;
            }
            await tx.product.update({
              where: { id: product.id },
              data: {
                mrpPaise: mrp,
                pricePaise: price,
                ...(r.hsnCode ? { hsnCode: r.hsnCode } : {}),
                ...(r.gstRate !== null ? { gstRate: r.gstRate } : {}),
                ...(r.manufacturer ? { manufacturer: r.manufacturer } : {}),
                ...(r.packSize ? { packSize: r.packSize } : {}),
              },
            });
            updatedSkus.add(r.sku);
            counts.productsUpdated++;
          }

          const batch = await tx.inventoryBatch.upsert({
            where: { productId_batchNo: { productId: product.id, batchNo: r.batchNo } },
            create: { productId: product.id, batchNo: r.batchNo, expiryDate: new Date(`${r.expiryDate}T00:00:00Z`), quantity: r.quantity },
            update: { expiryDate: new Date(`${r.expiryDate}T00:00:00Z`), quantity: r.quantity, syncedAt: new Date() },
            select: { id: true },
          });
          touchedBatchIds.push(batch.id);
          counts.batchesUpserted++;
        }

        if (record.fullSnapshot) {
          const zeroed = await tx.inventoryBatch.updateMany({
            where: { id: { notIn: touchedBatchIds }, quantity: { gt: 0 } },
            data: { quantity: 0, syncedAt: new Date() },
          });
          counts.batchesZeroed = zeroed.count;
        }

        await tx.auditLog.create({
          data: { actorId: userId, action: "inventory.import", entityType: "InventoryImport", entityId: importId, metadata: counts },
        });
        return counts;
      },
      { timeout: 120_000, maxWait: 10_000 },
    );

    const done: ImportSummary = { ...summary, applied };
    await db.inventoryImport.update({
      where: { id: importId },
      data: { status: "APPLIED", appliedAt: new Date(), summary: done, rows: [] },
    });
    return done;
  } catch (e) {
    // Transaction rolled back: nothing changed, so let staff retry the same preview.
    await db.inventoryImport.update({ where: { id: importId }, data: { status: "PREVIEW" } });
    throw e;
  }
}

export async function discardImport(importId: string): Promise<void> {
  await db.inventoryImport.updateMany({ where: { id: importId, status: "PREVIEW" }, data: { status: "DISCARDED", rows: [] } });
}
