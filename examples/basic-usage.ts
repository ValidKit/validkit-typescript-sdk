/**
 * Basic Usage Examples for ValidKit TypeScript SDK
 */

import { ValidKit, ResponseFormat } from '../src/index'

// Initialize client
const client = new ValidKit({
  api_key: process.env.VALIDKIT_API_KEY || 'your-api-key-here'
})

/**
 * Example 1: Single Email Verification
 */
async function verifySingleEmail() {
  console.log('🔍 Verifying single email...')
  
  try {
    // Full format with detailed checks
    const result = await client.verifyEmail('test@example.com', {
      format: ResponseFormat.FULL,
      trace_id: 'example-single-email'
    })
    
    console.log('Result:', {
      email: result.email,
      valid: result.valid,
      processing_time: result.processing_time_ms + 'ms'
    })
    
    // Compact format for token efficiency
    const compactResult = await client.verifyEmail('test@example.com', {
      format: ResponseFormat.COMPACT
    })
    
    console.log('Compact result:', compactResult)
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

/**
 * Example 2: Small Batch Verification
 */
async function verifySmallBatch() {
  console.log('📦 Verifying small batch...')
  
  const emails = [
    'user1@example.com',
    'user2@gmail.com',
    'invalid-email',
    'disposable@tempmail.com',
    'user3@yahoo.com'
  ]
  
  try {
    const results = await client.verifyBatch(emails, {
      format: ResponseFormat.COMPACT, // Efficient for batches
      trace_id: 'example-small-batch'
    })
    
    console.log('Results:', results)
    
    // Count valid emails
    const validCount = Object.values(results).filter(r => r.v).length
    console.log(`Valid emails: ${validCount}/${emails.length}`)
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

/**
 * Example 3: Large Batch with Progress Tracking
 */
async function verifyLargeBatch() {
  console.log('🚀 Verifying large batch with progress...')
  
  // Generate test emails
  const emails = Array.from({ length: 1000 }, (_, i) => `user${i}@example.com`)
  
  try {
    const results = await client.verifyBatch(emails, {
      format: ResponseFormat.COMPACT,
      chunk_size: 100, // Process in chunks of 100
      progress_callback: (processed, total) => {
        const percentage = Math.round((processed / total) * 100)
        console.log(`Progress: ${processed}/${total} (${percentage}%)`)
      },
      trace_id: 'example-large-batch'
    })
    
    const validEmails = Object.entries(results)
      .filter(([_, result]) => result.v)
      .map(([email]) => email)
    
    console.log(`Completed! Valid emails: ${validEmails.length}/${emails.length}`)
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

/**
 * Example 4: Error Handling
 */
async function demonstrateErrorHandling() {
  console.log('⚠️ Demonstrating error handling...')
  
  try {
    // This will throw a validation error
    await client.verifyEmail('')
  } catch (error) {
    console.log('Caught validation error:', error.message)
  }
  
  try {
    // This will throw a batch size error
    const hugeEmailList = Array.from({ length: 15000 }, (_, i) => `user${i}@example.com`)
    await client.verifyBatch(hugeEmailList)
  } catch (error) {
    console.log('Caught batch size error:', error.message)
    console.log('Suggestion: Use verifyBatchAsync for batches over 10K emails')
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  console.log('🎯 ValidKit TypeScript SDK Examples\n')
  
  await verifySingleEmail()
  console.log('\n' + '─'.repeat(50) + '\n')
  
  await verifySmallBatch()
  console.log('\n' + '─'.repeat(50) + '\n')
  
  await verifyLargeBatch()
  console.log('\n' + '─'.repeat(50) + '\n')
  
  await demonstrateErrorHandling()
  
  console.log('\n✅ Examples completed!')
}

// Run if called directly
if (require.main === module) {
  runExamples().catch(console.error)
}

export {
  verifySingleEmail,
  verifySmallBatch,
  verifyLargeBatch,
  demonstrateErrorHandling
}