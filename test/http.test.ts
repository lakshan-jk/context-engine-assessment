import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

test("POST /personalize returns the documented response shape", async () => {
  const app = buildApp();
  const res = await app.inject({
    method: "POST",
    url: "/personalize",
    payload: { userId: "user_101", question: "Should I consider changing my job?" },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(typeof body.answer === "string");
  assert.ok(["HIGH", "MEDIUM", "LOW"].includes(body.confidence));
  assert.ok(Array.isArray(body.sourcesUsed));
  await app.close();
});

test("POST /debug/personalization returns the reasoning, not an answer", async () => {
  const app = buildApp();
  const res = await app.inject({
    method: "POST",
    url: "/debug/personalization",
    payload: { userId: "user_101", question: "Should I consider changing my job?" },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.intent, "career");
  assert.ok(body.selectedContext.includes("10th House"));
  assert.equal(body.answer, undefined);
  await app.close();
});

test("malformed body is rejected with 400 by schema validation", async () => {
  const app = buildApp();
  const res = await app.inject({ method: "POST", url: "/personalize", payload: { userId: "u" } });
  assert.equal(res.statusCode, 400);
  await app.close();
});
