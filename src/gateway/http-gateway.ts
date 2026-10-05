import type { Kundli, Horoscope, Panchang, UserProfile } from "../domain.js";
import type { ServiceGateway } from "./gateway.js";

/**
 * Real HTTP implementation of the ServiceGateway port, talking to the upstream
 * services over the network. Kept intentionally thin: NO retry/timeout/cache
 * here — those live in ResilientGateway so the policy is shared with the mock
 * adapter. This adapter only knows how to make one request and surface errors.
 *
 * 4xx responses are tagged `noRetry` so the resilience layer won't retry them.
 */
export class HttpGateway implements ServiceGateway {
  constructor(private readonly baseUrl: string) {}

  getUser(userId: string): Promise<UserProfile> {
    return this.get<UserProfile>(`/users/${encodeURIComponent(userId)}`);
  }
  getKundli(userId: string): Promise<Kundli> {
    return this.get<Kundli>(`/kundli/${encodeURIComponent(userId)}`);
  }
  getHoroscope(userId: string): Promise<Horoscope> {
    return this.get<Horoscope>(`/horoscope/${encodeURIComponent(userId)}`);
  }
  getPanchang(): Promise<Panchang> {
    return this.get<Panchang>(`/panchang`);
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (res.status >= 400 && res.status < 500) {
      throw Object.assign(new Error(`HTTP ${res.status} for ${path}`), { noRetry: true });
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${path}`);
    }
    return (await res.json()) as T;
  }
}
