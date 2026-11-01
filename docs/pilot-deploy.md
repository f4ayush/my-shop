# Deploying the WhatsApp pilot (Netlify + Supabase, free plans)

| Part | Where |
| --- | --- |
| Site | Netlify free plan. Builds the `pilot` branch on every push; servers in US East (Ohio). |
| Database | Supabase free plan, East US (Ohio), next to the site. During the pilot it holds only the catalogue, staff accounts and anonymous carts. Move everything to India before turning on full online ordering (see [production.md](production.md)). |
| Settings and secrets | `.env.pilot` on your computer (gitignored), copied into Netlify. Never commit it. |
| Admin | On your computer with `npm run pilot:admin`, until MSG91 SMS is set up. The live site can't send sign-in codes yet. |

## 1. Database (Supabase)

1. Sign up at supabase.com and create a project. Region: **East US (Ohio)**. Use a generated password of letters and numbers only (other characters need URL-encoding), and save it in a password manager.
2. In the project, open **Connect**. Copy the **Transaction pooler** string (port 6543) into `DATABASE_URL` in `.env.pilot`, and the **Session pooler** string (port 5432) into `DIRECT_DATABASE_URL`. Replace `[YOUR-PASSWORD]` in both.
3. Set up the tables, categories and your admin account:
   ```bash
   npm run pilot:migrate
   npm run pilot:categories
   npm run pilot:staff -- <your mobile> ADMIN
   ```

## 2. Site (Netlify)

1. Sign up at netlify.com with your GitHub account, then **Add new project → Import an existing project → GitHub → f4ayush/my-shop**.
2. Branch to deploy: **pilot**. The build settings come from `netlify.toml`; leave them as they are.
3. Before the first deploy, open **Environment variables → Import from a .env file** and paste the contents of `.env.pilot`, **without** `DIRECT_DATABASE_URL` and without empty lines.
4. Deploy, then open the `*.netlify.app` address to check the shop loads.

## 3. Domain (rajhealthcares.com)

In Netlify, **Domain management → Add a domain** → `rajhealthcares.com`. Then either point the domain's nameservers to Netlify DNS, or add the records Netlify shows at your registrar. Netlify issues the HTTPS certificate once the DNS change has spread (minutes to a few hours).

## 4. Products and stock

1. Stop `npm run dev` if it is running (only one dev server can run in this folder).
2. Run `npm run pilot:admin` and open http://localhost:3001/login. Enter your mobile; the code appears in that terminal. Set up the authenticator app and keep the recovery codes.
3. In **/admin → Stock sync**, upload the CSV from your billing software. Then in **Products**, open each imported draft, set its category and schedule, and tick **On sale**.

Changes show on the live site straight away, since both use the same database.

## 5. Check the live site

- Add a few items, open the cart, tap **Order on WhatsApp**: a chat with the shop opens with the list typed in.
- `/checkout` goes back to the cart and `/account` to the home page.

## Later

- **Redeploy:** push to `pilot`. After changing a setting in Netlify, use **Deploys → Trigger deploy**.
- **Supabase pauses** a free project after 7 days of low activity; resume it from the dashboard. Free projects have no backups, so keep your stock CSVs.
- **Netlify's free plan** has monthly usage limits; upgrade if the pilot outgrows them.
- **Full online ordering** needs MSG91, Razorpay, private file storage and hosting in India first: see [production.md](production.md), then remove `WHATSAPP_ORDER_NUMBER`.
