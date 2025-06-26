# Contributing to ValidKit TypeScript SDK

Thank you for your interest in contributing to ValidKit! We welcome contributions from the community.

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for clear and consistent commit history.

### Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- `feat`: New feature
- `fix`: Bug fix  
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, missing semicolons, etc)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvements
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files

### Examples
```
feat: add support for custom timeout configuration

fix: handle network errors gracefully in batch processing

docs: improve TypeScript examples in README
```

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/validkit/typescript-sdk/issues)
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

### Pull Request Guidelines

#### Before Creating a PR

1. Fork the repository and clone locally
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

3. Make your changes following TypeScript best practices
4. Write/update tests to maintain coverage
5. Run all checks:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

#### Commit Your Changes

Follow our commit convention:
```bash
# Single line commit
git commit -m "feat: add retry configuration options"

# Multi-line commit with details
git commit -m "feat: add custom headers support" -m "- Allow setting custom headers via options
- Add X-Trace-ID header for request tracking
- Update TypeScript definitions
- Add examples to documentation"
```

#### PR Title and Description

Your PR title should follow the same convention as commits:
- `feat: add WebSocket support for real-time validation`
- `fix: handle network timeouts gracefully`
- `docs: improve TypeScript examples`
- `perf: optimize batch processing memory usage`

In your PR description, include:

```markdown
## What
Brief description of what this PR does

## Why
The problem it solves or feature it adds
Closes #[issue number]

## How
- Technical approach taken
- Any design decisions made
- Breaking changes (if any)

## Testing
- Unit tests added/updated
- Manual testing performed
- Performance impact (if relevant)

## Checklist
- [ ] Tests pass locally
- [ ] TypeScript types are correct
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

#### After Creating Your PR

1. Ensure all GitHub Actions checks pass
2. Respond to code review feedback promptly
3. Keep your branch up to date with `main`
4. Be prepared to make changes based on feedback

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/typescript-sdk.git
cd typescript-sdk

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