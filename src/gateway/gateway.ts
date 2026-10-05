import type { Kundli, Horoscope, Panchang, UserProfile } from "../domain.js";
import type { Cache } from "../infra/cache.js";
import type { Logger } from "../infra/logger.js";

/**
 * ── PORT 1: the upstream services ──────────────────────────────
 *
 * The engine depends only on this interface, never on how the data is fetched.
 * Two adapters implement it — an in-process mock (default) and a real HTTP
 * client — and the ResilientGateway decorator below wraps EITHER of them with
 * caching + retry + timeout. That the same decorator works over both is the
 * whole point of having the port.
 */
export interface ServiceGateway {
  getUser(userId: string): Promise<UserProfile>;
  getKundli(userId: string): Promise<Kundli>;
  getHoroscope(userId: string): Promise<Horoscope>;
  getPanchang(): Promise<Panchang>;
}

export interface ResilienceOptions {
  timeoutMs: number;
  retries: number;
  cacheTtlMs: number;
}

/**
 * Decorates any ServiceGateway with the cross-cutting resilience concerns:
 *   • read-through cache (per-user for profile/kundli/horoscope; per-date for panchang)
 *   • bounded retry with exponential backoff + jitter
 *   • hard per-attempt timeout
 *
 * The concrete adapter stays dumb ("fetch one thing"); the policy lives here,
 * in one place, testable in isolation.
 */
export class ResilientGateway implements ServiceGateway {
  constructor(
    private readonly inner: ServiceGateway,
    private readonly cache: Cache,
    private readonly opts: ResilienceOptions,
    private readonly log: Logger,
  ) {}

  getUser(userId: string): Promise<UserProfile> {
    return this.cache.getOrSet(`user:${userId}`, this.opts.cacheTtlMs, () =>
      this.call("user", () => this.inner.getUser(userId)),
    );
  }

  getKundli(userId: string): Promise<Kundli> {
    return this.cache.getOrSet(`kundli:${userId}`, this.opts.cacheTtlMs, () =>
      this.call("kundli", () => this.inner.getKundli(userId)),
    );
  }

  getHoroscope(userId: string): Promise<Horoscope> {
    return this.cache.getOrSet(`horoscope:${userId}`, this.opts.cacheTtlMs, () =>
      this.call("horoscope", () => this.inner.getHoroscope(userId)),
    );
  }

  getPanchang(): Promise<Panchang> {
    // Panchang is the same for every user on a given day → cache by date.
    const day = new Date().toISOString().slice(0, 10);
    return this.cache.getOrSet(`panchang:${day}`, this.opts.cacheTtlMs, () =>
      this.call("panchang", () => this.inner.getPanchang()),
    );
  }

  /** Retry + timeout wrapper shared by every call. */
  private async call<T>(label: string, fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.opts.retries; attempt++) {
      try {
        return await withTimeout(fn(), this.opts.timeoutMs, label);
      } catch (err) {
        lastErr = err;
        // 4xx-style errors are marked non-retryable by the adapter.
        if ((err as { noRetry?: boolean }).noRetry || attempt === this.opts.retries) break;
        const backoff = Math.min(2 ** attempt * 50, 500) + Math.floor(Math.random() * 50);
        this.log.warn("upstream retry", { service: label, attempt: attempt + 1, backoff });
        await sleep(backoff);
      }
    }
    throw lastErr;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Rejects with a TimeoutError if the promise does not settle in time. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms calling ${label}`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
