/**
 * ValidKit SDK Types - Optimized for AI Agents
 * 
 * Provides comprehensive TypeScript definitions for the ValidKit Email Verification API
 * Built for high-performance batch processing and AI agent workflows
 */

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
}

/**
 * MX record validation result
 */
export interface MXCheck {
  valid: boolean
  records?: string[]
  priority?: number[]
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
  
  // Performance and tracing metadata
  processing_time_ms?: number
  timestamp?: string
  trace_id?: string
  request_id?: string
}

/**
 * Compact verification result for token efficiency (80% smaller)
 * Optimized for AI agents processing large batches
 */
export interface CompactResult {
  /** Valid */
  v: boolean
  /** Disposable (optional) */
  d?: boolean
  /** Reason if invalid (only present when v=false) */
  r?: string
}

/**
 * Batch verification response
 */
export interface BatchVerificationResult {
  success: boolean
  total: number
  valid: number
  invalid: number
  results: Record<string, EmailVerificationResult | CompactResult>
  
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
}

/**
 * Options for single email verification
 */
export interface VerifyEmailOptions {
  /** Response format (default: full) */
  format?: ResponseFormat
  /** Optional trace ID for multi-agent correlation */
  trace_id?: string
  /** Optional parent ID for hierarchical tracing */
  parent_id?: string
  /** Enable debug mode for detailed validation steps */
  debug?: boolean
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
 * Progress callback function type for batch processing
 */
export type ProgressCallback = (processed: number, total: number) => void

/**
 * ValidKit API Error details
 */
export interface ValidKitErrorDetails {
  code: string
  message: string
  details?: Record<string, any>
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