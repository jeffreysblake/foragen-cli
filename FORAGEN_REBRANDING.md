# Foragen CLI Rebranding Documentation

## Overview

This document tracks the complete rebranding of the forked qwen-code project to foragen-cli. The fork maintains a single monorepo structure with all packages within one repository.

## Repository Information

- **Original**: https://github.com/QwenLM/qwen-code
- **Fork**: https://github.com/jeffreysblake/foragen-cli (renamed from jeffreysblake/qwen-code)
- **Structure**: Monorepo with npm workspaces (all packages in one repo)

## Package Namespace Changes

| Original Package                  | New Package                       | Type                     |
| --------------------------------- | --------------------------------- | ------------------------ |
| @jeffreysblake/foragen-cli        | @jeffreysblake/foragen-cli        | Main CLI                 |
| @jeffreysblake/foragen-core       | @jeffreysblake/foragen-core       | Core library             |
| @jeffreysblake/foragen-test-utils | @jeffreysblake/foragen-test-utils | Test utilities (private) |
| qwen-code-vscode-ide-companion    | foragen-vscode-companion          | VS Code extension        |

## Binary and Command Changes

- **Binary**: `qwen` → `fora`
- **Config Directory**: `~/.qwen/` → `~/.fora/`
- **Alias**: `alias fora='npm start --prefix /media/decisiv/models/consult/betech/foragen_cli'`

## Docker Strategy

- **Approach**: Build local Docker images (no registry needed)
- **Image Name**: `foragen-cli-sandbox:latest`
- **Build Command**: `docker build -t foragen-cli-sandbox:latest .`
- **Alternative**: Can still use upstream `ghcr.io/qwenlm/qwen-code:0.0.9` if needed

## Directory Renames

1. `/packages/core/src/qwen/` → `/packages/core/src/fora/`
2. `/packages/core/src/telemetry/qwen-logger/` → `/packages/core/src/telemetry/fora-logger/`

## File Renames (15+ files)

### Documentation

- `QWEN.md` → `FORA.md`
- `.github/workflows/qwen-code-pr-review.yml` → `.github/workflows/fora-cli-pr-review.yml`

### Core OAuth Module

- `packages/core/src/qwen/qwenOAuth2.ts` → `packages/core/src/fora/foraOAuth2.ts`
- `packages/core/src/qwen/qwenOAuth2.test.ts` → `packages/core/src/fora/foraOAuth2.test.ts`
- `packages/core/src/qwen/qwenContentGenerator.ts` → `packages/core/src/fora/foraContentGenerator.ts`
- `packages/core/src/qwen/qwenContentGenerator.test.ts` → `packages/core/src/fora/foraContentGenerator.test.ts`

### Telemetry

- `packages/core/src/telemetry/qwen-logger/qwen-logger.ts` → `packages/core/src/telemetry/fora-logger/fora-logger.ts`
- `packages/core/src/telemetry/qwen-logger/qwen-logger.test.ts` → `packages/core/src/telemetry/fora-logger/fora-logger.test.ts`

### React Components

- `packages/cli/src/ui/hooks/useQwenAuth.ts` → `packages/cli/src/ui/hooks/useForaAuth.ts`
- `packages/cli/src/ui/hooks/useQwenAuth.test.ts` → `packages/cli/src/ui/hooks/useForaAuth.test.ts`
- `packages/cli/src/ui/components/QwenOAuthProgress.tsx` → `packages/cli/src/ui/components/ForaOAuthProgress.tsx`
- `packages/cli/src/ui/components/QwenOAuthProgress.test.tsx` → `packages/cli/src/ui/components/ForaOAuthProgress.test.tsx`

### Themes

- `packages/cli/src/ui/themes/qwen-dark.ts` → `packages/cli/src/ui/themes/fora-dark.ts`
- `packages/cli/src/ui/themes/qwen-light.ts` → `packages/cli/src/ui/themes/fora-light.ts`

## Class/Interface/Function Renames

### Interfaces & Types

- `QwenCredentials` → `ForaCredentials`
- `IQwenOAuth2Client` → `IForaOAuth2Client`
- `QwenOAuth2Event` → `ForaOAuth2Event`
- `QwenAuthState` → `ForaAuthState`

### Classes

- `QwenOAuth2Client` → `ForaOAuth2Client`
- `QwenContentGenerator` → `ForaContentGenerator`
- `QwenLogger` → `ForaLogger`

### Functions

- `getQwenOAuthClient()` → `getForaOAuthClient()`
- `clearQwenCredentials()` → `clearForaCredentials()`
- `isQwenQuotaExceededError()` → `isForaQuotaExceededError()`
- `isQwenThrottlingError()` → `isForaThrottlingError()`
- `useQwenAuth()` → `useForaAuth()`

### Constants

- `QWEN_CODE_COMPANION_EXTENSION_NAME` → `FORA_CLI_COMPANION_EXTENSION_NAME`
- `## Qwen Added Memories` → `## Fora Added Memories`
- `qwenDarkColors` → `foraDarkColors`
- `qwenLightColors` → `foraLightColors`

## Import Updates

All imports need updating from:

- `@jeffreysblake/foragen-cli` → `@jeffreysblake/foragen-cli`
- `@jeffreysblake/foragen-core` → `@jeffreysblake/foragen-core`
- `@jeffreysblake/foragen-test-utils` → `@jeffreysblake/foragen-test-utils`
- `./qwen/` → `./fora/`
- `../qwen/` → `../fora/`

## Files Requiring Changes (204 total)

### Priority 1: Configuration Files (5 files)

- [ ] `/package.json` - Root package configuration
- [ ] `/packages/cli/package.json` - CLI package
- [ ] `/packages/core/package.json` - Core package
- [ ] `/packages/test-utils/package.json` - Test utils package
- [ ] `/packages/vscode-ide-companion/package.json` - VS Code extension

### Priority 2: Source Code Directories (2 directories)

- [ ] `/packages/core/src/qwen/` → `/packages/core/src/fora/` (6 files)
- [ ] `/packages/core/src/telemetry/qwen-logger/` → `/packages/core/src/telemetry/fora-logger/` (2 files)

### Priority 3: React Components & Hooks (6 files)

- [ ] `/packages/cli/src/ui/hooks/useQwenAuth.ts`
- [ ] `/packages/cli/src/ui/hooks/useQwenAuth.test.ts`
- [ ] `/packages/cli/src/ui/components/QwenOAuthProgress.tsx`
- [ ] `/packages/cli/src/ui/components/QwenOAuthProgress.test.tsx`
- [ ] `/packages/cli/src/ui/themes/qwen-dark.ts`
- [ ] `/packages/cli/src/ui/themes/qwen-light.ts`

### Priority 4: Core Source Files (~80 files)

See comprehensive list in search results. Major files include:

- [ ] `/packages/cli/src/gemini.tsx` - Main CLI component
- [ ] `/packages/cli/src/ui/App.tsx` - App component
- [ ] `/packages/cli/src/config/auth.ts` - Auth configuration
- [ ] `/packages/core/src/config/models.ts` - Model configurations
- [ ] `/packages/core/src/utils/quotaErrorDetection.ts` - Error detection
- [ ] `/packages/core/src/tools/memoryTool.ts` - Memory tool
- [ ] ... (and ~74 more source files)

### Priority 5: Test Files (~40 files)

All test files that import or reference qwen modules

### Priority 6: Build & Config Files (~20 files)

- [ ] `/Dockerfile` - Docker configuration
- [ ] `/.gitignore` - Git ignore rules
- [ ] `/.github/workflows/qwen-code-pr-review.yml` - GitHub workflow
- [ ] Various script files in `/scripts/`

### Priority 7: Documentation (2 files)

- [ ] `/QWEN.md` → `/FORA.md`
- [ ] `/docs/assets/qwen-screenshot.png` → `/docs/assets/fora-screenshot.png`

### Priority 8: Generated Files (Can be regenerated)

- `/packages/*/dist/**` - All dist directories
- `/packages/cli/coverage/**` - Coverage reports
- `/bundle/` - Bundle directory

## Git Configuration

### Remote Setup

```bash
# Update origin to new repo name
git remote set-url origin https://github.com/jeffreysblake/foragen-cli.git

# Add upstream tracking
git remote add qwen-upstream https://github.com/QwenLM/qwen-code.git

# Fetch upstream
git fetch qwen-upstream

# Create upstream tracking branch
git checkout -b upstream-qwen qwen-upstream/main
```

### Branch Strategy

- `main` - Your production branch with all customizations
- `upstream-qwen` - Clean mirror of QwenLM/qwen-code for syncing
- `feature/rebrand-to-fora` - Current rebranding work

## Automation Scripts Created

### 1. scripts/rebrand-to-fora.sh

Comprehensive script to automate the rebranding process

### 2. scripts/verify-rebranding.sh

Verification script to ensure no "qwen" references remain

### 3. scripts/sync-upstream.sh

Script to sync updates from upstream QwenLM/qwen-code

## Testing Checklist

After rebranding:

- [ ] `npm install` - Clean install
- [ ] `npm run build` - Build succeeds
- [ ] `npm run typecheck` - Type checking passes
- [ ] `npm test` - All tests pass
- [ ] `npm start` - CLI launches as "fora"
- [ ] Docker build succeeds
- [ ] OAuth flow works with new names

## Notes

1. **No NPM Publishing**: Using workspace `file:` references, no need to publish packages
2. **Single Repository**: All packages remain in one monorepo, no separate repos needed
3. **Local Docker**: Building images locally, no registry needed
4. **Backwards Compatibility**: Can still use upstream Docker images if needed

## Completion Status

- [x] Created ~/.fora/settings.json
- [x] Uninstalled global package
- [x] Created FORAGEN_REBRANDING.md
- [ ] Updated package.json files
- [ ] Renamed directories
- [ ] Created automation scripts
- [ ] Ran comprehensive rebranding
- [ ] Updated Docker configuration
- [ ] Configured git remotes
- [ ] Built and tested
- [ ] Created additional documentation
- [ ] Committed changes

Last Updated: 2025-11-02
