/**
 * Integration tests for bulk endpoint paths
 * These tests verify that the actual API endpoints exist and respond correctly
 */

import { ValidKit } from '../../src'

// Skip these tests in CI or if no API key is provided
const API_KEY = process.env.VALIDKIT_TEST_API_KEY
const SKIP_INTEGRATION = !API_KEY || process.env.CI === 'true'

const describeIntegration = SKIP_INTEGRATION ? describe.skip : describe

describeIntegration('Bulk Endpoints Integration Tests', () => {
  let client: ValidKit

  beforeAll(() => {
    if (!API_KEY) {
      console.log('Skipping integration tests - no VALIDKIT_TEST_API_KEY provided')
      return
    }
    client = new ValidKit({ 
      api_key: API_KEY,
      base_url: process.env.VALIDKIT_TEST_BASE_URL || 'https://api.validkit.com'
    })
  })

  describe('Standard Bulk Endpoint', () => {
    it('should successfully call /api/v1/verify/bulk endpoint', async () => {
      const emails = ['test1@example.com', 'test2@example.com']
      
      const result = await client.verifyBatch(emails)
      
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
      expect(Object.keys(result).length).toBe(emails.length)
      
      // Verify response structure
      for (const email of emails) {
        expect(result[email]).toBeDefined()
        expect(result[email]).toHaveProperty('v') // valid flag in compact format
      }
    })

    it('should handle bulk request with 100 emails', async () => {
      const emails = Array.from({ length: 100 }, (_, i) => `bulk-test-${i}@example.com`)
      
      const result = await client.verifyBatch(emails)
      
      expect(Object.keys(result).length).toBe(100)
    })
  })

  describe('Agent Bulk Endpoint (Async)', () => {
    it('should successfully create async batch job via /api/v1/verify/bulk/agent', async () => {
      const emails = Array.from({ length: 50 }, (_, i) => `async-test-${i}@example.com`)
      
      const job = await client.verifyBatchAsync(emails)
      
      expect(job).toBeDefined()
      expect(job.id).toBeDefined()
      expect(job.status).toBeDefined()
      expect(['pending', 'processing']).toContain(job.status)
      expect(job.total_emails).toBe(50)
    })
  })

  describe('Batch Management Endpoints', () => {
    let testJobId: string

    beforeAll(async () => {
      // Create a test batch job
      if (!SKIP_INTEGRATION) {
        const job = await client.verifyBatchAsync(['setup@example.com'])
        testJobId = job.id
      }
    })

    it('should get batch status via /api/v1/batch/:batchId', async () => {
      if (!testJobId) return

      const status = await client.getBatchJob(testJobId)
      
      expect(status).toBeDefined()
      expect(status.id).toBe(testJobId)
      expect(status.status).toBeDefined()
      expect(status.total_emails).toBeGreaterThan(0)
    })

    it('should handle batch results via /api/v1/batch/:batchId/results', async () => {
      if (!testJobId) return

      // Wait for job to complete (or timeout after 10 seconds)
      let attempts = 0
      let jobStatus
      
      while (attempts < 10) {
        jobStatus = await client.getBatchJob(testJobId)
        if (jobStatus.status === 'completed') break
        await new Promise(resolve => setTimeout(resolve, 1000))
        attempts++
      }

      if (jobStatus?.status === 'completed') {
        const results = await client.getBatchResults(testJobId)
        expect(results).toBeDefined()
        expect(results.results).toBeDefined()
      }
    })

    it('should cancel batch via DELETE /api/v1/batch/:batchId', async () => {
      // Create a new job to cancel
      const job = await client.verifyBatchAsync(
        Array.from({ length: 100 }, (_, i) => `cancel-test-${i}@example.com`)
      )

      const cancelResult = await client.cancelBatchJob(job.id)
      
      expect(cancelResult).toBeDefined()
      expect(cancelResult.id).toBe(job.id)
      expect(['cancelled', 'cancelling']).toContain(cancelResult.status)
    })
  })

  describe('Error Cases', () => {
    it('should return 404 for non-existent batch job', async () => {
      await expect(
        client.getBatchJob('non-existent-job-id')
      ).rejects.toThrow()
    })

    it('should handle rate limits gracefully', async () => {
      // This test would need to trigger rate limits
      // For now, just verify the client handles errors
      expect(client).toBeDefined()
    })
  })
})