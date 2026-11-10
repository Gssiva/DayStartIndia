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