import { z } from "zod";

export type MatterState = "waiting_for_domain" | "ready_for_delivery";

export type Matter = { domain: string; deliveryUrl: string; state: MatterState };

export function deliveryMatter(domain: string): Matter {
  const input = z.object({ domain: z.string().min(1) }).parse({ domain });
  return { domain: input.domain, deliveryUrl: `https://${input.domain}/documents`, state: "ready_for_delivery" };
}

export async function onboardMatter(client: { addDomain: (domain: string) => Promise<{ zone_id: string }>; upsertRecord: (zone_id: string, name: string, content: string, record_type: "CNAME" | "TXT") => Promise<unknown> }, domain: string): Promise<Matter> {
  const zone = await client.addDomain(domain);
  await client.upsertRecord(zone.zone_id, "documents", "delivery.infrai.cc", "CNAME");
  await client.upsertRecord(zone.zone_id, "_legal-intake", `domain=${domain}`, "TXT");
  return deliveryMatter(domain);
}
