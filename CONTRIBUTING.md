# Contributing to ValidKit TypeScript SDK

Thank you for your interest in contributing to ValidKit! We welcome contributions from the community.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/ValidKit/validkit-typescript-sdk/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Node.js/TypeScript version
   - Relevant code snippets

### Suggesting Features

1. Check if the feature has been requested
2. Open a new issue with:
   - Clear use case
   - Proposed API design
   - Benefits to users

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add/update tests
5. Update documentation
6. Commit with clear messages (`git commit -m 'feat: add amazing feature'`)
7. Push to your fork (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/validkit-typescript-sdk.git
cd validkit-typescript-sdk

# Install dependencies
npm install

# Build the project
npm run build

# Run tests in watch mode
npm run test:watch
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- src/client.test.ts

# Run tests in watch mode
npm run test:watch
```

### Code Style

We use:
- ESLint for linting
- Prettier for formatting
- TypeScript strict mode

Run all checks:
```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run type-check
```

### Building

```bash
# Build for production
npm run build

# Build in watch mode
npm run build:watch

# Build for different targets
npm run build:node    # Node.js
npm run build:browser # Browser bundle
```

### Documentation

- Add JSDoc comments to all public APIs
- Update README.md for user-facing changes
- Add examples for new features
- Ensure TypeScript types are well-documented

### Commit Messages

Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions/changes
- `refactor:` Code refactoring
- `style:` Code style changes
- `chore:` Maintenance tasks
- `perf:` Performance improvements

Examples:
```
feat: add webhook support for batch processing
fix: handle rate limit errors correctly
docs: update batch verification examples
perf: optimize batch processing for large datasets
```

## API Design Guidelines

- Keep the API surface small and focused
- Prioritize developer experience
- Maintain backward compatibility
- Use TypeScript types for better IDE support
- Follow existing naming conventions

## Testing Guidelines

- Write tests for all new features
- Maintain >90% code coverage
- Test edge cases and error scenarios
- Use descriptive test names
- Mock external dependencies

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Run `npm run build`
4. Create release PR
5. After merge, tag release: `git tag v1.2.3`
6. Push tags: `git push --tags`
7. GitHub Actions will publish to npm

## Questions?

- Open an issue for questions
- Join our [Discord](https://discord.gg/validkit)
- Email: developers@validkit.com

Thank you for contributing! 🎉