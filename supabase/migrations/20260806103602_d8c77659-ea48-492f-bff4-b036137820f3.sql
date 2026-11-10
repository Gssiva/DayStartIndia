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