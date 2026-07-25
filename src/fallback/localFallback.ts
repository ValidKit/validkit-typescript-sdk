import { DisposableProvider, type DegradedVerificationResult, type LocalFallbackCheck } from '../types';
import { checkFormat, extractDomain, isPublicDomain } from './formatCheck';

/** Capped confidence for degraded verdicts. Meaningful only relative to each other. */
export const DEGRADED_CONFIDENCE = { formatOnly: 0.2, withMx: 0.5 } as const;

// node-email-verifier reports a transient DNS/resolver failure as `mx.valid: false` with one of
// these machine-readable errorCodes (rather than throwing). They are INCONCLUSIVE — a lookup that
// could not complete, NOT a domain that definitively has no MX (`NO_MX_RECORDS`). Treating them as
// conclusive would let a local DNS blip during an API outage reject a real address.
const INCONCLUSIVE_MX_CODES = new Set(['DNS_LOOKUP_FAILED', 'DNS_LOOKUP_TIMEOUT', 'MX_LOOKUP_FAILED']);

type ReasonCode = 'syn' | 'mx' | 'disp' | 'err' | 'unk';

/** node-email-verifier's verify function (or a test stub). Its output is read defensively. */
export type RawVerifier = (
  email: string,
  opts: { timeout: number; checkMx: boolean; checkDisposable: boolean }
) => Promise<unknown>;
export type LoadVerifier = () => Promise<RawVerifier | null>;

export interface LocalValidateOptions {
  /** Transport reason that caused degradation (used when the verdict is otherwise a pass). */
  reason: ReasonCode;
  /** Total wall-clock budget (ms) for the Tier 1 check. */
  mxTimeoutMs?: number;
  /** Injectable loader (defaults to the guarded, memoized dynamic import). */
  loadVerifier?: LoadVerifier;
}

let verifierPromise: Promise<RawVerifier | null> | undefined;

/** Test-only: clear the process-lifetime import memo (and the one-time warn) between tests. */
export function __resetVerifierMemo(): void {
  verifierPromise = undefined;
  warnedMissingPeer = false;
}

/**
 * Adapt node-email-verifier's `emailValidator(email, options)` to our RawVerifier contract.
 * Critical: `detailed: true` makes it return a ValidationResult OBJECT (it returns a bare boolean
 * otherwise), and `checkDisposable` must be forwarded or the disposable tier never runs.
 * Exported so the loader<->library option contract is unit-testable without the real package.
 */
export function buildVerifier(fn: (email: string, options: unknown) => Promise<unknown>): RawVerifier {
  return (email, opts) =>
    fn(email, {
      timeout: opts.timeout,
      checkMx: opts.checkMx,
      checkDisposable: opts.checkDisposable,
      detailed: true
    });
}

/** True only in a real Node runtime (has `process.versions.node`, no `window`). Exported so the
 *  client's telemetry environment label uses the SAME guard — an edge runtime with a polyfilled
 *  `process` but no `process.versions.node` is correctly classified as non-Node. */
export function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && !!process.versions?.node && typeof window === 'undefined';
}

/** node-email-verifier@4 declares `engines: node >=20`. @validkit/sdk itself supports older Node,
 *  so Tier 1 must not import the peer below this floor — it would run an unsupported verifier
 *  instead of the documented format-only degrade. */
export const MIN_TIER1_NODE_MAJOR = 20;

/** True when a Node version string meets the Tier 1 floor. Pure (takes the string) so the version
 *  gate is unit-testable without mutating process.versions. */
export function meetsTier1NodeFloor(nodeVersion: string | undefined): boolean {
  if (!nodeVersion) return false;
  const major = Number.parseInt(nodeVersion.split('.')[0], 10);
  return Number.isFinite(major) && major >= MIN_TIER1_NODE_MAJOR;
}

/** Tier 1 (MX + disposable) runs only on a real Node runtime at/above the peer's Node floor.
 *  Distinct from isNodeRuntime() (the telemetry label): a Node 18 host IS 'node', it just can't
 *  load the peer. */
function supportsLocalVerifier(): boolean {
  return isNodeRuntime() && meetsTier1NodeFloor(typeof process !== 'undefined' ? process.versions?.node : undefined);
}

let warnedMissingPeer = false;

/** One-time, non-production hint when local-fallback is opted into but the peer dep is absent. */
function warnMissingPeerOnce(): void {
  if (warnedMissingPeer) return;
  const env = typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
  if (env === 'production') return;
  warnedMissingPeer = true;
  // eslint-disable-next-line no-console
  console.warn(
    '[validkit] on_error local-fallback is degrading to format-only checks: node-email-verifier is not installed. Run: npm i node-email-verifier to enable MX + disposable checks.'
  );
}

async function defaultLoad(): Promise<RawVerifier | null> {
  // Node-only AND Node >= the peer's floor: browsers / edge have no DNS, and Node < 20 cannot run
  // node-email-verifier@4. Below the floor, degrade to the documented format-only path.
  if (!supportsLocalVerifier()) return null;
  try {
    // Variable specifier: keeps tsc from requiring the (optional, possibly-absent) peer at
    // compile time, and lets the guarded import degrade gracefully when it is not installed.
    const spec = 'node-email-verifier';
    const mod = (await import(spec)) as { default?: unknown } & Record<string, unknown>;
    const fn = (typeof mod.default === 'function' ? mod.default : mod) as unknown;
    if (typeof fn !== 'function') return null;
    return buildVerifier(fn as (e: string, o: unknown) => Promise<unknown>);
  } catch {
    // Resolve null (never reject) so a transient failure is not memoized as a rejected promise.
    return null;
  }
}

function loadVerifierMemoized(): Promise<RawVerifier | null> {
  if (!verifierPromise) verifierPromise = defaultLoad();
  return verifierPromise;
}

const TIMED_OUT = Symbol('timedOut');

/** Race a promise against a resolving timeout sentinel. The timer is cleared (and unref'd) so it
 *  never keeps the Node event loop alive after the work settles. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let handle: ReturnType<typeof setTimeout>;
  const timer = new Promise<typeof TIMED_OUT>((resolve) => {
    handle = setTimeout(() => resolve(TIMED_OUT), ms);
    const h = handle as { unref?: () => void };
    if (typeof h.unref === 'function') h.unref();
  });
  return Promise.race([p, timer]).finally(() => clearTimeout(handle));
}

/**
 * Map node-email-verifier's `disposable.provider` to our enum. v4 returns a DOMAIN
 * (e.g. 'mailinator.com'), not a bare key, so an exact-value match alone would collapse every
 * real hit to OTHER. Match the registrable label too; fall back to OTHER for anything unknown.
 * The verdict (`valid: false`) never depends on this — only the provider label does.
 */
function coerceProvider(p: unknown): DisposableProvider {
  if (typeof p !== 'string' || p.length === 0) return DisposableProvider.OTHER;
  const head = p.toLowerCase().split('.')[0]; // 'mailinator.com' -> 'mailinator'
  const known = (Object.values(DisposableProvider) as DisposableProvider[]).filter(
    (v) => v !== DisposableProvider.OTHER
  );
  // startsWith (not includes): the known brands are a PREFIX of their domain label
  // ('guerrillamail', 'mailinator'), so this maps them without the substring false-positive
  // that would map 'notmailinator' -> MAILINATOR.
  return known.find((k) => head.startsWith(k)) ?? DisposableProvider.OTHER;
}

/**
 * Tiered local validation. Tier 0 (format) always runs; Tier 1 (MX + disposable) runs only in
 * Node, for a public domain, when node-email-verifier is present. An INCONCLUSIVE MX result
 * (timeout / thrown / missing) degrades to the format-only floor — it NEVER flips a real address
 * to invalid. A conclusive disposable hit or conclusive MX-absent result is decisive.
 * Returns a DegradedVerificationResult (source: 'local-fallback'); never throws.
 */
export async function localValidate(
  email: string,
  opts: LocalValidateOptions
): Promise<DegradedVerificationResult> {
  const { reason, mxTimeoutMs = 2000, loadVerifier = loadVerifierMemoized } = opts;
  const fmt = checkFormat(email);
  const base = { success: true, email, degraded: true as const, source: 'local-fallback' as const };

  // Tier 0: a format failure is conclusive.
  if (!fmt.valid) {
    return { ...base, valid: false, format: fmt, checks_run: ['format'], degraded_reason: 'syn', confidence: 0 };
  }

  const formatFloor = (reasonCode: ReasonCode): DegradedVerificationResult => ({
    ...base,
    valid: true,
    format: fmt,
    checks_run: ['format'],
    degraded_reason: reasonCode,
    confidence: DEGRADED_CONFIDENCE.formatOnly
  });

  // Tier 1 gate: Node + public domain + verifier available. Guard the loader itself so an
  // injected/real loader that throws still degrades to the floor.
  if (!isPublicDomain(extractDomain(email))) return formatFloor(reason);
  // A zero/negative MX budget is an explicit opt-out of Tier 1: never START the verifier. Racing
  // verifier(...) against setTimeout(0) is not enough — a fast local disposable-list hit or cached
  // MX can win the 0ms race and reject, so gate BEFORE invoking. Return the documented format floor.
  if (mxTimeoutMs <= 0) return formatFloor(reason);
  let verifier: RawVerifier | null = null;
  try {
    verifier = await loadVerifier();
  } catch {
    verifier = null;
  }
  if (!verifier) {
    // On a Tier-1-capable Node runtime (>= node floor), a null verifier means the optional peer is
    // not installed — hint once (dev only). Below the floor the format-only degrade is expected
    // and documented, so stay silent rather than telling the user to install an unsupported peer.
    if (supportsLocalVerifier()) warnMissingPeerOnce();
    return formatFloor(reason);
  }

  let raw: unknown = TIMED_OUT;
  try {
    raw = await withTimeout(verifier(email, { timeout: mxTimeoutMs, checkMx: true, checkDisposable: true }), mxTimeoutMs);
  } catch {
    raw = TIMED_OUT; // a thrown verifier is inconclusive, not a definitive failure
  }

  // node-email-verifier (detailed:true) returns a ValidationResult. Read it DEFENSIVELY:
  //   disposable: { valid, provider } where valid===true means NOT disposable (inverted!)
  //   mx: { valid, records: MxRecord[] }  (records are { exchange, priority }, not strings)
  const result = raw as {
    mx?: { valid?: boolean; records?: Array<{ exchange?: string } | string>; errorCode?: unknown };
    disposable?: { valid?: boolean; provider?: unknown };
  };

  // Disposable: a hit is valid===false. Only meaningful when the verifier ran and reported it.
  const hasDisposable = raw !== TIMED_OUT && typeof result?.disposable?.valid === 'boolean';
  const isDisposable = hasDisposable && result.disposable!.valid === false;
  const disposable = hasDisposable
    ? {
        valid: !isDisposable,
        value: isDisposable,
        ...(result.disposable!.provider != null ? { provider: coerceProvider(result.disposable!.provider) } : {}),
        source: 'node-email-verifier'
      }
    : undefined;

  // MX is CONCLUSIVE only when the verifier returned a boolean AND that boolean is trustworthy. A
  // `valid:false` carrying a lookup-failure errorCode is a transient DNS/resolver failure, not a
  // definitive no-MX result, so treat it (like a timeout/throw) as INCONCLUSIVE -> the format floor.
  const mxReturnedBool = raw !== TIMED_OUT && typeof result?.mx?.valid === 'boolean';
  const mxErrorCode = typeof result?.mx?.errorCode === 'string' ? result.mx!.errorCode : undefined;
  const mxLookupFailed =
    mxReturnedBool && result.mx!.valid === false && mxErrorCode !== undefined && INCONCLUSIVE_MX_CODES.has(mxErrorCode);
  // node-email-verifier SKIPS the MX lookup for a disposable hit (errorCode MX_SKIPPED_DISPOSABLE):
  // MX was never performed, so it is neither conclusive nor even attempted. Treat it as unknown and
  // omit 'mx' from checks_run below, rather than reporting a definitive no-MX verdict.
  const mxSkipped = mxReturnedBool && result.mx!.valid === false && mxErrorCode === 'MX_SKIPPED_DISPOSABLE';
  const mxKnown = mxReturnedBool && !mxLookupFailed && !mxSkipped;
  const mxValid = mxKnown && result.mx!.valid === true;
  const records = mxKnown
    ? (result.mx!.records ?? [])
        .map((r) => (typeof r === 'string' ? r : r.exchange))
        .filter((e): e is string => typeof e === 'string')
    : [];
  const mx = mxKnown
    ? { valid: mxValid, ...(records.length ? { records } : {}) }
    : { valid: false, reason: 'unknown' };

  // 'mx' means the MX lookup was actually performed (returned a verdict). Require mxReturnedBool so
  // a total timeout/throw (raw === TIMED_OUT) does not claim MX was checked, and exclude the
  // disposable skip. A lookup-failure verdict still counts — it ran, just inconclusively.
  const checks: LocalFallbackCheck[] = ['format'];
  if (mxReturnedBool && !mxSkipped) checks.push('mx');
  if (hasDisposable) checks.push('disposable');

  // Precedence: syn (handled above) > disp > mx (conclusive) > unk (inconclusive floor).
  if (isDisposable) {
    return { ...base, valid: false, format: fmt, mx, disposable, checks_run: checks, degraded_reason: 'disp', confidence: DEGRADED_CONFIDENCE.formatOnly };
  }
  // Inconclusive MX (timeout / thrown / no boolean verdict) -> floor; NEVER flip to invalid.
  if (!mxKnown) {
    return { ...base, valid: true, format: fmt, mx, disposable, checks_run: checks, degraded_reason: 'unk', confidence: DEGRADED_CONFIDENCE.formatOnly };
  }
  // Conclusive MX-absent.
  if (!mxValid) {
    return { ...base, valid: false, format: fmt, mx, disposable, checks_run: checks, degraded_reason: 'mx', confidence: DEGRADED_CONFIDENCE.formatOnly };
  }
  // Format ok, MX present, not disposable.
  return { ...base, valid: true, format: fmt, mx, disposable, checks_run: checks, degraded_reason: reason, confidence: DEGRADED_CONFIDENCE.withMx };
}
