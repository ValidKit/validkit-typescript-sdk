# ValidKit TypeScript SDK

[![npm version](https://badge.fury.io/js/%40validkit%2Fsdk.svg)](https://badge.fury.io/js/%40validkit%2Fsdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Documentation](https://img.shields.io/badge/docs-available-brightgreen.svg)](https://docs.validkit.com)
[![npm downloads](https://img.shields.io/npm/dm/@validkit/sdk.svg)](https://www.npmjs.com/package/@validkit/sdk)

**TypeScript-First Email Validation for Developer Tools**

The official TypeScript SDK for ValidKit Email Verification API, featuring intelligent pattern recognition that understands developer workflows:

- 🧠 **Developer Pattern Intelligence** - Recognizes `test@example.com`, plus addressing, system emails
- 🔒 **Full Type Safety** - Complete TypeScript interfaces for pattern classification
- 🚀 **High-volume rate limits** (1,000+ req/min)
- 📦 **Bulk processing** (10,000+ emails per request)
- ⚡ **Optimized responses** (compact format available)
- 🔗 **Request tracing** capabilities
- 🔄 **Async processing** with webhooks

**Full API Documentation**: https://api.validkit.com/api/v1/openapi.json

## Installation

```bash
pnpm add @validkit/sdk
# or
npm install @validkit/sdk
# or
yarn add @validkit/sdk
```

## Quick Start

```typescript
import { ValidKit, DeveloperPatternResult } from '@validkit/sdk'

const client = new ValidKit({
  api_key: 'your-api-key-here'
})

// Single email verification with pattern intelligence
const result = await client.verifyEmail('test@example.com')
console.log(result.valid) // true
console.log(result.pattern_type) // "developer_test"
console.log(result.developer_friendly) // true

// Type-safe pattern handling
if (result.pattern_type === 'plus_addressing') {
  console.log('Base email:', result.classification?.plus_addressing?.baseEmail)
}

// Batch verification with progress tracking
const emails = ['user+test@gmail.com', 'noreply@company.com', 'test@staging.com']
const results = await client.verifyBatch(emails, {
  format: 'full', // Get full pattern intelligence
  progress_callback: (processed, total) => {
    console.log(`Progress: ${processed}/${total}`)
  }
})
```

## Developer Pattern Intelligence

ValidKit's core differentiator: **"We know test@example.com isn't a typo"**. Get intelligent classification of developer-specific email patterns with full TypeScript support.

### Pattern Types

```typescript
import { PatternType, EmailClassification } from '@validkit/sdk'

// All supported pattern types
type PatternType = 
  | 'developer_test'    // test@, demo@, sandbox@
  | 'plus_addressing'   // user+tag@gmail.com
  | 'system_email'     // noreply@, notifications@
  | 'role_based'       // admin@, support@
  | 'temporary'        // disposable email services
  | 'development_env'  // dev@, staging@
  | 'ci_cd'           // github@, build@
  | 'regular'         // standard email patterns

// Full classification response
interface EmailClassification {
  pattern_type: PatternType
  developer_friendly: boolean
  confidence: number
  plus_addressing?: {
    baseEmail: string
    tag: string
  }
  domain_info?: {
    category: string
    platform?: string
    isTemporary?: boolean
  }
  metadata: Record<string, any>
}
```

### Real-World Examples

```typescript
// Team invite validation
const validateTeamEmail = async (email: string) => {
  const result = await client.verifyEmail(email)
  
  // Type-safe pattern handling
  switch (result.pattern_type) {
    case 'developer_test':
      return {
        valid: true,
        warning: 'Test email detected - okay for staging',
        allowInProduction: false
      }
    
    case 'plus_addressing':
      return {
        valid: true,
        normalized: result.classification?.plus_addressing?.baseEmail,
        note: 'Plus addressing normalized'
      }
    
    case 'temporary':
      return {
        valid: false,
        reason: 'Temporary email not allowed for team invites'
      }
    
    default:
      return { valid: result.valid }
  }
}
```

## Framework Integration Examples

### Next.js App Router

```typescript
// app/api/validate-email/route.ts
import { ValidKit, DeveloperPatternResult } from '@validkit/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new ValidKit({ 
  api_key: process.env.VALIDKIT_API_KEY! 
})

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  
  try {
    const result = await client.verifyEmail(email, {
      format: 'full' // Get pattern intelligence
    })
    
    // Smart validation logic based on patterns
    const response = {
      valid: result.valid,
      pattern: result.pattern_type,
      recommendations: result.recommendations || [],
      
      // Environment-aware validation
      allowInProduction: result.developer_friendly && 
        !['developer_test', 'temporary'].includes(result.pattern_type!)
    }
    
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 })
  }
}
```

### React Hook for Email Validation

```typescript
// hooks/useEmailValidation.ts
import { useState, useCallback } from 'react'
import { ValidKit, EmailVerificationResult } from '@validkit/sdk'

interface ValidationState {
  isValidating: boolean
  result: EmailVerificationResult | null
  error: string | null
}

const client = new ValidKit({ 
  api_key: process.env.NEXT_PUBLIC_VALIDKIT_API_KEY! 
})

export function useEmailValidation() {
  const [state, setState] = useState<ValidationState>({
    isValidating: false,
    result: null,
    error: null
  })
  
  const validateEmail = useCallback(async (email: string) => {
    setState({ isValidating: true, result: null, error: null })
    
    try {
      const result = await client.verifyEmail(email, {
        format: 'full'
      })
      
      setState({ 
        isValidating: false, 
        result, 
        error: null 
      })
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed'
      setState({ 
        isValidating: false, 
        result: null, 
        error: errorMessage 
      })
      throw error
    }
  }, [])
  
  return {
    ...state,
    validateEmail,
    // Computed properties with type safety
    isDeveloperPattern: state.result?.developer_friendly ?? false,
    patternType: state.result?.pattern_type,
    isTemporary: state.result?.pattern_type === 'temporary'
  }
}
```

### Smart Signup Form Component

```typescript
// components/SmartSignupForm.tsx
import React, { useState } from 'react'
import { useEmailValidation } from '../hooks/useEmailValidation'
import { PatternType } from '@validkit/sdk'

interface PatternBadgeProps {
  patternType: PatternType
  developerFriendly: boolean
}

const PatternBadge: React.FC<PatternBadgeProps> = ({ patternType, developerFriendly }) => {
  const badges = {
    developer_test: { label: 'Test Email', color: 'yellow', icon: '🧪' },
    plus_addressing: { label: 'Plus Addressing', color: 'blue', icon: '➕' },
    system_email: { label: 'System Email', color: 'gray', icon: '🤖' },
    temporary: { label: 'Temporary', color: 'red', icon: '⏳' },
    regular: { label: 'Standard', color: 'green', icon: '✉️' }
  }
  
  const badge = badges[patternType] || badges.regular
  
  return (
    <span className={`badge badge-${badge.color}`}>
      {badge.icon} {badge.label}
    </span>
  )
}

export function SmartSignupForm() {
  const [email, setEmail] = useState('')
  const { validateEmail, result, isValidating, error } = useEmailValidation()
  
  const handleEmailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value
    setEmail(newEmail)
    
    // Real-time validation with debouncing
    if (newEmail.includes('@') && newEmail.length > 5) {
      try {
        await validateEmail(newEmail)
      } catch (error) {
        // Error handled by hook
      }
    }
  }
  
  return (
    <div className="signup-form">
      <div className="field">
        <label>Email Address</label>
        <input
          type="email"
          value={email}
          onChange={handleEmailChange}
          className={`input ${
            result?.valid === false ? 'error' : 
            result?.valid === true ? 'success' : ''
          }`}
          placeholder="your.email@company.com"
        />
        
        {isValidating && <div className="spinner">Validating...</div>}
        
        {result && (
          <div className="validation-result">
            <div className="status">
              {result.valid ? '✅ Valid' : '❌ Invalid'}
              {result.pattern_type && (
                <PatternBadge 
                  patternType={result.pattern_type}
                  developerFriendly={result.developer_friendly!}
                />
              )}
            </div>
            
            {/* Smart recommendations */}
            {result.recommendations?.map((rec, i) => (
              <div key={i} className="recommendation">
                <strong>{rec.action}:</strong> {rec.reason}
              </div>
            ))}
            
            {/* Plus addressing normalization */}
            {result.pattern_type === 'plus_addressing' && (
              <div className="info">
                📧 Base email: {result.classification?.plus_addressing?.baseEmail}
              </div>
            )}
          </div>
        )}
        
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  )
}
```

## AI Agent Examples

### LangChain Integration

```typescript
import { Tool } from 'langchain/tools'
import { ValidKit } from '@validkit/sdk'

class EmailValidationTool extends Tool {
  name = 'email_validator'
  description = 'Validate email addresses for deliverability'
  
  private client = new ValidKit({ api_key: process.env.VALIDKIT_API_KEY! })

  async _call(emails: string): Promise<string> {
    const emailList = emails.split(',').map(e => e.trim())
    
    const results = await this.client.verifyBatch(emailList, {
      format: 'compact', // Token efficient
      trace_id: `langchain-${Date.now()}`
    })
    
    const validEmails = Object.entries(results)
      .filter(([_, result]) => result.v)
      .map(([email]) => email)
    
    return `Valid emails: ${validEmails.join(', ')}`
  }
}
```

### AutoGPT Plugin

```typescript
import { ValidKit, ResponseFormat } from '@validkit/sdk'

export class EmailVerificationPlugin {
  private client: ValidKit

  constructor(apiKey: string) {
    this.client = new ValidKit({ 
      api_key: apiKey,
      user_agent: 'AutoGPT EmailVerification Plugin/1.0.0'
    })
  }

  async validateEmailList(emails: string[], agentId: string) {
    return await this.client.verifyBatch(emails, {
      format: ResponseFormat.COMPACT,
      trace_id: `autogpt-${agentId}`,
      progress_callback: (processed, total) => {
        console.log(`Agent ${agentId}: ${processed}/${total} emails processed`)
      }
    })
  }

  async validateLargeList(emails: string[], webhookUrl: string) {
    const job = await this.client.verifyBatchAsync(emails, {
      webhook_url: webhookUrl,
      format: ResponseFormat.COMPACT
    })
    
    return job.id
  }
}
```

### Vercel AI SDK Integration

```typescript
import { ValidKit } from '@validkit/sdk'
import { streamText } from 'ai'

const client = new ValidKit({ api_key: process.env.VALIDKIT_API_KEY! })

export async function validateAndProcess(emails: string[]) {
  // Validate emails first
  const results = await client.verifyBatch(emails, {
    format: 'compact'
  })
  
  const validEmails = Object.entries(results)
    .filter(([_, result]) => result.v)
    .map(([email]) => email)
  
  // Use validated emails in AI processing
  return streamText({
    model: openai('gpt-4'),
    prompt: `Process these validated emails: ${validEmails.join(', ')}`
  })
}
```

## TypeScript Types

### Core Interfaces

```typescript
// Pattern classification types
export type PatternType = 
  | 'developer_test'
  | 'plus_addressing'
  | 'system_email'
  | 'role_based'
  | 'temporary'
  | 'development_env'
  | 'ci_cd'
  | 'regular'

// Pattern classification result
export interface EmailClassification {
  pattern_type: PatternType
  developer_friendly: boolean
  confidence: number
  plus_addressing?: {
    hasPlusAddressing: boolean
    baseEmail: string
    tag: string
  }
  domain_info?: {
    category: string
    platform?: string
    isTemporary?: boolean
    developerFriendly: boolean
    supportsPlusAddressing?: boolean
  }
  metadata: Record<string, any>
}

// Recommendation for handling the email
export interface EmailRecommendation {
  action: 'accept' | 'accept_with_warning' | 'accept_with_flag' | 'normalize' | 'flag' | 'accept_for_dev'
  reason: string
  suggestion: string
}

// Enhanced email verification result
export interface DeveloperPatternResult extends EmailVerificationResult {
  // Pattern intelligence fields
  pattern_type?: PatternType
  developer_friendly?: boolean
  classification?: EmailClassification
  recommendations?: EmailRecommendation[]
}
```

### Usage with Types

```typescript
import { ValidKit, DeveloperPatternResult, PatternType } from '@validkit/sdk'

const client = new ValidKit({ api_key: 'your-key' })

// Type-safe email validation
const result: DeveloperPatternResult = await client.verifyEmail('test@example.com')

// Type guards for pattern handling
function isDeveloperTest(result: DeveloperPatternResult): boolean {
  return result.pattern_type === 'developer_test'
}

function handlePlusAddressing(result: DeveloperPatternResult): string | null {
  if (result.pattern_type === 'plus_addressing') {
    return result.classification?.plus_addressing?.baseEmail ?? null
  }
  return null
}

// Smart validation with type safety
function getValidationDecision(result: DeveloperPatternResult) {
  const decisions: Record<PatternType, { allow: boolean; message: string }> = {
    developer_test: { 
      allow: process.env.NODE_ENV !== 'production', 
      message: 'Test emails allowed in development' 
    },
    plus_addressing: { 
      allow: true, 
      message: 'Plus addressing supported' 
    },
    system_email: { 
      allow: true, 
      message: 'Valid system email' 
    },
    temporary: { 
      allow: false, 
      message: 'Temporary emails not allowed' 
    },
    regular: { 
      allow: result.valid, 
      message: result.valid ? 'Valid email' : 'Invalid email' 
    },
    role_based: { 
      allow: true, 
      message: 'Role-based email accepted with warning' 
    },
    development_env: { 
      allow: process.env.NODE_ENV === 'development', 
      message: 'Development emails allowed in dev environment' 
    },
    ci_cd: { 
      allow: true, 
      message: 'CI/CD system email accepted' 
    }
  }
  
  return decisions[result.pattern_type || 'regular']
}
```

## API Reference

### ValidKit Constructor

```typescript
const client = new ValidKit({
  api_key: string,           // Required: Your API key
  base_url?: string,         // Optional: API base URL
  timeout?: number,          // Optional: Request timeout (default: 30000ms)
  max_retries?: number,      // Optional: Max retry attempts (default: 3)
  default_chunk_size?: number, // Optional: Batch chunk size (default: 1000)
  user_agent?: string        // Optional: Custom user agent
})
```

### Single Email Verification

```typescript
await client.verifyEmail(email: string, options?: {
  format?: 'full' | 'compact',  // Response format
  trace_id?: string,            // Multi-agent tracing
  signal?: AbortSignal          // Cancel the request (and any pending retry) - see below
})
```

**Full Format Response with Pattern Intelligence:**
```typescript
{
  success: true,
  email: "test@example.com",
  valid: true,
  format: { valid: true },
  disposable: { valid: true, value: false },
  mx: { valid: true, records: ["mx1.example.com"] },
  smtp: { valid: true, code: 250 },
  processing_time_ms: 245,
  trace_id: "agent-123",
  
  // Pattern Intelligence Fields
  pattern_type: "developer_test",
  developer_friendly: true,
  classification: {
    pattern_type: "developer_test",
    developer_friendly: true,
    confidence: 0.95,
    metadata: {
      matched_pattern: "test"
    }
  },
  recommendations: [{
    action: "accept_with_flag",
    reason: "Common developer test pattern",
    suggestion: "Consider allowing for development/staging environments"
  }]
}
```

**Plus Addressing Example:**
```typescript
{
  success: true,
  email: "user+signup@gmail.com",
  valid: true,
  pattern_type: "plus_addressing",
  developer_friendly: true,
  classification: {
    pattern_type: "plus_addressing",
    confidence: 0.95,
    plus_addressing: {
      hasPlusAddressing: true,
      baseEmail: "user@gmail.com",
      tag: "signup"
    },
    domain_info: {
      category: "email_provider",
      platform: "gmail.com",
      supportsPlusAddressing: true,
      developerFriendly: true
    }
  },
  recommendations: [{
    action: "normalize",
    reason: "Plus addressing detected",
    suggestion: "Base email: user@gmail.com"
  }]
}
```

**System Email Example:**
```typescript
{
  success: true,
  email: "noreply@github.com",
  valid: true,
  pattern_type: "system_email",
  developer_friendly: true,
  classification: {
    pattern_type: "system_email",
    confidence: 0.98,
    domain_info: {
      category: "developer_tool",
      platform: "github.com",
      developerFriendly: true
    }
  },
  recommendations: [{
    action: "accept",
    reason: "Valid system email pattern",
    suggestion: "Typically used for automated notifications"
  }]
}
```

**Compact Format Response (80% smaller):**
```typescript
{
  v: true,    // valid
  d: false,   // disposable
  p: "developer_test", // pattern_type (when available)
  df: true,   // developer_friendly (when available)
  // r: "reason" (only if invalid)
}
```

> **Note:** The V1 API always returns full format responses. When compact format is requested, the SDK automatically transforms the response client-side to provide the expected compact format. The SDK also extracts the verification data from the API response wrapper for ease of use.

### Batch Email Verification

```typescript
await client.verifyBatch(emails: string[], options?: {
  format?: 'full' | 'compact',
  chunk_size?: number,
  progress_callback?: (processed: number, total: number) => void,
  trace_id?: string
})
```

### Async Batch Processing (10K+ emails)

```typescript
// Start async job
const job = await client.verifyBatchAsync(emails: string[], {
  format?: 'compact',
  webhook_url?: string,
  trace_id?: string
})

// Check job status
const status = await client.getBatchJob(job.id)

// Get results when complete
if (status.status === 'completed') {
  const results = await client.getBatchResults(job.id)
}

// Cancel if needed
await client.cancelBatchJob(job.id)
```

## Error Handling

The SDK provides comprehensive error handling:

```typescript
import { 
  ValidKitError, 
  RateLimitError, 
  BatchSizeError,
  InvalidAPIKeyError,
  AbortError
} from '@validkit/sdk'

try {
  const result = await client.verifyEmail('test@example.com')
} catch (error) {
  if (error instanceof RateLimitError) {
    const retryDelay = error.getRetryDelay()
    console.log(`Rate limited. Retry in ${retryDelay}ms`)
  } else if (error instanceof BatchSizeError) {
    console.log('Batch too large, use verifyBatchAsync')
  } else if (error instanceof InvalidAPIKeyError) {
    console.log('Check your API key')
  } else if (error instanceof AbortError) {
    console.log('Request was cancelled by the caller')
  }
}
```

## Cancelling a request

`verifyEmail` accepts an optional `signal`. Aborting it cancels the in-flight request - and, if
the SDK was mid-backoff waiting to retry a rate limit or transient error, the pending retry delay
too - instead of merely stopping your own `await`:

```typescript
import { ValidKit, AbortError } from '@validkit/sdk'

const client = new ValidKit({ api_key: process.env.VALIDKIT_API_KEY! })
const controller = new AbortController()
const deadline = setTimeout(() => controller.abort(), 3000)   // give up after 3s

try {
  const result = await client.verifyEmail('user@example.com', { signal: controller.signal })
} catch (error) {
  if (error instanceof AbortError) {
    console.log('Cancelled - no further retries were attempted')
  } else {
    throw error
  }
} finally {
  clearTimeout(deadline)   // stop the timer once settled, so it doesn't outlive the request
}
```

A cancelled request always rejects with `AbortError` - it never falls back to a degraded
`on_error: 'fail-open'`/`'local-fallback'` verdict, since an explicit cancel means stop, not
"guess and continue." Discriminate a cancellation with `instanceof AbortError` or
`error.code === 'ABORTED'` - not `error.name`, since a native `fetch` abort also carries
`name: 'AbortError'`.

`signal` is currently supported on `verifyEmail` only; `verifyBatch`/`verifyBatchAgent`/`verifyBatchAsync`
don't accept it yet.

## Resilience: on_error postures

When the API is unreachable after retries (a `ConnectionError`, `TimeoutError`, or a retryable
5xx `ServerError`), `verifyEmail` can take one of three postures, chosen via `on_error`:

| `on_error` | Effect after retries are exhausted |
|-----------|-----------------------------------|
| `'throw'` (default) | Re-throws the original error. Block the signup. Behavior is unchanged from prior versions. |
| `'fail-open'` | Accept unvalidated (`valid: true`, `degraded: true`, `source: 'fail-open'`, no checks ran). |
| `'local-fallback'` | Degrade to a local check: format always, plus MX and disposable if you opt in. |

When to use which: default to `'throw'` and let your own retry/queue handle an outage. Choose
`'local-fallback'` when a signup must proceed during an outage but you still want a real format (and
optionally MX/disposable) check. Choose `'fail-open'` only when accepting unvalidated input is
strictly better than blocking the user, and note the trade-off: during an outage it accepts every
syntactically-anything input, including addresses the API would reject. For inline signup
validation specifically, see [Fail open in signup flows](#fail-open-in-signup-flows) below, which
also bounds how long the user waits (`on_error` only acts after the SDK's own retries are exhausted).

The fallback always returns the full degraded verdict shape, even when you requested
`format: 'compact'`. Branch on `isDegraded(result)` before reading the compact `result.v`.

```typescript
import { ValidKit, isDegraded } from '@validkit/sdk'

const client = new ValidKit({ api_key: 'your-api-key', on_error: 'local-fallback' })

const result = await client.verifyEmail('user@example.com')
if (isDegraded(result)) {
  // The API was unreachable; this is a degraded local verdict, not a full one.
  console.log(result.source)       // 'local-fallback'
  console.log(result.checks_run)   // e.g. ['format', 'mx', 'disposable'] or ['format']
  console.log(result.confidence)   // capped, meaningful only when degraded
}
```

### Opt in to Tier 1 (MX + disposable)

Tier 0 (format) is always available and adds no weight. Tier 1 adds MX and disposable checks via
an optional peer dependency that you install yourself:

```bash
pnpm add node-email-verifier   # Node 20+, optional, never bundled, never installed by default
# or: npm i node-email-verifier / yarn add node-email-verifier
```

Without it (or in a browser, edge runtime, or Node < 20), `local-fallback` silently degrades to
the format-only floor and `checks_run` is `['format']`. The default install adds zero runtime
dependencies; nothing changes for the common case where you never opt in.

### What a degraded verdict means

A degraded verdict is NOT a full ValidKit verdict. It has no catch-all detection, no Signal Pool,
no v2 Allow / Review / Deny, and no developer-pattern intelligence (`test@`, plus addressing, and
role accounts are not specially handled locally). Key semantics:

- An inconclusive MX lookup (for example a timeout) is reported as `mx: { valid: false, reason: 'unknown' }`
  and never flips a real address to invalid. Only a conclusive MX-absent result makes `valid` false.
- A conclusive disposable hit makes `valid` false with `degraded_reason: 'disp'`.
- The local disposable list is a point-in-time snapshot that may lag the API.
- The format check is ASCII-oriented; rare internationalized (IDN), quoted-local, or IP-literal
  addresses that the API accepts may be marked invalid during an outage.
- `degraded_reason` values reuse the compact reason vocabulary (`syn`, `mx`, `disp`, `err`, `unk`).
- `local_fallback_mx_timeout` (default 2000 ms) bounds the Tier 1 check. This budget is additive
  to any preceding API retry and timeout budget, not a replacement for it.

### Security note

Enabling Tier 1 pulls a third-party package that performs live DNS into your application's trust
boundary. MX results are domain-level only and are not a mailbox or deliverability guarantee. If
you wire a telemetry sink (`telemetrySink`), its beacons carry domain, tier, and error class only,
never the raw email address.

## Fail open in signup flows

If you call ValidKit inline in a signup flow, make sure a ValidKit *error* never blocks a real signup. Block only on a definitive `valid: false` *result*. If a call throws a transient error (connection, timeout, 5xx, or rate limit), let the user through and re-check the email later. Email validation is best-effort enrichment, not a hard gate. A dropped connection mid-response surfaces as `ConnectionError: ... Premature close`, which the SDK retries automatically.

> **Prefer validating off the hot signup path.** A signup burst is exactly when you are most likely to hit a rate limit or a cold start, so inline validation is most fragile right when it matters most. The most robust pattern is to let the user in immediately, then validate asynchronously (after commit, via a job or webhook) and act on the result out of band. Use the inline pattern below only when you must have the verdict before the user proceeds.

If you do validate inline, two things matter: bound how long the *user* waits, and fail open on every transient error, not just connection drops.

```typescript
import { ValidKit, ConnectionError, TimeoutError, ServerError, RateLimitError } from '@validkit/sdk'

// Keep retries low on the signup path. The SDK applies `timeout` PER attempt and
// sleeps between retries (1s/2s/4s, or the rate-limit Retry-After - which defaults
// to ~60s), so a high max_retries can make a single call run for a long time. One
// quick retry is plenty inline; the async re-check below covers the rest.
const client = new ValidKit({
  api_key: process.env.VALIDKIT_API_KEY!,
  max_retries: 1,
  timeout: 2000
})

// Bound how long the USER waits - this is a deadline on the caller, not a cancel.
// Promise.race here only stops AWAITING verifyEmail; it doesn't cancel the underlying
// request. For a leak-free version of this same pattern, pass a `signal` instead (see
// "Cancelling a request" above) - combining the signup deadline with an aborting
// signal actually stops the in-flight request, not just your wait.
const SIGNUP_DEADLINE_MS = 3000

async function emailBlocksSignup(email: string): Promise<boolean> {
  let deadline: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      client.verifyEmail(email),
      new Promise<never>((_, reject) => {
        deadline = setTimeout(() => reject(new TimeoutError('signup deadline exceeded')), SIGNUP_DEADLINE_MS)
      })
    ])
    // verifyEmail returns the full or compact result shape; narrow before reading the verdict
    return 'valid' in result ? result.valid === false : result.v === false   // block ONLY on a definitive invalid result
  } catch (error) {
    // Fail open on ANY transient ValidKit error: connection, timeout, 5xx, rate
    // limit, or our own deadline. The SDK retries all of these, so reaching here
    // means it could not get a definitive answer; don't punish the user for that.
    if (
      error instanceof ConnectionError ||
      error instanceof TimeoutError ||
      error instanceof ServerError ||
      error instanceof RateLimitError
    ) {
      // Optionally queue `email` for an async re-check and log it for monitoring.
      return false
    }
    throw error   // config errors (e.g. InvalidAPIKeyError) are real bugs - surface them
  } finally {
    clearTimeout(deadline)   // happy path: stop the deadline timer so it can't fire (or leak) later
  }
}
```

**Why:** The SDK retries `ConnectionError`, `TimeoutError`, `ServerError`, and `RateLimitError` up to `max_retries`, applying `timeout` to each attempt and backing off between tries (1s/2s/4s, or the rate-limit `Retry-After`). The `Promise.race` deadline bounds how long the *user* waits, but it does not by itself cancel the request - pass a `signal` (see [Cancelling a request](#cancelling-a-request)) if you want the underlying request stopped too, and prefer the async pattern above when you expect bursts. Fail open on every transient error that survives retries, not just connection drops, and reserve hard blocks for a definitive `valid: false`.

## Performance Benchmarks

ValidKit vs Competitors for 10,000 email verification:

| Provider | Time | Response Size | Batch Support |
|----------|------|---------------|---------------|
| **ValidKit** | **4.8s** | **~2KB** | ✅ 10K emails |
| Competitor A | 167 min | ~8KB | ❌ Sequential only |
| Competitor B | N/A | N/A | ❌ No batch support |

## Rate Limits

ValidKit provides high-volume rate limits:

- **Free Tier**: 1,000 requests/minute
- **Pro Tier**: 10,000 requests/minute  
- **Enterprise**: 100,000+ requests/minute

## Distributed Request Tracing

Track requests across distributed systems:

```typescript
// Agent 1
await client.verifyBatch(emails1, { 
  trace_id: 'workflow-abc-agent1' 
})

// Agent 2  
await client.verifyBatch(emails2, { 
  trace_id: 'workflow-abc-agent2' 
})

// All requests with same trace_id are correlated in logs
```

## Express.js API Server

```typescript
// server.ts
import express from 'express'
import { ValidKit, DeveloperPatternResult } from '@validkit/sdk'
import { body, validationResult } from 'express-validator'

const app = express()
const client = new ValidKit({ api_key: process.env.VALIDKIT_API_KEY! })

app.use(express.json())

// Smart email validation endpoint
app.post('/validate-email', 
  body('email').isEmail(),
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    
    try {
      const result: DeveloperPatternResult = await client.verifyEmail(req.body.email, {
        format: 'full'
      })
      
      // Environment-aware validation logic
      const isProduction = process.env.NODE_ENV === 'production'
      const allowedInProduction = result.valid && 
        !['developer_test', 'temporary'].includes(result.pattern_type || '')
      
      const response = {
        valid: result.valid,
        pattern: {
          type: result.pattern_type,
          friendly: result.developer_friendly,
          confidence: result.classification?.confidence
        },
        production_ready: isProduction ? allowedInProduction : result.valid,
        recommendations: result.recommendations,
        
        // Normalized email for plus addressing
        ...(result.pattern_type === 'plus_addressing' && {
          normalized: result.classification?.plus_addressing?.baseEmail
        })
      }
      
      res.json(response)
    } catch (error) {
      res.status(500).json({ error: 'Validation service unavailable' })
    }
  }
)

app.listen(3000, () => console.log('Server running on port 3000'))
```

## Advanced Pattern Handling

### Bulk Processing with Pattern Analysis

```typescript
import { ValidKit, DeveloperPatternResult, PatternType } from '@validkit/sdk'

const client = new ValidKit({ api_key: 'your-key' })

// Analyze email patterns in bulk
async function analyzeEmailPatterns(emails: string[]) {
  const results = await client.verifyBatch(emails, {
    format: 'full' // Get full pattern intelligence
  })
  
  // Type-safe pattern analysis
  const analysis = {
    total: emails.length,
    valid: 0,
    patterns: {} as Record<PatternType, number>,
    recommendations: {
      accept: [],
      flag: [],
      normalize: []
    } as Record<string, string[]>
  }
  
  Object.entries(results).forEach(([email, result]) => {
    if ('valid' in result && result.valid) {
      analysis.valid++
    }
    
    const pattern = result.pattern_type || 'regular'
    analysis.patterns[pattern] = (analysis.patterns[pattern] || 0) + 1
    
    // Group by primary recommendation
    const primaryRec = result.recommendations?.[0]
    if (primaryRec) {
      if (!analysis.recommendations[primaryRec.action]) {
        analysis.recommendations[primaryRec.action] = []
      }
      analysis.recommendations[primaryRec.action].push(email)
    }
  })
  
  return analysis
}

// Usage
const emails = [
  'test@company.com',
  'user+signup@gmail.com', 
  'noreply@service.com',
  'temp@10minutemail.com'
]

const analysis = await analyzeEmailPatterns(emails)
console.log('Pattern distribution:', analysis.patterns)
// Output: { developer_test: 1, plus_addressing: 1, system_email: 1, temporary: 1 }
```

## TypeScript Support

Full TypeScript definitions included with pattern intelligence:

```typescript
import { 
  EmailVerificationResult,
  DeveloperPatternResult,
  EmailClassification,
  PatternType,
  EmailRecommendation,
  CompactResult,
  BatchJob,
  ResponseFormat
} from '@validkit/sdk'

// Type-safe email verification
const result: DeveloperPatternResult = await client.verifyEmail(
  'test@example.com',
  { format: ResponseFormat.FULL }
)

// Type guards for pattern handling
function isPlus(result: DeveloperPatternResult): result is DeveloperPatternResult & {
  pattern_type: 'plus_addressing'
  classification: EmailClassification
} {
  return result.pattern_type === 'plus_addressing'
}

if (isPlus(result)) {
  // TypeScript knows classification exists and has plus_addressing
  console.log(result.classification.plus_addressing?.baseEmail)
}
```

## Error Handling

Comprehensive error handling with typed exceptions:

```typescript
import { ValidKit, ValidationError, RateLimitError, BatchSizeError } from '@validkit/sdk';

try {
  const result = await client.verifyEmail('invalid@email');
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof ValidationError) {
    console.log(`Validation error: ${error.message}`);
  } else if (error instanceof BatchSizeError) {
    console.log(`Batch too large: ${error.message}`);
  }
}
```

## Utility Functions

ValidKit SDK includes helpful utility functions for working with patterns:

```typescript
import { 
  ValidKit, 
  isDeveloperTest, 
  isPlusAddressing, 
  isSystemEmail, 
  isTemporary,
  isDeveloperFriendly 
} from '@validkit/sdk'

const client = new ValidKit({ api_key: 'your-key' })
const result = await client.verifyEmail('user+test@gmail.com')

// Type-safe utility functions
if (isDeveloperTest(result)) {
  console.log('This is a test email')
}

if (isPlusAddressing(result)) {
  // TypeScript knows classification.plus_addressing exists
  console.log('Base:', result.classification.plus_addressing.baseEmail)
  console.log('Tag:', result.classification.plus_addressing.tag)
}

if (isSystemEmail(result)) {
  console.log('System email detected')
}

if (isTemporary(result)) {
  console.log('Temporary email service')
}

if (isDeveloperFriendly(result)) {
  console.log('Developer-friendly pattern detected')
}

// Smart email normalization
function normalizeEmail(result: DeveloperPatternResult): string {
  if (isPlusAddressing(result)) {
    return result.classification.plus_addressing.baseEmail
  }
  return result.email
}

// Environment-aware validation
function isProductionReady(result: DeveloperPatternResult): boolean {
  const blockedInProduction = ['developer_test', 'temporary']
  return result.valid && !blockedInProduction.includes(result.pattern_type || '')
}
```

## Pattern-Based Routing

```typescript
// Route emails based on patterns
function routeEmail(result: DeveloperPatternResult) {
  const routes = {
    plus_addressing: () => ({
      action: 'normalize',
      email: result.classification?.plus_addressing?.baseEmail || result.email,
      tag: result.classification?.plus_addressing?.tag
    }),
    
    developer_test: () => ({
      action: 'flag_for_review',
      reason: 'Test email in production environment'
    }),
    
    system_email: () => ({
      action: 'accept',
      note: 'Valid system email pattern'
    }),
    
    temporary: () => ({
      action: 'reject',
      reason: 'Temporary email services not allowed'
    }),
    
    regular: () => ({
      action: result.valid ? 'accept' : 'reject'
    })
  }
  
  const router = routes[result.pattern_type || 'regular']
  return router()
}

// Usage
const result = await client.verifyEmail('user+signup@gmail.com')
const routing = routeEmail(result)
// { action: 'normalize', email: 'user@gmail.com', tag: 'signup' }
```

## TypeScript Configuration

For best TypeScript experience, ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## Browser Support

Works in both Node.js and browser environments:

```html
<!-- Browser via CDN -->
<script src="https://unpkg.com/@validkit/sdk@latest/dist/browser.js"></script>
<script>
  const client = new ValidKit.Client({ apiKey: 'your_api_key' });
  
  // Pattern intelligence works in browser too
  client.verifyEmail('test@example.com').then(result => {
    if (result.developer_friendly) {
      console.log('Developer pattern:', result.pattern_type)
    }
  })
</script>
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/ValidKit/validkit-typescript-sdk.git
cd typescript-sdk

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the project
pnpm run build

# Run in development mode
pnpm run dev
```

## Support

- 📖 **Documentation**: https://docs.validkit.com
- 🔧 **API Reference**: https://api.validkit.com/api/v1/openapi.json
- 🐛 **Issues**: https://github.com/ValidKit/validkit-typescript-sdk/issues
- 📧 **Email**: support@validkit.com
- 💬 **Discord**: [Join our community](https://discord.gg/validkit)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built for developers who understand that `test@example.com` isn't a typo. 🧠⚡

**Key Features:**
- 🎯 **Pattern Intelligence**: Recognizes developer email patterns
- 🔒 **Type Safety**: Full TypeScript support with intelligent types
- ⚡ **Performance**: Optimized for high-volume validation
- 🌍 **Universal**: Works in Node.js, browsers, and edge functions
- 🔗 **Framework Ready**: Built-in Next.js, React, Express examples

Made with ❤️ by [ValidKit](https://validkit.com) - Email validation that thinks like a developer.