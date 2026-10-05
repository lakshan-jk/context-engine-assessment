import { test } from "node:test";
import assert from "node:assert/strict";
import { ContextEngine } from "../src/pipeline.js";
import { MockGateway } from "../src/gateway/mock-gateway.js";
import { MockLlmProvider } from "../src/llm/mock-provider.js";
import type { Logger } from "../src/infra/logger.js";

// Silent logger so tests stay quiet.
const noop: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return noop;
  },
};

const llm = new MockLlmProvider();

test("personalize returns answer, confidence and engine-derived sources (happy path)", async () => {
  const engine = new ContextEngine(new MockGateway(), llm, noop);
  const res = await engine.personalize("user_101", "Should I change my job soon?");

  assert.equal(typeof res.answer, "string");
  assert.ok(res.answer.length > 0);
  assert.deepEqual(res.sourcesUsed, [
    "Career Horoscope",
    "10th House",
    "Current Dasha",
    "Today's Panchang",
  ]);
  assert.equal(res.confidence, "HIGH");
});

test("degrades to LOW (never throws) when a PRIMARY upstream fails", async () => {
  // Horoscope failing removes the "Career Horoscope" primary key.
  const engine = new ContextEngine(new MockGateway({ failServices: ["horoscope"] }), llm, noop);
  const res = await engine.personalize("user_101", "Should I change my job soon?");

  assert.ok(!res.sourcesUsed.includes("Career Horoscope"));
  assert.equal(res.confidence, "LOW");
});

test("user-service failure caps confidence at MEDIUM and still answers", async () => {
  const engine = new ContextEngine(new MockGateway({ failServices: ["user"] }), llm, noop);
  const res = await engine.personalize("user_101", "Should I change my job soon?");
  assert.notEqual(res.confidence, "HIGH");
  assert.ok(res.answer.length > 0);
});

test("debug explains the plan without invoking the LLM", async () => {
  let called = false;
  const spyLlm = new (class extends MockLlmProvider {
    override async generate(p: Parameters<MockLlmProvider["generate"]>[0]) {
      called = true;
      return super.generate(p);
    }
  })();
  const engine = new ContextEngine(new MockGateway(), spyLlm, noop);

  const dbg = await engine.debug("user_101", "How is my relationship going?");
  assert.equal(dbg.intent, "relationship");
  assert.ok(dbg.selectedContext.includes("Relationship Horoscope"));
  assert.ok(dbg.excludedContext.includes("Career Horoscope"));
  assert.equal(dbg.language, "English");
  assert.equal(called, false); // LLM never touched
});
