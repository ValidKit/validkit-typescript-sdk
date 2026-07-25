/**
 * ValidKit SDK Error Classes
 *
 * Comprehensive error handling for AI agent workflows
 */

import { ValidKitErrorDetails, RateLimitInfo } from './types';

/**
 * Merge upstream proxy metadata (#3496) into error details so consumers can
 * read the real API error code (`UPSTREAM_TIMEOUT` / `UPSTREAM_ERROR`) via
 * `details.upstream_code`, and `retry_after` (which also powers
 * `getRetryDelay()`), while the wrapper class keeps its legacy `code` for
 * backward compatibility.
 */
function withUpstreamMetadata(errorData?: ValidKitErrorDetails): Record<string, unknown> | undefined {
  if (!errorData) {
    return undefined;
  }
  const details: Record<string, unknown> = { ...(errorData.details ?? {}) };
  if (errorData.code) {
    details.upstream_code = errorData.code;
  }
  if (errorData.retry_after !== undefined) {
    details.retry_after = errorData.retry_after;
  }
  return Object.keys(details).length > 0 ? details : undefined;
}

/**
 * Base error class for all ValidKit SDK errors
 */
export class ValidKitError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public details?: Record<string, unknown>;

  constructor(message: string, statusCode?: number, details?: Record<string, unknown>, code: string = 'VALIDKIT_ERROR') {
    super(message);
    this.name = 'ValidKitError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidKitError);
    }
  }

  /**
   * Create error from API response
   */
  static fromApiResponse(response: Response, errorData?: ValidKitErrorDetails): ValidKitError {
    const message = errorData?.message;

    switch (response.status) {
      case 401:
        return new InvalidAPIKeyError(message || 'Invalid or missing API key', errorData?.details);
      case 429:
        return new RateLimitError(message || 'Rate limit exceeded', errorData?.details);
      case 400:
        if (errorData?.code === 'BATCH_SIZE_EXCEEDED') {
          return new BatchSizeError(message || 'Batch size exceeds maximum limit', errorData?.details);
        }
        return new ValidationError(message || response.statusText || 'Validation failed', errorData?.details);
      case 408:
      case 504:
        return new TimeoutError(message || 'Request timed out', withUpstreamMetadata(errorData), response.status);
      case 500:
      case 502:
        return new ServerError(message || 'Internal server error', withUpstreamMetadata(errorData), response.status);
      case 503:
        return new ServerError(message || 'Service temporarily unavailable', withUpstreamMetadata(errorData), response.status);
      default: {
        return new ValidKitError(
          message || response.statusText || `API request failed with status ${response.status}`,
          response.status,
          errorData?.details,
          errorData?.code || 'VALIDKIT_ERROR'
        );
      }
    }
  }

  /**
   * Convert error to JSON
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details
    };
  }
}

/**
 * Invalid API key error
 */
export class InvalidAPIKeyError extends ValidKitError {
  constructor(message: string = 'Invalid API key provided', details?: Record<string, unknown>) {
    super(message, 401, details, 'INVALID_API_KEY');
    this.name = 'InvalidAPIKeyError';
  }
}

/**
 * Rate limit exceeded error with retry information
 */
export class RateLimitError extends ValidKitError {
  public readonly rateLimit?: RateLimitInfo;

  constructor(message: string = 'Rate limit exceeded', details?: Record<string, unknown>) {
    super(message, 429, details, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';

    if (details?.rate_limit) {
      this.rateLimit = details.rate_limit as RateLimitInfo;
    }
  }

  /**
   * Get retry delay in milliseconds
   */
  getRetryDelay(): number {
    // Check rate_limit object in details (added by client)
    const rateLimitInfo = this.details?.rate_limit as RateLimitInfo | undefined;
    if (rateLimitInfo?.retry_after) {
      return rateLimitInfo.retry_after * 1000;
    }
    // Check direct retry_after in details
    if (this.details?.retry_after) {
      return (this.details.retry_after as number) * 1000;
    }
    if (this.rateLimit?.retry_after) {
      return this.rateLimit.retry_after * 1000;
    }
    if (this.rateLimit?.reset) {
      return Math.max(0, this.rateLimit.reset * 1000 - Date.now());
    }
    return 60000; // Default 1 minute
  }
}

/**
 * Batch size validation error
 */
export class BatchSizeError extends ValidKitError {
  constructor(message: string = 'Batch size exceeds maximum limit', details?: Record<string, unknown>) {
    super(message, 400, details, 'BATCH_SIZE_EXCEEDED');
    this.name = 'BatchSizeError';
  }
}

/**
 * Request timeout error
 */
export class TimeoutError extends ValidKitError {
  // statusCode is configurable (#3496): proxy-emitted upstream timeouts are
  // HTTP 504 on the wire — consumers branching on error.statusCode must see
  // the real status, not a hard-coded 408. Default preserves legacy behavior.
  constructor(message: string = 'Request timed out', details?: Record<string, unknown>, statusCode: number = 408) {
    super(message, statusCode, details, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

/**
 * Network connection error
 */
export class ConnectionError extends ValidKitError {
  constructor(message: string = 'Connection failed', details?: Record<string, unknown>) {
    super(message, 0, details, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
  }
}

/**
 * Server error (5xx responses)
 */
export class ServerError extends ValidKitError {
  // statusCode is configurable (#3496): 502/503 must surface their real wire
  // status to error.statusCode consumers. Default preserves legacy behavior.
  constructor(message: string = 'Server error occurred', details?: Record<string, unknown>, statusCode: number = 500) {
    super(message, statusCode, details, 'SERVER_ERROR');
    this.name = 'ServerError';
  }
}

/**
 * Validation error for request data
 */
export class ValidationError extends ValidKitError {
  constructor(message: string = 'Validation failed', details?: Record<string, unknown>) {
    super(message, 400, details, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Batch job error for async operations
 */
export class BatchJobError extends ValidKitError {
  constructor(message: string = 'Batch job failed', details?: Record<string, unknown>) {
    super(message, 500, details, 'BATCH_JOB_ERROR');
    this.name = 'BatchJobError';
  }
}

/**
 * Request aborted via a caller-supplied AbortSignal. Deliberately does NOT extend
 * ConnectionError / TimeoutError / ServerError — those are handleVerifyError's fail-open /
 * local-fallback trigger set, and an explicit caller cancellation must always propagate,
 * never silently degrade into a fallback verdict.
 *
 * `sleep()` and `makeRequest()` never let a native fetch/DOMException AbortError leak to
 * callers — every abort path (mid-flight fetch, retry backoff, already-aborted) converts to
 * this class. Its `.name` is still `'AbortError'` for familiarity with the platform
 * AbortController idiom, but since a native DOMException shares that same `.name`,
 * discriminate with `instanceof AbortError` or `error.code === 'ABORTED'` — not `.name`.
 */
export class AbortError extends ValidKitError {
  constructor(message: string = 'Request aborted', details?: Record<string, unknown>) {
    super(message, undefined, details, 'ABORTED');
    this.name = 'AbortError';
  }
}
