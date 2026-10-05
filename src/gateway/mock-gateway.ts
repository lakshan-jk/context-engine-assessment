import type { Kundli, Horoscope, Panchang, ServiceName, UserProfile } from "../domain.js";
import type { ServiceGateway } from "./gateway.js";
import { fixtures } from "./fixtures.js";

export interface MockGatewayOptions {
  /** Services configured to fail — lets us demonstrate graceful degradation. */
  failServices?: string[];
  /** Artificial latency (ms) added to every response. */
  latencyMs?: number;
}

/**
 * In-process implementation of the ServiceGateway port (the default).
 *
 * It serves deterministic fixtures and can inject latency and failures via
 * config, which is how the resilience layer and the partial-failure/degradation
 * paths get exercised without any network setup.
 */
export class MockGateway implements ServiceGateway {
  private readonly fail: Set<string>;
  private readonly latencyMs: number;

  constructor(opts: MockGatewayOptions = {}) {
    this.fail = new Set(opts.failServices ?? []);
    this.latencyMs = opts.latencyMs ?? 0;
  }

  getUser(userId: string): Promise<UserProfile> {
    return this.respond("user", () => fixtures.user(userId));
  }
  getKundli(userId: string): Promise<Kundli> {
    return this.respond("kundli", () => fixtures.kundli(userId));
  }
  getHoroscope(userId: string): Promise<Horoscope> {
    return this.respond("horoscope", () => fixtures.horoscope(userId));
  }
  getPanchang(): Promise<Panchang> {
    return this.respond("panchang", () => fixtures.panchang());
  }

  private async respond<T>(service: ServiceName, produce: () => T): Promise<T> {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs));
    if (this.fail.has(service)) {
      throw new Error(`Injected failure for "${service}" service`);
    }
    return produce();
  }
}
