import type { PromptBundle } from "./prompt.js";
import type { Confidence, UserProfile } from "../domain.js";
import { LANGUAGE_NAMES, toneLabel } from "./rules.config.js";

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  PROACTIVE GUIDANCE ALERTS — the engagement/retention engine.
 *
 *  Instead of waiting for a question, the app proactively notifies the user at
 *  meaningful points in an astrological period (a Dasha, a transit/Gochar):
 *    • start  → a heads-up as the period begins
 *    • middle → an encouraging check-in
 *    • end    → gentle closure and what comes next
 *
 *  Tone & safety are first-class here (astrology can be wrong; a careless
 *  "warning" can genuinely upset someone), so the prompt enforces: never
 *  alarmist, always humble, and every caution is paired with a constructive
 *  step. This module is PURE — phase logic and prompt building, no I/O.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type AlertPhase = "start" | "middle" | "end";

/** The /alert response. `phase`/`message` are null when today is outside the period. */
export interface AlertResponse {
  phase: AlertPhase | null;
  message: string | null;
  confidence: Confidence;
  period: string;
}

/** A significant astrological window the app can proactively speak to. */
export interface AstroPeriod {
  name: string; // e.g. "Jupiter Mahadasha", "Shani Gochar over Moon"
  start: string; // ISO date
  end: string; // ISO date
  sentiment: "good" | "relief" | "caution";
}

/**
 * Where in the period is "today"? Returns null if today is outside the window
 * (nothing to notify). start = first ~20%, end = last ~20%, middle otherwise.
 */
export function determinePhase(period: AstroPeriod, todayIso: string): AlertPhase | null {
  const start = Date.parse(period.start);
  const end = Date.parse(period.end);
  const today = Date.parse(todayIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  if (today < start || today > end) return null;

  const progress = (today - start) / (end - start); // 0..1
  if (progress <= 0.2) return "start";
  if (progress >= 0.8) return "end";
  return "middle";
}

/** Phase-specific intent for the message (keeps the LLM on-task). */
const PHASE_INTENT: Record<AlertPhase, string> = {
  start: "A new period is beginning — give a gentle heads-up and set a calm, hopeful expectation.",
  middle: "The period is underway — offer an encouraging check-in and a small, useful nudge.",
  end: "The period is winding down — offer gentle closure and a hint of what comes next.",
};

/** How to frame the emotional tone, safely, per sentiment. */
const SENTIMENT_GUIDE: Record<AstroPeriod["sentiment"], string> = {
  good: "This is a favourable window. Be warm and encouraging, without over-promising.",
  relief: "This brings relief after a hard phase. Be reassuring and kind.",
  caution:
    "This is a period to be MINDFUL of, NOT a threat. Never alarm the user. Frame it gently as " +
    "an area to give attention to, and ALWAYS pair it with one small, constructive step or remedy.",
};

/**
 * Builds a tone-safe, phase-aware alert prompt. The system message pins the
 * safety rails that keep proactive astrology from ever disturbing a user.
 */
export function buildAlertPrompt(
  user: UserProfile,
  period: AstroPeriod,
  phase: AlertPhase,
): PromptBundle {
  const language = LANGUAGE_NAMES[user.language] ?? user.language;
  const tone = toneLabel(user.tonePreference);

  const system = [
    "You are MyNaksh, a warm, caring astrology guide sending a short proactive notification.",
    `Write in ${language}. Use a ${tone.toLowerCase()}, gentle, human tone.`,
    "Keep it under 45 words — this is a push notification, not an essay.",
    "SAFETY RULES (critical):",
    "- Astrology is guidance, not certainty. Be humble: 'the stars suggest', never 'you will'.",
    "- Never be alarmist or fear-inducing. Do not predict specific bad events.",
    "- If it is a caution, frame it gently and ALWAYS pair it with one constructive step.",
    "- Be kind and respectful; the goal is to support the user, never to disturb them.",
    `- Address the user warmly by name (${user.name}).`,
    "",
    "Reply as strict minified JSON: {\"answer\": string, \"confidence\": \"HIGH\"|\"MEDIUM\"|\"LOW\"}",
  ].join("\n");

  const user_ = [
    `Astrological period: ${period.name}`,
    `Nature of the period: ${SENTIMENT_GUIDE[period.sentiment]}`,
    `Timing: ${PHASE_INTENT[phase]}`,
  ].join("\n");

  const promptChars = system.length + user_.length;
  return {
    system,
    user: user_,
    metrics: {
      promptChars,
      approxTokens: Math.ceil(promptChars / 4),
      keysIncluded: 1,
      keysAvailable: 1,
    },
  };
}
