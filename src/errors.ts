/**
 * ValidKit SDK Error Classes
 * 
 * Comprehensive error handling for AI agent workflows
 */

import { ValidKitErrorDetails, RateLimitInfo } from './types'

/**
 * Base error class for all ValidKit SDK errors
 */
export class ValidKitError extends Error {
  public readonly code: string
  public readonly details?: Record<string, any>

  constructor(message: string, code: string = 'VALIDKIT_ERROR', details?: Record<string, any>) {
    super(message)
    this.name = 'ValidKitError'
    this.code = code
    this.details = details
    
    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidKitError)
    }
  }

  /**
   * Create error from API response
   */
  static fromApiResponse(response: Response, errorData?: ValidKitErrorDetails): ValidKitError {
    const message = errorData?.message || `API request failed with status ${response.status}`
    const code = errorData?.code || 'API_ERROR'
    
    switch (response.status) {
      case 401:
        return new InvalidAPIKeyError(message, errorData?.details)
      case 429:
        return new RateLimitError(message, errorData?.details)
      case 400:
        if (code === 'BATCH_SIZE_ERROR') {
          return new BatchSizeError(message, errorData?.details)
        }
        return new ValidationError(message, errorData?.details)
      case 408:
      case 504:
        return new TimeoutError(message, errorData?.details)
      case 500:
      case 502:
      case 503:
        return new ServerError(message, errorData?.details)
      default:
        return new ValidKitError(message, code, errorData?.details)
    }
  }
}

/**
 * Invalid API key error
 */
export class InvalidAPIKeyError extends ValidKitError {
  constructor(message: string = 'Invalid API key provided', details?: Record<string, any>) {
    super(message, 'INVALID_API_KEY', details)
    this.name = 'InvalidAPIKeyError'
  }
}

/**
 * Rate limit exceeded error with retry information
 */
export class RateLimitError extends ValidKitError {
  public readonly rateLimit?: RateLimitInfo

  constructor(message: string = 'Rate limit exceeded', details?: Record<string, any>) {
    super(message, 'RATE_LIMIT_EXCEEDED', details)
    this.name = 'RateLimitError'
    
    if (details?.rate_limit) {
      this.rateLimit = details.rate_limit as RateLimitInfo
    }
  }

  /**
   * Get retry delay in milliseconds
   */
  getRetryDelay(): number {
    if (this.rateLimit?.retry_after) {
      return this.rateLimit.retry_after * 1000
    }
    if (this.rateLimit?.reset) {
      return Math.max(0, this.rateLimit.reset * 1000 - Date.now())
    }
    return 60000 // Default 1 minute
  }
}

/**
 * Batch size validation error
 */
export class BatchSizeError extends ValidKitError {
  constructor(message: string = 'Batch size exceeds maximum limit', details?: Record<string, any>) {
    super(message, 'BATCH_SIZE_ERROR', details)
    this.name = 'BatchSizeError'
  }
}

/**
 * Request timeout error
 */
export class TimeoutError extends ValidKitError {
  constructor(message: string = 'Request timed out', details?: Record<string, any>) {
    super(message, 'TIMEOUT_ERROR', details)
    this.name = 'TimeoutError'
  }
}

/**
 * Network connection error
 */
export class ConnectionError extends ValidKitError {
  constructor(message: string = 'Connection failed', details?: Record<string, any>) {
    super(message, 'CONNECTION_ERROR', details)
    this.name = 'ConnectionError'
  }
}

/**
 * Server error (5xx responses)
 */
export class ServerError extends ValidKitError {
  constructor(message: string = 'Server error occurred', details?: Record<string, any>) {
    super(message, 'SERVER_ERROR', details)
    this.name = 'ServerError'
  }
}

/**
 * Validation error for request data
 */
export class ValidationError extends ValidKitError {
  constructor(message: string = 'Validation failed', details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

/**
 * Batch job error for async operations
 */
export class BatchJobError extends ValidKitError {
  constructor(message: string = 'Batch job failed', details?: Record<string, any>) {
    super(message, 'BATCH_JOB_ERROR', details)
    this.name = 'BatchJobError'
  }
}