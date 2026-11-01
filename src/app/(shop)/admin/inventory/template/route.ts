import { getCurrentUser, isStaff } from "@/lib/auth/session";
import { csvCell } from "@/lib/csv";

// Example stock file showing the expected columns. Staff only.
export async function GET() {
  if (!isStaff(await getCurrentUser())) return new Response("Not found", { status: 404 });

  const rows = [
    ["Item Code", "Item Name", "Batch No", "Expiry", "Qty", "MRP", "Rate", "HSN", "GST %", "Manufacturer", "Pack"],
    ["OTC-001", "Oral Rehydration Salts (Orange)", "ORS2410", "12/2027", 40, "25.00", "23.00", "3004", 5, "Sample Pharma Ltd", "Sachet of 21 g"],
    ["RX-002", "Metformin 500 mg Tablet", "MF5531", "31/03/2028", 120, "30.00", "27.00", "3004", 5, "Sample Pharma Ltd", "Strip of 15 tablets"],
  ];
  const body = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n"; // BOM so Excel reads UTF-8
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="stock-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
