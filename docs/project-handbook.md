# My Pharmacy — Project Handbook

Oct 22, 2026 · @Ayush

## Overview

My Pharmacy is an online store for a licensed retail pharmacy in India. Customers order OTC and prescription medicines for store pickup or local delivery. Staff confirm orders, verify prescriptions and keep stock in sync with the billing software. All eight planned build steps and a production-hardening pass are done and on `main`; launch is blocked only by external accounts, configuration and legal review (see Pending).

| Item | Value |
| --- | --- |
| Repository | [f4ayush/my-shop](https://github.com/f4ayush/my-shop), branch `main` |
| Framework | Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4 |
| Database | PostgreSQL 16 via Prisma 7 (`@prisma/adapter-pg`); local DB runs in Docker |
| Payments | Razorpay Checkout + signed webhook |
| SMS | MSG91 (DLT templates); development prints messages to the server log |
| File storage | Local disk in development; private AWS S3 (Mumbai) or Cloudflare R2 in production |
| Tests | Vitest, 125 unit tests |
| Runtime | Node.js 22 LTS |

## What's built

Every feature below is implemented, unit-tested where it has logic, and was exercised end to end in a browser against the local database. Items marked † have only been tested with simulated or dev-mode providers, not real accounts.

| Area | What it does | Where |
| --- | --- | --- |
| Catalogue | Category pages, search by brand, salt or manufacturer, OTC/Rx filter, sort, pagination; Schedule X never listed | `/`, `/category/[slug]`, `/search` |
| Product page | Price vs MRP, stock from unexpired batches, same-salt alternatives | `/product/[slug]` |
| Customer login | Mobile number + 6-digit SMS code; hashed codes, per-number and per-IP limits; 30-day session | `/login` |
| Cart | Guest cart merged into the account at login; stock and availability checks | `/cart` |
| Checkout | Store pickup (IST slots) or delivery (pincode service areas + fee); cash on delivery or online payment | `/checkout` |
| Prescriptions | Upload JPG/PNG/PDF with explicit consent; type checked by content; private storage; reuse on later orders | `/account/prescriptions` |
| Online payment † | Razorpay Checkout, signature-verified webhook, 30-minute payment hold, automatic refunds | `/account/orders/[n]` |
| Orders | Progress tracker, payment status, GST tax invoice (print / save as PDF) | `/account/orders` |
| SMS updates † | One message per status change, order number only, never medicine names | MSG91 or dev log |
| Admin dashboard | Today's orders and value, items needing action, low stock, near-expiry and expired-on-shelf batches | `/admin` |
| Order board | Confirm, pack, ready for pickup / out for delivery, complete, cancel with reason (releases stock, refunds online payments) | `/admin/orders` |
| Rx queue | Pharmacist approves (doctor, date, validity) or rejects with a reason; H1 register reminder; failed-refund retry | `/admin/prescriptions` |
| Products | Create and edit; Rx requirement follows drug schedule; price never above MRP; no sale for Schedule X, zero-priced or uncategorised items; change history | `/admin/products` |
| Stock sync | CSV export from any billing software: column auto-detection, preview with line-numbered errors, one-time apply, unknown items as hidden drafts | `/admin/inventory` |
| Staff security | SMS code + authenticator app (TOTP) with 10 recovery codes; 8-hour sessions; role change signs out | `/login/mfa` |
| Platform security | CSP, HSTS, no framing, audit log of sensitive actions, staff pages return 404 to others | `next.config.ts` |
| Legal pages | Privacy, terms, returns, delivery, grievances — draft templates with a review banner | `/privacy` and others |

## What's pending

Nine items stand between the code and a public launch; the first five are blockers and need accounts or decisions from the business, not code.

| # | Item | Why it matters | Type |
| --- | --- | --- | --- |
| 1 | Legal review of the five policy pages; fill every \[bracketed\] value; set `STORE_LEGAL_REVIEWED=true` | DPDP Act and e-commerce rules; pages show a "draft" banner until then | Blocker — business |
| 2 | Confirm online-pharmacy licensing and delivery from the licensed premises with the State Drug Controller | Draft e-pharmacy rules are not finalised | Blocker — business |
| 3 | Razorpay: KYC, test-mode end-to-end payment and refund, then live keys and webhook | Real checkout and refund calls never run yet | Blocker — setup + test |
| 4 | MSG91: DLT sender ID and nine templates, then a real OTP and order SMS | Production refuses to send SMS until configured | Blocker — setup + test |
| 5 | Private S3 (Mumbai) or R2 bucket, then a real prescription upload and view | Production refuses local file storage | Blocker — setup + test |
| 6 | Real catalogue: import from billing software, confirm each drug schedule, GST rate and HSN with pharmacist and CA | Seed data is sample only | Before launch |
| 7 | Credit notes for cancelled orders that already have a tax invoice | Today the app only warns staff | Feature |
| 8 | Customer data requests (download / delete account) in the app | DPDP rights are handled by email for now | Feature |
| 9 | Batch-level MRP (price per batch), scheduled stock sync, inter-state IGST invoices, delivery-partner integration, refill reminders | Nice to have | Later |

Known limits: staff authenticator setup is trust-on-first-use (grant the role just before the person's first login, in person), and delivery fees are not split out as a separate GST line on invoices.

## Run it locally

A fresh machine reaches a working shop at http://localhost:3000 in about ten minutes with the steps below. Nothing external is needed: SMS codes print to the terminal, files go to `./storage`, and online payment stays hidden until Razorpay test keys are added.

**Prerequisites:** Node.js 22 LTS, Docker Desktop (running), Git.

1. Clone the repository and install dependencies (this also generates the Prisma client):

   ```bash
   git clone git@github.com:f4ayush/my-shop.git
   cd my-shop
   npm install
   ```
2. Create your `.env` from the template:

   ```bash
   cp .env.example .env
   ```
3. Generate two secrets and paste each into `.env` as `OTP_SECRET=` and `MFA_ENCRYPTION_KEY=` (run the command twice; never reuse values between machines or environments):

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
4. In `.env`, set `TRUSTED_PROXY_COUNT=0` (nothing sits in front of the app locally). Leave `SMS_PROVIDER` empty and `STORAGE_DRIVER=local`.
5. Start PostgreSQL in Docker (port 5432, bound to localhost only):

   ```bash
   npm run db:up
   ```
6. Create the tables and load the sample catalogue (11 products, 3 delivery pincodes):

   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```
7. Create the local staff test accounts (next section):

   ```bash
   npm run staff:grant -- 7777777777 ADMIN
   npm run staff:grant -- 8888888888 PHARMACIST
   ```
8. Start the app and open http://localhost:3000:

   ```bash
   npm run dev
   ```
9. Optional — online payments: add Razorpay **test-mode** keys as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env`, then restart `npm run dev`. Test cards and UPI IDs are on [Razorpay's test page](https://razorpay.com/docs/payments/payments/test-card-details/).
10. Check everything still passes before you push:

    ```bash
    npm test
    npm run typecheck
    npm run build
    ```

Restart `npm run dev` after any change to `.env` or after a new migration, so the server picks up the new values and Prisma client.

## Test logins (local only)

The app has no passwords: everyone logs in with a mobile number and a one-time SMS code, and staff add an authenticator-app code. Locally no SMS is sent — the code appears in the terminal running `npm run dev`. Use these dummy numbers on your own machine only; never grant them a role on a real deployment.

| Portal | Role | Mobile number | Second step | Lands on |
| --- | --- | --- | --- | --- |
| Customer | Customer | 9999999999 | none | `/` (any number works; the account is created on first login) |
| Admin | Admin | 7777777777 | authenticator app | `/admin` |
| Admin | Pharmacist | 8888888888 | authenticator app | `/admin` |

**Get the SMS code.** After "Send code", look in the `npm run dev` terminal for a line like `[dev sms] to +91******9999: 482913 is your My Pharmacy login code.` Enter those six digits. Codes last 5 minutes; a number can request 3 codes per 15 minutes.

**First staff login (one-time setup).**

1. Log in at http://localhost:3000/login with 7777777777 or 8888888888 and the SMS code.
2. The setup page shows a key in groups of four. In Google Authenticator or Microsoft Authenticator choose "Enter a setup key", type the key, and pick time-based.
3. Save the 10 recovery codes shown; each works once if the phone is lost.
4. Enter the 6-digit code from the app. You are signed in for 8 hours; the header shows **Admin**.

Later logins: SMS code, then the current app code. Lost the app? Run `npm run staff:reset-mfa -- 8888888888` and set it up again.

**End-to-end walkthrough** (about 10 minutes, two browser profiles or one normal + one private window):

1. Customer: search "metformin", add Metformin and ORS to the cart, log in as 9999999999, check out with store pickup and cash on delivery. Upload any test image as the prescription and tick consent.
2. Pharmacist: log in as 8888888888, open **Admin → Rx queue**, view the prescription, enter a doctor name and date, approve.
3. Admin: log in as 7777777777, open **Admin → Orders**: Mark packed → Ready for pickup → Collected.
4. Customer: open **My orders** — the tracker shows each step and the tax invoice opens; the terminal shows an SMS line per status.
5. Admin: **Admin → Stock sync** → download the template, change a quantity, upload, review the preview, apply. **Admin → Products** → open an imported draft, set its category and schedule, tick On sale.
6. Optional with Razorpay test keys: repeat step 1 with **Pay online**, then cancel the order from the order board and confirm the refund.

## Deploy to production

Recommended: everything in AWS Mumbai (`ap-south-1`) so customer and health data stay in India — the Next.js app as a Node 22 container behind a load balancer, RDS PostgreSQL 16, and a private S3 bucket. Avoid serverless hosts whose request-body limit is below the app's 6 MB upload limit (Vercel functions cap requests at about 4.5 MB), or prescription uploads will fail. Full detail per service is in `docs/production.md` in the repo.

1. **Accounts and approvals first** (they take days): Razorpay live KYC, MSG91 account with DLT sender ID and nine templates, a domain, and the legal and licensing items under Pending.
2. **Database:** RDS PostgreSQL 16 in a private subnet, encryption at rest, TLS required, automated backups with point-in-time restore. Create an app user with rights only on its own database. `DATABASE_URL` ends with `?sslmode=require`.
3. **Prescription storage:** S3 bucket in `ap-south-1` with Block Public Access on, ACLs disabled, default encryption, versioning, and a deny-non-TLS policy. Give the app role only Get/Put/Delete on `prescriptions/*`. Set `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION=ap-south-1`.
4. **Secrets:** store every value from `.env.example` in AWS Secrets Manager (or SSM Parameter Store) and inject them as environment variables. Generate fresh `OTP_SECRET`, `MFA_ENCRYPTION_KEY` and `RAZORPAY_WEBHOOK_SECRET` for production. Set `SMS_PROVIDER=msg91`, the `SMS_TEMPLATE_*` IDs, live Razorpay keys, all `STORE_*` details and `TRUSTED_PROXY_COUNT=1`.
5. **Build the app image:** Node 22, `npm ci` (generates the Prisma client), `npm run build`, start with `npm start` on port 3000. Run on ECS Fargate (2 tasks across availability zones) with an IAM task role for S3.
6. **Migrations:** before each release, run `npx prisma migrate deploy` once as a one-off task. Never run `prisma migrate dev` or `db:seed` against production.
7. **HTTPS:** an Application Load Balancer with an ACM certificate for your domain, HTTP redirected to HTTPS, health check on `/`. The app sends HSTS and CSP headers itself.
8. **Razorpay webhook:** in the dashboard add `https://<your-domain>/api/webhooks/razorpay` with the production webhook secret and the events `payment.*`, `order.paid` and `refund.*`.
9. **Staff:** from a one-off task with database access, run `npm run staff:grant -- <mobile> ADMIN` (or `PHARMACIST`) for real staff numbers, just before each person's first login, in person.
10. **Catalogue and stock:** create real categories and products, then upload the first stock CSV from **Admin → Stock sync**. Review every imported draft before putting it on sale.

**Go-live checklist**

- [ ] A real customer login receives the SMS code
- [ ] Staff login completes with the authenticator app; `/admin` returns 404 to a customer
- [ ] A prescription upload works and opens only for its owner and staff
- [ ] A live Razorpay payment of a small amount succeeds, then the cancel-and-refund path completes
- [ ] The tax invoice shows the real GSTIN, drug licence and address
- [ ] Legal pages have no \[brackets\] and no draft banner
- [ ] Database backups and a test restore are confirmed
- [ ] Error logs and uptime alerts reach someone on call

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `failed to connect to the docker API` | Docker Desktop isn't running | Start Docker Desktop, then `npm run db:up` |
| Staff login fails right after the SMS code | `MFA_ENCRYPTION_KEY` missing from `.env` | Generate one (step 3), restart `npm run dev` |
| "Another next dev server is already running" | A second dev server on the same folder | Stop the other one, or use the URL it prints |
| Error mentioning a missing table or `db.<model>` undefined | New migration not applied, or server started before it | `npx prisma migrate deploy`, then restart `npm run dev` |
| "Too many codes requested" | 3 codes per number per 15 minutes | Wait, or use another test number |
| No "Pay online" option at checkout | Razorpay keys not set | Add test keys (step 9) and restart |
| Hydration warning mentioning `data-gr-ext-installed` | Grammarly browser extension | Harmless; disable the extension for localhost |
| Admin pages show 404 | Not logged in as staff, or second step not finished | Log in with a granted number and complete the authenticator step |

**Useful commands**

| Command | Does |
| --- | --- |
| `npm run db:studio` | Browse and edit the local database in Prisma Studio |
| `npm run db:down` | Stop the Postgres container (data is kept in a Docker volume) |
| `npx prisma migrate reset` | Wipe the **local** database, re-run migrations and the seed |
| `npm run staff:grant -- <mobile> CUSTOMER` | Remove a staff role (also signs them out) |
| `npm run staff:reset-mfa -- <mobile>` | Clear a staff member's authenticator so they set it up again |
