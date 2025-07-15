import { ValidKit } from '../src'
import fetch from 'cross-fetch'

// Mock cross-fetch
jest.mock('cross-fetch')
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('ValidKit Endpoint URL Tests', () => {
  let client: ValidKit

  beforeEach(() => {
    jest.clearAllMocks()
    client = new ValidKit({ api_key: 'test_api_key' })
  })

  describe('Endpoint URL Verification', () => {
    it('should call correct endpoint for single email verification', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ success: true, result: { valid: true } })
      })

      await client.verifyEmail('test@example.com')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.validkit.com/api/v1/verify',
        expect.any(Object)
      )
    })

    it('should call correct endpoint for batch verification', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ success: true, results: {} })
      })

      await client.verifyBatch(['test@example.com'])

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.validkit.com/api/v1/verify/bulk',
        expect.any(Object)
      )
    })

    it('should call correct endpoint for async batch verification', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ id: 'job_123', status: 'pending' })
      })

      await client.verifyBatchAsync(['test@example.com'])

      // Should use the agent endpoint for async batch
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.validkit.com/api/v1/verify/bulk/agent',
        expect.any(Object)
      )
    })

    it('should call correct endpoint for batch job status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ id: 'job_123', status: 'completed' })
      })

      await client.getBatchJob('job_123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.validkit.com/api/v1/batch/job_123',
        expect.any(Object)
      )
    })

    it('should call correct endpoint for batch results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ success: true, results: {} })
      })

      await client.getBatchResults('job_123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.validkit.com/api/v1/batch/job_123/results',
        expect.any(Object)
      )
    })

    it('should call correct endpoint for batch cancellation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ id: 'job_123', status: 'cancelled' })
      })

      await client.cancelBatchJob('job_123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.validkit.com/api/v1/batch/job_123',
        expect.objectContaining({
          method: 'DELETE'
        })
      )
    })
  })

  describe('Custom Base URL', () => {
    it('should use custom base URL for all endpoints', async () => {
      const customClient = new ValidKit({ 
        api_key: 'test_api_key',
        base_url: 'https://custom.api.com'
      })

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map(),
        json: async () => ({ success: true, result: { valid: true } })
      })

      // Test various endpoints with custom base URL
      await customClient.verifyEmail('test@example.com')
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://custom.api.com/api/v1/verify',
        expect.any(Object)
      )

      await customClient.verifyBatch(['test@example.com'])
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://custom.api.com/api/v1/verify/bulk',
        expect.any(Object)
      )

      await customClient.verifyBatchAsync(['test@example.com'])
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://custom.api.com/api/v1/verify/bulk/agent',
        expect.any(Object)
      )
    })
  })
})