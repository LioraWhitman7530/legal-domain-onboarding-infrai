import { InfraiClient } from "./infrai_client.ts";
import { onboardMatter } from "./domain_decision.ts";

const domain = process.env.LEGAL_MATTER_DOMAIN;
if (!domain) throw new Error("LEGAL_MATTER_DOMAIN is required");
const infrai = new InfraiClient();
const matter = await onboardMatter(infrai, domain);
const webhook = await infrai.registerWebhook("https://product.example/webhooks/domain-verification");
console.log(JSON.stringify({ matter, webhook_id: webhook.webhook_id }, null, 2));
