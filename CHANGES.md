# DayStart — customer-only accounts, booking & contact

## 1) Database (Supabase -> SQL Editor -> paste -> Run)

- New project: run all of `supabase/FULL_SETUP.sql` once.
- Existing project: run `supabase/setup.sql` (safe to re-run). It adds `contact_messages`.
- Supabase Dashboard -> Authentication -> Providers -> Email: password sign-in must be ON
  (it is by default). Accounts are created pre-confirmed, so no confirmation email is needed.

## 2) Run

npm install && npm run dev (restart after editing .env)

## What changed

- Customers only. Worker registration, worker login, worker portal, KYC/Aadhaar and OTP login were removed.
  Old links (/register-worker, /worker-login, /for-workers) redirect to customer sign-up / login / about.
- Register (/register): full name, email, phone (10-digit Indian mobile), password, confirm password.
  Password: 8+ characters with a letter and a number. Duplicate email / phone is rejected with a clear message.
  Created by `registerCustomer` (src/lib/customer-auth.functions.ts); name + phone stored in `profiles`
  and in the auth user metadata.
- Login (/login): email + password. "Keep me logged in" option kept.
- Booking (/book): requires login (redirects to /login, then back). Contact number is pre-filled
  from the account. Prices are still recomputed on the server.
- Profile: shows the customer's name, email and phone.
- Contact (/contact): name, phone, email, topic, service, message. Saved to `contact_messages` AND emailed to
  CONTACT_TO (reply-to = visitor, confirmation copy to the visitor). Works if either the table or SMTP is set up.
  Pre-filled for logged-in customers. Honeypot + 3/hour throttle.

## Env (.env — never commit)

SUPABASE__, VITE_SUPABASE__, MAIL_SERVER/PORT/USE_TLS/USERNAME/PASSWORD (Gmail app password), CONTACT_TO.
