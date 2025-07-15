import {
  ValidKitError,
  InvalidAPIKeyError,
  RateLimitError,
  BatchSizeError,
  TimeoutError,
  ConnectionError,
  ServerError,
  ValidationError,
  BatchJobError
} from '../src/errors'

describe('ValidKit Errors', () => {
  describe('ValidKitError', () => {
    it('should create error with message and status code', () => {
      const error = new ValidKitError('Test error', 400)
      expect(error.message).toBe('Test error')
      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('VALIDKIT_ERROR')
      expect(error.name).toBe('ValidKitError')
    })

    it('should include details when provided', () => {
      const details = { field: 'email', reason: 'invalid' }
      const error = new ValidKitError('Test error', 400, details)
      expect(error.details).toEqual(details)
    })

    it('should serialize to JSON properly', () => {
      const error = new ValidKitError('Test error', 400, { foo: 'bar' })
      const json = error.toJSON()
      expect(json).toEqual({
        name: 'ValidKitError',
        message: 'Test error',
        code: 'VALIDKIT_ERROR',
        statusCode: 400,
        details: { foo: 'bar' }
      })
    })
  })

  describe('Error subclasses', () => {
    it('InvalidAPIKeyError should have correct properties', () => {
      const error = new InvalidAPIKeyError('Invalid key')
      expect(error.statusCode).toBe(401)
      expect(error.code).toBe('INVALID_API_KEY')
      expect(error.name).toBe('InvalidAPIKeyError')
    })

    it('RateLimitError should have correct properties', () => {
      const error = new RateLimitError('Rate limit exceeded')
      expect(error.statusCode).toBe(429)
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(error.name).toBe('RateLimitError')
    })

    it('RateLimitError should calculate retry delay', () => {
      const error = new RateLimitError('Rate limit exceeded')
      expect(error.getRetryDelay()).toBe(60000) // Default 60 seconds

      const errorWithRetryAfter = new RateLimitError('Rate limit exceeded', { retry_after: 30 })
      expect(errorWithRetryAfter.getRetryDelay()).toBe(30000) // 30 seconds
    })

    it('BatchSizeError should have correct properties', () => {
      const error = new BatchSizeError('Batch too large')
      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('BATCH_SIZE_EXCEEDED')
      expect(error.name).toBe('BatchSizeError')
    })

    it('TimeoutError should have correct properties', () => {
      const error = new TimeoutError('Request timed out')
      expect(error.statusCode).toBe(408)
      expect(error.code).toBe('TIMEOUT')
      expect(error.name).toBe('TimeoutError')
    })

    it('ConnectionError should have correct properties', () => {
      const error = new ConnectionError('Connection failed')
      expect(error.statusCode).toBe(0)
      expect(error.code).toBe('CONNECTION_ERROR')
      expect(error.name).toBe('ConnectionError')
    })

    it('ServerError should have correct properties', () => {
      const error = new ServerError('Internal server error')
      expect(error.statusCode).toBe(500)
      expect(error.code).toBe('SERVER_ERROR')
      expect(error.name).toBe('ServerError')
    })

    it('ValidationError should have correct properties', () => {
      const error = new ValidationError('Invalid input')
      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.name).toBe('ValidationError')
    })
  })

  describe('fromApiResponse', () => {
    it('should create InvalidAPIKeyError for 401 status', () => {
      const response = { status: 401, statusText: 'Unauthorized' } as Response
      const error = ValidKitError.fromApiResponse(response)
      expect(error).toBeInstanceOf(InvalidAPIKeyError)
      expect(error.message).toBe('Invalid or missing API key')
    })

    it('should create RateLimitError for 429 status', () => {
      const response = { status: 429, statusText: 'Too Many Requests' } as Response
      const error = ValidKitError.fromApiResponse(response)
      expect(error).toBeInstanceOf(RateLimitError)
      expect(error.message).toBe('Rate limit exceeded')
    })

    it('should create ValidationError for 400 status', () => {
      const response = { status: 400, statusText: 'Bad Request' } as Response
      const errorData = { message: 'Invalid email format' }
      const error = ValidKitError.fromApiResponse(response, errorData)
      expect(error).toBeInstanceOf(ValidationError)
      expect(error.message).toBe('Invalid email format')
    })

    it('should create TimeoutError for 408 status', () => {
      const response = { status: 408, statusText: 'Request Timeout' } as Response
      const error = ValidKitError.fromApiResponse(response)
      expect(error).toBeInstanceOf(TimeoutError)
      expect(error.message).toBe('Request timed out')
    })

    it('should create ServerError for 5xx status', () => {
      const response = { status: 503, statusText: 'Service Unavailable' } as Response
      const error = ValidKitError.fromApiResponse(response)
      expect(error).toBeInstanceOf(ServerError)
      expect(error.message).toBe('Service temporarily unavailable')
    })

    it('should create generic ValidKitError for unknown status', () => {
      const response = { status: 418, statusText: "I'm a teapot" } as Response
      const error = ValidKitError.fromApiResponse(response)
      expect(error).toBeInstanceOf(ValidKitError)
      expect(error.message).toBe("I'm a teapot")
      expect(error.statusCode).toBe(418)
    })

    it('should use error data message when available', () => {
      const response = { status: 400, statusText: 'Bad Request' } as Response
      const errorData = { 
        message: 'Custom error message',
        code: 'CUSTOM_CODE',
        details: { field: 'email' }
      }
      const error = ValidKitError.fromApiResponse(response, errorData)
      expect(error.message).toBe('Custom error message')
      expect(error.details).toEqual(errorData.details)
    })

    it('should handle rate limit error with retry_after header', () => {
      const response = { status: 429, statusText: 'Too Many Requests' } as Response
      const errorData = {
        message: 'Rate limit exceeded',
        details: {
          retry_after: 5
        }
      }
      const error = ValidKitError.fromApiResponse(response, errorData)
      expect(error).toBeInstanceOf(RateLimitError)
      expect(error.details?.retry_after).toBe(5)
    })

    it('should create ServerError for 500 status', () => {
      const response = { status: 500, statusText: 'Internal Server Error' } as Response
      const error = ValidKitError.fromApiResponse(response)
      expect(error).toBeInstanceOf(ServerError)
      expect(error.message).toBe('Internal server error')
    })

    it('should create ServerError for 502 status', () => {
      const response = { status: 502, statusText: 'Bad Gateway' } as Response
      const error = ValidKitError.fromApiResponse(response)
      expect(error).toBeInstanceOf(ServerError)
      expect(error.message).toBe('Internal server error')
    })

    it('should create TimeoutError for 504 status', () => {
      const response = { status: 504, statusText: 'Gateway Timeout' } as Response
      const error = ValidKitError.fromApiResponse(response)
      expect(error).toBeInstanceOf(TimeoutError)
      expect(error.message).toBe('Request timed out')
    })

    it('should handle error data with all fields', () => {
      const response = { status: 400, statusText: 'Bad Request' } as Response
      const errorData = {
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: { 
          field: 'email', 
          reason: 'invalid',
          request_id: 'req_123',
          trace_id: 'trace_456'
        }
      }
      const error = ValidKitError.fromApiResponse(response, errorData)
      expect(error.details).toMatchObject({
        field: 'email',
        reason: 'invalid',
        request_id: 'req_123',
        trace_id: 'trace_456'
      })
    })

    it('should handle missing message in error data', () => {
      const response = { status: 400, statusText: 'Bad Request' } as Response
      const errorData = {} // Empty error data
      const error = ValidKitError.fromApiResponse(response, errorData)
      expect(error.message).toBe('Bad Request')
    })
  })

  describe('BatchJobError', () => {
    it('should have correct properties', () => {
      const error = new BatchJobError()
      expect(error.statusCode).toBe(500)
      expect(error.code).toBe('BATCH_JOB_ERROR')
      expect(error.name).toBe('BatchJobError')
      expect(error.message).toBe('Batch job failed')
    })

    it('should accept custom message and details', () => {
      const error = new BatchJobError('Custom batch error', { jobId: 'job_123' })
      expect(error.message).toBe('Custom batch error')
      expect(error.details).toEqual({ jobId: 'job_123' })
    })
  })
})