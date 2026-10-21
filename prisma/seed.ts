// Development seed data. Idempotent: safe to run repeatedly.
// NOTE: products, schedules, GST rates and HSN codes below are SAMPLE values for
// development only. Real data must come from your billing software, and drug
// schedules / GST rates must be confirmed with your pharmacist and CA.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, DrugSchedule, Role } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const categories = [
  { slug: "medicines", name: "Medicines" },
  { slug: "wellness", name: "Vitamins & Wellness" },
  { slug: "personal-care", name: "Personal Care" },
  { slug: "devices", name: "Health Devices" },
  { slug: "first-aid", name: "First Aid" },
];

type SeedProduct = {
  sku: string;
  name: string;
  composition?: string;
  packSize: string;
  category: string;
  mrp: number; // rupees
  price: number; // rupees
  gstRate: number;
  hsnCode: string;
  schedule: DrugSchedule;
};

const products: SeedProduct[] = [
  // OTC
  { sku: "OTC-001", name: "Oral Rehydration Salts (Orange)", composition: "ORS WHO formula", packSize: "Sachet of 21 g", category: "medicines", mrp: 25, price: 23, gstRate: 5, hsnCode: "3004", schedule: "OTC" },
  { sku: "OTC-002", name: "Vitamin C 500 mg Chewable", composition: "Ascorbic Acid 500 mg", packSize: "Strip of 15 tablets", category: "wellness", mrp: 120, price: 108, gstRate: 5, hsnCode: "2106", schedule: "OTC" },
  { sku: "OTC-003", name: "Hand Sanitizer 500 ml", composition: "Ethyl alcohol 70% v/v", packSize: "Bottle of 500 ml", category: "personal-care", mrp: 250, price: 199, gstRate: 18, hsnCode: "3808", schedule: "OTC" },
  { sku: "OTC-004", name: "Digital Thermometer", packSize: "1 unit", category: "devices", mrp: 350, price: 299, gstRate: 5, hsnCode: "9025", schedule: "OTC" },
  { sku: "OTC-005", name: "Antiseptic Liquid 250 ml", composition: "Chloroxylenol 4.8% w/v", packSize: "Bottle of 250 ml", category: "first-aid", mrp: 140, price: 132, gstRate: 5, hsnCode: "3004", schedule: "OTC" },
  { sku: "OTC-006", name: "Cotton Crepe Bandage 10 cm", packSize: "1 roll", category: "first-aid", mrp: 110, price: 95, gstRate: 5, hsnCode: "3005", schedule: "OTC" },
  // Prescription (Schedule H / H1)
  { sku: "RX-001", name: "Amoxicillin 500 mg Capsule", composition: "Amoxicillin 500 mg", packSize: "Strip of 10 capsules", category: "medicines", mrp: 95, price: 86, gstRate: 5, hsnCode: "3004", schedule: "H" },
  { sku: "RX-002", name: "Metformin 500 mg Tablet", composition: "Metformin Hydrochloride 500 mg", packSize: "Strip of 15 tablets", category: "medicines", mrp: 30, price: 27, gstRate: 5, hsnCode: "3004", schedule: "H" },
  { sku: "RX-005", name: "Metformin 500 mg SR Tablet (Brand B)", composition: "Metformin Hydrochloride 500 mg", packSize: "Strip of 10 tablets", category: "medicines", mrp: 28, price: 22, gstRate: 5, hsnCode: "3004", schedule: "H" },
  { sku: "RX-003", name: "Atorvastatin 10 mg Tablet", composition: "Atorvastatin 10 mg", packSize: "Strip of 15 tablets", category: "medicines", mrp: 110, price: 99, gstRate: 5, hsnCode: "3004", schedule: "H" },
  { sku: "RX-004", name: "Cefixime 200 mg Tablet", composition: "Cefixime 200 mg", packSize: "Strip of 10 tablets", category: "medicines", mrp: 120, price: 108, gstRate: 5, hsnCode: "3004", schedule: "H1" },
];

const serviceAreas = [
  { pincode: "110001", area: "Connaught Place", deliveryFeePaise: 0 },
  { pincode: "110002", area: "Daryaganj", deliveryFeePaise: 2000 },
  { pincode: "110005", area: "Karol Bagh", deliveryFeePaise: 3000 },
];

// Placeholder staff accounts (fake numbers, no passwords — auth comes in step 3).
const staff = [
  { phone: "+910000000001", name: "Dev Admin", role: Role.ADMIN },
  { phone: "+910000000002", name: "Dev Pharmacist", role: Role.PHARMACIST },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  for (const c of categories) {
    await db.category.upsert({ where: { slug: c.slug }, update: { name: c.name }, create: c });
  }
  const categoryIds = Object.fromEntries(
    (await db.category.findMany()).map((c) => [c.slug, c.id]),
  );

  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  for (const p of products) {
    const data = {
      name: p.name,
      slug: slugify(p.name),
      composition: p.composition,
      manufacturer: "Sample Pharma Ltd",
      packSize: p.packSize,
      mrpPaise: p.mrp * 100,
      pricePaise: p.price * 100,
      hsnCode: p.hsnCode,
      gstRate: p.gstRate,
      schedule: p.schedule,
      requiresRx: p.schedule !== DrugSchedule.OTC,
      categoryId: categoryIds[p.category],
    };
    const product = await db.product.upsert({
      where: { sku: p.sku },
      update: data,
      create: { sku: p.sku, ...data },
    });
    await db.inventoryBatch.upsert({
      where: { productId_batchNo: { productId: product.id, batchNo: `${p.sku}-B1` } },
      update: { quantity: 50 },
      create: { productId: product.id, batchNo: `${p.sku}-B1`, expiryDate: nextYear, quantity: 50 },
    });
  }

  for (const a of serviceAreas) {
    await db.serviceArea.upsert({ where: { pincode: a.pincode }, update: a, create: a });
  }

  for (const s of staff) {
    await db.user.upsert({ where: { phone: s.phone }, update: { name: s.name, role: s.role }, create: s });
  }

  console.log(
    `Seeded ${categories.length} categories, ${products.length} products, ` +
      `${serviceAreas.length} service areas, ${staff.length} staff users.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
