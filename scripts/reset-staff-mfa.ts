// Turns off a staff member's authenticator app and recovery codes (e.g. lost phone), and signs
// them out everywhere. Run by someone with database access, after confirming who is asking:
//   npm run staff:reset-mfa -- 9876543210
// On their next login they set up an authenticator app again after the SMS code.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { maskPhone, normalizeIndianMobile } from "../src/lib/phone";

async function main() {
  const phone = normalizeIndianMobile(process.argv[2] ?? "");
  if (!phone) {
    console.error("Usage: npm run staff:reset-mfa -- <10-digit mobile>");
    process.exit(1);
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const user = await db.user.findUnique({ where: { phone }, select: { id: true } });
    if (!user) {
      console.error(`No user with ${maskPhone(phone)}.`);
      process.exit(1);
    }
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null } }),
      db.recoveryCode.deleteMany({ where: { userId: user.id } }),
      db.session.deleteMany({ where: { userId: user.id } }),
      db.auditLog.create({ data: { action: "mfa.reset", entityType: "User", entityId: user.id, metadata: { via: "cli" } } }),
    ]);
    console.log(`Second factor reset for ${maskPhone(phone)}. They will set it up again at next login.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
