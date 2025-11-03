# Rebranding Notes: qwen-code → foragen-cli

## Current Status (Latest Session)

### Critical Issues Identified and Fixed

During this session, we identified critical flaws in the previous rebranding scripts and created a completely new, correct approach.

### Previous Script Issues (NOW FIXED)

1. **Scripts Were "Reversed"** - All batch_replace calls were replacing targets with themselves (ForaLogger → ForaLogger instead of QwenLogger → ForaLogger)

2. **Missing Compound Pattern Handling** - Patterns like `@qwen-code/qwen-code-core` were not handled before simple replacements, causing partial matches like `@fora-code/fora-code-core`

3. **Incorrect Case Handling** - Using case-insensitive sed (`gI` flag) mangled mixed-case identifiers (QwenLogger became foralogger instead of ForaLogger)

4. **Wrong Package Mappings** - Package names were mapped incorrectly (should be `@jeffreysblake/foragen-cli-core` not `@jeffreysblake/foragen-core`)

5. **Environment Variables Wrong** - Should be `FORAGEN_CLI_*` not `FORA_CLI_*` (following the qwen-code → foragen-cli pattern)

### New Script Approach

Created `scripts/rebrand-to-foragen-cli.sh` with a **TWO-FLOW** architecture:

## The Two-Flow Pattern

### Flow 1: "qwen-code" → "foragen-cli" (COMPLETE FIRST)

This handles the compound pattern that appears throughout the codebase.

**Phase 1.1: Package Scopes** (Most specific - double compound)
```bash
@qwen-code/qwen-code-core → @jeffreysblake/foragen-cli-core
@qwen-code/qwen-code-test-utils → @jeffreysblake/foragen-cli-test-utils
@qwen-code/qwen-code → @jeffreysblake/foragen-cli
```

**Phase 1.2: GitHub URLs and Containers**
```bash
QwenLM/qwen-code-action → jeffreysblake/foragen-cli-action
QwenLM/qwen-code → jeffreysblake/foragen-cli
ghcr.io/qwenlm/qwen-code → foragen-cli-sandbox (local build)
qwenlm.qwen-code-vscode-ide-companion → jeffreysblake.foragen-cli-vscode-companion
```

**Phase 1.3: Environment Variables** (UPPER_SNAKE_CASE compounds)
```bash
QWEN_CODE_COMPANION_EXTENSION_NAME → FORAGEN_CLI_COMPANION_EXTENSION_NAME
QWEN_CODE_IDE_SERVER_PORT → FORAGEN_CLI_IDE_SERVER_PORT
QWEN_CODE_IDE_WORKSPACE_PATH → FORAGEN_CLI_IDE_WORKSPACE_PATH
QWEN_CODE_IDE_SERVER_STDIO_COMMAND → FORAGEN_CLI_IDE_SERVER_STDIO_COMMAND
QWEN_CODE_IDE_SERVER_STDIO_ARGS → FORAGEN_CLI_IDE_SERVER_STDIO_ARGS
QWEN_CODE_SYSTEM_SETTINGS_PATH → FORAGEN_CLI_SYSTEM_SETTINGS_PATH
QWEN_CODE_SYSTEM_DEFAULTS_PATH → FORAGEN_CLI_SYSTEM_DEFAULTS_PATH
QWEN_CODE_VERSION → FORAGEN_CLI_VERSION
QWEN_CODE_TOOL_CALL_STYLE → FORAGEN_CLI_TOOL_CALL_STYLE
QWEN_CODE_FORCE_ENCRYPTED_FILE_STORAGE → FORAGEN_CLI_FORCE_ENCRYPTED_FILE_STORAGE
```

**Phase 1.4: PascalCase QwenCode** (No space/hyphen - used in code)
```bash
QwenCodeAgent → ForagenCliAgent
QwenCode/1.0.0 → ForagenCli/1.0.0  # User-Agent strings
/Library/Application Support/QwenCode → /Library/Application Support/ForagenCli
qwen-code.runQwenCode → foragen-cli.runForagenCli  # VS Code commands
runQwenCode → runForagenCli
```

**Phase 1.5: kebab-case Compounds** (Longest/most specific first)
```bash
qwen-code-vscode-ide-companion → foragen-cli-vscode-companion
qwen-code-companion-mcp-server → foragen-cli-companion-mcp-server
qwen-code-tool-modify-diffs → foragen-cli-tool-modify-diffs
qwen-code-test-workspace- → foragen-cli-test-workspace-
qwen-code-test-home- → foragen-cli-test-home-
qwen-code-test-root → foragen-cli-test-root
qwen-code-ide-server- → foragen-cli-ide-server-
qwen-code-mcp-client → foragen-cli-mcp-client
qwen-code-telemetry- → foragen-cli-telemetry-
qwen-code-releases- → foragen-cli-releases-
qwen-code-warnings.txt → foragen-cli-warnings.txt
qwen-code-linters → foragen-cli-linters
qwen-code-modify- → foragen-cli-modify-
qwen-code-dev-script → fora-cli-dev-script
qwen-code-setup.sh → foragen-cli-setup.sh
qwen-code-oauth → foragen-cli-oauth
qwen-code-cli → foragen-cli  # Special case
qwen-code-sandbox → foragen-cli-sandbox
qwen-code-pr-review.yml → foragen-cli-pr-review.yml
```

**Phase 1.6: Simple Replacements** (Only AFTER all compounds)
```bash
QWEN_CODE → FORAGEN_CLI
Qwen-Code → Foragen-Cli
qwen-code → foragen-cli
qwen_code → foragen_cli
```

### Flow 2: "qwen" → "fora" (ONLY AFTER FLOW 1)

This handles simple qwen references throughout the codebase.

**Phase 2.1: Compound Qwen Identifiers**
```bash
# PascalCase compounds
QwenContentGenerator → ForaContentGenerator
QwenLogger → ForaLogger
QwenOAuth → ForaOAuth

# camelCase compounds
useQwenAuth → useForaAuth
qwenOAuth → foraOAuth
qwenCodeInfoMessageShown → foragenCliInfoMessageShown
```

**Phase 2.2: Simple Qwen Replacements** (Case-sensitive order)
```bash
QWEN_OAUTH → FORA_OAUTH
QWEN_DIR → FORA_DIR
QWEN → FORA
Qwen → Fora
qwen → fora
```

**Phase 2.3 & 2.4: File and Directory Renames**
- Files first, then directories
- Deepest first to avoid parent directory conflicts
- Explicit case handling (not case-insensitive)

## Why This Approach Works

### Problem with Simple Case Replacements

Consider: `@qwen-code/qwen-code-core`

If we just do case replacements:
1. `qwen` → `fora` (first instance): `@fora-code/qwen-code-core`
2. `qwen` → `fora` (second instance): `@fora-code/fora-code-core` ❌ WRONG!

We needed: `@jeffreysblake/foragen-cli-core`

### Solution: Two-Flow Pattern

By handling `qwen-code` → `foragen-cli` FIRST, we replace the entire compound:
1. `@qwen-code/qwen-code-core` → `@jeffreysblake/foragen-cli-core` ✅ CORRECT!

Then simple `qwen` → `fora` replacements only affect non-compound instances.

## Case Sensitivity Rules

### NEVER use case-insensitive flags

❌ **Wrong**: `sed 's/qwen/fora/gI'` - This mangles mixed case!
- Turns `QwenLogger` → `foralogger` (broken!)

✅ **Right**: Explicit case handling in order:
```bash
QWEN → FORA      # uppercase first
Qwen → Fora      # title case
qwen → fora      # lowercase last
```

This preserves: `QwenLogger` → `ForaLogger` ✅

## Compound Patterns Catalog

### Found 10 Categories of Compound Patterns:

1. **Package names**: `@qwen-code/qwen-code-*`
2. **GitHub URLs**: `QwenLM/qwen-code`, `ghcr.io/qwenlm/qwen-code`
3. **Environment variables**: `QWEN_CODE_*` (10 variants found)
4. **PascalCase identifiers**: `QwenCodeAgent`, `QwenCode/` (User-Agent)
5. **kebab-case files**: `qwen-code-*` (20+ variants)
6. **Package filenames**: `qwen-code-qwen-code-*.tgz`
7. **Workflow files**: `qwen-code-pr-review.yml`
8. **VS Code IDs**: `qwenlm.qwen-code-vscode-ide-companion`
9. **Class names**: `QwenContentGenerator`, `QwenLogger`
10. **camelCase vars**: `useQwenAuth`, `qwenOAuth`

## Upstream Folder Structure

**Verified from upstream**: The directory structure is **FLAT**, not nested.

```
packages/core/src/qwen/          ← FLAT structure
├── qwenOAuth2.ts
├── qwenContentGenerator.ts
└── sharedTokenManager.ts
```

There is **NO** `qwen/qwen/` nesting in upstream. Any nested `fora/fora/` issues were caused by script bugs.

## New Scripts

We've created both **Bash** and **Python** versions of the scripts. The Python versions are recommended for better error handling and cross-platform compatibility.

### 1. `rebrand_to_foragen_cli.py` ⭐ Main Script (Python - RECOMMENDED)

**Why Python?**
- ✅ Pure Python stdlib (no dependencies, no venv needed!)
- ✅ No sed/bash escaping nightmares
- ✅ Precise string replacement (no regex accidents)
- ✅ Better error handling and progress reporting
- ✅ Cross-platform (works same on Linux/Mac/Windows)
- ✅ Easier to read and maintain

**Features**:
- Two-flow architecture (qwen-code first, then qwen)
- Explicit case handling (no case-insensitive operations)
- Compound patterns handled before simple replacements
- Dry-run mode: `--dry-run`
- Verbose mode: `-v` or `--verbose`
- Proper ordering: most specific → least specific
- Statistics tracking and summary
- Git integration (tries `git mv`, falls back to regular `mv`)

**Usage**:
```bash
# Dry run to preview changes
./scripts/rebrand_to_foragen_cli.py --dry-run

# Verbose output with dry run
./scripts/rebrand_to_foragen_cli.py --dry-run -v

# Actually perform rebranding
./scripts/rebrand_to_foragen_cli.py

# With verbose output
./scripts/rebrand_to_foragen_cli.py -v
```

### 1b. `rebrand-to-foragen-cli.sh` - Bash Version (Alternative)

Same functionality as Python version but in Bash. Use if you prefer bash or don't have Python 3.

**Usage**:
```bash
./scripts/rebrand-to-foragen-cli.sh --dry-run
./scripts/rebrand-to-foragen-cli.sh --verbose
./scripts/rebrand-to-foragen-cli.sh
```

### 2. `verify_rebranding.py` - Verification Script (Python - RECOMMENDED)

**Why Python?**
- ✅ Pure stdlib Python (no dependencies)
- ✅ Better error reporting
- ✅ Clearer output formatting
- ✅ More precise pattern matching
- ✅ Detailed line-by-line reporting

**Checks**:
- ✓ No remaining `@qwen-code/*` package references
- ✓ No remaining `QwenLM/qwen-code` URLs (except upstream docs)
- ✓ All environment variables updated (`QWEN_CODE_*` → `FORAGEN_CLI_*`)
- ✓ Binary renamed (`qwen` → `fora`)
- ✓ All package.json files updated
- ✓ No nested `fora/fora` or `foragen-cli/foragen-cli` directories
- ✓ Workflow files renamed
- ✓ VS Code extension IDs updated
- ✓ Class names and identifiers updated

**Usage**:
```bash
# After running rebrand script
./scripts/verify_rebranding.py
```

**Exit codes**:
- 0 = All checks passed
- 1 = Errors found (must fix before proceeding)
- Warnings for acceptable upstream references

**Output**:
- Shows file path, line number, and content for each match
- Color-coded results (green=pass, yellow=warning, red=fail)
- Summary statistics at the end

### 2b. `verify-rebranding.sh` - Bash Version (Alternative)

Same functionality as Python version but in Bash.

**Usage**:
```bash
./scripts/verify-rebranding.sh
```

## Deleted Old Scripts

Removed all previous incorrect scripts:
- ❌ `rebrand-to-fora.sh` (had reversed replacements)
- ❌ `rebrand-to-fora-temp.sh` (incomplete)
- ❌ `rebrand-to-fora-v2.sh` (wrong package mappings)
- ❌ `rebrand-phase1-only.sh` (partial/incorrect)
- ❌ `rebrand-to-fora-fast.sh` (case handling issues)

## Key Learnings

### 1. Compound Before Simple

Always replace compound patterns before simple ones:
- `@qwen-code/qwen-code-core` BEFORE `qwen-code`
- `qwen-code` BEFORE `qwen`
- `QWEN_CODE_*` BEFORE `QWEN_CODE`

### 2. Case Matters

Never use case-insensitive replacement for code identifiers:
- Preserve PascalCase: `QwenLogger` → `ForaLogger`
- Preserve camelCase: `useQwenAuth` → `useForaAuth`
- Use explicit ordered replacements (UPPER, Title, lower)

### 3. Verify Pattern Consistency

The replacement pattern must be consistent:
- `qwen-code` → `foragen-cli` (compound)
- `QWEN_CODE` → `FORAGEN_CLI` (env vars follow compound pattern)
- `qwen` → `fora` (simple)
- `QWEN` → `FORA` (simple uppercase)

### 4. Repository Structure Matters

Check upstream to verify directory structures:
- Don't flatten directories that aren't nested upstream
- Preserve import path structures
- Rename directories deepest-first to avoid conflicts

## Next Session Checklist

### Before Running Rebranding

1. ✅ Ensure on correct branch (`feature/rebrand-scripts-prep` or create new branch)
2. ✅ Stash or commit any uncommitted changes
3. ✅ Review the script with `--dry-run` first
4. ✅ Check the script matches your expectations

### Running Rebranding

**Recommended: Use Python scripts**

```bash
# Create a new branch for clean rebranding
git checkout -b feature/rebrand-clean main

# Dry run to verify (Python - recommended)
./scripts/rebrand_to_foragen_cli.py --dry-run -v

# If dry run looks good, run for real
./scripts/rebrand_to_foragen_cli.py -v

# Verify the changes
./scripts/verify_rebranding.py

# Check status
git status

# Review changes
git diff --stat
```

**Alternative: Bash scripts**

```bash
# Dry run with bash
./scripts/rebrand-to-foragen-cli.sh --dry-run --verbose

# Run with bash
./scripts/rebrand-to-foragen-cli.sh --verbose

# Verify with bash
./scripts/verify-rebranding.sh
```

### After Rebranding

1. ✅ Run verification: `./scripts/verify_rebranding.py` (or `.sh`)
2. ✅ Test build: `npm run build`
3. ✅ Test typecheck: `npm run typecheck`
4. ✅ Test linting: `npm run lint`
5. ✅ Run tests: `npm test`
6. ✅ Review git diff for unexpected changes
7. ✅ Commit with descriptive message

### If Issues Found

- Check verification script output for specific errors
- Review patterns in the rebranding script
- Add any missing patterns you discover
- Re-run from clean branch if major issues found

## Performance

Expected performance:
- **Processing**: ~7-10 seconds (estimated)
- **Files affected**: 420+ files
- **Replacements**: 200+ patterns

## Repository Structure

### Remotes
```bash
origin: https://github.com/jeffreysblake/foragen-cli.git
qwen-upstream: https://github.com/QwenLM/qwen-code.git
```

### Branches Strategy
- `main` - Synced with upstream, base for work
- `feature/rebrand-scripts-prep` - Script development and testing
- `feature/rebrand-clean` - Clean rebranding execution
- `upstream-qwen` - Mirror of upstream for syncing

## Notes

- The two-flow approach is critical for correct compound handling
- Case sensitivity must be explicit, never use case-insensitive flags
- Compound patterns must be identified and handled before simple patterns
- Verification script helps catch any missed patterns
- Upstream structure is flat - no nested directories to preserve

## Session Summary

This session successfully:

1. ✅ Identified critical flaws in previous rebranding scripts
2. ✅ Analyzed complete compound pattern requirements
3. ✅ Verified upstream folder structure (flat, not nested)
4. ✅ Created comprehensive two-flow rebranding script
5. ✅ Created verification script with detailed checks
6. ✅ Deleted all incorrect previous scripts
7. ✅ Documented the complete approach for next session

Ready for next session to execute the rebranding on a clean branch and verify results.
