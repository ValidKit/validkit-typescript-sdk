/**
 * AI Agent Workflow Examples for ValidKit TypeScript SDK
 * 
 * Examples showcasing integration with popular AI frameworks:
 * - LangChain email validation tool
 * - AutoGPT plugin pattern
 * - Vercel AI SDK integration
 * - CrewAI agent workflow
 */

import { ValidKit, ResponseFormat, BatchJob } from '../src/index'

// Initialize client
const client = new ValidKit({
  api_key: process.env.VALIDKIT_API_KEY || 'your-api-key-here',
  user_agent: 'AI-Agent-Examples/1.0.0'
})

/**
 * Example 1: LangChain Email Validation Tool
 */
export class EmailValidationTool {
  name = 'email_validator'
  description = 'Validate email addresses for deliverability and detect disposable emails'
  
  private client: ValidKit
  
  constructor(apiKey: string) {
    this.client = new ValidKit({ 
      api_key: apiKey,
      user_agent: 'LangChain EmailValidationTool/1.0.0'
    })
  }

  async _call(input: string): Promise<string> {
    try {
      // Parse input - could be single email or comma-separated list
      const emails = input.split(',').map(e => e.trim()).filter(Boolean)
      
      if (emails.length === 0) {
        return 'No valid email addresses provided'
      }
      
      if (emails.length === 1) {
        // Single email verification
        const result = await this.client.verifyEmail(emails[0], {
          format: ResponseFormat.COMPACT,
          trace_id: `langchain-${Date.now()}`
        })
        
        return `Email ${emails[0]} is ${result.v ? 'valid' : 'invalid'}${
          result.d ? ' (disposable)' : ''
        }`
      } else {
        // Batch verification
        const results = await this.client.verifyBatch(emails, {
          format: ResponseFormat.COMPACT,
          trace_id: `langchain-batch-${Date.now()}`
        })
        
        const validEmails = Object.entries(results)
          .filter(([_, result]) => result.v && !result.d)
          .map(([email]) => email)
        
        const disposableEmails = Object.entries(results)
          .filter(([_, result]) => result.d)
          .map(([email]) => email)
        
        return [
          `Validation Results:`,
          `Valid emails (${validEmails.length}): ${validEmails.join(', ') || 'None'}`,
          `Disposable emails (${disposableEmails.length}): ${disposableEmails.join(', ') || 'None'}`,
          `Total processed: ${emails.length}`
        ].join('\n')
      }
    } catch (error) {
      return `Email validation failed: ${error.message}`
    }
  }
}

/**
 * Example 2: AutoGPT Plugin Pattern
 */
export class AutoGPTEmailPlugin {
  private client: ValidKit
  private agentId: string

  constructor(apiKey: string, agentId: string) {
    this.client = new ValidKit({ 
      api_key: apiKey,
      user_agent: `AutoGPT-Agent-${agentId}/1.0.0`
    })
    this.agentId = agentId
  }

  /**
   * Validate a list of emails for the agent
   */
  async validateEmailList(
    emails: string[], 
    options: { allowDisposable?: boolean } = {}
  ): Promise<{
    valid: string[]
    invalid: string[]
    disposable: string[]
    summary: string
  }> {
    console.log(`[Agent ${this.agentId}] Validating ${emails.length} emails...`)
    
    const results = await this.client.verifyBatch(emails, {
      format: ResponseFormat.COMPACT,
      trace_id: `autogpt-${this.agentId}-${Date.now()}`,
      progress_callback: (processed, total) => {
        console.log(`[Agent ${this.agentId}] Progress: ${processed}/${total}`)
      }
    })

    const valid: string[] = []
    const invalid: string[] = []
    const disposable: string[] = []

    Object.entries(results).forEach(([email, result]) => {
      if (result.v) {
        if (result.d) {
          disposable.push(email)
          if (options.allowDisposable) {
            valid.push(email)
          }
        } else {
          valid.push(email)
        }
      } else {
        invalid.push(email)
      }
    })

    const summary = [
      `Email validation completed for Agent ${this.agentId}:`,
      `- Valid emails: ${valid.length}`,
      `- Invalid emails: ${invalid.length}`,
      `- Disposable emails: ${disposable.length}`,
      `- Success rate: ${Math.round((valid.length / emails.length) * 100)}%`
    ].join('\n')

    console.log(summary)

    return { valid, invalid, disposable, summary }
  }

  /**
   * Start async validation for large lists
   */
  async validateLargeList(emails: string[], webhookUrl?: string): Promise<string> {
    const job = await this.client.verifyBatchAsync(emails, {
      format: ResponseFormat.COMPACT,
      webhook_url: webhookUrl,
      trace_id: `autogpt-${this.agentId}-async-${Date.now()}`
    })
    
    console.log(`[Agent ${this.agentId}] Started async validation job: ${job.id}`)
    return job.id
  }

  /**
   * Monitor async job progress
   */
  async monitorJob(jobId: string): Promise<void> {
    console.log(`[Agent ${this.agentId}] Monitoring job ${jobId}...`)
    
    while (true) {
      const job = await this.client.getBatchJob(jobId)
      
      console.log(`[Agent ${this.agentId}] Job ${jobId}: ${job.status} (${job.processed}/${job.total_emails})`)
      
      if (job.status === 'completed') {
        const results = await this.client.getBatchResults(jobId)
        console.log(`[Agent ${this.agentId}] Job completed! Valid: ${results.valid}/${results.total}`)
        break
      } else if (job.status === 'failed') {
        console.error(`[Agent ${this.agentId}] Job failed: ${job.error}`)
        break
      }
      
      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
}

/**
 * Example 3: Vercel AI SDK Integration
 */
export async function validateEmailsForAI(
  emails: string[],
  context: { userId?: string; sessionId?: string } = {}
): Promise<{
  validEmails: string[]
  metadata: {
    totalProcessed: number
    validCount: number
    invalidCount: number
    disposableCount: number
    processingTimeMs: number
  }
}> {
  const startTime = Date.now()
  const traceId = `vercel-ai-${context.sessionId || 'unknown'}-${startTime}`
  
  console.log(`🤖 Validating emails for AI processing (trace: ${traceId})`)
  
  const results = await client.verifyBatch(emails, {
    format: ResponseFormat.COMPACT,
    trace_id: traceId
  })
  
  const validEmails: string[] = []
  let disposableCount = 0
  let invalidCount = 0
  
  Object.entries(results).forEach(([email, result]) => {
    if (result.v) {
      validEmails.push(email)
      if (result.d) disposableCount++
    } else {
      invalidCount++
    }
  })
  
  const processingTimeMs = Date.now() - startTime
  
  const metadata = {
    totalProcessed: emails.length,
    validCount: validEmails.length,
    invalidCount,
    disposableCount,
    processingTimeMs
  }
  
  console.log(`✅ Validation complete:`, metadata)
  
  return { validEmails, metadata }
}

/**
 * Example 4: CrewAI Multi-Agent Workflow
 */
export class CrewAIEmailValidator {
  private client: ValidKit
  private crewId: string

  constructor(apiKey: string, crewId: string) {
    this.client = new ValidKit({ 
      api_key: apiKey,
      user_agent: `CrewAI-${crewId}/1.0.0`
    })
    this.crewId = crewId
  }

  /**
   * Distribute email validation across multiple agents
   */
  async distributeValidation(
    emails: string[],
    agentCount: number = 3
  ): Promise<Record<string, any>> {
    console.log(`🚀 CrewAI: Distributing ${emails.length} emails across ${agentCount} agents`)
    
    // Split emails into chunks for each agent
    const chunkSize = Math.ceil(emails.length / agentCount)
    const chunks = []
    
    for (let i = 0; i < emails.length; i += chunkSize) {
      chunks.push(emails.slice(i, i + chunkSize))
    }
    
    // Process chunks in parallel with different agents
    const agentPromises = chunks.map(async (chunk, agentIndex) => {
      const agentId = `agent-${agentIndex + 1}`
      console.log(`🤖 ${agentId}: Processing ${chunk.length} emails`)
      
      const results = await this.client.verifyBatch(chunk, {
        format: ResponseFormat.COMPACT,
        trace_id: `crewai-${this.crewId}-${agentId}-${Date.now()}`,
        progress_callback: (processed, total) => {
          console.log(`🤖 ${agentId}: ${processed}/${total} completed`)
        }
      })
      
      return { agentId, results, count: chunk.length }
    })
    
    // Wait for all agents to complete
    const agentResults = await Promise.all(agentPromises)
    
    // Combine results
    const combinedResults: Record<string, any> = {}
    let totalValid = 0
    let totalProcessed = 0
    
    agentResults.forEach(({ agentId, results, count }) => {
      Object.assign(combinedResults, results)
      const validCount = Object.values(results).filter((r: any) => r.v).length
      totalValid += validCount
      totalProcessed += count
      
      console.log(`✅ ${agentId}: ${validCount}/${count} valid emails`)
    })
    
    console.log(`🎯 CrewAI Complete: ${totalValid}/${totalProcessed} valid emails`)
    
    return {
      results: combinedResults,
      summary: {
        totalProcessed,
        totalValid,
        agentCount: agentResults.length,
        successRate: Math.round((totalValid / totalProcessed) * 100)
      }
    }
  }
}

/**
 * Example 5: Real-time Agent Validation Stream
 */
export class RealTimeEmailValidator {
  private client: ValidKit
  private queue: string[] = []
  private processing = false
  private batchSize = 100
  private batchTimeout = 5000 // 5 seconds

  constructor(apiKey: string) {
    this.client = new ValidKit({ 
      api_key: apiKey,
      user_agent: 'RealTimeAgent/1.0.0'
    })
  }

  /**
   * Add email to validation queue
   */
  queueEmail(email: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push(email)
      
      // Store resolver for this email
      ;(this as any)[email] = { resolve, reject }
      
      this.processBatch()
    })
  }

  /**
   * Process queued emails in batches
   */
  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) return
    
    this.processing = true
    
    // Wait for batch to fill or timeout
    await new Promise(resolve => setTimeout(resolve, this.batchTimeout))
    
    if (this.queue.length === 0) {
      this.processing = false
      return
    }
    
    const batch = this.queue.splice(0, this.batchSize)
    console.log(`🔄 Processing batch of ${batch.length} emails`)
    
    try {
      const results = await this.client.verifyBatch(batch, {
        format: ResponseFormat.COMPACT,
        trace_id: `realtime-${Date.now()}`
      })
      
      // Resolve individual promises
      Object.entries(results).forEach(([email, result]) => {
        const pending = (this as any)[email]
        if (pending) {
          pending.resolve(result)
          delete (this as any)[email]
        }
      })
      
    } catch (error) {
      // Reject all pending promises
      batch.forEach(email => {
        const pending = (this as any)[email]
        if (pending) {
          pending.reject(error)
          delete (this as any)[email]
        }
      })
    }
    
    this.processing = false
    
    // Process next batch if queue not empty
    if (this.queue.length > 0) {
      this.processBatch()
    }
  }
}

// Example usage demonstrations
export async function runAIAgentExamples(): Promise<void> {
  console.log('🤖 AI Agent Workflow Examples\n')
  
  // Example 1: LangChain Tool
  console.log('1. LangChain Email Validation Tool')
  const langchainTool = new EmailValidationTool(process.env.VALIDKIT_API_KEY!)
  const result1 = await langchainTool._call('test@example.com,invalid-email,user@tempmail.com')
  console.log(result1)
  console.log()
  
  // Example 2: AutoGPT Plugin
  console.log('2. AutoGPT Plugin Pattern')
  const autoGPTPlugin = new AutoGPTEmailPlugin(process.env.VALIDKIT_API_KEY!, 'agent-007')
  const result2 = await autoGPTPlugin.validateEmailList([
    'user1@gmail.com',
    'user2@yahoo.com', 
    'invalid@email',
    'temp@guerrillamail.com'
  ])
  console.log(result2.summary)
  console.log()
  
  // Example 3: Vercel AI SDK
  console.log('3. Vercel AI SDK Integration')
  const result3 = await validateEmailsForAI([
    'ai@example.com',
    'bot@assistant.com',
    'invalid-email'
  ], { sessionId: 'demo-session' })
  console.log('Valid emails for AI:', result3.validEmails)
  console.log('Metadata:', result3.metadata)
  console.log()
  
  // Example 4: CrewAI
  console.log('4. CrewAI Multi-Agent Workflow')
  const crewValidator = new CrewAIEmailValidator(process.env.VALIDKIT_API_KEY!, 'email-crew')
  const testEmails = Array.from({ length: 50 }, (_, i) => `user${i}@example.com`)
  const result4 = await crewValidator.distributeValidation(testEmails, 3)
  console.log('CrewAI Summary:', result4.summary)
  
  console.log('\n✅ AI Agent examples completed!')
}

// Run if called directly
if (require.main === module) {
  runAIAgentExamples().catch(console.error)
}