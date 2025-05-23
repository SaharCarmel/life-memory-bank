# Contributing to VoiceMCP

Thank you for your interest in contributing to VoiceMCP! This document provides guidelines and instructions for contributing to the project.

## Development Process

### 1. Setting Up Development Environment

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a new branch for your feature/fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### 2. Code Style Guidelines

We use ESLint and Prettier to maintain consistent code style. Please ensure your code follows these guidelines:

- Use TypeScript for all new code
- Follow the established project structure
- Write meaningful variable and function names
- Include JSDoc comments for public APIs
- Keep functions focused and concise
- Use async/await for asynchronous operations
- Maintain type safety (avoid `any` types)

### 3. Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or modifying tests
- `chore:` - Maintenance tasks

Example:
```bash
git commit -m "feat: add Hebrew language detection to Whisper integration"
```

### 4. Testing Requirements

- Write tests for new features
- Update existing tests when modifying features
- Ensure all tests pass before submitting PR
- Include both unit and integration tests where appropriate
- Test both English and Hebrew language scenarios

Run tests with:
```bash
npm test
```

### 5. Documentation

- Update README.md if adding new features
- Document new APIs and components
- Include code examples where helpful
- Update type definitions
- Document any new dependencies

### 6. Pull Request Process

1. Update your fork to the latest main branch
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Push your changes
6. Create a Pull Request with:
   - Clear description of changes
   - Any related issues referenced
   - Screenshots for UI changes
   - List of tested scenarios

### 7. Code Review

- All PRs require at least one review
- Address review comments promptly
- Keep discussions focused and professional
- Request re-review after making changes

## Project Structure

### Main Process (src/main/)

- `audio/` - Audio recording and processing
- `whisper/` - Whisper AI integration
- `storage/` - Database operations
- `mcp/` - MCP server implementation

### Renderer Process (src/renderer/)

- `components/` - React components
- `hooks/` - Custom React hooks
- `styles/` - CSS/SCSS styles

### Shared (src/shared/)

- Types
- Constants
- Utility functions
- Interfaces

## Development Workflow

1. **Planning**
   - Review existing issues
   - Discuss approach in issue comments
   - Create technical design for larger features

2. **Implementation**
   - Follow code style guidelines
   - Write tests alongside code
   - Keep PRs focused and manageable

3. **Testing**
   - Run the test suite
   - Perform manual testing
   - Test edge cases
   - Verify both languages

4. **Documentation**
   - Update relevant docs
   - Add inline comments
   - Update type definitions

5. **Review**
   - Submit PR
   - Address feedback
   - Update based on reviews

## Best Practices

### TypeScript

- Use strict type checking
- Avoid type assertions
- Define interfaces for data structures
- Use enums for fixed sets of values
- Leverage union types for variants

### Electron

- Follow security best practices
- Use IPC for process communication
- Handle window management properly
- Consider macOS-specific features

### Testing

- Use Jest for unit tests
- Test both processes (main & renderer)
- Mock external dependencies
- Test error conditions
- Include integration tests

### Performance

- Optimize audio processing
- Handle large transcripts efficiently
- Implement proper memory management
- Profile and optimize hot paths

## Getting Help

- Check existing issues and discussions
- Ask questions in PR comments
- Join project discussions
- Reach out to maintainers

## License

By contributing to VoiceMCP, you agree that your contributions will be licensed under the MIT License.
