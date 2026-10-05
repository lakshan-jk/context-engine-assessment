import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, selectedKeysForIntent } from "../src/engine/personalization.js";
import { INTENT_RULES } from "../src/engine/rules.config.js";
import { ALL_CONTEXT_KEYS } from "../src/engine/catalog.js";
import type { Intent, UserProfile } from "../src/domain.js";

const premiumUser: UserProfile = {
  id: "user_101",
  name: "Aarav Sharma",
  language: "en",
  subscription: "premium",
  tonePreference: "motivational",
  birthDetails: { date: "1997-08-15", time: "09:35", place: "Delhi" },
};

test("career plan selects primary+secondary and personalizes from the profile", () => {
  const plan = buildPlan("Should I change my job?", premiumUser);
  assert.equal(plan.intent, "career");
  assert.deepEqual(plan.selectedContext, [
    "Career Horoscope",
    "10th House",
    "Current Dasha",
    "Today's Panchang",
  ]);
  assert.equal(plan.language, "English");
  assert.equal(plan.tone, "Motivational");
  assert.equal(plan.maxWords, 350); // 250 base + 100 premium bonus
});

test("excludedContext is derived: selected ∪ excluded == full catalog, disjoint", () => {
  const plan = buildPlan("Should I change my job?", premiumUser);
  const selected = new Set(plan.selectedContext);
  const excluded = new Set(plan.excludedContext);
  // Disjoint
  for (const k of selected) assert.ok(!excluded.has(k), `${k} in both`);
  // Together they cover the whole catalog
  assert.equal(selected.size + excluded.size, ALL_CONTEXT_KEYS.length);
});

test("free users get the base word budget (no premium bonus)", () => {
  const freeUser = { ...premiumUser, subscription: "free" as const };
  const plan = buildPlan("Should I change my job?", freeUser);
  assert.equal(plan.maxWords, 250);
});

test("general intent selects the entire catalog and excludes nothing", () => {
  const plan = buildPlan("Give me overall guidance for life", premiumUser);
  assert.equal(plan.intent, "general");
  assert.equal(plan.selectedContext.length, ALL_CONTEXT_KEYS.length);
  assert.equal(plan.excludedContext.length, 0);
});

// INVARIANT: the config's explicit `exclude` list is documentation/safety only —
// nothing in it may ever appear in the selected set for that intent.
test("config invariant: excluded keys never leak into selection", () => {
  for (const intent of Object.keys(INTENT_RULES) as Intent[]) {
    const selected = new Set(selectedKeysForIntent(intent));
    for (const ex of INTENT_RULES[intent].exclude) {
      assert.ok(!selected.has(ex), `intent ${intent} selected an excluded key: ${ex}`);
    }
  }
});
