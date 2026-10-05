import type { Intent } from "../domain.js";

/**
 * ── MEMORY ─────────────────────────────────────────────────────
 *
 * The layer that makes the assistant remember a user across turns — the
 * difference between a stateless Q&A box and a "long-term relationship".
 *
 * Two kinds, deliberately separated:
 *   • SHORT-TERM — the recent conversation (last N turns) so a follow-up like
 *     "what about next month?" has the prior context.
 *   • LONG-TERM  — durable signal about the user, here the topics they ask about
 *     most, so the assistant can acknowledge recurring interests.
 *
 * A PORT (interface) like ServiceGateway / LlmProvider — the engine depends only
 * on this, so the in-memory adapter below can later be swapped for Redis / a
 * vector store (semantic long-term memory) without touching the pipeline.
 */
export interface ConversationTurn {
  question: string;
  answer: string;
  at: number; // epoch ms
}

export interface UserMemory {
  recentTurns: ConversationTurn[];
  interests: Intent[]; // most-asked topics first
}

export interface MemoryStore {
  /** Short-term: the most recent turns for this user (oldest → newest). */
  recentTurns(userId: string, limit?: number): ConversationTurn[];
  /** Record a completed Q&A turn (short-term). */
  appendTurn(userId: string, turn: ConversationTurn): void;
  /** Long-term: note that the user asked about `intent` (frequency signal). */
  recordIntent(userId: string, intent: Intent): void;
  /** Long-term: the user's topics, most-frequent first. */
  interests(userId: string, limit?: number): Intent[];
  /** Convenience: both kinds in one read. */
  load(userId: string): UserMemory;
}

/**
 * Default adapter: in-process, zero dependencies, bounded. Matches the engine's
 * "runs with zero secrets / zero external services" principle. Turns are capped
 * per user so memory can't grow without bound. Swap for Redis/vector in prod.
 */
export class InMemoryMemoryStore implements MemoryStore {
  private readonly turns = new Map<string, ConversationTurn[]>();
  private readonly intentCounts = new Map<string, Map<Intent, number>>();

  constructor(private readonly maxTurns = 6) {}

  recentTurns(userId: string, limit = this.maxTurns): ConversationTurn[] {
    const all = this.turns.get(userId) ?? [];
    return limit >= all.length ? all.slice() : all.slice(all.length - limit);
  }

  appendTurn(userId: string, turn: ConversationTurn): void {
    const list = this.turns.get(userId) ?? [];
    list.push(turn);
    // Keep only the most recent maxTurns — bounded memory.
    if (list.length > this.maxTurns) list.splice(0, list.length - this.maxTurns);
    this.turns.set(userId, list);
  }

  recordIntent(userId: string, intent: Intent): void {
    const counts = this.intentCounts.get(userId) ?? new Map<Intent, number>();
    counts.set(intent, (counts.get(intent) ?? 0) + 1);
    this.intentCounts.set(userId, counts);
  }

  interests(userId: string, limit = 3): Intent[] {
    const counts = this.intentCounts.get(userId);
    if (!counts) return [];
    return [...counts.entries()]
      .filter(([intent]) => intent !== "general") // "general" isn't a real interest
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([intent]) => intent);
  }

  load(userId: string): UserMemory {
    return { recentTurns: this.recentTurns(userId), interests: this.interests(userId) };
  }
}
