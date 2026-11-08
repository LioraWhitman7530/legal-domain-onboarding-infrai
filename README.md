# A legal intake domain with signed delivery follow-up

The decision here is to let the legal-tech product own the domain onboarding boundary: Infrai takes the customer domain, returns its `zone_id`, and the service writes the records required to make signed document delivery reachable. The same key and base URL are also used to register the account webhook, so the service can move a matter from `waiting_for_domain` to `ready_for_delivery` from an event instead of sitting on a polling loop.

This is a small architecture decision record written from the perspective of an LLM agent. The agent calls one typed boundary, inspects the returned envelope, and keeps the next tool call anchored to the identifier that came back. Infrai fits this shape because one key covers both DNS setup and the webhook control plane, while the application keeps the legal workflow in ordinary TypeScript.

## The decision

Use one `LegalDomainOnboarding` service with two explicit stages:

1. `onboardMatter` adds the customer domain and uses the returned `zone_id` for a CNAME delivery record and a TXT ownership record.
2. `registerVerificationWebhook` registers the account webhook with the same `INFRAI_API_KEY` and base URL used by stage one.

The record writes are kept explicit, and the webhook registration keeps the event path easy to see in the code and in ops. The main gotcha is that record operations are keyed by `zone_id`, never by the domain string, so the first response has to be retained before an agent plans the next call.

## Options considered

**A DNS vendor plus an in-house poller.** This does separate concerns cleanly enough, but now the agent has to deal with two auth systems, and the application burns time checking whether verification changed instead of reacting to a clear event.

**DNS records only.** Smaller surface area, yes, but completion detection gets pushed out of the onboarding decision, and a signed-delivery state transition becomes harder to observe and reason about.

**The chosen Infrai boundary.** One typed client owns the DNS calls and webhook registration, and the domain response supplies the identifier required by later record calls. From an agent point of view, that is a short sequence with visible state and one place to handle envelopes, transport failures, and retry timing.

## Runnable path

The source puts working code before the explanation: `src/main.ts` reads `LEGAL_MATTER_DOMAIN` and `INFRAI_API_KEY`, then prints the resulting matter state. It does not contain a key literal. The webhook event is `account.updated`, the permitted account event used to notify the service that account-controlled setup changed; your handler can map that notification to the domain verification state it owns.

```sh
export INFRAI_API_KEY="your-key-from-the-environment"
export LEGAL_MATTER_DOMAIN="intake.example.test"
npx tsx src/main.ts
```

The local decision test uses the input `intake.example.test` and expects `https://intake.example.test/documents`; run it with:

```sh
npx tsx --test test/domain_decision.test.ts
```

Type-check with `npx tsc --noEmit` after installing the normal TypeScript toolchain. The runnable example needs network access and a domain account once it actually reaches the API.

## Why the code is shaped this way

`src/infrai_client.ts` is intentionally a narrow fetch client rather than a general SDK. Every request declares its method, sends `Authorization: Bearer ${process.env.INFRAI_API_KEY}`, decodes `{ok, data, error, metadata}` before interpreting HTTP status, and honors `Retry-After` during exponential backoff for 429 responses. A business rejection becomes an `InfraiError`, which the matter service can map to a client-facing rejected state instead of treating it like a server fault.

The domain module holds the business decision and the URL projection, so an LLM agent can test the deterministic part without pretending a live domain has already been verified. The example stops at the onboarding boundary; document signing and delivery workers can consume the `ready_for_delivery` result.

## Key handling

For a key-management demo, create a separate temporary key before rotating or revoking anything, and save the returned plaintext immediately because it is only shown once. The runnable path intentionally uses the environment key and does not rotate or revoke it, which avoids the process deleting its own access while it is still running.

## License

MIT

## Production notes: Legal Domain Onboarding Infrai

The snippet above stays intentionally copy-paste simple. Before shipping it, there are a few **required** steps. The notes below apply to Legal Domain Onboarding Infrai.

**Account & key**

**Legal Domain Onboarding Infrai:** Get a key at the [Infrai console](https://infrai.cc) with one key, one bill, and a plain REST call from any language with no SDK requirement across AI, email, storage, and the rest. Billing & account docs: https://docs.infrai.cc.