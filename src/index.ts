/**
 * ValidKit TypeScript SDK
 *
 * Official TypeScript SDK for ValidKit Email Verification API
 * Features intelligent pattern recognition for developer workflows
 *
 * @example Basic Usage with Pattern Intelligence
 * ```typescript
 * import { ValidKit, DeveloperPatternResult } from '@validkit/sdk'
 *
 * const client = new ValidKit({ api_key: 'your-api-key' })
 *
 * // Single email verification with pattern intelligence
 * const result: DeveloperPatternResult = await client.verifyEmail('test@example.com')
 * console.log(result.valid) // true
 * console.log(result.pattern_type) // "developer_test"
 * console.log(result.developer_friendly) // true
 *
 * // Type-safe pattern handling
 * if (result.pattern_type === 'plus_addressing') {
 *   console.log('Base email:', result.classification?.plus_addressing?.baseEmail)
 * }
 * ```
 *
 * @example Framework Integration
 * ```typescript
 * // Smart validation for team invites
 * const validateTeamEmail = async (email: string) => {
 *   const result = await client.verifyEmail(email)
 *
 *   switch (result.pattern_type) {
 *     case 'temporary':
 *       return { valid: false, reason: 'Temporary emails not allowed' }
 *     case 'plus_addressing':
 *       return { valid: true, normalized: result.classification?.plus_addressing?.baseEmail }
 *     default:
 *       return { valid: result.valid }
 *   }
 * }
 * ```
 *
 * @example Batch Processing with Pattern Analysis
 * ```typescript
 * // Bulk verification with pattern insights
 * const results = await client.verifyBatch(emails, {
 *   format: 'full' // Get pattern intelligence
 * })
 *
 * // Analyze patterns across batch
 * const patterns = Object.values(results).reduce((acc, result) => {
 *   const pattern = result.pattern_type || 'regular'
 *   acc[pattern] = (acc[pattern] || 0) + 1
 *   return acc
 * }, {} as Record<string, number>)
 * ```
 */

// Export main client
export { ValidKit } from './client';

// Export all types including pattern intelligence
export * from './types';

// Export key types for convenient importing
export type {
  DeveloperPatternResult,
  PatternType,
  EmailClassification,
  EmailRecommendation,
  PlusAddressingInfo,
  DomainInfo,
  ValidationDecision,
  PatternAnalysis
} from './types';

// Export errors
export * from './errors';

// Export the capped degraded-confidence tiers so consumers can threshold against documented
// boundaries (formatOnly: 0.2, withMx: 0.5) rather than hard-coding magic numbers.
export { DEGRADED_CONFIDENCE } from './fallback/localFallback';

// Default export for convenience
export { ValidKit as default } from './client';
