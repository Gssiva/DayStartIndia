import {
  Sprout,
  Sparkles,
  HardHat,
  Car,
  Scissors,
  Droplets,
  Wheat,
  Brush,
  Crown,
  Hammer,
  PaintRoller,
  Grid3X3,
  Plane,
  Moon,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";

export type LangCode = "en" | "te" | "hi";

export const LANGUAGES: { code: LangCode; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
];

export type SubService = {
  id: string;
  name: string;
  icon: LucideIcon;
  price: number;
  unit: string;
};

export type Service = {
  id: string;
  name: string;
  icon: LucideIcon;
  blurb: string;
  startingPrice: number;
  eta: string;
  popular?: boolean;
  multiWorker: boolean;
  accent: string;
  subs: SubService[];
};

const ALL_SERVICES: Service[] = [
  {
    id: "agriculture",
    name: "Agriculture",
    icon: Sprout,
    blurb: "Field hands for harvesting, sowing and irrigation work.",
    startingPrice: 550,
    eta: "45–60 min",
    popular: true,
    multiWorker: true,
    accent: "from-emerald-500/15 to-emerald-500/0",
    subs: [
      { id: "harvesting", name: "Harvesting", icon: Wheat, price: 600, unit: "per worker / day" },
      {
        id: "seed-planting",
        name: "Seed planting",
        icon: Sprout,
        price: 550,
        unit: "per worker / day",
      },
      {
        id: "irrigation",
        name: "Irrigation",
        icon: Droplets,
        price: 575,
        unit: "per worker / day",
      },
    ],
  },
  {
    id: "beauty",
    name: "Beauty",
    icon: Sparkles,
    blurb: "Trained beauticians at your doorstep, hygiene-kit included.",
    startingPrice: 299,
    eta: "30–45 min",
    popular: true,
    multiWorker: false,
    accent: "from-pink-500/15 to-pink-500/0",
    subs: [
      { id: "hair-cut", name: "Hair cut", icon: Scissors, price: 299, unit: "per session" },
      { id: "facial", name: "Facial", icon: Sparkles, price: 699, unit: "per session" },
      { id: "bridal-makeup", name: "Bridal makeup", icon: Crown, price: 4999, unit: "per session" },
    ],
  },
  {
    id: "construction",
    name: "Construction",
    icon: HardHat,
    blurb: "Masons, painters and tile experts with their own tools.",
    startingPrice: 700,
    eta: "60–90 min",
    multiWorker: true,
    accent: "from-amber-500/15 to-amber-500/0",
    subs: [
      { id: "mason", name: "Mason", icon: Hammer, price: 850, unit: "per worker / day" },
      { id: "painter", name: "Painter", icon: PaintRoller, price: 750, unit: "per worker / day" },
      { id: "tile-work", name: "Tile work", icon: Grid3X3, price: 900, unit: "per worker / day" },
    ],
  },
  {
    id: "driver",
    name: "Driver",
    icon: Car,
    blurb: "Verified, licence-checked drivers for city and outstation.",
    startingPrice: 499,
    eta: "20–35 min",
    multiWorker: false,
    accent: "from-sky-500/15 to-sky-500/0",
    subs: [
      { id: "airport-drop", name: "Airport drop", icon: Plane, price: 499, unit: "per trip" },
      { id: "night-driver", name: "Night driver", icon: Moon, price: 799, unit: "per shift" },
      {
        id: "daily-driver",
        name: "Daily driver",
        icon: CalendarClock,
        price: 899,
        unit: "per day",
      },
    ],
  },
];

/** Live categories only — beauty & driver are coming soon. */
export const LIVE_SERVICE_IDS = ["agriculture", "construction"];
export const SERVICES: Service[] = ALL_SERVICES.filter((x) => LIVE_SERVICE_IDS.includes(x.id));

export function findService(id?: string | null) {
  return SERVICES.find((s) => s.id === id);
}
export function findSub(serviceId?: string | null, subId?: string | null) {
  return findService(serviceId)?.subs.find((s) => s.id === subId);
}

export const SERVICE_AREAS = [
  {
    city: "Visakhapatnam",
    areas: ["MVP Colony", "Gajuwaka", "Madhurawada", "Dwaraka Nagar", "Bheemili"],
  },
  {
    city: "Hyderabad",
    areas: ["Gachibowli", "Kukatpally", "Madhapur", "LB Nagar", "Secunderabad"],
  },
  { city: "Vijayawada", areas: ["Benz Circle", "Gunadala", "Patamata", "Auto Nagar"] },
];

export const TIME_SLOTS = [
  "06:00 – 08:00",
  "08:00 – 10:00",
  "10:00 – 12:00",
  "12:00 – 14:00",
  "14:00 – 16:00",
  "16:00 – 18:00",
  "18:00 – 20:00",
];

// Platform fees, GST, and advance rates are now configured in pricing_config table
// This file only provides service catalog data

export function priceBreakdown(
  subPrice: number,
  workers: number,
  platformFee: number = 0,
  gstRate: number = 0,
  advanceRate: number = 0,
) {
  const base = subPrice * workers;
  const taxes = platformFee > 0 && gstRate > 0 ? Math.round((base + platformFee) * gstRate) : 0;
  const total = base + platformFee + taxes;
  const advance = advanceRate > 0 ? Math.round(total * advanceRate) : 0;
  return { base, platformFee, taxes, total, advance, remaining: total - advance };
}

export const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

type Dict = Record<string, string>;
const EN: Dict = {
  title: "Book a verified worker",
  subtitle: "Ten quick steps. Under 60 seconds.",
  next: "Continue",
  back: "Back",
  language: "Choose your language",
  location: "Where do you need help?",
  service: "Pick a service",
  sub: "What exactly do you need?",
  workers: "How many workers?",
  when: "When do you need them?",
  address: "Address details",
  summary: "Review your booking",
  payment: "Pay 30% advance",
  done: "Booking confirmed",
};
const TE: Dict = {
  ...EN,
  title: "ధృవీకరించిన కార్మికుడిని బుక్ చేయండి",
  subtitle: "పది సులభ దశలు. 60 సెకన్లలోపు.",
  next: "కొనసాగించండి",
  back: "వెనుకకు",
  language: "మీ భాషను ఎంచుకోండి",
  location: "మీకు ఎక్కడ సహాయం కావాలి?",
  service: "సేవను ఎంచుకోండి",
  sub: "మీకు ఖచ్చితంగా ఏమి కావాలి?",
  workers: "ఎంత మంది కార్మికులు?",
  when: "ఎప్పుడు కావాలి?",
  address: "చిరునామా వివరాలు",
  summary: "మీ బుకింగ్‌ను సమీక్షించండి",
  payment: "30% అడ్వాన్స్ చెల్లించండి",
  done: "బుకింగ్ నిర్ధారించబడింది",
};
const HI: Dict = {
  ...EN,
  title: "सत्यापित कर्मचारी बुक करें",
  subtitle: "दस आसान चरण. 60 सेकंड से कम.",
  next: "आगे बढ़ें",
  back: "वापस",
  language: "अपनी भाषा चुनें",
  location: "आपको कहाँ मदद चाहिए?",
  service: "सेवा चुनें",
  sub: "आपको वास्तव में क्या चाहिए?",
  workers: "कितने कर्मचारी?",
  when: "कब चाहिए?",
  address: "पता विवरण",
  summary: "अपनी बुकिंग जाँचें",
  payment: "30% अग्रिम भुगतान",
  done: "बुकिंग पक्की हुई",
};

export const DICT: Record<LangCode, Dict> = { en: EN, te: TE, hi: HI };
