import { ValidKit, ResponseFormat } from '../src'
import {
  InvalidAPIKeyError,
  ValidationError,
  BatchSizeError,
  RateLimitError,
  TimeoutError,
  ConnectionError,
  ServerError
} from '../src/errors'

// Mock cross-fetch
jest.mock('cross-fetch')
import fetch from 'cross-fetch'
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('ValidKit Client', () => {
  let client: ValidKit

  beforeEach(() => {
    jest.clearAllMocks()
    client = new ValidKit({ api_key: 'test_api_key' })
  })

  describe('constructor', () => {
    it('should throw error if API key is not provided', () => {
      expect(() => new ValidKit({ api_key: '' })).toThrow(InvalidAPIKeyError)
      expect(() => new ValidKit({ api_key: '' })).toThrow('API key is required')
    })

    it('should initialize with default config', () => {
      const client = new ValidKit({ api_key: 'test_key' })
      expect(client).toBeDefined()
      expect((client as any).config.base_url).toBe('https://api.validkit.com')
      expect((client as any).config.timeout).toBe(30000)
      expect((client as any).config.max_retries).toBe(3)
    })

    it('should accept custom config', () => {
      const client = new ValidKit({
        api_key: 'test_key',
        base_url: 'https://custom.api.com',
        timeout: 5000,
        max_retries: 5
      })
      expect((client as any).config.base_url).toBe('https://custom.api.com')
      expect((client as any).config.timeout).toBe(5000)
      expect((client as any).config.max_retries).toBe(5)
    })
  })

  describe('verifyEmail', () => {
    it('should verify a single email successfully', async () => {
      // Mock API response - direct format
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          success: true,
          email: 'test@example.com',
          result: {
            valid: true,
            format: { valid: true },
            disposable: { valid: true, provider: null },
            mx: { valid: true, records: [] }
          },
          trace_id: 'trace_123',
          request_id: 'req_456'
        })
      })

      const result = await client.verifyEmail('test@example.com')
      
      expect(result).toEqual({
        success: true,
        email: 'test@example.com',
        valid: true,
        format: { valid: true },
        disposable: { valid: true, provider: null },
        mx: { valid: true, records: [] },
        smtp: undefined,
        trace_id: 'trace_123',
        request_id: 'req_456',
        cached: undefined,
        warning: undefined,
        signal_pool: undefined
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.validkit.com/api/v1/verify',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_api_key',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            email: 'test@example.com',
            format: ResponseFormat.FULL,
            debug: false
          })
        })
      )
    })

    it('should handle compact format response', async () => {
      // V1 endpoint returns full format, SDK transforms to compact
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          success: true,
          email: 'test@example.com',
          result: {
            valid: true,
            format: { valid: true },
            disposable: { valid: true, value: false },
            mx: { valid: true, records: [] }
          },
          trace_id: 'trace_123'
        })
      })

      const result = await client.verifyEmail('test@example.com', {
        format: ResponseFormat.COMPACT
      })

      expect(result).toEqual({
        v: true,
        trace_id: 'trace_123'
      })
    })

    it('should handle compact format with disposable email', async () => {
      // V1 endpoint returns full format, SDK transforms to compact with d flag
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          success: true,
          email: 'test@tempmail.com',
          result: {
            valid: true,
            format: { valid: true },
            disposable: { valid: true, value: true, provider: 'tempmail' },
            mx: { valid: true, records: [] }
          },
          trace_id: 'trace_456'
        })
      })

      const result = await client.verifyEmail('test@tempmail.com', {
        format: ResponseFormat.COMPACT
      })

      expect(result).toEqual({
        v: true,
        d: true,
        trace_id: 'trace_456'
      })
    })

    it('should handle response with cached data', async () => {
      // Test case where API returns cached result
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          success: true,
          email: 'test@example.com',
          result: {
            valid: true,
            format: { valid: true },
            disposable: { valid: true, provider: null },
            mx: { valid: true, records: [] }
          },
          cached: true,
          trace_id: 'trace_123',
          request_id: 'req_456'
        })
      })

      const result = await client.verifyEmail('test@example.com')
      
      expect(result.cached).toBe(true)
      expect(result.valid).toBe(true)
    })

    it('should include trace headers when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          success: true,
          email: 'test@example.com',
          result: {
            valid: true,
            format: { valid: true },
            disposable: { valid: true, provider: null },
            mx: { valid: true, records: [] }
          }
        })
      })

      await client.verifyEmail('test@example.com', {
        trace_id: 'custom_trace',
        parent_id: 'parent_123'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Trace-ID': 'custom_trace',
            'X-Parent-ID': 'parent_123'
          })
        })
      )
    })

    it('should include share_signals option when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          success: true,
          email: 'test@example.com',
          result: {
            valid: true,
            format: { valid: true },
            disposable: { valid: true, value: false },
            mx: { valid: true, records: [] }
          }
        })
      })

      await client.verifyEmail('test@example.com', {
        share_signals: true
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            email: 'test@example.com',
            format: 'full',
            debug: false,
            share_signals: true
          })
        })
      )
    })

    it('should throw validation error for invalid email', async () => {
      await expect(client.verifyEmail('')).rejects.toThrow(ValidationError)
      await expect(client.verifyEmail('')).rejects.toThrow('Email must be a non-empty string')
      await expect(client.verifyEmail(null as any)).rejects.toThrow(ValidationError)
    })
  })

  describe('verifyBatch', () => {
    it('should verify batch of emails successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          '0': { v: true },
          '1': { v: false, r: 'invalid format' }
        })
      })

      const result = await client.verifyBatch(['test1@example.com', 'test2@example.com'])
      
      expect(result).toEqual({
        'test1@example.com': { v: true },
        'test2@example.com': { v: false, r: 'invalid format' }
      })
    })

    it('should handle batch response with wrapper', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          '0': { v: true }
        })
      })

      const result = await client.verifyBatch(['test@example.com'], {
        format: ResponseFormat.COMPACT
      })
      
      expect(result).toEqual({
        'test@example.com': { v: true }
      })
    })

    it('should handle full format batch response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          success: true,
          total: 1,
          results: [{
            email: 'test@example.com',
            success: true,
            result: {
              valid: true,
              format: { valid: true },
              disposable: { valid: true, value: false },
              mx: { valid: true },
              smtp: { valid: true }
            }
          }],
          summary: { valid: 1, invalid: 0 },
          trace_id: 'trace_123',
          request_id: 'req_456'
        })
      })

      const result = await client.verifyBatch(['test@example.com'], {
        format: ResponseFormat.FULL
      })
      
      expect(result).toEqual({
        'test@example.com': {
          success: true,
          email: 'test@example.com',
          valid: true,
          format: { valid: true },
          disposable: { valid: true, value: false },
          mx: { valid: true },
          smtp: { valid: true },
          trace_id: 'trace_123',
          request_id: 'req_456'
        }
      })
    })

    it('should process large batches in chunks', async () => {
      const emails = Array.from({ length: 2500 }, (_, i) => `test${i}@example.com`)
      
      // Mock 3 chunk responses (1000, 1000, 500)
      for (let i = 0; i < 3; i++) {
        const chunkResponse = {};
        const start = i * 1000;
        const end = Math.min((i + 1) * 1000, emails.length);
        for (let j = start; j < end; j++) {
          chunkResponse[j - start] = { v: true };
        }
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: new Map(),
          json: async () => chunkResponse
        })
      }

      const progressCallback = jest.fn()
      const result = await client.verifyBatch(emails, {
        chunk_size: 1000,
        progress_callback: progressCallback
      })

      expect(Object.keys(result)).toHaveLength(2500)
      expect(progressCallback).toHaveBeenCalledTimes(3)
      expect(progressCallback).toHaveBeenCalledWith(1000, 2500)
      expect(progressCallback).toHaveBeenCalledWith(2000, 2500)
      expect(progressCallback).toHaveBeenCalledWith(2500, 2500)
    })

    it('should include share_signals option in batch request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          '0': { v: true },
          '1': { v: false, r: 'invalid format' }
        })
      })

      await client.verifyBatch(['test1@example.com', 'test2@example.com'], {
        share_signals: true
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            emails: ['test1@example.com', 'test2@example.com'],
            format: 'compact',
            debug: false,
            share_signals: true
          })
        })
      )
    })

    it('should throw error for empty array', async () => {
      await expect(client.verifyBatch([])).rejects.toThrow(ValidationError)
      await expect(client.verifyBatch([])).rejects.toThrow('Emails must be a non-empty array')
    })

    it('should throw error for batch exceeding 10k emails', async () => {
      const emails = Array.from({ length: 10001 }, (_, i) => `test${i}@example.com`)
      await expect(client.verifyBatch(emails)).rejects.toThrow(BatchSizeError)
      await expect(client.verifyBatch(emails)).rejects.toThrow('Batch size cannot exceed 10000 emails')
    })

    it('should throw error for non-array input', async () => {
      await expect(client.verifyBatch('not-an-array' as any)).rejects.toThrow(ValidationError)
      await expect(client.verifyBatch(null as any)).rejects.toThrow(ValidationError)
    })
  })

  describe('verifyBatchAsync', () => {
    it('should start async batch job', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          id: 'job_123',
          status: 'pending',
          total_emails: 15000,
          processed: 0,
          valid: 0,
          invalid: 0,
          created_at: '2025-01-14T12:00:00Z',
          updated_at: '2025-01-14T12:00:00Z'
        })
      })

      const emails = Array.from({ length: 15000 }, (_, i) => `test${i}@example.com`)
      const result = await client.verifyBatchAsync(emails, {
        webhook_url: 'https://example.com/webhook'
      })

      expect(result).toEqual({
        id: 'job_123',
        status: 'pending',
        total_emails: 15000,
        processed: 0,
        valid: 0,
        invalid: 0,
        created_at: '2025-01-14T12:00:00Z',
        updated_at: '2025-01-14T12:00:00Z'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.validkit.com/api/v1/verify/bulk/agent',
        expect.objectContaining({
          body: expect.stringContaining('"webhook_url":"https://example.com/webhook"')
        })
      )
    })

    it('should include trace headers when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          id: 'job_123',
          status: 'pending'
        })
      })

      await client.verifyBatchAsync(['test@example.com'], {
        trace_id: 'async_trace',
        parent_id: 'async_parent'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Trace-ID': 'async_trace',
            'X-Parent-ID': 'async_parent'
          })
        })
      )
    })

    it('should always include async: true in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ id: 'job_123' })
      })

      await client.verifyBatchAsync(['test@example.com'])

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"async":true')
        })
      )
    })

    it('should throw error for empty array', async () => {
      await expect(client.verifyBatchAsync([])).rejects.toThrow(ValidationError)
    })

    it('should throw error for non-array input', async () => {
      await expect(client.verifyBatchAsync('not-an-array' as any)).rejects.toThrow(ValidationError)
    })
  })

  describe('getBatchJob', () => {
    it('should get batch job status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          id: 'job_123',
          status: 'completed',
          total_emails: 1000,
          processed: 1000,
          valid: 900,
          invalid: 100
        })
      })

      const result = await client.getBatchJob('job_123')

      expect(result).toMatchObject({
        id: 'job_123',
        status: 'completed',
        processed: 1000
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.validkit.com/api/v1/batch/job_123',
        expect.any(Object)
      )
    })

    it('should throw error for missing job ID', async () => {
      await expect(client.getBatchJob('')).rejects.toThrow(ValidationError)
      await expect(client.getBatchJob('')).rejects.toThrow('Job ID is required')
    })
  })

  describe('getBatchResults', () => {
    it('should get batch results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          success: true,
          total: 2,
          valid: 1,
          invalid: 1,
          results: {
            'test1@example.com': { v: true },
            'test2@example.com': { v: false }
          }
        })
      })

      const result = await client.getBatchResults('job_123')

      expect(result).toMatchObject({
        success: true,
        total: 2,
        valid: 1,
        invalid: 1
      })
    })
  })

  describe('cancelBatchJob', () => {
    it('should cancel batch job', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          id: 'job_123',
          status: 'cancelled'
        })
      })

      const result = await client.cancelBatchJob('job_123')

      expect(result).toMatchObject({
        id: 'job_123',
        status: 'cancelled'
      })
    })
  })

  describe('verifyBatchAgent', () => {
    it('should verify batch using agent endpoint with compact format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          '0': { v: true },
          '1': { v: false, r: 'invalid format' }
        })
      })

      const result = await client.verifyBatchAgent(['test1@example.com', 'test2@example.com'])
      
      expect(result).toEqual({
        '0': { v: true },
        '1': { v: false, r: 'invalid format' }
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.validkit.com/api/v1/verify/bulk/agent',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            emails: ['test1@example.com', 'test2@example.com'],
            format: ResponseFormat.COMPACT
          })
        })
      )
    })

    it('should verify batch using agent endpoint with verbose format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          success: true,
          total: 2,
          results: {
            'test1@example.com': {
              valid: true,
              format: { valid: true },
              disposable: { valid: true, value: false }
            },
            'test2@example.com': {
              valid: false,
              format: { valid: true },
              disposable: { valid: true, value: false }
            }
          },
          summary: { valid: 1, invalid: 1 }
        })
      })

      const result = await client.verifyBatchAgent(
        ['test1@example.com', 'test2@example.com'],
        { format: ResponseFormat.FULL }
      )
      
      expect(result).toMatchObject({
        success: true,
        total: 2,
        summary: { valid: 1, invalid: 1 }
      })
    })

    it('should include trace headers when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ '0': { v: true } })
      })

      await client.verifyBatchAgent(['test@example.com'], {
        trace_id: 'agent_trace_123',
        parent_id: 'parent_456'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Trace-ID': 'agent_trace_123',
            'X-Parent-ID': 'parent_456'
          })
        })
      )
    })

    it('should pass share_signals parameter when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ '0': { v: true } })
      })

      await client.verifyBatchAgent(['test@example.com'], {
        share_signals: true
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"share_signals":true')
        })
      )
    })

    it('should throw error for empty array', async () => {
      await expect(client.verifyBatchAgent([])).rejects.toThrow(ValidationError)
      await expect(client.verifyBatchAgent([])).rejects.toThrow('Emails must be a non-empty array')
    })

    it('should throw error for non-array input', async () => {
      await expect(client.verifyBatchAgent('not-an-array' as any)).rejects.toThrow(ValidationError)
      await expect(client.verifyBatchAgent(null as any)).rejects.toThrow(ValidationError)
    })
  })
})