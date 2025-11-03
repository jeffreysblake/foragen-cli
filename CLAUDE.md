# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **For TypeScript/React/Vitest best practices**, see `CODE.md` (auto-generated via `/setup-stack`)

## Quick Start

```bash
npm ci                    # Install dependencies
npm run build            # Build all packages
npm start                # Start the CLI
npm run preflight        # Full validation (format, lint, build, test)
```

## Key Commands

### Development

- `npm run build` - Build the entire project (all packages)
- `npm run build:all` - Build project + sandbox container + VS Code extension
- `npm run build:packages` - Build only workspace packages
- `npm start` - Start the CLI from source after building
- `npm run debug` - Start CLI in debug mode with inspect-brk
- `npm run clean` - Clean build artifacts and dependencies

### Testing

- `npm run test` - Run unit tests for all packages (parallel)
- `npm run test:e2e` - Run end-to-end integration tests
- `npm run test:ci` - Run CI test suite including scripts tests
- `npm run test:integration:all` - Run all integration tests (none/docker/podman)
- `npm run preflight` - **Full check**: clean, install, format, lint, build, typecheck, test

### Code Quality

- `npm run lint` - Run ESLint on codebase
- `npm run lint:fix` - Run ESLint with auto-fixes
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Run TypeScript type checking across all packages

## Architecture Overview

This is **Foragen CLI**, a command-line AI workflow tool adapted from Google's Gemini CLI, specifically optimized for Qwen3-Coder models. It's a TypeScript monorepo using npm workspaces.

### Core Structure

**Entry Point**: `packages/cli/src/index.ts` → Bundles to `dist/cli.js` (bin: `fora`)

**Workspace Packages** (4 total):
- `packages/cli/` - Command-line interface and UI (React/Ink)
- `packages/core/` - Backend logic and services
- `packages/test-utils/` - Shared testing utilities
- `packages/vscode-ide-companion/` - VS Code integration

### Key Architectural Patterns

- **Monorepo**: npm workspaces for multi-package management
- **Build System**: ESBuild bundles to `dist/cli.js` for distribution
- **React CLI**: Uses Ink v6 framework for React-based terminal UI
- **Services Architecture**: Command processing through service layer
- **Tool System**: Extensible tool system with built-in and MCP (Model Context Protocol) tools
- **Strict TypeScript**: Comprehensive compiler options (see tsconfig.json)

### Important Directories

- `packages/` - Workspace packages (cli, core, test-utils, vscode-ide-companion)
- `integration-tests/` - End-to-end test scenarios
- `scripts/` - Build automation and utility scripts
- `dist/` - Bundled output (cli.js + sandbox profiles)
- `docs/` - Project documentation
- `.github/` - CI/CD workflows and templates
- `.claude/` - Claude Code configuration and best practices

### Build & Distribution

- **Build**: `esbuild.config.js` bundles to `dist/cli.js`
- **Binary**: `package.json` bin field: `"fora": "dist/cli.js"`
- **Assets**: Sandbox profiles copied to `dist/` during build
- **Bundle Script**: `npm run bundle` - generates git info + bundles + copies assets

## Project-Specific Conventions

### Import Rules (Enforced by ESLint)

- **Cross-package imports**: Use package names, NOT relative paths
  ```typescript
  // ✅ Correct
  import { foo } from '@jeffreysblake/foragen-cli-core';

  // ❌ Wrong (will fail ESLint)
  import { foo } from '../../core/src/foo';
  ```
- **ES6 imports**: Required over CommonJS require()
- **Import organization**: Group by external, internal, types

### Monorepo Package References

Packages reference each other via `file:` protocol in package.json:
```json
"dependencies": {
  "@jeffreysblake/foragen-cli-core": "file:../core"
}
```

### Authentication & APIs

- **Primary**: Fora OAuth with 2,000 requests/day free tier
- **Alternative**: OpenAI-compatible APIs (ModelScope, OpenRouter, etc.)
- **Configuration**: Supports `.env` files and environment variables
- **Model**: Optimized for Qwen3-Coder (now branded as Foragen)

### Sandboxing Support

- **macOS**: Seatbelt profiles (permissive/restrictive, open/closed/proxied)
  - Profiles stored in `dist/*.sb` after build
- **Cross-platform**: Docker/Podman container sandboxing
  - Container image: `foragen-cli-sandbox:0.1.3`
  - Build: `npm run build:sandbox`
- **Network**: Optional proxy support for restricted networking

## Key Files to Navigate

### Main Entry Points
- `packages/cli/src/index.ts` - CLI entry point
- `packages/cli/src/gemini.tsx` - Main CLI React component (Ink app)

### Core Services
- `packages/cli/src/services/` - Core service implementations
- `packages/core/src/` - Backend logic (shared across packages)

### Configuration
- `packages/cli/src/config/` - Configuration management
- `tsconfig.json` - Root TypeScript config (strict mode)
- `eslint.config.js` - ESLint rules with import restrictions

### UI & Commands
- `packages/cli/src/ui/commands/` - Built-in command implementations
- `packages/cli/src/ui/` - Ink components for terminal UI

### Testing
- `packages/test-utils/` - Shared test utilities
- `integration-tests/` - E2E test scenarios
- `vitest.config.ts` - Test configuration (per package)

## Development Workflow

### Making Changes

1. **Make changes** to code in `packages/`
2. **Run tests**: `npm test` (runs all package tests in parallel)
3. **Check quality**: `npm run lint:fix && npm run format`
4. **Build**: `npm run build`
5. **Test locally**: `npm start`
6. **Full validation**: `npm run preflight` (before commit)

### Adding New Dependencies

```bash
# Add to root (dev dependencies)
npm install -D <package>

# Add to specific workspace package
npm install <package> -w packages/cli
```

### Creating New Packages

1. Create `packages/<name>/` directory
2. Add to root `package.json` workspaces array
3. Follow existing package structure (package.json, tsconfig.json, src/, dist/)

## Testing Strategy

- **Unit Tests**: Vitest (co-located with source files)
- **Integration Tests**: Custom framework in `integration-tests/`
- **E2E Tests**: `npm run test:e2e` (sandbox: none/docker/podman)
- **Coverage**: Vitest coverage via `@vitest/coverage-v8`

## For More Details

- **Best Practices**: See `CODE.md` for TypeScript/React/Vitest patterns
- **Tech Stack**: Run `/setup-stack` to see detected stack and loaded templates
- **Project Docs**: See `docs/` directory for additional documentation
