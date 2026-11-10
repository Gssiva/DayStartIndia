CREATE TABLE public.bookings (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  service_slug text NOT NULL,
  sub_service_slug text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  city text NOT NULL,
  area text NOT NULL,
  workers integer NOT NULL DEFAULT 1,
  timing text NOT NULL DEFAULT 'immediate',
  booking_date text,
  slot text,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'searching',
  worker jsonb NOT NULL DEFAULT '{}'::jsonb,
  rating integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bookings_user_created_idx ON public.bookings (user_id, created_at DESC);
GRANT SELECT ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view their own bookings" ON public.bookings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();