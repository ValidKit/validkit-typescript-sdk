/**
 * Async Batch Processing Examples for ValidKit TypeScript SDK
 * 
 * Demonstrates handling large email lists (10K+) with async processing,
 * webhooks, job monitoring, and error recovery
 */

import { ValidKit, BatchJob, BatchJobStatus } from '../src/index'

// Initialize client
const client = new ValidKit({
  api_key: process.env.VALIDKIT_API_KEY || 'your-api-key-here',
  user_agent: 'AsyncBatchExamples/1.0.0'
})

/**
 * Example 1: Basic Async Batch Processing
 */
async function basicAsyncBatch(): Promise<void> {
  console.log('🚀 Starting basic async batch processing...')
  
  // Generate large email list (10K+ emails)
  const emails = Array.from({ length: 15000 }, (_, i) => {
    const domains = ['gmail.com', 'yahoo.com', 'example.com', 'tempmail.com']
    const domain = domains[i % domains.length]
    return `user${i}@${domain}`
  })
  
  console.log(`📧 Generated ${emails.length} emails for processing`)
  
  try {
    // Start async batch job
    const job = await client.verifyBatchAsync(emails, {
      format: 'compact', // Token efficient for large batches
      trace_id: `async-batch-${Date.now()}`
    })
    
    console.log(`✅ Job created: ${job.id}`)
    console.log(`📊 Total emails: ${job.total_emails}`)
    console.log(`🔗 Status URL: ${job.status_url}`)
    
    // Monitor job progress
    await monitorJobProgress(job.id)
    
  } catch (error) {
    console.error('❌ Error starting async batch:', error.message)
  }
}

/**
 * Example 2: Async Batch with Webhook
 */
async function asyncBatchWithWebhook(): Promise<void> {
  console.log('🔔 Starting async batch with webhook notification...')
  
  const emails = Array.from({ length: 5000 }, (_, i) => `webhook-test-${i}@example.com`)
  
  try {
    const job = await client.verifyBatchAsync(emails, {
      format: 'compact',
      webhook_url: 'https://your-app.com/webhook/validkit', // Replace with your webhook URL
      trace_id: `webhook-batch-${Date.now()}`
    })
    
    console.log(`✅ Job with webhook created: ${job.id}`)
    console.log(`🔔 Webhook URL: ${job.webhook_url}`)
    console.log(`📧 Will notify when ${job.total_emails} emails are processed`)
    
    // You can also monitor manually while waiting for webhook
    console.log('🔍 Monitoring progress (webhook will also notify when complete)...')
    await monitorJobProgress(job.id, { webhookMode: true })
    
  } catch (error) {
    console.error('❌ Error with webhook batch:', error.message)
  }
}

/**
 * Example 3: Job Progress Monitoring with Detailed Logging
 */
async function monitorJobProgress(
  jobId: string, 
  options: { webhookMode?: boolean; maxWaitTime?: number } = {}
): Promise<BatchJob> {
  const { webhookMode = false, maxWaitTime = 300000 } = options // 5 min default
  const startTime = Date.now()
  
  console.log(`📊 Monitoring job ${jobId}...`)
  
  while (true) {
    try {
      const job = await client.getBatchJob(jobId)
      
      // Calculate progress percentage
      const progressPercent = job.total_emails > 0 
        ? Math.round((job.processed / job.total_emails) * 100) 
        : 0
      
      // Log detailed progress
      console.log([
        `🔄 Job ${jobId}:`,
        `Status: ${job.status}`,
        `Progress: ${job.processed}/${job.total_emails} (${progressPercent}%)`,
        `Valid: ${job.valid}`,
        `Invalid: ${job.invalid}`,
        `Updated: ${new Date(job.updated_at).toLocaleTimeString()}`
      ].join(' | '))
      
      // Check if job is complete
      if (job.status === BatchJobStatus.COMPLETED) {
        console.log(`✅ Job completed successfully!`)
        console.log(`📈 Final results: ${job.valid} valid, ${job.invalid} invalid`)
        
        // Get detailed results
        try {
          const results = await client.getBatchResults(jobId)
          console.log(`📋 Results retrieved: ${Object.keys(results.results).length} email results`)
          
          // Sample some results
          const sampleEmails = Object.entries(results.results).slice(0, 5)
          console.log('📧 Sample results:')
          sampleEmails.forEach(([email, result]) => {
            console.log(`  ${email}: ${result.v ? '✅ Valid' : '❌ Invalid'}${result.d ? ' (Disposable)' : ''}`)
          })
          
        } catch (error) {
          console.error('❌ Error retrieving results:', error.message)
        }
        
        return job
      }
      
      if (job.status === BatchJobStatus.FAILED) {
        console.error(`❌ Job failed: ${job.error}`)
        if (job.failed_emails?.length) {
          console.error(`💥 Failed emails (${job.failed_emails.length}):`, job.failed_emails.slice(0, 10))
        }
        throw new Error(`Job failed: ${job.error}`)
      }
      
      if (job.status === BatchJobStatus.CANCELLED) {
        console.log('🛑 Job was cancelled')
        return job
      }
      
      // Check timeout
      if (Date.now() - startTime > maxWaitTime) {
        console.log(`⏰ Max wait time reached (${maxWaitTime}ms), stopping monitoring`)
        if (!webhookMode) {
          console.log('💡 Consider using webhook notifications for long-running jobs')
        }
        return job
      }
      
      // Wait before next check (longer intervals for webhook mode)
      const waitTime = webhookMode ? 30000 : 10000 // 30s vs 10s
      await new Promise(resolve => setTimeout(resolve, waitTime))
      
    } catch (error) {
      console.error(`❌ Error checking job status: ${error.message}`)
      
      // Wait and retry for transient errors
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
}

/**
 * Example 4: Multiple Concurrent Jobs
 */
async function multipleConcurrentJobs(): Promise<void> {
  console.log('🎯 Starting multiple concurrent async jobs...')
  
  const jobConfigs = [
    { name: 'Gmail Users', count: 3000, domain: 'gmail.com' },
    { name: 'Yahoo Users', count: 2500, domain: 'yahoo.com' },
    { name: 'Corporate Users', count: 4000, domain: 'company.com' },
    { name: 'Mixed Domains', count: 2000, domain: 'mixed' }
  ]
  
  try {
    // Start all jobs concurrently
    const jobPromises = jobConfigs.map(async (config, index) => {
      const emails = Array.from({ length: config.count }, (_, i) => {
        if (config.domain === 'mixed') {
          const domains = ['hotmail.com', 'outlook.com', 'example.com']
          const domain = domains[i % domains.length]
          return `${config.name.toLowerCase().replace(' ', '')}-${i}@${domain}`
        }
        return `user${i}@${config.domain}`
      })
      
      const job = await client.verifyBatchAsync(emails, {
        format: 'compact',
        trace_id: `concurrent-job-${index}-${Date.now()}`
      })
      
      console.log(`🚀 Started ${config.name}: Job ${job.id} (${config.count} emails)`)
      return { ...config, job }
    })
    
    const startedJobs = await Promise.all(jobPromises)
    console.log(`✅ All ${startedJobs.length} jobs started successfully`)
    
    // Monitor all jobs concurrently
    const monitorPromises = startedJobs.map(async ({ name, job }) => {
      console.log(`📊 Monitoring ${name} (${job.id})...`)
      const finalJob = await monitorJobProgress(job.id, { maxWaitTime: 600000 }) // 10 min
      return { name, finalJob }
    })
    
    const completedJobs = await Promise.all(monitorPromises)
    
    // Summary report
    console.log('\n📈 FINAL SUMMARY:')
    let totalEmails = 0
    let totalValid = 0
    
    completedJobs.forEach(({ name, finalJob }) => {
      totalEmails += finalJob.total_emails
      totalValid += finalJob.valid
      
      const successRate = Math.round((finalJob.valid / finalJob.total_emails) * 100)
      console.log(`${name}: ${finalJob.valid}/${finalJob.total_emails} valid (${successRate}%)`)
    })
    
    const overallSuccessRate = Math.round((totalValid / totalEmails) * 100)
    console.log(`\n🎯 OVERALL: ${totalValid}/${totalEmails} valid emails (${overallSuccessRate}%)`)
    
  } catch (error) {
    console.error('❌ Error with concurrent jobs:', error.message)
  }
}

/**
 * Example 5: Job Management and Error Recovery
 */
async function jobManagementExample(): Promise<void> {
  console.log('🛠️ Demonstrating job management and error recovery...')
  
  const emails = Array.from({ length: 1000 }, (_, i) => `management-test-${i}@example.com`)
  
  try {
    // Start a job
    const job = await client.verifyBatchAsync(emails, {
      format: 'compact',
      trace_id: `management-${Date.now()}`
    })
    
    console.log(`🚀 Started job ${job.id}`)
    
    // Simulate monitoring for a bit
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Check status
    const status1 = await client.getBatchJob(job.id)
    console.log(`📊 Current status: ${status1.status} (${status1.processed}/${status1.total_emails})`)
    
    // Demonstrate cancellation (comment out if you want job to complete)
    if (status1.status === BatchJobStatus.PROCESSING) {
      console.log('🛑 Demonstrating job cancellation...')
      const cancelledJob = await client.cancelBatchJob(job.id)
      console.log(`✅ Job cancelled: ${cancelledJob.status}`)
      
      // Start a new job as recovery
      console.log('🔄 Starting recovery job...')
      const recoveryJob = await client.verifyBatchAsync(emails.slice(0, 500), {
        format: 'compact',
        trace_id: `recovery-${Date.now()}`
      })
      
      console.log(`🚀 Recovery job started: ${recoveryJob.id}`)
      await monitorJobProgress(recoveryJob.id, { maxWaitTime: 120000 }) // 2 min
    }
    
  } catch (error) {
    console.error('❌ Error in job management:', error.message)
  }
}

/**
 * Example 6: Webhook Payload Handler (simulation)
 */
function simulateWebhookHandler(): void {
  console.log('🔔 Webhook payload handler example:')
  
  // This is what your webhook endpoint would receive
  const webhookPayload = {
    event: 'batch.completed',
    batch_id: 'job_12345',
    status: 'completed',
    results: {
      success: true,
      total: 10000,
      valid: 8765,
      invalid: 1235,
      processing_time_ms: 45230
    },
    timestamp: new Date().toISOString(),
    signature: 'sha256=abcdef...' // For verification
  }
  
  console.log('📨 Received webhook:', JSON.stringify(webhookPayload, null, 2))
  
  // Your webhook handler logic
  if (webhookPayload.event === 'batch.completed') {
    console.log(`✅ Batch ${webhookPayload.batch_id} completed`)
    console.log(`📊 Results: ${webhookPayload.results.valid}/${webhookPayload.results.total} valid`)
    
    // Process results, send notifications, update database, etc.
    console.log('💾 Processing webhook: updating database, sending notifications...')
  }
}

/**
 * Run all async batch examples
 */
export async function runAsyncBatchExamples(): Promise<void> {
  console.log('🔄 ValidKit Async Batch Processing Examples\n')
  
  // Run examples (comment out as needed for testing)
  await basicAsyncBatch()
  console.log('\n' + '─'.repeat(60) + '\n')
  
  // await asyncBatchWithWebhook()
  // console.log('\n' + '─'.repeat(60) + '\n')
  
  // await multipleConcurrentJobs()
  // console.log('\n' + '─'.repeat(60) + '\n')
  
  // await jobManagementExample()
  // console.log('\n' + '─'.repeat(60) + '\n')
  
  simulateWebhookHandler()
  
  console.log('\n✅ Async batch examples completed!')
}

// Run if called directly
if (require.main === module) {
  runAsyncBatchExamples().catch(console.error)
}

export {
  basicAsyncBatch,
  asyncBatchWithWebhook,
  monitorJobProgress,
  multipleConcurrentJobs,
  jobManagementExample,
  simulateWebhookHandler
}