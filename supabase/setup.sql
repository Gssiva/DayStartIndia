-- DayStart: run this ONCE in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once. Creates the profiles + contact_messages tables used by customer accounts and the contact page.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='Users can view their own profile') then
    create policy "Users can view their own profile" on public.profiles for select to authenticated using (auth.uid() = id); end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='Users can insert their own profile') then
    create policy "Users can insert their own profile" on public.profiles for insert to authenticated with check (auth.uid() = id); end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='Users can update their own profile') then
    create policy "Users can update their own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id); end if;
end $$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- OTP codes (stored hashed). Used for BOTH mobile-number and email OTP.
create table if not exists public.phone_otp_requests (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists phone_otp_requests_phone_idx on public.phone_otp_requests (phone, created_at desc);
grant all on public.phone_otp_requests to service_role;
alter table public.phone_otp_requests enable row level security;

-- Private storage buckets used by worker registration (Aadhaar upload / KYC)
insert into storage.buckets (id, name, public)
values ('aadhaar-documents', 'aadhaar-documents', false), ('worker-kyc', 'worker-kyc', false)
on conflict (id) do nothing;

-- ====================================================================
-- Include Shared Backend Schema (User Roles, Bookings, Evidence, Payments, Payouts, Admin Logs)
-- ====================================================================

-- 2. USER ROLES & ACCESS CONTROL
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer', 'worker', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_idx ON public.user_roles (role);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(check_user_id uuid, check_role text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = check_user_id AND role = check_role); $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'); $$;

CREATE OR REPLACE FUNCTION public.is_worker()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'worker'); $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Users can view their own roles') THEN
    CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Only admins can modify roles') THEN
    CREATE POLICY "Only admins can modify roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- 3. CUSTOMER PROFILES
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_type text NOT NULL DEFAULT 'individual' CHECK (customer_type IN ('individual', 'business')),
  company_name text,
  gstin text,
  billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_profiles' AND policyname = 'Customers can view own customer profile') THEN
    CREATE POLICY "Customers can view own customer profile" ON public.customer_profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_profiles' AND policyname = 'Customers can update own customer profile') THEN
    CREATE POLICY "Customers can update own customer profile" ON public.customer_profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.is_admin()) WITH CHECK (auth.uid() = id OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_profiles' AND policyname = 'Customers can insert own customer profile') THEN
    CREATE POLICY "Customers can insert own customer profile" ON public.customer_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id OR public.is_admin());
  END IF;
END $$;
DROP TRIGGER IF EXISTS customer_profiles_set_updated_at ON public.customer_profiles;
CREATE TRIGGER customer_profiles_set_updated_at BEFORE UPDATE ON public.customer_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT, UPDATE ON public.customer_profiles TO authenticated;
GRANT ALL ON public.customer_profiles TO service_role;

-- 4. SERVICE COVERAGE LOCATIONS (Admin-configured)
CREATE TABLE IF NOT EXISTS public.service_coverage_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  area text NOT NULL,
  lat numeric(10,7) NOT NULL,
  lng numeric(10,7) NOT NULL,
  radius_km numeric(5,2) NOT NULL DEFAULT 10.00,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_coverage_locations_city_area_unique UNIQUE (city, area)
);
CREATE INDEX IF NOT EXISTS service_coverage_locations_city_area_idx ON public.service_coverage_locations (city, area, is_active);
ALTER TABLE public.service_coverage_locations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_coverage_locations' AND policyname = 'Anyone can view active coverage locations') THEN
    CREATE POLICY "Anyone can view active coverage locations" ON public.service_coverage_locations FOR SELECT TO anon, authenticated USING (is_active = true OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_coverage_locations' AND policyname = 'Admins can manage coverage locations') THEN
    CREATE POLICY "Admins can manage coverage locations" ON public.service_coverage_locations FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;
DROP TRIGGER IF EXISTS service_coverage_locations_set_updated_at ON public.service_coverage_locations;
CREATE TRIGGER service_coverage_locations_set_updated_at BEFORE UPDATE ON public.service_coverage_locations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.service_coverage_locations TO anon, authenticated;
GRANT ALL ON public.service_coverage_locations TO service_role;

-- 5. SERVICES EXTENSIONS
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS evidence_requirements jsonb NOT NULL DEFAULT '{"before_photos":true,"during_photos":false,"after_photos":true,"supervisor_evidence":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'fixed';

-- 6. WORKER PROFILES EXTENSIONS
ALTER TABLE public.worker_profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_date timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS payout_preference text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS payout_preference_requested text,
  ADD COLUMN IF NOT EXISTS e_shram_number text,
  ADD COLUMN IF NOT EXISTS rating numeric(3,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_jobs_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_lat numeric(10,7),
  ADD COLUMN IF NOT EXISTS current_lng numeric(10,7),
  ADD COLUMN IF NOT EXISTS last_location_at timestamptz,
  ADD COLUMN IF NOT EXISTS service_areas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- 7. BOOKINGS
CREATE TABLE IF NOT EXISTS public.bookings (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id),
  sub_service_id uuid REFERENCES public.sub_services(id),
  service_slug text NOT NULL,
  sub_service_slug text NOT NULL,
  booking_type text NOT NULL DEFAULT 'instant' CHECK (booking_type IN ('instant', 'quote', 'bulk')),
  language text NOT NULL DEFAULT 'en',
  city text NOT NULL,
  area text NOT NULL,
  workers integer NOT NULL DEFAULT 1,
  timing text NOT NULL DEFAULT 'immediate' CHECK (timing IN ('immediate', 'scheduled')),
  booking_date text,
  slot text,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  site_lat numeric(10,7),
  site_lng numeric(10,7),
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','searching','assigned','on_the_way','arrived','started','awaiting_confirmation','completed','cancelled','disputed','awaiting_review')),
  payment jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_price integer NOT NULL DEFAULT 0,
  advance_amount integer NOT NULL DEFAULT 0,
  balance_amount integer NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'advance_paid', 'fully_paid', 'refunded', 'failed')),
  evidence_submitted boolean NOT NULL DEFAULT false,
  customer_confirmed_at timestamptz,
  disputed boolean NOT NULL DEFAULT false,
  dispute_reason text,
  worker jsonb NOT NULL DEFAULT '{}'::jsonb,
  rating integer,
  rating_feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_user_created_idx ON public.bookings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_status_created_idx ON public.bookings (status, created_at DESC);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Customers can view own bookings') THEN
    CREATE POLICY "Customers can view own bookings" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Admins can manage all bookings') THEN
    CREATE POLICY "Admins can manage all bookings" ON public.bookings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;
DROP TRIGGER IF EXISTS bookings_set_updated_at ON public.bookings;
CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

-- 8. BOOKING ITEMS
CREATE TABLE IF NOT EXISTS public.booking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  title text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price integer NOT NULL,
  total_price integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_items_booking_id_idx ON public.booking_items (booking_id);
ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_items' AND policyname = 'Customers can view own booking items') THEN
    CREATE POLICY "Customers can view own booking items" ON public.booking_items FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND (b.user_id = auth.uid() OR public.is_admin()))
    );
  END IF;
END $$;
GRANT SELECT ON public.booking_items TO authenticated;
GRANT ALL ON public.booking_items TO service_role;

-- 9. BOOKING EVENTS
CREATE TABLE IF NOT EXISTS public.booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  status_from text,
  status_to text NOT NULL,
  event_type text NOT NULL,
  actor_id uuid REFERENCES auth.users(id),
  actor_role text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_events_booking_id_idx ON public.booking_events (booking_id, created_at ASC);
ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_events' AND policyname = 'Customers and workers can view booking events') THEN
    CREATE POLICY "Customers and workers can view booking events" ON public.booking_events FOR SELECT TO authenticated USING (
      public.is_admin() OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
    );
  END IF;
END $$;
GRANT SELECT ON public.booking_events TO authenticated;
GRANT ALL ON public.booking_events TO service_role;

-- 10. WORKER ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.worker_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  assignment_reason text,
  distance_km numeric(5,2),
  score numeric(6,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_assignments_booking_worker_unique UNIQUE (booking_id, worker_id)
);
CREATE INDEX IF NOT EXISTS worker_assignments_worker_idx ON public.worker_assignments (worker_id, status);
CREATE INDEX IF NOT EXISTS worker_assignments_booking_idx ON public.worker_assignments (booking_id);
ALTER TABLE public.worker_assignments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_assignments' AND policyname = 'Workers can view their assigned jobs') THEN
    CREATE POLICY "Workers can view their assigned jobs" ON public.worker_assignments FOR SELECT TO authenticated USING (auth.uid() = worker_id OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_assignments' AND policyname = 'Customers can view assignments on their bookings') THEN
    CREATE POLICY "Customers can view assignments on their bookings" ON public.worker_assignments FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
    );
  END IF;
END $$;
DROP TRIGGER IF EXISTS worker_assignments_set_updated_at ON public.worker_assignments;
CREATE TRIGGER worker_assignments_set_updated_at BEFORE UPDATE ON public.worker_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.worker_assignments TO authenticated;
GRANT ALL ON public.worker_assignments TO service_role;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Assigned workers can view bookings') THEN
    CREATE POLICY "Assigned workers can view bookings" ON public.bookings FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.worker_assignments a WHERE a.booking_id = id AND a.worker_id = auth.uid())
    );
  END IF;
END $$;

-- 11. WORK EVIDENCE
INSERT INTO storage.buckets (id, name, public) VALUES ('work-evidence', 'work-evidence', false) ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.booking_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.worker_assignments(id) ON DELETE SET NULL,
  worker_id uuid NOT NULL REFERENCES auth.users(id),
  evidence_type text NOT NULL CHECK (evidence_type IN ('before', 'during', 'after', 'supervisor')),
  file_path text NOT NULL,
  bucket_id text NOT NULL DEFAULT 'work-evidence',
  notes text,
  verified_by_admin boolean NOT NULL DEFAULT false,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_evidence_booking_id_idx ON public.booking_evidence (booking_id);
ALTER TABLE public.booking_evidence ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_evidence' AND policyname = 'Parties can view booking evidence') THEN
    CREATE POLICY "Parties can view booking evidence" ON public.booking_evidence FOR SELECT TO authenticated USING (
      auth.uid() = worker_id OR public.is_admin() OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_evidence' AND policyname = 'Workers can upload evidence for assigned bookings') THEN
    CREATE POLICY "Workers can upload evidence for assigned bookings" ON public.booking_evidence FOR INSERT TO authenticated WITH CHECK (
      auth.uid() = worker_id AND EXISTS (SELECT 1 FROM public.worker_assignments a WHERE a.booking_id = booking_id AND a.worker_id = auth.uid())
    );
  END IF;
END $$;
GRANT SELECT, INSERT ON public.booking_evidence TO authenticated;
GRANT ALL ON public.booking_evidence TO service_role;

-- 12. PAYMENTS
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id),
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  payment_type text NOT NULL CHECK (payment_type IN ('advance_30', 'full_100', 'balance_70', 'refund')),
  gateway_name text NOT NULL DEFAULT 'mock_gateway',
  gateway_order_id text,
  gateway_payment_id text,
  gateway_signature text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'refunded', 'partially_refunded')),
  idempotency_key text UNIQUE NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_transactions_booking_idx ON public.payment_transactions (booking_id);
CREATE INDEX IF NOT EXISTS payment_transactions_idempotency_idx ON public.payment_transactions (idempotency_key);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_transactions' AND policyname = 'Customers can view own payments') THEN
    CREATE POLICY "Customers can view own payments" ON public.payment_transactions FOR SELECT TO authenticated USING (auth.uid() = customer_id OR public.is_admin());
  END IF;
END $$;
DROP TRIGGER IF EXISTS payment_transactions_set_updated_at ON public.payment_transactions;
CREATE TRIGGER payment_transactions_set_updated_at BEFORE UPDATE ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;

-- 13. WORKER EARNINGS & PAYOUTS
CREATE TABLE IF NOT EXISTS public.worker_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.worker_assignments(id) ON DELETE SET NULL,
  gross_amount integer NOT NULL,
  platform_fee integer NOT NULL DEFAULT 0,
  net_earnings integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'held', 'paid')),
  hold_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS worker_earnings_worker_status_idx ON public.worker_earnings (worker_id, status);
ALTER TABLE public.worker_earnings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_earnings' AND policyname = 'Workers can view their own earnings') THEN
    CREATE POLICY "Workers can view their own earnings" ON public.worker_earnings FOR SELECT TO authenticated USING (auth.uid() = worker_id OR public.is_admin());
  END IF;
END $$;
DROP TRIGGER IF EXISTS worker_earnings_set_updated_at ON public.worker_earnings;
CREATE TRIGGER worker_earnings_set_updated_at BEFORE UPDATE ON public.worker_earnings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.worker_earnings TO authenticated;
GRANT ALL ON public.worker_earnings TO service_role;

CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'processing', 'completed', 'failed')),
  payout_method text NOT NULL DEFAULT 'bank_transfer',
  account_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  reference_id text,
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payout_requests_worker_idx ON public.payout_requests (worker_id, status);
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payout_requests' AND policyname = 'Workers can view their own payout requests') THEN
    CREATE POLICY "Workers can view their own payout requests" ON public.payout_requests FOR SELECT TO authenticated USING (auth.uid() = worker_id OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payout_requests' AND policyname = 'Workers can create payout requests') THEN
    CREATE POLICY "Workers can create payout requests" ON public.payout_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = worker_id);
  END IF;
END $$;
DROP TRIGGER IF EXISTS payout_requests_set_updated_at ON public.payout_requests;
CREATE TRIGGER payout_requests_set_updated_at BEFORE UPDATE ON public.payout_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;

-- 14. PROJECT QUOTES
CREATE TABLE IF NOT EXISTS public.project_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id),
  title text NOT NULL,
  description text NOT NULL,
  city text NOT NULL,
  area text NOT NULL,
  site_address text,
  workers_needed integer NOT NULL DEFAULT 1,
  duration_days integer NOT NULL DEFAULT 1,
  estimated_budget integer,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'quoted', 'accepted', 'rejected', 'cancelled')),
  quote_amount integer,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_quotes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_quotes' AND policyname = 'Customers can view own quotes') THEN
    CREATE POLICY "Customers can view own quotes" ON public.project_quotes FOR SELECT TO authenticated USING (auth.uid() = customer_id OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_quotes' AND policyname = 'Customers can insert own quotes') THEN
    CREATE POLICY "Customers can insert own quotes" ON public.project_quotes FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_quotes' AND policyname = 'Admins can manage quotes') THEN
    CREATE POLICY "Admins can manage quotes" ON public.project_quotes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;
DROP TRIGGER IF EXISTS project_quotes_set_updated_at ON public.project_quotes;
CREATE TRIGGER project_quotes_set_updated_at BEFORE UPDATE ON public.project_quotes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT ON public.project_quotes TO authenticated;
GRANT ALL ON public.project_quotes TO service_role;

-- 15. REVIEWS & DISPUTES & NOTIFICATIONS & AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Anyone can view reviews') THEN
    CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT ALL ON public.reviews TO service_role;

CREATE TABLE IF NOT EXISTS public.booking_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id),
  worker_id uuid REFERENCES auth.users(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'opened' CHECK (status IN ('opened', 'under_review', 'resolved_refund', 'resolved_payout', 'dismissed')),
  resolution_notes text,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.booking_disputes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_disputes' AND policyname = 'Parties can view disputes') THEN
    CREATE POLICY "Parties can view disputes" ON public.booking_disputes FOR SELECT TO authenticated USING (
      auth.uid() = customer_id OR auth.uid() = worker_id OR public.is_admin()
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_disputes' AND policyname = 'Admins can manage disputes') THEN
    CREATE POLICY "Admins can manage disputes" ON public.booking_disputes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;
DROP TRIGGER IF EXISTS booking_disputes_set_updated_at ON public.booking_disputes;
CREATE TRIGGER booking_disputes_set_updated_at BEFORE UPDATE ON public.booking_disputes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT ON public.booking_disputes TO authenticated;
GRANT ALL ON public.booking_disputes TO service_role;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view own notifications') THEN
    CREATE POLICY "Users can view own notifications" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_audit_logs' AND policyname = 'Admins can view audit logs') THEN
    CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs FOR SELECT TO authenticated USING (public.is_admin());
  END IF;
END $$;
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

-- 19. PRICING CONFIGURATION (Admin-configurable fees and rates)
CREATE TABLE IF NOT EXISTS public.pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_fee integer NOT NULL DEFAULT 0,
  gst_rate numeric(5,4) NOT NULL DEFAULT 0,
  advance_percentage integer NOT NULL DEFAULT 0,
  platform_commission_rate numeric(5,4) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pricing_config_check CHECK (
    platform_fee >= 0 AND
    gst_rate >= 0 AND gst_rate <= 1 AND
    advance_percentage >= 0 AND advance_percentage <= 100 AND
    platform_commission_rate >= 0 AND platform_commission_rate <= 1
  )
);

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pricing_config' AND policyname = 'Anyone can view active pricing config') THEN
    CREATE POLICY "Anyone can view active pricing config" ON public.pricing_config
      FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pricing_config' AND policyname = 'Admins can manage pricing config') THEN
    CREATE POLICY "Admins can manage pricing config" ON public.pricing_config
      FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

DROP TRIGGER IF EXISTS pricing_config_set_updated_at ON public.pricing_config;
CREATE TRIGGER pricing_config_set_updated_at
  BEFORE UPDATE ON public.pricing_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.pricing_config TO anon, authenticated;
GRANT ALL ON public.pricing_config TO service_role;

NOTIFY pgrst, 'reload schema';
