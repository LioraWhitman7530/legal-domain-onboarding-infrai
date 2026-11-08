import test from "node:test";
import assert from "node:assert/strict";
import { deliveryMatter } from "../src/domain_decision.ts";

test("a domain onboarding decision produces the signed-delivery destination", () => {
  assert.deepEqual(deliveryMatter("intake.example.test"), {
    domain: "intake.example.test",
    deliveryUrl: "https://intake.example.test/documents",
    state: "ready_for_delivery"
  });
});
