import { redirect } from "next/navigation";
import { whatsappOrders } from "@/lib/whatsapp";

// Pilot: no customer accounts while orders are taken on WhatsApp.
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  if (whatsappOrders) redirect("/");
  return children;
}
