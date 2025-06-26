# ValidKit TypeScript SDK

[![npm version](https://badge.fury.io/js/%40validkit%2Fsdk.svg)](https://badge.fury.io/js/%40validkit%2Fsdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Documentation](https://img.shields.io/badge/docs-available-brightgreen.svg)](https://docs.validkit.com)
[![npm downloads](https://img.shields.io/npm/dm/@validkit/sdk.svg)](https://www.npmjs.com/package/@validkit/sdk)

**AI Agent Optimized Email Verification SDK**

The official TypeScript/JavaScript SDK for ValidKit Email Verification API, designed specifically for AI agents with:

- 🚀 **Agent-scale rate limits** (1,000+ req/min)
- 📦 **Bulk processing** (10,000+ emails per request)
- ⚡ **Token-optimized responses** (80% smaller than competitors)
- 🔗 **Multi-agent tracing** capabilities
- 🔄 **Async processing** with webhooks

**Full API Documentation**: https://api.validkit.com/docs/openapi.json

## Installation

```bash
npm install @validkit/sdk
# or
yarn add @validkit/sdk
# or
pnpm add @validkit/sdk
```

## Quick Start

```typescript
import { ValidKit } from '@validkit/sdk'

const client = new ValidKit({
  api_key: 'your-api-key-here'
})

// Single email verification
const result = await client.verifyEmail('test@example.com')
console.log(result.valid) // true/false

// Batch verification with progress tracking
const emails = ['email1@test.com', 'email2@test.com', /* ... up to 10K emails */]
const results = await client.verifyBatch(emails, {
  format: 'compact', // 80% smaller responses
  progress_callback: (processed, total) => {
    console.log(`Progress: ${processed}/${total}`)
  }
})
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
  trace_id?: string             // Multi-agent tracing
})
```

**Full Format Response:**
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
  trace_id: "agent-123"
}
```

**Compact Format Response (80% smaller):**
```typescript
{
  v: true,    // valid
  d: false,   // disposable
  // r: "reason" (only if invalid)
}
```

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
  InvalidAPIKeyError 
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
  }
}
```

## Performance Benchmarks

ValidKit vs Competitors for 10,000 email verification:

| Provider | Time | Response Size | Batch Support |
|----------|------|---------------|---------------|
| **ValidKit** | **4.8s** | **~2KB** | ✅ 10K emails |
| Competitor A | 167 min | ~8KB | ❌ Sequential only |
| Competitor B | N/A | N/A | ❌ No batch support |

## Rate Limits

ValidKit provides agent-scale rate limits:

- **Free Tier**: 1,000 requests/minute
- **Pro Tier**: 10,000 requests/minute  
- **Enterprise**: 100,000+ requests/minute

## Multi-Agent Tracing

Track requests across distributed agent systems:

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

## TypeScript Support

Full TypeScript definitions included:

```typescript
import { 
  EmailVerificationResult,
  CompactResult,
  BatchJob,
  ResponseFormat
} from '@validkit/sdk'

const result: EmailVerificationResult = await client.verifyEmail(
  'test@example.com',
  { format: ResponseFormat.FULL }
)
```

## Error Handling

Comprehensive error handling with typed exceptions:

```typescript
import { ValidKit, ValidationError, RateLimitError } from '@validkit/sdk';

try {
  const result = await client.verifyEmail('invalid@email');
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof ValidationError) {
    console.log(`Validation error: ${error.message}`);
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
</script>
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/validkit/typescript-sdk.git
cd typescript-sdk

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Run in development mode
npm run dev
```

## Support

- 📖 **Documentation**: https://docs.validkit.com
- 🔧 **API Reference**: https://api.validkit.com/docs/openapi.json
- 🐛 **Issues**: https://github.com/validkit/typescript-sdk/issues
- 📧 **Email**: support@validkit.com
- 💬 **Discord**: [Join our community](https://discord.gg/validkit)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built for the AI agent era. Validate at the speed of thought. ⚡

Made with ❤️ by [ValidKit](https://validkit.com)