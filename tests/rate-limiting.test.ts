import { ValidKit } from '../src'

// Mock cross-fetch
jest.mock('cross-fetch')
import fetch from 'cross-fetch'
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('Rate Limiting', () => {
  let client: ValidKit

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    client = new ValidKit({ api_key: 'test_api_key' })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should extract rate limit headers from response', async () => {
    const rateLimitHeaders = new Map([
      ['X-RateLimit-Limit', '1000'],
      ['X-RateLimit-Remaining', '999'],
      ['X-RateLimit-Reset', '1642000000']
    ])

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: rateLimitHeaders,
      json: async () => ({
        success: true,
        result: { valid: true }
      })
    } as any)

    // We need to spy on the private makeRequest method to verify rate limit handling
    const makeRequestSpy = jest.spyOn(client as any, 'makeRequest')

    await client.verifyEmail('test@example.com')

    const response = await makeRequestSpy.mock.results[0].value
    expect(response.rateLimit).toEqual({
      limit: 1000,
      remaining: 999,
      reset: 1642000000,
      retry_after: undefined
    })
  })

  it('should include retry-after in rate limit info when present', async () => {
    const rateLimitHeaders = new Map([
      ['X-RateLimit-Limit', '1000'],
      ['X-RateLimit-Remaining', '0'],
      ['X-RateLimit-Reset', '1642000000'],
      ['Retry-After', '60']
    ])

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: rateLimitHeaders,
      json: async () => ({
        success: true,
        result: { valid: true }
      })
    } as any)

    const makeRequestSpy = jest.spyOn(client as any, 'makeRequest')

    await client.verifyEmail('test@example.com')

    const response = await makeRequestSpy.mock.results[0].value
    expect(response.rateLimit).toEqual({
      limit: 1000,
      remaining: 0,
      reset: 1642000000,
      retry_after: 60
    })
  })

  it('should handle missing rate limit headers gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Map(), // No rate limit headers
      json: async () => ({
        success: true,
        result: { valid: true }
      })
    } as any)

    const makeRequestSpy = jest.spyOn(client as any, 'makeRequest')

    await client.verifyEmail('test@example.com')

    const response = await makeRequestSpy.mock.results[0].value
    expect(response.rateLimit).toBeUndefined()
  })

})