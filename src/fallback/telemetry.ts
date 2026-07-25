import { extractDomain } from './formatCheck';
import type { DegradedVerificationResult } from '../types';

/**
 * The beacon tier is the deepest CONCLUSIVE tier a degraded verdict reached:
 *  - a disposable hit  -> 'disposable'
 *  - a conclusive MX verdict (records present, OR a definitive no-MX) -> 'mx'
 *  - an inconclusive MX (timeout / DNS-lookup failure that degraded to the floor) or a
 *    format-only result (Tier 1 never ran) -> 'format'
 * Keying off `checks_run.includes('mx')` would over-report an inconclusive MX as 'mx'; a clean
 * Tier-1 pass carries the transport `degraded_reason` (e.g. 'err') so `mx?.valid === true` is what
 * distinguishes a conclusive-present verdict.
 */
export function degradedTier(
  result: Pick<DegradedVerificationResult, 'degraded_reason' | 'mx'>
): 'disposable' | 'mx' | 'format' {
  if (result.degraded_reason === 'disp') return 'disposable';
  if (result.degraded_reason === 'mx' || result.mx?.valid === true) return 'mx';
  return 'format';
}

export interface DegradedBeaconInput {
  email: string;
  tier: 'format' | 'mx' | 'disposable' | 'none';
  errorClass: string;
  environment: 'node' | 'browser';
}

/**
 * Degraded-fallback telemetry payload. Domain-only by design: no raw email and no hashed email
 * (an unsalted client-side hash over a low-entropy email is brute-forceable, not anonymization).
 */
export interface DegradedBeaconPayload {
  event: 'sdk.local_fallback.degraded';
  domain: string;
  tier: string;
  error_class: string;
  environment: string;
}

/** Telemetry transport. #3402 wires the real sink here; until then a caller may pass one or omit it. */
export type DegradedBeaconSink = (payload: DegradedBeaconPayload) => void;

/**
 * Domain-only AND log-injection-safe. `verifyEmail` accepts any non-empty string, so a malformed
 * address (e.g. `a@evil.com\ninjected line`) would otherwise leak arbitrary user-controlled text —
 * including newlines that forge log entries — into the beacon's `domain`. Allow only DNS-safe
 * characters within the RFC length bound; anything else collapses to '' (unknown/malformed).
 */
export function safeDomain(email: string): string {
  const domain = extractDomain(email);
  return /^[a-z0-9.-]{1,253}$/.test(domain) ? domain : '';
}

let warnedSinkFailure = false;

/** One-time, non-production warning so a misconfigured (throwing) sink is not itself silent. */
function warnSinkFailureOnce(): void {
  if (warnedSinkFailure) return;
  const env = typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
  if (env === 'production') return;
  warnedSinkFailure = true;
  // eslint-disable-next-line no-console
  console.warn('[validkit] degraded-telemetry sink threw and was ignored; fallback continued. Check your telemetrySink.');
}

/**
 * Emit a degraded beacon through the provided sink, if any. Guarded seam: a missing sink is a
 * no-op (the verdict's degraded:true discriminant still flags the degradation in-band) and a
 * throwing sink is swallowed, so telemetry can never break the fallback path. A throwing sink
 * also triggers a one-time dev warning so a broken telemetry seam does not go unnoticed.
 */
export function emitDegradedBeacon(sink: DegradedBeaconSink | undefined, input: DegradedBeaconInput): void {
  if (!sink) return;
  try {
    const returned: unknown = sink({
      event: 'sdk.local_fallback.degraded',
      domain: safeDomain(input.email),
      tier: input.tier,
      error_class: input.errorClass,
      environment: input.environment
    });
    // A sink typed `=> void` may still be an async function at runtime (network beacons commonly
    // are). The sync try/catch cannot see a REJECTED promise, so observe it here — otherwise a
    // failing async sink surfaces as an unhandled rejection that could crash the host, breaking the
    // very "telemetry can never break the fallback path" guarantee. Best-effort, fire-and-forget.
    if (returned && typeof (returned as { then?: unknown }).then === 'function') {
      void (returned as Promise<unknown>).catch(() => warnSinkFailureOnce());
    }
  } catch {
    // Telemetry must never break the fallback path.
    warnSinkFailureOnce();
  }
}
