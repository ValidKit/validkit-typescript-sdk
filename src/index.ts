/**
 * ValidKit TypeScript SDK
 * 
 * Official TypeScript/JavaScript SDK for ValidKit Email Verification API
 * Optimized for AI agents with bulk processing and token efficiency
 * 
 * @example Basic Usage
 * ```typescript
 * import { ValidKit } from '@validkit/sdk'
 * 
 * const client = new ValidKit({ api_key: 'your-api-key' })
 * 
 * // Single email verification
 * const result = await client.verifyEmail('test@example.com')
 * 
 * // Batch verification (up to 10K emails)
 * const results = await client.verifyBatch([
 *   'email1@example.com',
 *   'email2@example.com'
 * ], { format: 'compact' })
 * ```
 * 
 * @example AI Agent Optimized
 * ```typescript
 * // Verify 10K emails with progress tracking
 * const results = await client.verifyBatch(emails, {
 *   format: 'compact', // 80% smaller responses
 *   progress_callback: (processed, total) => {
 *     console.log(`Progress: ${processed}/${total}`)
 *   }
 * })
 * 
 * // Async processing for massive lists
 * const job = await client.verifyBatchAsync(emails, {
 *   webhook_url: 'https://your-app.com/webhook'
 * })
 * ```
 */

// Export main client
export { ValidKit } from './client'

// Export all types
export * from './types'

// Export errors
export * from './errors'

// Default export for convenience
export { ValidKit as default } from './client'