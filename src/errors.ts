/**
 * ValidKit SDK Error Classes
 *
 * Comprehensive error handling for AI agent workflows
 */

import { ValidKitErrorDetails, RateLimitInfo } from './types';

/**
 * Base error class for all ValidKit SDK errors
 */
export class ValidKitError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: Record<string, unknown>;

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
        return new TimeoutError(message || 'Request timed out', errorData?.details);
      case 500:
      case 502:
        return new ServerError(message || 'Internal server error', errorData?.details);
      case 503:
        return new ServerError(message || 'Service temporarily unavailable', errorData?.details);
      default: {
        const error = new ValidKitError(message || response.statusText || `API request failed with status ${response.status}`, response.status, errorData?.details);
        if (errorData?.code) {
          (error as any).code = errorData.code;
        }
        return error;
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
  constructor(message: string = 'Request timed out', details?: Record<string, unknown>) {
    super(message, 408, details, 'TIMEOUT');
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
  constructor(message: string = 'Server error occurred', details?: Record<string, unknown>) {
    super(message, 500, details, 'SERVER_ERROR');
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
