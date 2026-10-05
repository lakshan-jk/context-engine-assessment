import type { Kundli, Horoscope, Panchang, UserProfile } from "../domain.js";

/**
 * Deterministic fixtures used by the mock gateway (and by the standalone mock
 * HTTP server). A single, well-known user keeps the demo reproducible; unknown
 * users are synthesized so any userId "works" for exploration.
 */

const USERS: Record<string, UserProfile> = {
  user_101: {
    id: "user_101",
    name: "Aarav Sharma",
    language: "en",
    subscription: "premium",
    tonePreference: "motivational",
    birthDetails: { date: "1997-08-15", time: "09:35", place: "Delhi" },
  },
  user_ta: {
    id: "user_ta",
    name: "Karthik Raman",
    language: "ta",
    subscription: "premium",
    tonePreference: "motivational",
    birthDetails: { date: "1995-04-10", time: "06:20", place: "Chennai" },
  },
};

const KUNDLI: Kundli = {
  lagna: "Libra",
  moonSign: "Scorpio",
  currentDasha: { mahadasha: "Rahu", antardasha: "Mars" },
  houses: {
    "2": { lord: "Mars", strength: "Average" },
    "6": { lord: "Jupiter", strength: "Average" },
    "7": { lord: "Mars", strength: "Weak" },
    "10": { lord: "Moon", strength: "Strong" },
  },
};

const HOROSCOPE: Horoscope = {
  career: "Networking may bring new opportunities.",
  finance: "Avoid risky investments.",
  health: "Prioritize proper sleep.",
  relationship: "Communication with your partner improves.",
};

const PANCHANG: Panchang = {
  date: "2026-08-01",
  tithi: "Shukla Panchami",
  nakshatra: "Rohini",
  yoga: "Siddhi",
  karana: "Bava",
};

export const fixtures = {
  user(userId: string): UserProfile {
    return (
      USERS[userId] ?? {
        id: userId,
        name: "Guest User",
        language: "en",
        subscription: "free",
        tonePreference: "neutral",
        birthDetails: { date: "1990-01-01", time: "12:00", place: "Unknown" },
      }
    );
  },
  kundli(_userId: string): Kundli {
    return structuredClone(KUNDLI);
  },
  horoscope(_userId: string): Horoscope {
    return structuredClone(HOROSCOPE);
  },
  panchang(): Panchang {
    return structuredClone(PANCHANG);
  },
};
