-- ====================================================================
-- DayStart India — COMPLETE DATABASE MIGRATION
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run
-- Project: mewwklzfqijwiimndjrk
-- ====================================================================

-- 1. EXTENSIONS & CORE UTILITIES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public)
VALUES ('aadhaar-documents', 'aadhaar-documents', false), 
       ('worker-kyc', 'worker-kyc', false),
       ('work-evidence', 'work-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- 3. PROFILES & OTP
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view their own profile') THEN
    CREATE POLICY "Users can view their own profile" ON public.profiles
      FOR SELECT TO authenticated USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert their own profile') THEN
    CREATE POLICY "Users can insert their own profile" ON public.profiles
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile" ON public.profiles
      FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.phone_otp_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_otp_requests_phone_idx ON public.phone_otp_requests (phone, created_at DESC);
GRANT ALL ON public.phone_otp_requests TO service_role;
ALTER TABLE public.phone_otp_requests ENABLE ROW LEVEL SECURITY;

-- 4. USER ROLES
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
    CREATE POLICY "Users can view their own roles" ON public.user_roles
      FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Only admins can modify roles') THEN
    CREATE POLICY "Only admins can modify roles" ON public.user_roles
      FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- 5. CUSTOMER PROFILES
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
    CREATE POLICY "Customers can view own customer profile" ON public.customer_profiles
      FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_profiles' AND policyname = 'Customers can update own customer profile') THEN
    CREATE POLICY "Customers can update own customer profile" ON public.customer_profiles
      FOR UPDATE TO authenticated USING (auth.uid() = id OR public.is_admin()) WITH CHECK (auth.uid() = id OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_profiles' AND policyname = 'Customers can insert own customer profile') THEN
    CREATE POLICY "Customers can insert own customer profile" ON public.customer_profiles
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = id OR public.is_admin());
  END IF;
END $$;

DROP TRIGGER IF EXISTS customer_profiles_set_updated_at ON public.customer_profiles;
CREATE TRIGGER customer_profiles_set_updated_at BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.customer_profiles TO authenticated;
GRANT ALL ON public.customer_profiles TO service_role;

-- 6. SERVICE COVERAGE LOCATIONS
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
    CREATE POLICY "Anyone can view active coverage locations" ON public.service_coverage_locations
      FOR SELECT TO anon, authenticated USING (is_active = true OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_coverage_locations' AND policyname = 'Admins can manage coverage locations') THEN
    CREATE POLICY "Admins can manage coverage locations" ON public.service_coverage_locations
      FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

DROP TRIGGER IF EXISTS service_coverage_locations_set_updated_at ON public.service_coverage_locations;
CREATE TRIGGER service_coverage_locations_set_updated_at BEFORE UPDATE ON public.service_coverage_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.service_coverage_locations TO anon, authenticated;
GRANT ALL ON public.service_coverage_locations TO service_role;

-- 7. SERVICES & SUB-SERVICES
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'Sparkles',
  image text,
  starting_price integer,
  eta text,
  multi_worker boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 0,
  evidence_requirements jsonb NOT NULL DEFAULT '{"before_photos":true,"during_photos":false,"after_photos":true,"supervisor_evidence":false}'::jsonb,
  pricing_model text NOT NULL DEFAULT 'fixed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sub_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'Sparkles',
  image text,
  price integer NOT NULL,
  unit text NOT NULL DEFAULT 'per session',
  duration text,
  status text NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, slug)
);

GRANT SELECT ON public.services TO anon, authenticated;
GRANT SELECT ON public.sub_services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
GRANT ALL ON public.sub_services TO service_role;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_services ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'services' AND policyname = 'Anyone can view active services') THEN
    CREATE POLICY "Anyone can view active services" ON public.services
      FOR SELECT TO anon, authenticated USING (status = 'active');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sub_services' AND policyname = 'Anyone can view active sub-services') THEN
    CREATE POLICY "Anyone can view active sub-services" ON public.sub_services
      FOR SELECT TO anon, authenticated
      USING (status = 'active' AND EXISTS (SELECT 1 FROM public.services s WHERE s.id = service_id AND s.status = 'active'));
  END IF;
END $$;

CREATE TRIGGER services_set_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sub_services_set_updated_at BEFORE UPDATE ON public.sub_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.services (name, slug, description, icon, starting_price, eta, multi_worker, sort_order) VALUES
('Agriculture','agriculture','Field hands for plowing, sowing, irrigation and harvest work. Book 1–20 workers for a full day.','Sprout',550,'45–60 min',true,1),
('Beauty','beauty','Trained beauticians at your doorstep with a fresh hygiene kit for every appointment.','Sparkles',149,'30–45 min',false,2),
('Construction','construction','Masons, painters and tile experts who bring their own tools to site.','HardHat',700,'60–90 min',true,3),
('Driver','driver','Licence-checked, background-verified drivers for city runs and outstation trips.','Car',499,'20–35 min',false,4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.sub_services (service_id, name, slug, description, icon, price, unit, duration, sort_order)
SELECT s.id, v.name, v.slug, v.description, v.icon, v.price, v.unit, v.duration, v.sort_order
FROM public.services s
JOIN (VALUES
('agriculture','Field Plowing','field-plowing','Tractor-assisted or manual plowing to prepare your land for sowing.','Tractor',699,'per worker / day','8 hours',1),
('agriculture','Seed Planting','seed-planting','Careful row sowing and seed placement for even germination.','Sprout',550,'per worker / day','8 hours',2),
('agriculture','Harvesting','harvesting','Crop cutting, bundling and loading during peak harvest season.','Wheat',600,'per worker / day','8 hours',3),
('agriculture','Irrigation Work','irrigation','Channel digging, pump handling and controlled watering of fields.','Droplets',575,'per worker / day','8 hours',4),
('agriculture','Weeding','weeding','Manual removal of weeds between rows without damaging the crop.','Scissors',650,'per worker / day','8 hours',5),
('agriculture','Fertilizer Spraying','fertilizer-spraying','Measured spraying of fertilizer or pesticide with safety gear.','SprayCan',700,'per worker / day','8 hours',6),
('agriculture','Land Leveling','land-leveling','Levelling uneven plots so water spreads evenly across the field.','Grid3X3',750,'per worker / day','8 hours',7),
('agriculture','Crop Cutting','crop-cutting','Skilled hands for clean crop cutting and field clearing.','Wheat',650,'per worker / day','8 hours',8),
('beauty','Facial','facial','Deep-cleanse facial with steam, scrub and a relaxing massage.','Sparkles',699,'per session','60 min',1),
('beauty','Hair Cut & Style','hair-cut','Cut, wash and blow-dry styling done at your home.','Scissors',299,'per session','45 min',2),
('beauty','Waxing','waxing','Full arms, legs or underarms waxing with disposable strips.','Sparkles',499,'per session','45 min',3),
('beauty','Threading','threading','Eyebrow, upper lip and forehead threading.','Sparkles',149,'per session','20 min',4),
('beauty','Bridal Makeup','bridal-makeup','Complete bridal look with HD makeup, draping and hair styling.','Crown',4999,'per session','3 hours',5),
('beauty','Hair Color','hair-color','Global colour or root touch-up with ammonia-free options.','Brush',899,'per session','90 min',6),
('beauty','Manicure & Pedicure','manicure-pedicure','Nail shaping, cuticle care and a soothing soak.','Sparkles',799,'per session','75 min',7),
('beauty','Mehendi','mehendi','Traditional or Arabic mehendi designs for any occasion.','Brush',599,'per session','60 min',8),
('construction','Masonry / Bricklaying','mason','Brickwork, block laying and structural repairs by trained masons.','Hammer',850,'per worker / day','8 hours',1),
('construction','Tile Work','tile-work','Floor and wall tiling with precise levelling and grouting.','Grid3X3',900,'per worker / day','8 hours',2),
('construction','Plastering','plastering','Smooth interior and exterior plastering ready for paint.','Layers',800,'per worker / day','8 hours',3),
('construction','Painting','painter','Interior or exterior painting including surface prep.','PaintRoller',750,'per worker / day','8 hours',4),
('construction','Demolition','demolition','Controlled demolition and debris clearing with safety gear.','Hammer',900,'per worker / day','8 hours',5),
('construction','Daily Labour','daily-labour','General-purpose site helpers for lifting, mixing and clearing.','HardHat',700,'per worker / day','8 hours',6),
('construction','Flooring','flooring','Cement, marble or vitrified flooring laid to level.','Grid3X3',880,'per worker / day','8 hours',7),
('construction','Roofing','roofing','Roof sheeting, waterproofing and leak repairs.','Home',950,'per worker / day','8 hours',8),
('driver','Daily Driver (8 hrs)','daily-driver','A verified driver for a full 8-hour city shift.','CalendarClock',899,'per day','8 hours',1),
('driver','Half Day (4 hrs)','half-day-driver','Short-shift driver for errands and school or office runs.','Clock',499,'per shift','4 hours',2),
('driver','Airport Drop','airport-drop','One-way airport pick-up or drop in your own car.','Plane',499,'per trip','2 hours',3),
('driver','Outstation Trip','outstation-trip','Experienced highway driver for intercity travel.','Car',1499,'per day','12 hours',4),
('driver','Wedding / Event','wedding-driver','Formally dressed driver for weddings and family functions.','Crown',1200,'per day','10 hours',5),
('driver','Night Driver','night-driver','Late-night shift driver for safe returns after hours.','Moon',799,'per shift','8 hours',6)
) AS v(service_slug,name,slug,description,icon,price,unit,duration,sort_order)
ON v.service_slug = s.slug
ON CONFLICT (service_id, slug) DO NOTHING;

-- 8. WORKER PROFILES
CREATE TABLE IF NOT EXISTS public.worker_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_path text,
  full_name text,
  phone text,
  alt_phone text,
  address_line text,
  district text,
  state text,
  pin_code text,
  skill_categories text[] NOT NULL DEFAULT '{}',
  experience_years integer NOT NULL DEFAULT 0,
  languages text[] NOT NULL DEFAULT '{}',
  availability_status text NOT NULL DEFAULT 'offline',
  availability_schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_lat numeric(10,7),
  current_lng numeric(10,7),
  bank_account_name text,
  bank_account_number text,
  bank_ifsc text,
  upi_id text,
  payout_preference text NOT NULL DEFAULT 'daily' CHECK (payout_preference IN ('daily', 'weekly', 'monthly')),
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approval_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_profiles_availability_status_check CHECK (availability_status IN ('online','offline','paused'))
);

GRANT SELECT, INSERT, UPDATE ON public.worker_profiles TO authenticated;
GRANT ALL ON public.worker_profiles TO service_role;
ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_profiles' AND policyname = 'Workers can view their own worker profile') THEN
    CREATE POLICY "Workers can view their own worker profile" ON public.worker_profiles
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_profiles' AND policyname = 'Workers can create their own worker profile') THEN
    CREATE POLICY "Workers can create their own worker profile" ON public.worker_profiles
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_profiles' AND policyname = 'Workers can update their own worker profile') THEN
    CREATE POLICY "Workers can update their own worker profile" ON public.worker_profiles
      FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_profiles' AND policyname = 'Admins can manage all worker profiles') THEN
    CREATE POLICY "Admins can manage all worker profiles" ON public.worker_profiles
      FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS worker_profiles_status_avail_idx ON public.worker_profiles (approval_status, availability_status);
CREATE INDEX IF NOT EXISTS worker_profiles_location_idx ON public.worker_profiles (current_lat, current_lng);

DROP TRIGGER IF EXISTS worker_profiles_set_updated_at ON public.worker_profiles;
CREATE TRIGGER worker_profiles_set_updated_at BEFORE UPDATE ON public.worker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. WORKER KYC DOCUMENTS
CREATE TABLE IF NOT EXISTS public.worker_kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_path text,
  status text NOT NULL DEFAULT 'pending',
  reviewer_note text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_kyc_documents_doc_type_check CHECK (doc_type IN ('aadhaar','pan','selfie','address_proof','bank')),
  CONSTRAINT worker_kyc_documents_status_check CHECK (status IN ('pending','verified','rejected')),
  CONSTRAINT worker_kyc_documents_user_doc_unique UNIQUE (user_id, doc_type)
);

GRANT SELECT, INSERT, UPDATE ON public.worker_kyc_documents TO authenticated;
GRANT ALL ON public.worker_kyc_documents TO service_role;
ALTER TABLE public.worker_kyc_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_kyc_documents' AND policyname = 'Workers can view their own KYC documents') THEN
    CREATE POLICY "Workers can view their own KYC documents" ON public.worker_kyc_documents
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_kyc_documents' AND policyname = 'Workers can add their own KYC documents') THEN
    CREATE POLICY "Workers can add their own KYC documents" ON public.worker_kyc_documents
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_kyc_documents' AND policyname = 'Workers can replace their own KYC documents') THEN
    CREATE POLICY "Workers can replace their own KYC documents" ON public.worker_kyc_documents
      FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND status = 'pending');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS worker_kyc_documents_user_idx ON public.worker_kyc_documents (user_id);

DROP TRIGGER IF EXISTS worker_kyc_documents_set_updated_at ON public.worker_kyc_documents;
CREATE TRIGGER worker_kyc_documents_set_updated_at BEFORE UPDATE ON public.worker_kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10. WORKER REGISTRATIONS
CREATE TABLE IF NOT EXISTS public.worker_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  aadhaar_last4 TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('agriculture','beauty','construction','driver')),
  pay_model TEXT NOT NULL CHECK (pay_model IN ('monthly','per_job')),
  city TEXT NOT NULL,
  area TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  phone_verified boolean NOT NULL DEFAULT false,
  email_verified boolean NOT NULL DEFAULT false,
  aadhaar_document_path text,
  aadhaar_verified boolean NOT NULL DEFAULT false,
  aadhaar_ocr_full text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS worker_registrations_user_id_idx ON public.worker_registrations(user_id);
ALTER TABLE public.worker_registrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_registrations' AND policyname = 'Workers can insert their own registration') THEN
    CREATE POLICY "Workers can insert their own registration" ON public.worker_registrations
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_registrations' AND policyname = 'Workers can view their own registration') THEN
    CREATE POLICY "Workers can view their own registration" ON public.worker_registrations
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_registrations' AND policyname = 'Workers can update their own registration') THEN
    CREATE POLICY "Workers can update their own registration" ON public.worker_registrations
      FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.worker_registrations TO authenticated;
GRANT ALL ON public.worker_registrations TO service_role;

DROP TRIGGER IF EXISTS worker_registrations_set_updated_at ON public.worker_registrations;
CREATE TRIGGER worker_registrations_set_updated_at BEFORE UPDATE ON public.worker_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 11. STORAGE POLICIES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Workers can upload own aadhaar docs') THEN
    CREATE POLICY "Workers can upload own aadhaar docs" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'aadhaar-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Workers can read own aadhaar docs') THEN
    CREATE POLICY "Workers can read own aadhaar docs" ON storage.objects
      FOR SELECT TO authenticated USING (bucket_id = 'aadhaar-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Workers can read their own kyc files') THEN
    CREATE POLICY "Workers can read their own kyc files" ON storage.objects
      FOR SELECT TO authenticated USING (bucket_id = 'worker-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Workers can upload their own kyc files') THEN
    CREATE POLICY "Workers can upload their own kyc files" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'worker-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Workers can update their own kyc files') THEN
    CREATE POLICY "Workers can update their own kyc files" ON storage.objects
      FOR UPDATE TO authenticated USING (bucket_id = 'worker-kyc' AND (storage.foldername(name))[1] = auth.uid()::text)
      WITH CHECK (bucket_id = 'worker-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Workers can delete their own kyc files') THEN
    CREATE POLICY "Workers can delete their own kyc files" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'worker-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Assigned workers can upload work evidence') THEN
    CREATE POLICY "Assigned workers can upload work evidence" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'work-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated parties can view work evidence') THEN
    CREATE POLICY "Authenticated parties can view work evidence" ON storage.objects
      FOR SELECT TO authenticated USING (bucket_id = 'work-evidence');
  END IF;
END $$;

-- 12. BOOKINGS
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
CREATE INDEX IF NOT EXISTS bookings_city_area_idx ON public.bookings (city, area);
CREATE INDEX IF NOT EXISTS bookings_service_slug_idx ON public.bookings (service_slug, sub_service_slug);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Customers can view own bookings') THEN
    CREATE POLICY "Customers can view own bookings" ON public.bookings
      FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Admins can manage all bookings') THEN
    CREATE POLICY "Admins can manage all bookings" ON public.bookings
      FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

DROP TRIGGER IF EXISTS bookings_set_updated_at ON public.bookings;
CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

-- 13. BOOKING ITEMS
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
    CREATE POLICY "Customers can view own booking items" ON public.booking_items
      FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND (b.user_id = auth.uid() OR public.is_admin())));
  END IF;
END $$;

GRANT SELECT ON public.booking_items TO authenticated;
GRANT ALL ON public.booking_items TO service_role;

-- 14. BOOKING EVENTS
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
    CREATE POLICY "Customers and workers can view booking events" ON public.booking_events
      FOR SELECT TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()));
  END IF;
END $$;

GRANT SELECT ON public.booking_events TO authenticated;
GRANT ALL ON public.booking_events TO service_role;

-- 15. WORKER ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.worker_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pending_acceptance', 'assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show', 'declined')),
  distance_km numeric(8,2),
  score numeric(6,2),
  assignment_reason text,
  acceptance_deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_assignments_booking_worker_unique UNIQUE (booking_id, worker_id)
);

CREATE INDEX IF NOT EXISTS worker_assignments_worker_idx ON public.worker_assignments (worker_id, status);
CREATE INDEX IF NOT EXISTS worker_assignments_booking_idx ON public.worker_assignments (booking_id);
ALTER TABLE public.worker_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_assignments' AND policyname = 'Workers can view their assigned jobs') THEN
    CREATE POLICY "Workers can view their assigned jobs" ON public.worker_assignments
      FOR SELECT TO authenticated USING (auth.uid() = worker_id OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_assignments' AND policyname = 'Customers can view assignments on their bookings') THEN
    CREATE POLICY "Customers can view assignments on their bookings" ON public.worker_assignments
      FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()));
  END IF;
END $$;

-- Add the missing policy for bookings that references worker_assignments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Assigned workers can view bookings') THEN
    CREATE POLICY "Assigned workers can view bookings" ON public.bookings
      FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.worker_assignments a WHERE a.booking_id = bookings.id::text AND a.worker_id = auth.uid()));
  END IF;
END $$;

DROP TRIGGER IF EXISTS worker_assignments_set_updated_at ON public.worker_assignments;
CREATE TRIGGER worker_assignments_set_updated_at BEFORE UPDATE ON public.worker_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.worker_assignments TO authenticated;
GRANT ALL ON public.worker_assignments TO service_role;

-- 16. BOOKING EVIDENCE
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
CREATE INDEX IF NOT EXISTS booking_evidence_worker_id_idx ON public.booking_evidence (worker_id);
ALTER TABLE public.booking_evidence ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_evidence' AND policyname = 'Parties can view booking evidence') THEN
    CREATE POLICY "Parties can view booking evidence" ON public.booking_evidence
      FOR SELECT TO authenticated USING (auth.uid() = worker_id OR public.is_admin() OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_evidence' AND policyname = 'Workers can upload evidence for assigned bookings') THEN
    CREATE POLICY "Workers can upload evidence for assigned bookings" ON public.booking_evidence
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = worker_id AND EXISTS (SELECT 1 FROM public.worker_assignments a WHERE a.booking_id = booking_id AND a.worker_id = auth.uid()));
  END IF;
END $$;

GRANT SELECT, INSERT ON public.booking_evidence TO authenticated;
GRANT ALL ON public.booking_evidence TO service_role;

-- 17. PAYMENT TRANSACTIONS
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
CREATE INDEX IF NOT EXISTS payment_transactions_customer_idx ON public.payment_transactions (customer_id);
CREATE INDEX IF NOT EXISTS payment_transactions_idempotency_idx ON public.payment_transactions (idempotency_key);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_transactions' AND policyname = 'Customers can view own payments') THEN
    CREATE POLICY "Customers can view own payments" ON public.payment_transactions
      FOR SELECT TO authenticated USING (auth.uid() = customer_id OR public.is_admin());
  END IF;
END $$;

DROP TRIGGER IF EXISTS payment_transactions_set_updated_at ON public.payment_transactions;
CREATE TRIGGER payment_transactions_set_updated_at BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;

-- 18. WORKER EARNINGS
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
CREATE INDEX IF NOT EXISTS worker_earnings_booking_idx ON public.worker_earnings (booking_id);
ALTER TABLE public.worker_earnings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_earnings' AND policyname = 'Workers can view their own earnings') THEN
    CREATE POLICY "Workers can view their own earnings" ON public.worker_earnings
      FOR SELECT TO authenticated USING (auth.uid() = worker_id OR public.is_admin());
  END IF;
END $$;

DROP TRIGGER IF EXISTS worker_earnings_set_updated_at ON public.worker_earnings;
CREATE TRIGGER worker_earnings_set_updated_at BEFORE UPDATE ON public.worker_earnings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.worker_earnings TO authenticated;
GRANT ALL ON public.worker_earnings TO service_role;

-- 19. PAYOUT REQUESTS
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
    CREATE POLICY "Workers can view their own payout requests" ON public.payout_requests
      FOR SELECT TO authenticated USING (auth.uid() = worker_id OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payout_requests' AND policyname = 'Workers can create payout requests') THEN
    CREATE POLICY "Workers can create payout requests" ON public.payout_requests
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = worker_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS payout_requests_set_updated_at ON public.payout_requests;
CREATE TRIGGER payout_requests_set_updated_at BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;

-- 20. PROJECT QUOTES
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

CREATE INDEX IF NOT EXISTS project_quotes_customer_idx ON public.project_quotes (customer_id, status);
ALTER TABLE public.project_quotes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_quotes' AND policyname = 'Customers can view own quotes') THEN
    CREATE POLICY "Customers can view own quotes" ON public.project_quotes
      FOR SELECT TO authenticated USING (auth.uid() = customer_id OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_quotes' AND policyname = 'Customers can insert own quotes') THEN
    CREATE POLICY "Customers can insert own quotes" ON public.project_quotes
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_quotes' AND policyname = 'Admins can manage quotes') THEN
    CREATE POLICY "Admins can manage quotes" ON public.project_quotes
      FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

DROP TRIGGER IF EXISTS project_quotes_set_updated_at ON public.project_quotes;
CREATE TRIGGER project_quotes_set_updated_at BEFORE UPDATE ON public.project_quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT ON public.project_quotes TO authenticated;
GRANT ALL ON public.project_quotes TO service_role;

-- 21. REVIEWS
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_worker_id_idx ON public.reviews (worker_id);
CREATE INDEX IF NOT EXISTS reviews_booking_id_idx ON public.reviews (booking_id);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Anyone can view reviews') THEN
    CREATE POLICY "Anyone can view reviews" ON public.reviews
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Customers can create review for own booking') THEN
    CREATE POLICY "Customers can create review for own booking" ON public.reviews
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid() AND b.status = 'completed'));
  END IF;
END $$;

GRANT SELECT, INSERT ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;

-- 22. BOOKING DISPUTES
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

CREATE INDEX IF NOT EXISTS booking_disputes_status_idx ON public.booking_disputes (status);
ALTER TABLE public.booking_disputes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_disputes' AND policyname = 'Parties can view disputes') THEN
    CREATE POLICY "Parties can view disputes" ON public.booking_disputes
      FOR SELECT TO authenticated USING (auth.uid() = customer_id OR auth.uid() = worker_id OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_disputes' AND policyname = 'Customers can open dispute on own booking') THEN
    CREATE POLICY "Customers can open dispute on own booking" ON public.booking_disputes
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_disputes' AND policyname = 'Admins can manage disputes') THEN
    CREATE POLICY "Admins can manage disputes" ON public.booking_disputes
      FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;

DROP TRIGGER IF EXISTS booking_disputes_set_updated_at ON public.booking_disputes;
CREATE TRIGGER booking_disputes_set_updated_at BEFORE UPDATE ON public.booking_disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT ON public.booking_disputes TO authenticated;
GRANT ALL ON public.booking_disputes TO service_role;

-- 23. NOTIFICATIONS
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

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, is_read, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view and update own notifications') THEN
    CREATE POLICY "Users can view and update own notifications" ON public.notifications
      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- 24. ADMIN AUDIT LOGS
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

CREATE INDEX IF NOT EXISTS admin_audit_logs_action_idx ON public.admin_audit_logs (action, created_at DESC);
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_audit_logs' AND policyname = 'Admins can view audit logs') THEN
    CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs
      FOR SELECT TO authenticated USING (public.is_admin());
  END IF;
END $$;

GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

-- 25. PRICING CONFIGURATION
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
CREATE TRIGGER pricing_config_set_updated_at BEFORE UPDATE ON public.pricing_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.pricing_config TO anon, authenticated;
GRANT ALL ON public.pricing_config TO service_role;

-- 26. CONTACT MESSAGES
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  topic text NOT NULL,
  service text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON public.contact_messages (created_at DESC);
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
