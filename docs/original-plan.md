# Online Pharmacy Website — Plan (India)

## Context
You run a physical pharmacy in India and want customers to order online. The site needs to:
- sell OTC products,
- take prescription uploads that a pharmacist verifies,
- accept online payments and COD,
- offer store pickup and local delivery.

Inventory lives in your existing billing software. Stack: Node, React/Next.js, PostgreSQL, hosted on managed cloud. `D:\my-shop` is empty, so this is a new project.

## Compliance first (decide before building)
- **Fact:** The draft e-pharmacy rules (2018 amendment to the Drugs & Cosmetics Rules) have not been fully finalised. Your existing retail drug licence (Form 20/21) covers the physical shop. **Assumption to verify with a lawyer or the State Drug Controller:** whether local delivery from your licensed premises is allowed under your licence.
- Never sell **Schedule X / narcotic (NDPS)** drugs online. Schedule H/H1 items need a valid Rx and pharmacist approval, and H1 sales need a register.
- Show your licence number, the pharmacist's name and registration number, and the shop address on the site.
- **DPDP Act 2023:** prescriptions are health data. Collect only what you need, get explicit consent, keep files in a private bucket, share them via short-lived signed URLs, set a retention period, and keep an access log.
- **Payments:** card data must never touch your server. Use the gateway's hosted checkout (Razorpay/Cashfree/PayU) so you stay out of PCI scope.

## Architecture (recommended: one Next.js app)
```
Next.js 15 (App Router, TypeScript)
 ├─ Storefront (SSR/ISR for SEO)    /, /category, /product/[slug], /cart, /checkout
 ├─ Customer account                /account/orders, /account/prescriptions
 ├─ Admin / pharmacist panel         /admin/* (role-protected)
 ├─ API: Route Handlers / Server Actions
 └─ Background jobs (inventory sync, notifications) → cron or a small Node worker
PostgreSQL (Neon / Supabase / AWS RDS Mumbai region) via Prisma or Drizzle
Object storage: S3 / R2 private bucket (Rx images)
Hosting: Vercel (app) + Render/Railway (worker), or all on Render
```
Start with a single Next.js app and only split out a separate Node/Express API if a mobile app arrives later.

## Core data model (Postgres)
- `users` (role: customer | pharmacist | admin), `addresses`
- `products` (name, salt/composition, manufacturer, pack size, MRP, selling price, HSN, GST %, `schedule` [OTC|H|H1|X], `requires_rx`, images), `categories`
- `inventory` (product_id, batch, expiry, qty), synced from billing software
- `prescriptions` (user_id, file_key, status [pending|approved|rejected], verified_by, notes, expires_at)
- `orders`, `order_items`, `payments` (gateway ids, status), `deliveries` (mode: pickup|delivery, slot, status)
- `audit_logs` (who viewed or changed Rx and orders)

## Key flows
1. **OTC order:** browse/search → cart → address or pickup → pay (UPI/card/COD) → order confirmed → packed → delivered/picked up.
2. **Rx order:** the cart contains an `requires_rx` item, so the customer must upload an Rx or pick a saved one. The order goes to **"Awaiting pharmacist"**. A pharmacist approves or rejects it in admin. Only after approval: payment capture (or COD), then dispatch.
3. **Inventory sync:** check whether your billing software (Marg, GoFrugal, etc.) has an API or scheduled export. If it does, run a job every 15–30 minutes that upserts stock and prices. If not, import CSV exports. Reserve stock when an order is placed and push sales back if the software supports it.
4. **Delivery area:** check pincodes or distance against your service radius at checkout. Offer store-pickup slots.

## Feature ideas
**MVP:** search by brand/salt, categories, Rx upload, pharmacist queue, Razorpay + COD, WhatsApp/SMS order updates (via an approved provider such as Gupshup or MSG91), GST invoice PDF, pickup/delivery, admin order board.
**Later:** generic-substitute suggestions, refill reminders for chronic medicines, reorder in one click, offers and coupons, health-product blog for SEO, PWA/mobile app, Shiprocket/Dunzo-style delivery partner, analytics dashboard (top sellers, near-expiry stock).

## Security checklist
- Auth: Auth.js or Clerk with phone OTP for customers. Pharmacists and admins use strong passwords plus 2FA. Role-based access on every admin route.
- Input validation with Zod. Parameterised queries via the ORM. CSRF protection for server actions. Rate-limit OTP and login.
- Keep secrets in hosting environment variables, never in the repo. Verify payment webhook signatures.
- Encrypted backups (point-in-time recovery on managed Postgres). HTTPS everywhere. Keep data in the India region.

## Suggested build order
1. Scaffold Next.js + TS + Tailwind + Prisma, Postgres schema, seed data
2. Catalog + search + product pages
3. Auth (OTP) + cart + checkout (COD first)
4. Rx upload + pharmacist approval queue
5. Razorpay integration + webhooks + invoices
6. Pickup/delivery + notifications
7. Inventory sync with billing software
8. Admin dashboard, legal pages (privacy, terms, refund, licence details), launch

## Verification
- Unit tests (Vitest) for pricing/GST, Rx gating, and stock reservation. Playwright E2E for OTC checkout, Rx approve/reject, and the pickup flow.
- Payments in Razorpay **test mode** only until launch.
- Before going live: legal review of the compliance points above, plus a security review (OWASP top 10).
