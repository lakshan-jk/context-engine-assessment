import type {
  ContextSnippet,
  Horoscope,
  Kundli,
  Panchang,
  ServiceName,
  UserProfile,
} from "../domain.js";

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  THE CONTEXT CATALOG — the decoupling seam.
 *
 *  Maps a LOGICAL context key (what the engine reasons about, e.g. "10th House")
 *  to (1) the upstream service that supplies it and (2) how to extract a
 *  compact, prompt-ready snippet from that service's raw response.
 *
 *  Why it matters:
 *   • The rules table and engine speak in domain terms, never raw JSON paths.
 *   • An upstream schema change touches exactly ONE resolver here.
 *   • Only SELECTED keys are resolved → the prompt carries just what the
 *     question needs (prompt optimization lives here, not in the LLM layer).
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Raw upstream data available to resolvers. Any field may be absent (fetch failed). */
export interface RawContext {
  user?: UserProfile;
  kundli?: Kundli;
  horoscope?: Horoscope;
  panchang?: Panchang;
}

interface ContextDefinition {
  service: ServiceName;
  /** Returns a prompt-ready line, or null when the underlying data is unavailable. */
  resolve(raw: RawContext): string | null;
}

/** English ordinal suffix: 1→1st, 2→2nd, 3→3rd, 4→4th, 10→10th, 11→11th … */
const ordinal = (n: string): string => {
  const num = Number(n);
  const rem100 = num % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${num}th`;
  const suffix = ["th", "st", "nd", "rd"][num % 10] ?? "th";
  return `${num}${suffix}`;
};

const house =
  (num: string) =>
  (raw: RawContext): string | null => {
    const h = raw.kundli?.houses?.[num];
    return h ? `${ordinal(num)} House — lord ${h.lord}, strength ${h.strength}` : null;
  };

export const CONTEXT_CATALOG: Record<string, ContextDefinition> = {
  // Horoscope service
  "Career Horoscope": {
    service: "horoscope",
    resolve: (r) => (r.horoscope?.career ? `Career outlook: ${r.horoscope.career}` : null),
  },
  "Finance Horoscope": {
    service: "horoscope",
    resolve: (r) => (r.horoscope?.finance ? `Finance outlook: ${r.horoscope.finance}` : null),
  },
  "Health Horoscope": {
    service: "horoscope",
    resolve: (r) => (r.horoscope?.health ? `Health outlook: ${r.horoscope.health}` : null),
  },
  "Relationship Horoscope": {
    service: "horoscope",
    resolve: (r) =>
      r.horoscope?.relationship ? `Relationship outlook: ${r.horoscope.relationship}` : null,
  },

  // Kundli service
  "10th House": { service: "kundli", resolve: house("10") },
  "7th House": { service: "kundli", resolve: house("7") },
  "6th House": { service: "kundli", resolve: house("6") },
  "2nd House": { service: "kundli", resolve: house("2") },
  "Current Dasha": {
    service: "kundli",
    resolve: (r) => {
      const d = r.kundli?.currentDasha;
      return d ? `Current Dasha — Mahadasha ${d.mahadasha}, Antardasha ${d.antardasha}` : null;
    },
  },
  "Moon Sign": {
    service: "kundli",
    resolve: (r) => (r.kundli?.moonSign ? `Moon Sign: ${r.kundli.moonSign}` : null),
  },
  Lagna: {
    service: "kundli",
    resolve: (r) => (r.kundli?.lagna ? `Lagna (Ascendant): ${r.kundli.lagna}` : null),
  },

  // Panchang service
  "Today's Panchang": {
    service: "panchang",
    resolve: (r) => {
      const p = r.panchang;
      return p
        ? `Today's Panchang — Tithi ${p.tithi}, Nakshatra ${p.nakshatra}, Yoga ${p.yoga}`
        : null;
    },
  },
};

/** Every logical context key known to the system (used by the `general` intent). */
export const ALL_CONTEXT_KEYS = Object.keys(CONTEXT_CATALOG);

/** The distinct upstream services needed to resolve the given keys. */
export function servicesForKeys(keys: string[]): Set<ServiceName> {
  const services = new Set<ServiceName>();
  for (const key of keys) {
    const def = CONTEXT_CATALOG[key];
    if (def) services.add(def.service);
  }
  return services;
}

/**
 * Resolve selected keys against the raw data. Keys whose data is unavailable
 * (service failed or field missing) are dropped and returned in `unresolved`
 * so the confidence model can react to them.
 */
export function resolveContext(
  keys: string[],
  raw: RawContext,
): { snippets: ContextSnippet[]; unresolved: string[] } {
  const snippets: ContextSnippet[] = [];
  const unresolved: string[] = [];

  for (const key of keys) {
    const def = CONTEXT_CATALOG[key];
    const text = def?.resolve(raw) ?? null;
    if (text === null) unresolved.push(key);
    else snippets.push({ key, service: def!.service, text });
  }
  return { snippets, unresolved };
}
