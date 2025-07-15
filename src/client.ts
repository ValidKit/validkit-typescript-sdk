/**
 * ValidKit TypeScript SDK - AI Agent Optimized
 *
 * High-performance email verification client designed for AI agents
 * Supports batch processing up to 10K emails with token-optimized responses
 */

import fetch from 'cross-fetch';
import {
  ValidKitConfig,
  EmailVerificationResult,
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
  AgentBulkVerboseResponse
} from './types';
import {
  ValidKitError,
  InvalidAPIKeyError,
  RateLimitError,
  BatchSizeError,
  TimeoutError,
  ConnectionError,
  ServerError,
  ValidationError
} from './errors';

// Constants
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_CHUNK_SIZE = 1000;
const MAX_BATCH_SIZE = 10000;
const RETRY_BASE_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

/**
 * ValidKit client for email verification optimized for AI agents
 *
 * Features:
 * - Agent-scale rate limits (1,000+ req/min)
 * - Bulk processing (10,000+ emails per request)
 * - Token-optimized responses (80% smaller)
 * - Multi-agent tracing capabilities
 * - Async processing with webhooks
 */
export class ValidKit {
  private readonly config: Required<ValidKitConfig>;
  private readonly baseHeaders: Record<string, string>;

  constructor(config: ValidKitConfig) {
    if (!config.api_key) {
      throw new InvalidAPIKeyError('API key is required');
    }

    this.config = {
      api_key: config.api_key,
      base_url: config.base_url || 'https://api.validkit.com',
      timeout: config.timeout || DEFAULT_TIMEOUT,
      max_retries: config.max_retries || 3,
      default_chunk_size: config.default_chunk_size || DEFAULT_CHUNK_SIZE,
      user_agent: config.user_agent || 'ValidKit TypeScript SDK/1.0.0 (AI Agent Optimized)'
    };

    this.baseHeaders = {
      'Authorization': `Bearer ${this.config.api_key}`,
      'Content-Type': 'application/json',
      'User-Agent': this.config.user_agent,
      'X-SDK-Version': '1.0.0',
      'X-SDK-Language': 'typescript'
    };
  }

  /**
   * Verify a single email address
   *
   * @param email - Email address to verify
   * @param options - Verification options
   * @returns Promise<EmailVerificationResult | CompactResult>
   */
  async verifyEmail(
    email: string,
    options: VerifyEmailOptions = {}
  ): Promise<EmailVerificationResult | CompactResult> {
    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email must be a non-empty string');
    }

    const { format = ResponseFormat.FULL, trace_id, parent_id, debug = false, share_signals } = options;

    const headers = { ...this.baseHeaders };
    if (trace_id) {
      headers['X-Trace-ID'] = trace_id;
    }
    if (parent_id) {
      headers['X-Parent-ID'] = parent_id;
    }

    const response = await this.makeRequest('/api/v1/verify', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        format,
        debug,
        ...(share_signals !== undefined && { share_signals })
      })
    });

    // Extract the actual verification result from the API response
    const apiResponse = response.data;

    // V1 API always returns full format, regardless of format parameter
    // The response has a nested structure with 'result' field
    if ('result' in apiResponse && 'email' in apiResponse) {
      const result = apiResponse.result;

      // If compact format was requested, transform to compact
      if (format === ResponseFormat.COMPACT) {
        // Transform to compact format client-side since V1 doesn't support it
        return {
          v: result.valid,
          ...(result.disposable?.value && { d: true }),
          ...(apiResponse.trace_id && { trace_id: apiResponse.trace_id })
        } as CompactResult;
      }

      // Full format - transform the nested result structure to flat SDK format
      return {
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
        signal_pool: apiResponse.signal_pool
      };
    }

    // Fallback - return as-is
    return apiResponse;
  }

  /**
   * Verify multiple emails in batch (up to 10K emails)
   * Optimized for AI agent bulk processing with progress tracking
   *
   * @param emails - Array of email addresses to verify
   * @param options - Batch verification options
   * @returns Promise<Record<string, EmailVerificationResult | CompactResult>>
   */
  async verifyBatch(
    emails: string[],
    options: VerifyBatchOptions = {}
  ): Promise<Record<string, EmailVerificationResult | CompactResult>> {
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
    const results: Record<string, EmailVerificationResult | CompactResult> = {};
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

    const response = await this.makeRequest('/api/v1/verify/bulk/agent', {
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

    const response = await this.makeRequest('/api/v1/verify/bulk/agent', {
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

    const response = await this.makeRequest(`/api/v1/batch/${jobId}`, {
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

    const response = await this.makeRequest(`/api/v1/batch/${jobId}/results`, {
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

    const response = await this.makeRequest(`/api/v1/batch/${jobId}`, {
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
  ): Promise<Record<string, EmailVerificationResult | CompactResult>> {
    const headers = { ...this.baseHeaders };
    if (trace_id) {
      headers['X-Trace-ID'] = trace_id;
    }
    if (parent_id) {
      headers['X-Parent-ID'] = parent_id;
    }

    const response = await this.makeRequest('/api/v1/verify/bulk', {
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
    if (format === ResponseFormat.COMPACT && typeof apiResponse === 'object' && !('results' in apiResponse)) {
      // Compact format returns { "0": { "v": true }, "1": { "v": false, "r": "invalid" } }
      // Transform to email-keyed object
      const emailResults: Record<string, CompactResult> = {};
      emails.forEach((email, index) => {
        if (apiResponse[index]) {
          emailResults[email] = apiResponse[index];
        }
      });
      return emailResults;
    }

    // Check if response has the full format structure with metadata
    if ('results' in apiResponse && Array.isArray(apiResponse.results)) {
      // The batch API always returns full format, even when compact is requested
      const emailResults: Record<string, EmailVerificationResult | CompactResult> = {};

      apiResponse.results.forEach((result: any) => {
        if (result.email && result.result) {
          // If compact format was requested, transform to compact
          if (format === ResponseFormat.COMPACT) {
            emailResults[result.email] = {
              v: result.result.valid,
              ...(result.result.disposable?.value && { d: true }),
              ...(apiResponse.trace_id && { trace_id: apiResponse.trace_id })
            } as CompactResult;
          } else {
            // Full format - flatten the nested structure
            emailResults[result.email] = {
              success: result.success,
              email: result.email,
              valid: result.result.valid,
              format: result.result.format,
              disposable: result.result.disposable,
              mx: result.result.mx,
              smtp: result.result.smtp,
              trace_id: apiResponse.trace_id,
              request_id: apiResponse.request_id
            };
          }
        }
      });
      return emailResults;
    }

    // Fallback for unexpected response formats
    return apiResponse;
  }

  /**
   * Make HTTP request with retry logic and error handling
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit,
    retries: number = 0
  ): Promise<{ data: any; rateLimit?: RateLimitInfo }> {
    const url = `${this.config.base_url}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

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
        } catch {
          // Response body is not JSON
        }

        const error = ValidKitError.fromApiResponse(response, errorData);

        // Add rate limit info to rate limit errors
        if (error instanceof RateLimitError && rateLimit) {
          (error as any).details = { ...error.details, rate_limit: rateLimit };
        }

        // Retry logic for certain errors
        if (this.shouldRetry(error, retries)) {
          const delay = this.getRetryDelay(error, retries);
          await this.sleep(delay);
          return this.makeRequest(endpoint, options, retries + 1);
        }

        throw error;
      }

      const data = await response.json();
      return { data, rateLimit };

    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error instanceof ValidKitError) {
        throw error;
      }

      if (error.name === 'AbortError') {
        const timeoutError = new TimeoutError(`Request timed out after ${this.config.timeout}ms`);
        if (this.shouldRetry(timeoutError, retries)) {
          const delay = this.getRetryDelay(timeoutError, retries);
          await this.sleep(delay);
          return this.makeRequest(endpoint, options, retries + 1);
        }
        throw timeoutError;
      }

      // Network or other errors
      const connectionError = new ConnectionError(`Request failed: ${error.message}`);
      if (this.shouldRetry(connectionError, retries)) {
        const delay = this.getRetryDelay(connectionError, retries);
        await this.sleep(delay);
        return this.makeRequest(endpoint, options, retries + 1);
      }

      throw connectionError;
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

    // Exponential backoff: 1s, 2s, 4s, etc.
    return Math.min(RETRY_BASE_DELAY * Math.pow(2, retries), MAX_RETRY_DELAY);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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

