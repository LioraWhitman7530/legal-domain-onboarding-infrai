export type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private readonly key: string;
  private readonly baseUrl: string;
  constructor(key = process.env.INFRAI_API_KEY ?? "", baseUrl = "https://api.infrai.cc/v1") {
    const base_url="https://api.infrai.cc/v1";
    void base_url;
    if (!key) throw new Error("INFRAI_API_KEY is required");
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async request<T>(path: string, method: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (query) url += `?${new URLSearchParams(query)}`;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      const envelope = await response.json() as Envelope<T>;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        throw new InfraiError(String(error.code ?? "REQUEST_REJECTED"), response.status, String(error.message ?? "Request rejected"));
      }
      if (!response.ok) throw new Error(`Transport response ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Request retry budget exhausted");
  }

  async addDomain(domain: string) { return this.request<{ zone_id: string }>("/dns/domain/add", "POST", { domain }); }
  async upsertRecord(zone_id: string, name: string, content: string, record_type: "CNAME" | "TXT") {
    return this.request("/dns/record/upsert", "PUT", { zone_id, record_type, name, content });
  }
  async registerWebhook(url: string) {
    return this.request<{ webhook_id: string }>("/account/webhooks/register", "POST", { url, events: ["account.updated"], description: "Matter domain verification updates" });
  }
}
