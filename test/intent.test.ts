import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyIntent } from "../src/engine/intent.js";

test("classifies the brief's sample questions", () => {
  assert.equal(classifyIntent("Should I consider changing my job this year?").intent, "career");
  assert.equal(classifyIntent("How does this month look for my relationship?").intent, "relationship");
  assert.equal(classifyIntent("What should I focus on for my health?").intent, "health");
  assert.equal(classifyIntent("Is this a good time to invest my money?").intent, "finance");
});

test("falls back to general when there is no keyword signal", () => {
  const r = classifyIntent("Can you summarize today's guidance?");
  assert.equal(r.intent, "general");
  assert.equal(r.ambiguous, false);
});

test("ambiguous multi-intent widens to general instead of guessing", () => {
  // Hits both career ('work','job') and relationship ('love') → too close to call.
  const r = classifyIntent("How is my week for work and love?");
  assert.equal(r.intent, "general");
  assert.equal(r.ambiguous, true);
});

test("a clear winner beats a single competing keyword", () => {
  // career: job, career, promotion (3) vs relationship: love (1) → clear career.
  const r = classifyIntent("Will I get a job promotion in my career, or focus on love?");
  assert.equal(r.intent, "career");
  assert.ok(r.score > 0.6);
});
