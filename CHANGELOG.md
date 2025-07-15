# Changelog

All notable changes to the ValidKit TypeScript SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-01-15

### Fixed
- Client-side transformation for compact format responses (V1 API always returns full format)
- Batch response parsing to handle actual API response structure
- Test expectations to match real API behavior
- Added trace_id and request_id to batch response types
- Linting issues and trailing spaces

### Added
- Comprehensive real API test suite
- Response transformation logic for V1 API compatibility
- processing_time_ms field mapping

## [1.0.0] - 2025-01-14

### Added
- Initial release of ValidKit TypeScript SDK
- Single email verification with `verifyEmail()`
- Batch email verification with `verifyBatch()` (up to 10K emails)
- Agent-optimized endpoint with `verifyBatchAgent()`
- Async batch processing with `verifyBatchAsync()`
- Full TypeScript support with comprehensive type definitions
- Token-optimized compact response format (80% smaller)
- Multi-agent tracing with trace_id/parent_id headers
- Progress callbacks for batch processing
- Automatic retry logic with exponential backoff
- Rate limit handling
- Both ESM and CommonJS builds
- Comprehensive error handling with typed exceptions
- AI agent integration examples (LangChain, AutoGPT, Vercel AI)

### Features
- Agent-scale rate limits (1,000+ req/min)
- Bulk processing support
- Signal Pool integration for Pro+ tiers
- Webhook support for async processing
- Cross-platform compatibility (Node.js and browsers)

[1.0.1]: https://github.com/ValidKit/validkit-typescript-sdk/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/ValidKit/validkit-typescript-sdk/releases/tag/v1.0.0