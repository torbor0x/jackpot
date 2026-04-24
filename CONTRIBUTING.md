# Contributing to JackpotEx

Thank you for your interest in contributing to JackpotEx! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Git
- A Solana wallet (for testing)

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/jackpot.git
   cd jackpot
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy environment template:
   ```bash
   cp .env.example .env
   ```
5. Configure your environment variables (see [LOCAL_SETUP.md](./LOCAL_SETUP.md))
6. Run development server:
   ```bash
   npm run dev
   ```

## Development Workflow

### Branching

- Create a new branch for your feature or bugfix:
  ```bash
  git checkout -b feature/your-feature-name
  ```
- Use descriptive branch names (e.g., `feature/add-team-wallet-config`, `bugfix/vrf-timeout`)

### Making Changes

1. Write clean, readable code
2. Follow existing code style and patterns
3. Add comments for complex logic
4. Update documentation as needed
5. Add tests for new functionality
6. Ensure all tests pass:
   ```bash
   npm test
   ```

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add configurable team wallet array support
fix: resolve VRF timeout issue with fallback
docs: update deployment guide for Vercel
refactor: simplify distribution logic
test: add unit tests for holder snapshot
```

Format: `<type>(<scope>): <subject>`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run live integration tests (requires real configuration)
npm run test:live
```

### Test Coverage

- Write unit tests for new functions
- Test edge cases and error conditions
- Mock external dependencies (Solana, RPC, etc.)
- Ensure tests are deterministic

## Pull Requests

### Before Submitting

1. Ensure your code is up to date with main:
   ```bash
   git checkout main
   git pull upstream main
   git checkout your-branch
   git rebase main
   ```
2. Run tests and ensure they pass
3. Run type check:
   ```bash
   npm run typecheck
   ```
4. Run linter:
   ```bash
   npm run lint
   ```

### Submitting a PR

1. Push your branch:
   ```bash
   git push origin your-branch
   ```
2. Create a pull request on GitHub
3. Fill in the PR template with:
   - Description of changes
   - Related issues (if any)
   - Testing performed
   - Screenshots (if applicable)
4. Request review from maintainers

### PR Review Process

- Maintainers will review your PR
- Address feedback in a timely manner
- Keep discussions focused and constructive
- Squash commits if requested before merge

## Documentation

### When to Update Docs

- Adding new features
- Changing configuration options
- Modifying API endpoints
- Updating dependencies
- Fixing bugs that affect user experience

### Documentation Files

- `README.md` - Project overview and quick start
- `ARCHITECTURE.md` - System architecture and technical details
- `DEPLOYMENT.md` - Deployment guide
- `LOCAL_SETUP.md` - Local development setup
- Code comments - For complex logic

## Issues

### Reporting Bugs

1. Search existing issues first
2. Create a new issue with:
   - Clear title
   - Description of the problem
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment details (OS, Node version, etc.)
   - Relevant logs or screenshots

### Feature Requests

1. Search existing issues first
2. Create a new issue with:
   - Clear title
   - Description of the feature
   - Use case or motivation
   - Potential implementation approach (optional)

## Security

### Reporting Security Issues

- Do not report security issues publicly
- Send a private message to maintainers
- Include details about the vulnerability
- Allow time for fixes before disclosure

### Security Best Practices

- Never commit secrets or API keys
- Use environment variables for sensitive data
- Review dependencies for vulnerabilities regularly
- Follow principle of least privilege

## Coding Standards

### TypeScript

- Use strict TypeScript settings
- Define types for all functions and variables
- Avoid `any` type when possible
- Use interfaces for object shapes

### Code Style

- Follow existing patterns in the codebase
- Use meaningful variable and function names
- Keep functions focused and small
- Add JSDoc comments for public APIs

### File Organization

- Group related files together
- Use descriptive file names
- Keep similar functionality in the same directory

## Questions?

- Open an issue for questions
- Check existing documentation first
- Be patient with responses from maintainers

## License

By contributing to JackpotEx, you agree that your contributions will be licensed under the MIT License.
