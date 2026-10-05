/**
 * Minimal in-memory TTL cache.
 *
 * The `Cache` interface is the seam that lets this be swapped for Redis in
 * production without touching call sites (see gateway/gateway.ts). It has one
 * implementation today — and that is deliberate: we abstract the thing that
 * genuinely changes (in-memory → distributed), nothing more.
 */
export interface Cache {
  getOrSet<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T>;
  stats(): { size: number; hits: number; misses: number };
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

export class InMemoryCache implements Cache {
  private store = new Map<string, Entry>();
  private hits = 0;
  private misses = 0;

  async getOrSet<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const entry = this.store.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      this.hits++;
      return entry.value as T;
    }
    if (entry) this.store.delete(key); // expired
    this.misses++;

    const value = await load();
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  stats() {
    return { size: this.store.size, hits: this.hits, misses: this.misses };
  }
}
