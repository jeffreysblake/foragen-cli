# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Key Commands

### Development

- `npm run build` - Build the entire project (all packages)
- `npm run build:all` - Build project + sandbox container
- `npm start` - Start the CLI from source after building
- `npm run debug` - Start CLI in debug mode with inspect-brk

### Testing

- `npm run test` - Run unit tests for all packages
- `npm run test:e2e` - Run end-to-end integration tests
- `npm run test:ci` - Run CI test suite including scripts tests
- `npm run preflight` - Full check: clean, install, format, lint, build, typecheck, test

### Code Quality

- `npm run lint` - Run ESLint on codebase
- `npm run lint:fix` - Run ESLint with auto-fixes
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Run TypeScript type checking

### Package Management

- `npm run build:packages` - Build all workspace packages
- `npm run clean` - Clean build artifacts and dependencies

## Architecture Overview

This is **Fora Code**, a command-line AI workflow tool adapted from Google's Gemini CLI, specifically optimized for Fora3-Coder models. It's a TypeScript monorepo using npm workspaces.

### Core Structure

- **Entry Point**: `packages/cli/index.ts` - Main CLI entry
- **Core Packages**:
  - `packages/cli/` - Command-line interface and UI (React/Ink)
  - `packages/core/` - Backend logic and services
  - `packages/server/` - Server components
  - `packages/vscode-ide-companion/` - VS Code integration

### Key Architectural Patterns

- **Monorepo**: Uses npm workspaces for multi-package management
- **Bundle**: ESBuild bundles to `bundle/gemini.js` for distribution (bin: `fora`)
- **React CLI**: Uses Ink framework for React-based terminal UI
- **Services Architecture**: Command processing through service layer
- **Tool System**: Extensible tool system with built-in and MCP (Model Context Protocol) tools

### Important Directories

- `integration-tests/` - End-to-end test scenarios
- `scripts/` - Build automation and utility scripts
- `docs/` - Project documentation
- `.github/` - CI/CD workflows and templates

### Configuration Files

- `tsconfig.json` - Strict TypeScript configuration
- `eslint.config.js` - Comprehensive ESLint rules with import restrictions
- `esbuild.config.js` - Build configuration bundling to `bundle/gemini.js`

## Development Guidelines

### Code Standards

- **TypeScript**: Strict mode enabled with comprehensive compiler options
- **ESLint**: Enforces coding standards, import patterns, and no relative cross-package imports
- **Testing**: Uses Vitest for unit tests, custom integration test framework
- **Formatting**: Prettier with consistent style

### Import Rules

- **Cross-package imports**: Prohibited relative imports between packages (enforced by ESLint)
- **ES6 imports**: Required over CommonJS require() (ESLint enforced)
- **Import organization**: Structured import patterns for maintainability

### Authentication & APIs

- **Primary**: Fora OAuth with 2,000 requests/day free tier
- **Alternative**: OpenAI-compatible APIs (ModelScope, OpenRouter, etc.)
- **Configuration**: Supports `.env` files and environment variables

### Sandboxing Support

- **macOS**: Seatbelt profiles (permissive-open, restrictive-closed)
- **Cross-platform**: Docker/Podman container sandboxing
- **Network**: Optional proxy support for restricted networking

### Key Files to Understand

- `packages/cli/src/gemini.tsx` - Main CLI React component
- `packages/cli/src/services/` - Core service implementations
- `packages/cli/src/config/` - Configuration management
- `packages/cli/src/ui/commands/` - Built-in command implementations
