
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
