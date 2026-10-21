// Grants (or removes) a staff role for a mobile number. Run by someone with database access:
//   npm run staff:grant -- 9876543210 PHARMACIST
//   npm run staff:grant -- 9876543210 CUSTOMER     (revoke)
// The person then logs in normally with an SMS code.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { maskPhone, normalizeIndianMobile } from "../src/lib/phone";

async function main() {
  const [rawPhone, rawRole] = process.argv.slice(2);
  const phone = normalizeIndianMobile(rawPhone ?? "");
  const role = rawRole?.toUpperCase();
  if (!phone || !role || !(role in Role)) {
    console.error("Usage: npm run staff:grant -- <10-digit mobile> <PHARMACIST|ADMIN|CUSTOMER>");
    process.exit(1);
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const user = await db.user.upsert({
      where: { phone },
      update: { role: role as Role },
      create: { phone, role: role as Role },
    });
    // Sign them out everywhere so the new role takes effect on their next login.
    await db.session.deleteMany({ where: { userId: user.id } });
    await db.auditLog.create({
      data: { action: "user.role_change", entityType: "User", entityId: user.id, metadata: { role, via: "cli" } },
    });
    console.log(`${maskPhone(phone)} is now ${role}.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
