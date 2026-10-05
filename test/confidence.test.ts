import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageConfidence, combineConfidence } from "../src/engine/confidence.js";
import { buildPlan } from "../src/engine/personalization.js";
import type { UserProfile } from "../src/domain.js";

const user: UserProfile = {
  id: "u",
  name: "n",
  language: "en",
  subscription: "free",
  tonePreference: "neutral",
  birthDetails: { date: "", time: "", place: "" },
};
const careerPlan = buildPlan("Should I change my job?", user);

test("combineConfidence takes the more conservative level", () => {
  assert.equal(combineConfidence("HIGH", "LOW"), "LOW");
  assert.equal(combineConfidence("HIGH", "MEDIUM"), "MEDIUM");
  assert.equal(combineConfidence("HIGH", "HIGH"), "HIGH");
  assert.equal(combineConfidence("MEDIUM", "LOW"), "LOW");
});

test("HIGH coverage when all primary resolved, no failure, clear intent", () => {
  const c = coverageConfidence({
    plan: careerPlan,
    unresolvedKeys: [],
    anyUpstreamFailed: false,
    ambiguous: false,
  });
  assert.equal(c, "HIGH");
});

test("LOW coverage when a PRIMARY key is unresolved", () => {
  const c = coverageConfidence({
    plan: careerPlan,
    unresolvedKeys: ["10th House"], // primary for career
    anyUpstreamFailed: true,
    ambiguous: false,
  });
  assert.equal(c, "LOW");
});

test("MEDIUM coverage when only a SECONDARY key dropped", () => {
  const c = coverageConfidence({
    plan: careerPlan,
    unresolvedKeys: ["Today's Panchang"], // secondary for career
    anyUpstreamFailed: true,
    ambiguous: false,
  });
  assert.equal(c, "MEDIUM");
});

test("MEDIUM coverage when intent was ambiguous even with full data", () => {
  const c = coverageConfidence({
    plan: careerPlan,
    unresolvedKeys: [],
    anyUpstreamFailed: false,
    ambiguous: true,
  });
  assert.equal(c, "MEDIUM");
});
