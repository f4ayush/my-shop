// Creates the shop's categories, and nothing else, so it is safe on a production database (unlike the
// development seed, which also adds sample products and staff). Idempotent:
//   npm run pilot:categories
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { pgConfig } from "../src/lib/db-config";
import { CATEGORIES } from "../prisma/categories";

async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg(pgConfig()) });
  try {
    for (const c of CATEGORIES) {
      await db.category.upsert({ where: { slug: c.slug }, update: { name: c.name }, create: c });
    }
    console.log(`${CATEGORIES.length} categories ready.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
