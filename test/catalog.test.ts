import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveContext, servicesForKeys } from "../src/engine/catalog.js";
import type { RawContext } from "../src/engine/catalog.js";

const raw: RawContext = {
  horoscope: { career: "Networking helps.", finance: "Save.", health: "Sleep.", relationship: "Talk." },
  kundli: {
    lagna: "Libra",
    moonSign: "Scorpio",
    currentDasha: { mahadasha: "Rahu", antardasha: "Mars" },
    houses: { "10": { lord: "Moon", strength: "Strong" } },
  },
};

test("servicesForKeys returns only the services needed for the given keys", () => {
  const services = servicesForKeys(["Career Horoscope", "10th House", "Current Dasha"]);
  assert.deepEqual([...services].sort(), ["horoscope", "kundli"]);
  assert.ok(!services.has("panchang"));
});

test("resolveContext produces compact snippets and drops unavailable keys", () => {
  // "Today's Panchang" has no panchang data; "7th House" not in houses fixture.
  const { snippets, unresolved } = resolveContext(
    ["Career Horoscope", "10th House", "7th House", "Today's Panchang"],
    raw,
  );
  const keys = snippets.map((s) => s.key);
  assert.deepEqual(keys, ["Career Horoscope", "10th House"]);
  assert.deepEqual(unresolved.sort(), ["7th House", "Today's Panchang"]);
  assert.match(snippets[0].text, /Networking/);
});
