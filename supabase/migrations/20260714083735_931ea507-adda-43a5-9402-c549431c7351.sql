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