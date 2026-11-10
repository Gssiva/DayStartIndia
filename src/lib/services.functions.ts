import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type SubServiceRow = {
  id: string;
  serviceId: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  image: string | null;
  price: number;
  unit: string;
  duration: string | null;
  status: string;
};

export type ServiceRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  image: string | null;
  startingPrice: number | null;
  eta: string | null;
  multiWorker: boolean;
  status: string;
  subs: SubServiceRow[];
};

function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("catalog_unavailable");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const getServiceCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ services: ServiceRow[]; error: string | null }> => {
    try {
      const supabase = publicClient();
      const [{ data: services, error: sErr }, { data: subs, error: subErr }] = await Promise.all([
        supabase
          .from("services")
          .select(
            "id,name,slug,description,icon,image,starting_price,eta,multi_worker,status,sort_order",
          )
          .eq("status", "active")
          .order("sort_order", { ascending: true }),
        supabase
          .from("sub_services")
          .select(
            "id,service_id,name,slug,description,icon,image,price,unit,duration,status,sort_order",
          )
          .eq("status", "active")
          .order("sort_order", { ascending: true }),
      ]);

      if (sErr || subErr) throw sErr ?? subErr;

      // Only these categories are live; others (beauty, driver) are "coming soon" and hidden.
      const LIVE_SERVICE_SLUGS = ["agriculture", "construction"];
      const mapped: ServiceRow[] = (services ?? [])
        .filter((s) => LIVE_SERVICE_SLUGS.includes(s.slug))
        .map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          description: s.description,
          icon: s.icon,
          image: s.image,
          startingPrice: s.starting_price,
          eta: s.eta,
          multiWorker: s.multi_worker,
          status: s.status,
          subs: (subs ?? [])
            .filter((x) => x.service_id === s.id)
            .map((x) => ({
              id: x.id,
              serviceId: x.service_id,
              name: x.name,
              slug: x.slug,
              description: x.description,
              icon: x.icon,
              image: x.image,
              price: x.price,
              unit: x.unit,
              duration: x.duration,
              status: x.status,
            })),
        }));

      return { services: mapped, error: null };
    } catch (err) {
      console.error("[services] catalog load failed", err);
      return { services: [], error: "We couldn't load services right now. Please try again." };
    }
  },
);

/** Server-side validation of a service + sub-service selection. Never trust client IDs. */
export const validateServiceSelection = createServerFn({ method: "POST" })
  .inputValidator((data: { serviceSlug: string; subSlug: string }) => {
    const serviceSlug = String(data?.serviceSlug ?? "").trim();
    const subSlug = String(data?.subSlug ?? "").trim();
    if (!/^[a-z0-9-]{2,60}$/.test(serviceSlug) || !/^[a-z0-9-]{2,60}$/.test(subSlug)) {
      throw new Error("invalid_selection");
    }
    return { serviceSlug, subSlug };
  })
  .handler(async ({ data }) => {
    try {
      const supabase = publicClient();
      const { data: service, error } = await supabase
        .from("services")
        .select("id,name,slug,status,multi_worker")
        .eq("slug", data.serviceSlug)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!service)
        return { valid: false as const, reason: "This service is currently unavailable." };

      const { data: sub, error: subError } = await supabase
        .from("sub_services")
        .select("id,name,slug,price,unit,duration,status")
        .eq("service_id", service.id)
        .eq("slug", data.subSlug)
        .eq("status", "active")
        .maybeSingle();
      if (subError) throw subError;
      if (!sub) return { valid: false as const, reason: "This option is currently unavailable." };

      return {
        valid: true as const,
        selection: {
          serviceId: service.id,
          serviceSlug: service.slug,
          serviceName: service.name,
          multiWorker: service.multi_worker,
          subServiceId: sub.id,
          subServiceSlug: sub.slug,
          subServiceName: sub.name,
          price: sub.price,
          unit: sub.unit,
          duration: sub.duration,
        },
      };
    } catch (err) {
      console.error("[services] selection validation failed", err);
      return {
        valid: false as const,
        reason: "We couldn't verify that selection. Please try again.",
      };
    }
  });
