-- ====================================================================
-- DayStart FULL database setup for a NEW, EMPTY Supabase project.
-- Supabase Dashboard -> SQL Editor -> New query -> paste ALL -> Run (once).
-- If it says something 'already exists', your project was already set up;
-- in that case run supabase/setup.sql instead.
-- ====================================================================

-- Private storage buckets used by worker registration (Aadhaar upload / KYC)
insert into storage.buckets (id, name, public)
values ('aadhaar-documents', 'aadhaar-documents', false), ('worker-kyc', 'worker-kyc', false)
on conflict (id) do nothing;

-- ---------- 20260714083735_931ea507-adda-43a5-9402-c549431c7351.sql ----------
CREATE TABLE public.worker_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.worker_registrations TO anon;
GRANT INSERT ON public.worker_registrations TO authenticated;
GRANT ALL ON public.worker_registrations TO service_role;

ALTER TABLE public.worker_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a worker registration"
  ON public.worker_registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
-- ---------- 20260715050536_6a7d59c2-073e-4e7a-a2ba-ff3389c2df3f.sql ----------

ALTER TABLE public.worker_registrations
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aadhaar_document_path text,
  ADD COLUMN IF NOT EXISTS aadhaar_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aadhaar_ocr_full text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.worker_registrations ALTER COLUMN email TYPE text;

CREATE INDEX IF NOT EXISTS worker_registrations_user_id_idx ON public.worker_registrations(user_id);

-- Only authenticated users can now create registrations (linked to their auth user)
DROP POLICY IF EXISTS "Anyone can submit a worker registration" ON public.worker_registrations;

CREATE POLICY "Workers can insert their own registration"
  ON public.worker_registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Workers can view their own registration"
  ON public.worker_registrations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Workers can update their own registration"
  ON public.worker_registrations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.worker_registrations TO authenticated;

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

DROP TRIGGER IF EXISTS worker_registrations_set_updated_at ON public.worker_registrations;
CREATE TRIGGER worker_registrations_set_updated_at
  BEFORE UPDATE ON public.worker_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 20260715050603_35bb8d93-5e72-47e5-9fa9-b604563046b5.sql ----------

CREATE POLICY "Workers can upload own aadhaar docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'aadhaar-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Workers can read own aadhaar docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'aadhaar-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- 20260802093956_212bf948-d2ea-4b0e-9418-c10db57c8f86.sql ----------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.phone_otp_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX phone_otp_requests_phone_idx ON public.phone_otp_requests (phone, created_at DESC);

GRANT ALL ON public.phone_otp_requests TO service_role;

ALTER TABLE public.phone_otp_requests ENABLE ROW LEVEL SECURITY;
-- ---------- 20260806103602_d8c77659-ea48-492f-bff4-b036137820f3.sql ----------
CREATE TABLE public.worker_profiles (
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
  bank_account_name text,
  bank_account_number text,
  bank_ifsc text,
  upi_id text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_profiles_availability_status_check
    CHECK (availability_status IN ('online','offline','paused'))
);

GRANT SELECT, INSERT, UPDATE ON public.worker_profiles TO authenticated;
GRANT ALL ON public.worker_profiles TO service_role;

ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers can view their own worker profile"
  ON public.worker_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Workers can create their own worker profile"
  ON public.worker_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Workers can update their own worker profile"
  ON public.worker_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER worker_profiles_set_updated_at
  BEFORE UPDATE ON public.worker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.worker_kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_path text,
  status text NOT NULL DEFAULT 'pending',
  reviewer_note text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_kyc_documents_doc_type_check
    CHECK (doc_type IN ('aadhaar','pan','selfie','address_proof','bank')),
  CONSTRAINT worker_kyc_documents_status_check
    CHECK (status IN ('pending','verified','rejected')),
  CONSTRAINT worker_kyc_documents_user_doc_unique UNIQUE (user_id, doc_type)
);

GRANT SELECT, INSERT, UPDATE ON public.worker_kyc_documents TO authenticated;
GRANT ALL ON public.worker_kyc_documents TO service_role;

ALTER TABLE public.worker_kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers can view their own KYC documents"
  ON public.worker_kyc_documents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Workers can add their own KYC documents"
  ON public.worker_kyc_documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Workers can replace their own KYC documents"
  ON public.worker_kyc_documents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE TRIGGER worker_kyc_documents_set_updated_at
  BEFORE UPDATE ON public.worker_kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX worker_kyc_documents_user_idx ON public.worker_kyc_documents (user_id);
-- ---------- 20260806103640_54a58a90-4c51-48e8-b330-751021a24f22.sql ----------
CREATE POLICY "Workers can read their own kyc files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'worker-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Workers can upload their own kyc files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'worker-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Workers can update their own kyc files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'worker-kyc' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'worker-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Workers can delete their own kyc files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'worker-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);
-- ---------- 20260905090425_a390b403-64c8-484b-81a3-1e2c71f7fe10.sql ----------
CREATE TABLE public.services (
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sub_services (
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

CREATE POLICY "Anyone can view active services" ON public.services
  FOR SELECT TO anon, authenticated USING (status = 'active');

CREATE POLICY "Anyone can view active sub-services" ON public.sub_services
  FOR SELECT TO anon, authenticated
  USING (status = 'active' AND EXISTS (SELECT 1 FROM public.services s WHERE s.id = service_id AND s.status = 'active'));

CREATE TRIGGER services_set_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sub_services_set_updated_at BEFORE UPDATE ON public.sub_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.services (name, slug, description, icon, starting_price, eta, multi_worker, sort_order) VALUES
('Agriculture','agriculture','Field hands for plowing, sowing, irrigation and harvest work. Book 1–20 workers for a full day.','Sprout',550,'45–60 min',true,1),
('Beauty','beauty','Trained beauticians at your doorstep with a fresh hygiene kit for every appointment.','Sparkles',149,'30–45 min',false,2),
('Construction','construction','Masons, painters and tile experts who bring their own tools to site.','HardHat',700,'60–90 min',true,3),
('Driver','driver','Licence-checked, background-verified drivers for city runs and outstation trips.','Car',499,'20–35 min',false,4);

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
ON v.service_slug = s.slug;
-- Contact page enquiries (also emailed to CONTACT_TO). Only the server can read/write.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  topic text not null,
  service text,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);
grant all on public.contact_messages to service_role;
alter table public.contact_messages enable row level security;

notify pgrst, 'reload schema';
