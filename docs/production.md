# Running in production

Checklist for going live. Every value below goes in the host's secrets manager or environment,
never in the repository. `.env.example` lists them all with comments.

## Required environment

| Variable | What to set |
| --- | --- |
| `DATABASE_URL` | Production Postgres (TLS, least-privilege app user) |
| `OTP_SECRET` | 32+ random bytes (also keys the hashed IPs in rate-limit buckets) |
| `MFA_ENCRYPTION_KEY` | 32 random bytes, base64url. Encrypts staff TOTP secrets and keys recovery-code hashes. Losing or changing it disables every staff second factor |
| `TRUSTED_PROXY_COUNT` | Proxies/CDNs that append to `X-Forwarded-For` (usually `1`). If wrong, per-IP limits can be dodged or lump everyone together |
| `SMS_PROVIDER` | `msg91` |
| `MSG91_AUTH_KEY` | MSG91 auth key, ideally restricted to your server IPs in MSG91 |
| `SMS_TEMPLATE_*` | One MSG91 template ID per DLT template (OTP + 8 order templates) |
| `STORAGE_DRIVER` | `s3` |
| `S3_BUCKET`, `S3_REGION` | e.g. `ap-south-1` for AWS Mumbai, `auto` for R2 |
| `S3_ENDPOINT` | R2 only |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Omit on AWS and use an IAM role; otherwise a key limited to this bucket |
| `S3_SSE` (+ `S3_KMS_KEY_ID`) | `AES256` (default) or `aws:kms` on AWS; `provider-default` on R2 |

Plus the Razorpay and `STORE_*` values already in `.env.example`.

## Staff sign-in

- Pharmacists and admins log in with the SMS code, then an authenticator app (TOTP). The first
  login after being granted a role sets the app up and shows 10 one-time recovery codes.
- Until the second factor is passed the session grants nothing (staff pages answer 404). It expires
  after 10 minutes or 5 wrong codes.
- Staff sessions last 8 hours; customer sessions 30 days.
- Any role change ends that user's sessions. `npm run staff:grant` also signs them out directly.
- Lost phone: confirm who is asking out of band, then `npm run staff:reset-mfa -- <mobile>`.
- The migration `staff_mfa_rate_limits` signs out all existing staff sessions.
- Known gap: setup is trust-on-first-use. Anyone holding the staff member's SIM during their *first*
  login could set up the app. Grant roles shortly before the person first logs in, in person.

## Private storage (prescriptions)

Files are only ever served through `/api/prescriptions/[id]/file`, which checks ownership or staff
role and audit-logs staff views. The app never creates public or presigned URLs.

AWS S3 (Mumbai):
1. Create the bucket in `ap-south-1` with **Block Public Access** fully on and **Object Ownership:
   Bucket owner enforced** (ACLs disabled).
2. Default encryption SSE-S3 or SSE-KMS (the app also sends the header on every upload).
3. Enable versioning and a lifecycle rule in line with your prescription retention policy.
4. Bucket policy denying non-TLS access:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "DenyInsecureTransport", "Effect": "Deny", "Principal": "*", "Action": "s3:*",
       "Resource": ["arn:aws:s3:::BUCKET", "arn:aws:s3:::BUCKET/*"],
       "Condition": { "Bool": { "aws:SecureTransport": "false" } }
     }]
   }
   ```
5. Give the app's IAM role only `s3:GetObject`, `s3:PutObject` and `s3:DeleteObject` on
   `arn:aws:s3:::BUCKET/prescriptions/*` (plus `kms:Encrypt`/`kms:Decrypt`/`kms:GenerateDataKey` on the
   key if you use SSE-KMS).

Cloudflare R2: keep the bucket's public access (r2.dev and custom domains) **off**, use an API token
with Object Read & Write scoped to this bucket only, choose an Asia-Pacific location hint, and set
`S3_SSE=provider-default` (R2 encrypts all objects at rest).

## SMS (MSG91 + DLT)

1. Register the sender ID and each template on the DLT portal. Template wording is in
   `src/lib/sms/templates.ts` (OTP) and `src/lib/notify.ts` (orders), with the variable as `{#var#}`.
2. Add each in MSG91 with its DLT Template ID; use `##otp##` for the code and `##order##` for the order
   number. Put MSG91's template IDs in `SMS_TEMPLATE_*`.
3. Production logs never contain message text, OTPs or full phone numbers.

## Security headers and rate limits

- `next.config.ts` sends a CSP (allowing Razorpay Checkout), HSTS (2 years, subdomains; add
  `preload` only once every subdomain is HTTPS), `frame-ancestors 'none'` and related headers. The
  prescription file route sets its own headers so the Rx queue can frame it.
- Per-IP limits (15-minute windows): 10 OTP sends, 30 OTP checks, 20 second-factor checks. These are
  on top of the per-number limits (3 codes per 15 minutes, 5 guesses per code).
