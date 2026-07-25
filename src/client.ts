/**
 * ValidKit TypeScript SDK - AI Agent Optimized
 *
 * High-performance email verification client designed for AI agents
 * Supports batch processing up to 10K emails with token-optimized responses
 */

import fetch from 'cross-fetch';
import {
  ValidKitConfig,
  DeveloperPatternResult,
  BatchVerificationResult,
  BatchJob,
  CompactResult,
  ResponseFormat,
  VerifyEmailOptions,
  VerifyBatchOptions,
  VerifyBatchAsyncOptions,
  ValidKitErrorDetails,
  RateLimitInfo,
  AgentBulkCompactResponse,
  AgentBulkVerboseResponse,
  PatternType,
  EmailClassification,
  EmailRecommendation,
  FormatCheck,
  DisposableCheck,
  MXCheck,
  SMTPCheck,
  DegradedVerificationResult
} from './types';
import { localValidate, isNodeRuntime } from './fallback/localFallback';
import { emitDegradedBeacon, degradedTier, type DegradedBeaconSink } from './fallback/telemetry';
import {
  ValidKitError,
  InvalidAPIKeyError,
  RateLimitError,
  BatchSizeError,
  TimeoutError,
  ConnectionError,
  ServerError,
  ValidationError,
  AbortError
} from './errors';

// Constants
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_CHUNK_SIZE = 1000;
const MAX_BATCH_SIZE = 10000;
const RETRY_BASE_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

/** API response shape from single email verification endpoint */
interface VerifyApiResponse {
  success: boolean;
  email: string;
  result: {
    valid: boolean;
    format?: FormatCheck;
    disposable?: DisposableCheck;
    mx?: MXCheck;
    smtp?: SMTPCheck;
    validation_time_ms?: number;
    processing_time_ms?: number;
  };
  timestamp?: string;
  trace_id?: string;
  request_id?: string;
  cached?: boolean;
  warning?: string;
  signal_pool?: {
    contributed: boolean;
    reward_earned: boolean;
    reward_amount?: number;
    pool_size?: number;
  };
  pattern_type?: string;
  developer_friendly?: boolean;
  classification?: EmailClassification;
  recommendations?: EmailRecommendation[];
}

/** Individual entry in batch API response */
interface BatchResultEntry {
  email?: string;
  success?: boolean;
  result?: {
    valid: boolean;
    format?: FormatCheck;
    disposable?: DisposableCheck;
    mx?: MXCheck;
    smtp?: SMTPCheck;
    validation_time_ms?: number;
    processing_time_ms?: number;
  };
  pattern_type?: string;
  developer_friendly?: boolean;
  classification?: EmailClassification;
  recommendations?: EmailRecommendation[];
}

/**
 * ValidKit client for email verification with developer pattern intelligence
 *
 * Features:
 * - Developer pattern recognition (test@, plus addressing, system emails)
 * - Full TypeScript support with pattern classification
 * - Agent-scale rate limits (1,000+ req/min)
 * - Bulk processing (10,000+ emails per request)
 * - Token-optimized responses (80% smaller)
 * - Multi-agent tracing capabilities
 * - Async processing with webhooks
 */
export class ValidKit {
  // telemetrySink is intentionally excluded — it is genuinely optional (may be undefined) and is
  // stored as a separate field rather than forced into the Required<> config.
  private readonly config: Required<Omit<ValidKitConfig, 'telemetrySink'>>;
  private readonly telemetrySink?: DegradedBeaconSink;
  private readonly baseHeaders: Record<string, string>;

  constructor(config: ValidKitConfig) {
    if (!config.api_key) {
      throw new InvalidAPIKeyError('API key is required');
    }

    this.config = {
      api_key: config.api_key,
      base_url: config.base_url || 'https://api.validkit.com',
      timeout: config.timeout || DEFAULT_TIMEOUT,
      // ?? not ||: max_retries: 0 is the documented opt-out for the 502/504
      // auto-retry (each retry may consume a validation credit, #3496) — a
      // falsy-coercing default would silently re-enable 3 retries.
      max_retries: config.max_retries ?? 3,
      default_chunk_size: config.default_chunk_size || DEFAULT_CHUNK_SIZE,
      user_agent: config.user_agent || 'ValidKit TypeScript SDK/1.1.0 (AI Agent Optimized)',
      on_error: config.on_error || 'throw',
      // ?? not ||: an explicit `0` opts out of the Tier 1 network budget (immediate timeout ->
      // format-only floor). A falsy-coercing default would silently override it back to 2000ms.
      local_fallback_mx_timeout: config.local_fallback_mx_timeout ?? 2000
    };
    this.telemetrySink = config.telemetrySink;

    this.baseHeaders = {
      'Authorization': `Bearer ${this.config.api_key}`,
      'Content-Type': 'application/json',
      'User-Agent': this.config.user_agent,
      'X-SDK-Version': '1.1.0',
      'X-SDK-Language': 'typescript'
    };
  }

  /**
   * Verify a single email address with developer pattern intelligence
   *
   * @param email - Email address to verify
   * @param options - Verification options
   * @returns Promise<DeveloperPatternResult | CompactResult | DegradedVerificationResult>
   *
   * NOTE: when `on_error` is `'fail-open'` or `'local-fallback'` and the API is unreachable after
   * retries, this returns a full-shape `DegradedVerificationResult` REGARDLESS of the requested
   * `format` (including `'compact'`). Callers reading the compact `{ v, d }` shape should branch on
   * `isDegraded(result)` first, since a degraded verdict is keyed on `valid`/`email`, not `v`.
   */
  async verifyEmail(
    email: string,
    options: VerifyEmailOptions = {}
  ): Promise<DeveloperPatternResult | CompactResult | DegradedVerificationResult> {
    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email must be a non-empty string');
    }

    const { format = ResponseFormat.FULL, trace_id, parent_id, debug = false, share_signals, signal } = options;

    const headers = { ...this.baseHeaders };
    if (trace_id) {
      headers['X-Trace-ID'] = trace_id;
    }
    if (parent_id) {
      headers['X-Parent-ID'] = parent_id;
    }

    try {
      return await this.requestVerify(email, format, debug, share_signals, headers, signal);
    } catch (err) {
      return this.handleVerifyError(email, err);
    }
  }

  /** Issue the /verify request and shape the API response. Throws on transport failure. */
  private async requestVerify(
    email: string,
    format: ResponseFormat,
    debug: boolean,
    share_signals: boolean | undefined,
    headers: Record<string, string>,
    signal?: AbortSignal
  ): Promise<DeveloperPatternResult | CompactResult> {
    const response = await this.makeRequest<VerifyApiResponse>('/api/v1/verify', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        format,
        debug,
        ...(share_signals !== undefined && { share_signals })
      })
    }, 0, signal);

    // Extract the actual verification result from the API response
    const apiResponse = response.data;

    // V1 API always returns full format, regardless of format parameter
    // The response has a nested structure with 'result' field
    if ('result' in apiResponse && 'email' in apiResponse) {
      const result = apiResponse.result;

      // If compact format was requested, transform to compact
      if (format === ResponseFormat.COMPACT) {
        // Transform to compact format client-side since V1 doesn't support it
        const compactResult: CompactResult = {
          v: result.valid,
          ...(result.disposable?.value && { d: true }),
          ...(apiResponse.pattern_type && { p: apiResponse.pattern_type as PatternType }),
          ...(apiResponse.developer_friendly !== undefined && { df: apiResponse.developer_friendly }),
          ...(apiResponse.trace_id && { trace_id: apiResponse.trace_id })
        };
        return compactResult;
      }

      // Full format - transform the nested result structure to flat SDK format
      const fullResult: DeveloperPatternResult = {
        success: apiResponse.success,
        email: apiResponse.email,
        valid: result.valid,
        format: result.format,
        disposable: result.disposable,
        mx: result.mx,
        smtp: result.smtp,
        processing_time_ms: result.validation_time_ms || result.processing_time_ms,
        timestamp: apiResponse.timestamp,
        trace_id: apiResponse.trace_id,
        request_id: apiResponse.request_id,
        cached: apiResponse.cached,
        warning: apiResponse.warning,
        signal_pool: apiResponse.signal_pool,

        // Developer Pattern Intelligence fields
        pattern_type: apiResponse.pattern_type as PatternType,
        developer_friendly: apiResponse.developer_friendly,
        classification: apiResponse.classification as EmailClassification,
        recommendations: apiResponse.recommendations as EmailRecommendation[],

        // Degradation discriminant: a full API verdict is never degraded.
        degraded: false,
        source: 'api'
      };
      return fullResult;
    }

    // Fallback - return as-is, still carrying the api discriminant.
    return { ...(apiResponse as Record<string, unknown>), degraded: false, source: 'api' } as DeveloperPatternResult;
  }

  /**
   * Route a verifyEmail transport failure through the configured on_error posture. Only
   * ConnectionError / TimeoutError / retryable ServerError (5xx) trigger fallback; any other
   * error (e.g. InvalidAPIKeyError, ValidationError) always re-throws regardless of posture.
   */
  private async handleVerifyError(
    email: string,
    err: unknown
  ): Promise<DeveloperPatternResult | CompactResult | DegradedVerificationResult> {
    const isTrigger =
      err instanceof ConnectionError || err instanceof TimeoutError || err instanceof ServerError;
    if (!isTrigger) throw err;

    // Reuse the fallback's Node guard so telemetry's environment label matches the tier gate:
    // an edge runtime with a polyfilled `process` (no `process.versions.node`) is not 'node'.
    const environment: 'node' | 'browser' = isNodeRuntime() ? 'node' : 'browser';
    const errorClass = err instanceof Error ? err.name : 'Error';

    switch (this.config.on_error) {
      case 'fail-open': {
        emitDegradedBeacon(this.telemetrySink, { email, tier: 'none', errorClass, environment });
        return {
          success: true,
          email,
          valid: true,
          degraded: true,
          source: 'fail-open',
          checks_run: [],
          degraded_reason: 'err',
          confidence: 0
        };
      }
      case 'local-fallback': {
        const result = await localValidate(email, {
          reason: 'err',
          mxTimeoutMs: this.config.local_fallback_mx_timeout
        });
        emitDegradedBeacon(this.telemetrySink, {
          email,
          // Deepest CONCLUSIVE tier (see degradedTier): a disposable hit is 'disposable'; a
          // conclusive MX verdict is 'mx'; an inconclusive MX that degraded to the floor is 'format'
          // — so abuse/outage monitoring can tell "MX said no" apart from "MX couldn't resolve".
          tier: degradedTier(result),
          errorClass,
          environment
        });
        return result;
      }
      case 'throw':
      default:
        throw err;
    }
  }

  /**
   * Verify multiple emails in batch (up to 10K emails)
   * Optimized for AI agent bulk processing with progress tracking
   *
   * @param emails - Array of email addresses to verify
   * @param options - Batch verification options
   * @returns Promise<Record<string, DeveloperPatternResult | CompactResult>>
   *
   * NOTE: unlike `verifyEmail`, this does not accept an `AbortSignal` yet — cancellation is
   * currently single-verify only (see #3470).
   */
  async verifyBatch(
    emails: string[],
    options: VerifyBatchOptions = {}
  ): Promise<Record<string, DeveloperPatternResult | CompactResult>> {
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new ValidationError('Emails must be a non-empty array');
    }

    if (emails.length > MAX_BATCH_SIZE) {
      throw new BatchSizeError(`Batch size cannot exceed ${MAX_BATCH_SIZE} emails. Use verifyBatchAsync for larger batches.`);
    }

    const {
      format = ResponseFormat.COMPACT, // Default to compact for efficiency
      chunk_size = this.config.default_chunk_size,
      progress_callback,
      trace_id,
      parent_id,
      debug = false,
      share_signals
    } = options;

    // For smaller batches, process directly
    if (emails.length <= chunk_size) {
      return this.processBatchChunk(emails, format, trace_id, parent_id, debug, share_signals);
    }

    // For larger batches, process in chunks with progress tracking
    const results: Record<string, DeveloperPatternResult | CompactResult> = {};
    const chunks = this.chunkArray(emails, chunk_size);
    let processed = 0;

    for (const chunk of chunks) {
      const chunkResults = await this.processBatchChunk(chunk, format, trace_id, parent_id, debug, share_signals);
      Object.assign(results, chunkResults);

      processed += chunk.length;
      if (progress_callback) {
        progress_callback(processed, emails.length);
      }
    }

    return results;
  }

  /**
   * Verify emails using the agent-optimized endpoint (high performance)
   * Returns results immediately (synchronous mode)
   *
   * @param emails - Array of email addresses to verify
   * @param options - Batch verification options
   * @returns Promise<AgentBulkCompactResponse | AgentBulkVerboseResponse>
   *
   * NOTE: unlike `verifyEmail`, this does not accept an `AbortSignal` yet — cancellation is
   * currently single-verify only (see #3470).
   */
  async verifyBatchAgent(
    emails: string[],
    options: VerifyBatchOptions = {}
  ): Promise<AgentBulkCompactResponse | AgentBulkVerboseResponse> {
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new ValidationError('Emails must be a non-empty array');
    }

    const {
      format = ResponseFormat.COMPACT,
      trace_id,
      parent_id,
      share_signals
    } = options;

    const headers = { ...this.baseHeaders };
    if (trace_id) {
      headers['X-Trace-ID'] = trace_id;
    }
    if (parent_id) {
      headers['X-Parent-ID'] = parent_id;
    }

    const response = await this.makeRequest<AgentBulkCompactResponse | AgentBulkVerboseResponse>('/api/v1/verify/bulk/agent', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        emails,
        format,
        ...(share_signals !== undefined && { share_signals })
      })
    });

    return response.data;
  }

  /**
   * Start async batch verification for large email lists (10K+)
   * Returns immediately with job ID for polling/webhook notification
   *
   * @param emails - Array of email addresses to verify
   * @param options - Async batch options
   * @returns Promise<BatchJob>
   *
   * NOTE: unlike `verifyEmail`, this does not accept an `AbortSignal` yet — cancellation is
   * currently single-verify only (see #3470).
   */
  async verifyBatchAsync(
    emails: string[],
    options: VerifyBatchAsyncOptions = {}
  ): Promise<BatchJob> {
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new ValidationError('Emails must be a non-empty array');
    }

    const {
      format = ResponseFormat.COMPACT,
      webhook_url,
      trace_id,
      parent_id
    } = options;

    const headers = { ...this.baseHeaders };
    if (trace_id) {
      headers['X-Trace-ID'] = trace_id;
    }
    if (parent_id) {
      headers['X-Parent-ID'] = parent_id;
    }

    const response = await this.makeRequest<BatchJob>('/api/v1/verify/bulk/agent', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        emails,
        format,
        webhook_url,
        async: true  // Always use async mode for verifyBatchAsync
      })
    });

    // The API returns a batch job when async=true
    return response.data;
  }

  /**
   * Get status of an async batch job
   *
   * @param jobId - Batch job ID
   * @returns Promise<BatchJob>
   */
  async getBatchJob(jobId: string): Promise<BatchJob> {
    if (!jobId) {
      throw new ValidationError('Job ID is required');
    }

    const response = await this.makeRequest<BatchJob>(`/api/v1/batch/${jobId}`, {
      method: 'GET',
      headers: this.baseHeaders
    });

    return response.data;
  }

  /**
   * Get results of a completed batch job
   *
   * @param jobId - Batch job ID
   * @returns Promise<BatchVerificationResult>
   */
  async getBatchResults(jobId: string): Promise<BatchVerificationResult> {
    if (!jobId) {
      throw new ValidationError('Job ID is required');
    }

    const response = await this.makeRequest<BatchVerificationResult>(`/api/v1/batch/${jobId}/results`, {
      method: 'GET',
      headers: this.baseHeaders
    });

    return response.data;
  }

  /**
   * Cancel an async batch job
   *
   * @param jobId - Batch job ID
   * @returns Promise<BatchJob>
   */
  async cancelBatchJob(jobId: string): Promise<BatchJob> {
    if (!jobId) {
      throw new ValidationError('Job ID is required');
    }

    const response = await this.makeRequest<BatchJob>(`/api/v1/batch/${jobId}`, {
      method: 'DELETE',
      headers: this.baseHeaders
    });

    return response.data;
  }

  /**
   * Process a batch chunk
   */
  private async processBatchChunk(
    emails: string[],
    format: ResponseFormat,
    trace_id?: string,
    parent_id?: string,
    debug?: boolean,
    share_signals?: boolean
  ): Promise<Record<string, DeveloperPatternResult | CompactResult>> {
    const headers = { ...this.baseHeaders };
    if (trace_id) {
      headers['X-Trace-ID'] = trace_id;
    }
    if (parent_id) {
      headers['X-Parent-ID'] = parent_id;
    }

    const response = await this.makeRequest<Record<string, unknown>>('/api/v1/verify/bulk', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        emails,
        format,
        debug,
        ...(share_signals !== undefined && { share_signals })
      })
    });

    // Map indexed results to email-keyed results
    const apiResponse = response.data;

    // Check if this is a compact format response (direct object with indices)
    if (format === ResponseFormat.COMPACT && apiResponse && typeof apiResponse === 'object' && !('results' in apiResponse)) {
      // Compact format returns { "0": { "v": true }, "1": { "v": false, "r": "invalid" } }
      // Transform to email-keyed object
      const emailResults: Record<string, CompactResult> = {};
      emails.forEach((email, index) => {
        const entry = apiResponse[String(index)] as CompactResult | undefined;
        if (entry) {
          emailResults[email] = entry;
        }
      });
      return emailResults;
    }

    // Check if response has the full format structure with metadata
    if (apiResponse && typeof apiResponse === 'object' && 'results' in apiResponse && Array.isArray(apiResponse.results)) {
      // The batch API always returns full format, even when compact is requested
      const emailResults: Record<string, DeveloperPatternResult | CompactResult> = {};
      const traceId = apiResponse.trace_id as string | undefined;
      const requestId = apiResponse.request_id as string | undefined;

      (apiResponse.results as BatchResultEntry[]).forEach((result) => {
        if (result.email && result.result) {
          // If compact format was requested, transform to compact
          if (format === ResponseFormat.COMPACT) {
            const compactResult: CompactResult = {
              v: result.result.valid,
              ...(result.result.disposable?.value && { d: true }),
              ...(result.pattern_type && { p: result.pattern_type as PatternType }),
              ...(result.developer_friendly !== undefined && { df: result.developer_friendly }),
              ...(traceId && { trace_id: traceId })
            };
            emailResults[result.email] = compactResult;
          } else {
            // Full format - flatten the nested structure
            const fullResult: DeveloperPatternResult = {
              success: result.success ?? true,
              email: result.email,
              valid: result.result.valid,
              format: result.result.format,
              disposable: result.result.disposable,
              mx: result.result.mx,
              smtp: result.result.smtp,
              trace_id: traceId,
              request_id: requestId,

              // Developer Pattern Intelligence fields
              pattern_type: result.pattern_type as PatternType,
              developer_friendly: result.developer_friendly,
              classification: result.classification as EmailClassification,
              recommendations: result.recommendations as EmailRecommendation[]
            };
            emailResults[result.email] = fullResult;
          }
        }
      });
      return emailResults;
    }

    // Fallback for unexpected response formats
    return apiResponse as Record<string, DeveloperPatternResult | CompactResult>;
  }

  /**
   * Make HTTP request with retry logic and error handling.
   *
   * Cancellation precedence: classification of an abort (caller AbortError vs internal
   * TimeoutError) is decided by reading `externalSignal.aborted` at the moment THIS attempt's
   * catch block classifies it — not by which of the two AbortControllers (internal timeout vs
   * external signal) triggered the fetch rejection first. This is a point-in-time read, not a
   * retroactive one: if the internal timeout fires and this attempt has already thrown
   * TimeoutError before the caller happens to call `.abort()` on a later tick, that already-
   * thrown TimeoutError stands — a cancellation cannot reclassify an attempt that already
   * completed.
   */
  private async makeRequest<T = unknown>(
    endpoint: string,
    options: RequestInit,
    retries: number = 0,
    externalSignal?: AbortSignal
  ): Promise<{ data: T; rateLimit?: RateLimitInfo }> {
    if (externalSignal?.aborted) {
      throw new AbortError('Request aborted before it started');
    }

    const url = `${this.config.base_url}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    // No engines-floor guarantee of AbortSignal.any (needs Node >=20.3) — forward the caller's
    // signal onto the internal per-attempt controller manually so this works down to the SDK's
    // published engines floor. Each recursive attempt attaches (and later detaches) its own
    // listener onto its own controller — see the `finally` below.
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onExternalAbort);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Extract rate limit information
      const rateLimit: RateLimitInfo | undefined = response.headers.get('X-RateLimit-Limit') ? {
        limit: parseInt(response.headers.get('X-RateLimit-Limit') || '0'),
        remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0'),
        reset: parseInt(response.headers.get('X-RateLimit-Reset') || '0'),
        retry_after: response.headers.get('Retry-After') ? parseInt(response.headers.get('Retry-After')!) : undefined
      } : undefined;

      if (!response.ok) {
        let errorData: ValidKitErrorDetails | undefined;
        try {
          const jsonResponse = await response.json();
          // API returns errors wrapped in 'error' object
          errorData = jsonResponse.error || jsonResponse;
        } catch (parseError: unknown) {
          // An abort landing while the error body is still being read also rejects here (same
          // AbortError name as a mid-fetch abort) — re-throw so the outer catch's
          // externalSignal-aware classification runs, instead of silently falling through to a
          // status-code-only classification that would misclassify a cancellation.
          if (parseError instanceof Error && parseError.name === 'AbortError') {
            throw parseError;
          }
          // Response body is not JSON
        }

        const error = ValidKitError.fromApiResponse(response, errorData);

        // Add rate limit info to rate limit errors
        if (error instanceof RateLimitError && rateLimit) {
          error.details = { ...error.details, rate_limit: rateLimit };
        }

        // Retry logic for certain errors
        if (this.shouldRetry(error, retries)) {
          const delay = this.getRetryDelay(error, retries);
          await this.sleep(delay, externalSignal);
          return this.makeRequest<T>(endpoint, options, retries + 1, externalSignal);
        }

        throw error;
      }

      const data: T = await response.json();
      return { data, rateLimit };

    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof ValidKitError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        if (externalSignal?.aborted) {
          throw new AbortError('Request aborted by caller signal');
        }

        const timeoutError = new TimeoutError(`Request timed out after ${this.config.timeout}ms`);
        if (this.shouldRetry(timeoutError, retries)) {
          const delay = this.getRetryDelay(timeoutError, retries);
          await this.sleep(delay, externalSignal);
          return this.makeRequest<T>(endpoint, options, retries + 1, externalSignal);
        }
        throw timeoutError;
      }

      // Network or other errors
      const message = error instanceof Error ? error.message : String(error);
      const connectionError = new ConnectionError(`Request failed: ${message}`);
      if (this.shouldRetry(connectionError, retries)) {
        const delay = this.getRetryDelay(connectionError, retries);
        await this.sleep(delay, externalSignal);
        return this.makeRequest<T>(endpoint, options, retries + 1, externalSignal);
      }

      throw connectionError;
    } finally {
      // Load-bearing: every `return this.makeRequest(...)` above is NOT awaited, so the
      // recursive call's own listener attaches synchronously (during its call, before this
      // frame resumes) and only then does this frame's `finally` remove its own listener —
      // so exactly one listener is ever live at a point where an abort event could actually
      // fire; nothing stacks. A future `return await this.makeRequest(...)` refactor would
      // stack one listener per retry instead.
      externalSignal?.removeEventListener('abort', onExternalAbort);
    }
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(error: ValidKitError, retries: number): boolean {
    if (retries >= this.config.max_retries) {
      return false;
    }

    // Don't retry client errors (4xx except 429)
    if (error instanceof InvalidAPIKeyError ||
        error instanceof ValidationError ||
        error instanceof BatchSizeError) {
      return false;
    }

    // Retry rate limits, timeouts, connection errors, and server errors
    return error instanceof RateLimitError ||
           error instanceof TimeoutError ||
           error instanceof ConnectionError ||
           error instanceof ServerError;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private getRetryDelay(error: ValidKitError, retries: number): number {
    if (error instanceof RateLimitError) {
      return error.getRetryDelay();
    }

    // Honor a server-provided retry_after on any error type (#3496: proxy
    // 502/504 carry retry_after=5/1 precisely so retries don't tight-loop
    // and burn validation credits during an upstream incident).
    const serverRetryAfter = error.details?.retry_after;
    if (typeof serverRetryAfter === 'number' && serverRetryAfter > 0) {
      return Math.min(serverRetryAfter * 1000, MAX_RETRY_DELAY);
    }

    // Exponential backoff: 1s, 2s, 4s, etc.
    return Math.min(RETRY_BASE_DELAY * Math.pow(2, retries), MAX_RETRY_DELAY);
  }

  /**
   * Sleep for specified milliseconds. If `signal` aborts before or during the delay, rejects
   * immediately with AbortError instead of waiting out the remainder — this is what makes a
   * cancelled request stop during a long rate-limit backoff (default 60s) rather than after it.
   */
  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new AbortError('Request aborted during retry delay'));
        return;
      }

      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);

      const onAbort = (): void => {
        clearTimeout(timer);
        reject(new AbortError('Request aborted during retry delay'));
      };

      // { once: true }: the runtime auto-detaches this listener once it fires, so only the
      // timer-resolve path above needs to remove it manually.
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

