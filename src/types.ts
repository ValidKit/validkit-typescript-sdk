/**
 * ValidKit SDK Types - TypeScript-First with Developer Pattern Intelligence
 *
 * Provides comprehensive TypeScript definitions for the ValidKit Email Verification API
 * Built for high-performance batch processing and intelligent pattern recognition
 */

// Type-only import (erased at compile time) — avoids a runtime cycle with the fallback modules.
import type { DegradedBeaconSink } from './fallback/telemetry';

/**
 * Developer email pattern classifications
 */
export type PatternType =
  | 'developer_test'    // test@, demo@, sandbox@
  | 'plus_addressing'   // user+tag@gmail.com
  | 'system_email'     // noreply@, notifications@
  | 'role_based'       // admin@, support@
  | 'temporary'        // disposable email services
  | 'development_env'  // dev@, staging@
  | 'ci_cd'           // github@, build@
  | 'regular'         // standard email patterns

/**
 * Plus addressing parsing result
 */
export interface PlusAddressingInfo {
  hasPlusAddressing: boolean
  baseEmail?: string
  tag?: string
}

/**
 * Domain classification information
 */
export interface DomainInfo {
  category: string
  platform?: string
  isTemporary?: boolean
  developerFriendly: boolean
  supportsPlusAddressing?: boolean
  confidence: number
}

/**
 * Email pattern classification result
 */
export interface EmailClassification {
  pattern_type: PatternType
  developer_friendly: boolean
  confidence: number
  plus_addressing?: PlusAddressingInfo
  domain_info?: DomainInfo
  metadata: Record<string, unknown>
  error?: string
}

/**
 * Recommendation for handling the email
 */
export interface EmailRecommendation {
  action: 'accept' | 'accept_with_warning' | 'accept_with_flag' | 'normalize' | 'flag' | 'accept_for_dev'
  reason: string
  suggestion: string
}

/**
 * Response format options for AI agent optimization
 */
export enum ResponseFormat {
  /** Full detailed response with all validation checks */
  FULL = 'full',
  /** Compact response optimized for tokens (80% smaller) */
  COMPACT = 'compact'
}

/**
 * Email verification status
 */
export enum VerificationStatus {
  VALID = 'valid',
  INVALID = 'invalid',
  UNKNOWN = 'unknown'
}

/**
 * Known disposable email providers
 */
export enum DisposableProvider {
  TEMPMAIL = 'tempmail',
  GUERRILLA = 'guerrilla',
  MAILINATOR = 'mailinator',
  YOPMAIL = 'yopmail',
  OTHER = 'other'
}

/**
 * Batch job status for async processing
 */
export enum BatchJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Email format validation result
 */
export interface FormatCheck {
  valid: boolean
  reason?: string
}

/**
 * Disposable email detection result
 */
export interface DisposableCheck {
  valid: boolean
  /** True if email is disposable */
  value: boolean
  provider?: DisposableProvider
  /** Origin of the disposable verdict (e.g. 'api' or 'node-email-verifier'). Additive. */
  source?: string
}

/**
 * MX record validation result
 */
export interface MXCheck {
  valid: boolean
  records?: string[]
  priority?: number[]
  /** Set to 'unknown' when an MX lookup was inconclusive (e.g. local-fallback timeout). Additive. */
  reason?: string
}

/**
 * SMTP validation result
 */
export interface SMTPCheck {
  valid: boolean
  code?: number
  message?: string
}

/**
 * Where a verdict was produced.
 * - 'api': a full verdict from the ValidKit API
 * - 'local-fallback': a degraded verdict from a local check that actually ran
 * - 'fail-open': a blind accept (no checks ran) under on_error:'fail-open'
 */
export type VerdictSource = 'api' | 'local-fallback' | 'fail-open'

/** The local checks the fallback can run, in escalation order. */
export type LocalFallbackCheck = 'format' | 'mx' | 'disposable'

/** Compact reason codes, shared by the bulk API and local-fallback degradation. */
export type DegradedReason = 'syn' | 'mx' | 'disp' | 'err' | 'unk'

/**
 * Full email verification result with detailed checks
 */
export interface EmailVerificationResult {
  success: boolean
  email: string
  valid: boolean

  // Detailed validation checks
  format?: FormatCheck
  disposable?: DisposableCheck
  mx?: MXCheck
  smtp?: SMTPCheck

  // Degradation discriminant (set on full-format verifyEmail verdicts — API and fallback —
  // so consumers never branch on field absence; see DegradedVerificationResult / isDegraded).
  /** true for a local-fallback / fail-open verdict, false for a full API verdict. */
  degraded?: boolean
  /** Where the verdict was produced. */
  source?: VerdictSource
  /** Which local checks ran (meaningful only when degraded). */
  checks_run?: LocalFallbackCheck[]
  /**
   * Compact reason code for degradation, reusing the existing compact vocabulary.
   * NOTE: 'err' here means a transport failure (API unreachable), distinct from a
   * validation 'err' in the compact bulk API.
   */
  degraded_reason?: DegradedReason
  /**
   * Confidence in [0,1]. Meaningful ONLY when degraded:true (withMx 0.5 > formatOnly 0.2).
   * The API path does not set a comparable confidence, so there is no cross-path ordering.
   */
  confidence?: number

  // Performance and tracing metadata
  processing_time_ms?: number
  timestamp?: string
  trace_id?: string
  request_id?: string

  // Cache and Signal Pool info
  cached?: boolean
  warning?: string
  signal_pool?: {
    contributed: boolean
    reward_earned: boolean
    reward_amount?: number
    pool_size?: number
  }

  // Developer Pattern Intelligence (new fields)
  pattern_type?: PatternType
  developer_friendly?: boolean
  classification?: EmailClassification
  recommendations?: EmailRecommendation[]
}

/**
 * Email verification result with developer pattern intelligence
 * Extends base result with pattern classification fields
 */
export interface DeveloperPatternResult extends EmailVerificationResult {
  pattern_type?: PatternType
  developer_friendly?: boolean
  classification?: EmailClassification
  recommendations?: EmailRecommendation[]
}

/**
 * Compact verification result for token efficiency (80% smaller)
 * Optimized for AI agents processing large batches
 * Now includes pattern intelligence fields
 */
export interface CompactResult {
  /** Valid */
  v: boolean
  /** Disposable (optional - only present if true) */
  d?: boolean
  /** Reason if invalid (only present when v=false) */
  r?: string
  /** Pattern type (optional - when pattern intelligence is available) */
  p?: PatternType
  /** Developer friendly (optional - when pattern intelligence is available) */
  df?: boolean
  /** Optional trace ID */
  trace_id?: string
}

/**
 * Batch verification response
 */
export interface BatchVerificationResult {
  success: boolean
  total: number
  valid: number
  invalid: number
  results: Record<string, DeveloperPatternResult | CompactResult>

  // Batch metadata
  batch_id?: string
  processing_time_ms?: number
  timestamp?: string
  trace_id?: string
  request_id?: string

  // Rate limiting information
  rate_limit?: number
  rate_remaining?: number
  rate_reset?: number
}

/**
 * Async batch job information for large email lists (10K+)
 */
export interface BatchJob {
  id: string
  status: BatchJobStatus
  total_emails: number
  processed: number
  valid: number
  invalid: number

  // Job management URLs
  status_url?: string
  results_url?: string
  cancel_url?: string

  // Webhook configuration
  webhook_url?: string
  webhook_status?: string

  // Timestamps
  created_at: string
  updated_at: string
  completed_at?: string

  // Error handling
  error?: string
  failed_emails?: string[]
}

/**
 * Webhook payload for batch completion notifications
 */
export interface WebhookPayload {
  event: string
  batch_id: string
  status: BatchJobStatus
  results: BatchVerificationResult
  timestamp: string
  signature?: string
}

/**
 * SDK Configuration options
 */
export interface ValidKitConfig {
  /** API key for authentication */
  api_key: string
  /** Base URL for the API (default: https://api.validkit.com) */
  base_url?: string
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Maximum number of retries for failed requests (default: 3) */
  max_retries?: number
  /** Default chunk size for batch processing (default: 1000) */
  default_chunk_size?: number
  /** Custom User-Agent string */
  user_agent?: string
  /**
   * Behavior when the API is unreachable after all retries are exhausted (additive — SemVer MINOR).
   * - 'throw' (default): re-throw the original error instance (block the signup)
   * - 'fail-open': accept unvalidated (valid:true, degraded:true, source:'fail-open', no checks)
   * - 'local-fallback': degrade to a local check (format always; MX + disposable if opted in)
   * Only affects verifyEmail; ConnectionError / TimeoutError / retryable ServerError (5xx) trigger it.
   */
  on_error?: 'throw' | 'fail-open' | 'local-fallback'
  /**
   * Total wall-clock budget (ms) for the Tier 1 MX/disposable local check (default 2000).
   * Additive to any preceding API retry/timeout budget, not a replacement for it.
   */
  local_fallback_mx_timeout?: number
  /**
   * Optional telemetry sink for degraded-fallback beacons (domain-only, PII-safe). #3402 wires
   * the real transport; until then this is the seam. A throwing/absent sink never breaks fallback.
   */
  telemetrySink?: DegradedBeaconSink
}

/**
 * Options for single email verification
 */
export interface VerifyEmailOptions {
  /** Response format (default: full for pattern intelligence) */
  format?: ResponseFormat
  /** Optional trace ID for multi-agent correlation */
  trace_id?: string
  /** Optional parent ID for hierarchical tracing */
  parent_id?: string
  /** Enable debug mode for detailed validation steps */
  debug?: boolean
  /** Share validation results with Agent Signal Pool™ (Pro+ tiers only) */
  share_signals?: boolean
  /** Include pattern intelligence classification (default: true) */
  include_patterns?: boolean
  /**
   * Abort the in-flight request — and any pending retry delay — when this signal fires.
   * On abort, verifyEmail rejects with the SDK's own AbortError (never a raw fetch
   * DOMException) and never falls back to fail-open/local-fallback. Discriminate with
   * `instanceof AbortError` or `error.code === 'ABORTED'` — not `error.name`, since a native
   * fetch abort also carries `name: 'AbortError'`.
   */
  signal?: AbortSignal
}

/**
 * Options for batch email verification
 */
export interface VerifyBatchOptions {
  /** Response format (default: compact for efficiency) */
  format?: ResponseFormat
  /** Chunk size for processing (default: 1000) */
  chunk_size?: number
  /** Progress callback function for large batches */
  progress_callback?: (processed: number, total: number) => void
  /** Optional trace ID for multi-agent correlation */
  trace_id?: string
  /** Optional parent ID for hierarchical tracing */
  parent_id?: string
  /** Enable debug mode for detailed validation steps */
  debug?: boolean
  /** Share validation results with Agent Signal Pool™ (Pro+ tiers only) */
  share_signals?: boolean
}

/**
 * Options for async batch processing (10K+ emails)
 */
export interface VerifyBatchAsyncOptions {
  /** Response format (default: compact) */
  format?: ResponseFormat
  /** Webhook URL for completion notification */
  webhook_url?: string
  /** Optional trace ID for multi-agent correlation */
  trace_id?: string
  /** Optional parent ID for hierarchical tracing */
  parent_id?: string
}

/**
 * Agent bulk verification compact result
 */
export interface AgentCompactResult {
  /** Index in the input array */
  i: number
  /** Valid flag (1 = valid, 0 = invalid) */
  v: 0 | 1
  /** Disposable flag (1 = disposable, only present if true) */
  d?: 0 | 1
  /** Error code (only present if invalid) */
  e?: DegradedReason
}

/**
 * Agent bulk verification response (compact format)
 */
export interface AgentBulkCompactResponse {
  /** Request ID */
  id: string
  /** Trace ID */
  tid: string
  /** Array of results */
  results: AgentCompactResult[]
  /** Statistics */
  stats: {
    /** Total emails */
    t: number
    /** Valid count */
    v: number
    /** Processing time in milliseconds */
    ms: number
    /** Emails per second */
    eps: number
  }
}

/**
 * Agent bulk verification response (verbose format)
 */
export interface AgentBulkVerboseResponse {
  success: boolean
  request_id: string
  trace_id: string
  total: number
  valid: number
  invalid: number
  processing_time_ms: number
  emails_per_second: number
  results: Array<{
    index: number
    email: string
    valid: boolean
    disposable: boolean
    reason?: string
    // Pattern intelligence fields
    pattern_type?: PatternType
    developer_friendly?: boolean
    classification?: EmailClassification
  }>
  error_summary?: {
    syn?: number
    mx?: number
    disp?: number
    err?: number
    unk?: number
  }
  pattern_summary?: Record<PatternType, number>
}

/**
 * Progress callback function type for batch processing
 */
export type ProgressCallback = (processed: number, total: number) => void

/**
 * Pattern analysis result for bulk operations
 */
export interface PatternAnalysis {
  total: number
  valid: number
  patterns: Record<PatternType, number>
  developer_friendly_count: number
  recommendations: Record<string, string[]>
  confidence_distribution: {
    high: number    // confidence >= 0.9
    medium: number  // confidence >= 0.7
    low: number     // confidence < 0.7
  }
}

/**
 * Smart validation decision based on pattern classification
 */
export interface ValidationDecision {
  allow: boolean
  message: string
  confidence?: number
  production_ready?: boolean
  normalized_email?: string
  warnings?: string[]
}

/**
 * ValidKit API Error details
 */
export interface ValidKitErrorDetails {
  code: string
  message: string
  statusCode?: number
  details?: Record<string, unknown>
  retry_after?: number
  limit?: number
  reset?: number
  upgrade_url?: string
  help_url?: string
  support?: string
  feature?: string
  current_plan?: string
  required_plan?: string
  used?: number
  resets_at?: string
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
  retry_after?: number
}

/**
 * Type guard functions for pattern classification
 */
export function isDeveloperTest(result: DeveloperPatternResult): boolean {
  return result.pattern_type === 'developer_test';
}

export function isPlusAddressing(result: DeveloperPatternResult): result is DeveloperPatternResult & {
  pattern_type: 'plus_addressing'
  classification: EmailClassification & {
    plus_addressing: PlusAddressingInfo
  }
} {
  return result.pattern_type === 'plus_addressing' &&
         !!result.classification?.plus_addressing?.hasPlusAddressing;
}

export function isSystemEmail(result: DeveloperPatternResult): boolean {
  return result.pattern_type === 'system_email';
}

export function isTemporary(result: DeveloperPatternResult): boolean {
  return result.pattern_type === 'temporary';
}

export function isDeveloperFriendly(result: DeveloperPatternResult): boolean {
  return result.developer_friendly === true;
}

/**
 * A verdict produced by local fallback or a blind fail-open — never by the API.
 * Discriminated on `degraded` / `source`. A degraded format-only pass is intentionally
 * NOT field-equivalent to a full API pass (lower, capped confidence; checks_run recorded).
 */
export interface DegradedVerificationResult extends EmailVerificationResult {
  degraded: true
  source: 'local-fallback' | 'fail-open'
  checks_run: LocalFallbackCheck[]
  degraded_reason: DegradedReason
  confidence: number
}

/**
 * Type guard: true when a verdict is a complete degraded verdict (local-fallback or fail-open).
 * Checks ALL fields the narrowed type promises, so the narrow is sound — a consumer can rely on
 * `checks_run` / `degraded_reason` / `confidence` being present after this returns true.
 *
 * The parameter is the full `verifyEmail` return union (`EmailVerificationResult` covers the
 * `DeveloperPatternResult`/`DegradedVerificationResult` members; `CompactResult` is added
 * explicitly) so a compact-format caller can branch on `isDegraded(result)` WITHOUT a cast — a
 * `CompactResult` has no `degraded` field and simply returns false. Fields are read via a
 * `Partial` view because `CompactResult` does not declare them.
 */
export function isDegraded(
  result: EmailVerificationResult | CompactResult
): result is DegradedVerificationResult {
  const r = result as Partial<DegradedVerificationResult>;
  return (
    r.degraded === true &&
    (r.source === 'local-fallback' || r.source === 'fail-open') &&
    Array.isArray(r.checks_run) &&
    r.degraded_reason !== undefined &&
    typeof r.confidence === 'number'
  );
}
