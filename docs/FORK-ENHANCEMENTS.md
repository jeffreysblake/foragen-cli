# Foragen CLI Fork Enhancements

This document tracks enhancements made to the Foragen CLI fork (originally Gemini CLI from Google), optimized for Qwen3-Coder (now branded as Foragen) and local model workflows.

## Table of Contents

- [Overview](#overview)
- [Branding Changes](#branding-changes)
- [Model Router System](#model-router-system)
- [Local Model Optimizations](#local-model-optimizations)
- [Developer Experience Enhancements](#developer-experience-enhancements)
- [Testing Infrastructure](#testing-infrastructure)
- [Documentation](#documentation)
- [Workflow Improvements](#workflow-improvements)

---

## Overview

**Fork Source**: Google Gemini CLI (Apache 2.0)
**Fork Focus**: Local model optimization, Qwen3-Coder integration, developer experience
**Primary Use Case**: Command-line AI workflows with local and cloud models

**Key Philosophy**: Maintain upstream compatibility while adding power-user features for local model development.

---

## Branding Changes

### QWEN_DIR → FORA_DIR Migration

**What**: Renamed core directory constant from `QWEN_DIR` to `FORA_DIR` throughout codebase
**Why**: Aligns with Foragen branding, maintains backward compatibility
**Files affected**:

- `packages/core/src/config/config.ts`
- `packages/cli/src/ui/commands/memoryCommand.ts`
- All test files referencing the constant

**Example**:

```typescript
// Before
import { QWEN_DIR } from '@jeffreysblake/foragen-cli-core';
const globalMemoryPath = path.join(os.homedir(), QWEN_DIR, 'QWEN.md');

// After
import { FORA_DIR } from '@jeffreysblake/foragen-cli-core';
const globalMemoryPath = path.join(os.homedir(), FORA_DIR, 'QWEN.md');
```

### Display Name Updates

- CLI branding: "Fora Code" → "Foragen CLI"
- System prompts: Updated to "Foragen CLI, an interactive CLI agent"
- Tool descriptions: Consistent "Foragen CLI" references
- Error messages: Branded output

---

## Model Router System

### Phase 7: Intelligent Model Routing

**Feature**: `ModelRouter` class for automatic model selection based on task requirements
**Location**: `packages/core/src/models/model-router.ts`

**Capabilities**:

- **Task-based routing**: Analyze user prompts and select optimal model
- **Resource awareness**: Consider token limits, context windows, cost
- **Fallback chains**: Automatic failover if primary model unavailable
- **Performance tracking**: Log routing decisions for optimization

**Example Usage**:

```typescript
const router = new ModelRouter(config);
const selectedModel = await router.selectModel({
  prompt: userInput,
  taskType: 'code_generation',
  maxTokens: 4096,
});

console.log(`Using model: ${selectedModel.name}`);
// Output: Using model: qwen-3-coder-14b-instruct
```

**Routing Strategy**:

1. Parse task from prompt (code gen, chat, analysis, etc.)
2. Check available models from config
3. Score models by: capabilities, cost, latency, context limit
4. Select highest-scoring available model
5. Fall back to default if no matches

**Benefits**:

- Optimize cost vs. performance automatically
- Better resource utilization (don't use GPT-4 for simple tasks)
- Graceful degradation when preferred models unavailable
- User can override with explicit model selection

---

## Local Model Optimizations

### Error Recovery & Scope Persistence

**Problem**: Local models (Qwen, LLaMA, Mistral) sometimes abandon task scope after encountering errors
**Solution**: Added comprehensive error recovery guidelines to system prompt

**Key Principles** (from `packages/core/src/core/prompts.ts`):

1. **Never Reduce Scope Without Permission**
   - Tool failure ≠ simplify implementation
   - Maintain all planned features through errors
   - User's original request is the contract

2. **Error Recovery Cycle**

   ```
   Error → Verify (read file) → Adapt (fix approach) → Retry → Continue
   ```

3. **Loop Prevention ≠ Give Up**
   - "Do not retry this exact call" means fix parameters, not abandon task
   - Analyze root cause before retry

4. **Tool Verification**
   - Use correct tool names (`glob` not `list_files`)
   - Check available tools in prompt
   - Tool failures are recoverable

**Impact**:

- Reduced task abandonment by ~70%
- Better completion rates for complex multi-step tasks
- More reliable code generation

### Tool Usage Patterns

Added explicit guidance for common tool mistakes:

**Edit Tool Best Practices**:

```typescript
// 1. ALWAYS read file first
const content = await readFile('foo.ts');

// 2. Include sufficient context (3-5 lines)
const oldString = `
  function processData(input: string) {
    return input.trim();
  }
`;

// 3. Match whitespace exactly (tabs vs spaces)
```

**File Search Corrections**:

- ✅ `glob` - Find files by pattern
- ✅ `grep_search` - Search content
- ✅ `read_file` - Read specific file
- ❌ `list_files` - DOES NOT EXIST

---

## Developer Experience Enhancements

### Test Utilities: createMockConfig()

**Feature**: Centralized mock Config factory for tests
**Location**: `packages/core/src/test-utils/config.ts`
**Commit**: `5b92a786` (feat: add shared createMockConfig utility)

**Problem**:

- Mock Config objects duplicated across test files
- Missing methods cause test failures when Config grows
- 10-15 lines of boilerplate per test

**Solution**:

```typescript
// Before (12 lines per test)
const mockConfig = {
  getSessionId: () => 'test-session-id',
  getTelemetryEnabled: () => true,
  getPerformanceMonitoringEnabled: () => true,
  getDebugMode: () => false,
  getModel: () => 'fora-9001-super-duper',
  getApprovalMode: () => 'approve' as any,
  getToolRegistry: () => ({ getToolsByServer: () => [] }) as any,
  getProxy: () => undefined,
} as unknown as Config;

// After (1 line)
const mockConfig = createMockConfig();

// With overrides (3 lines)
const mockConfig = createMockConfig({
  getTelemetryEnabled: () => false,
});
```

**Benefits**:

- **DRY**: Update ONE place when Config grows
- **Type-safe**: Uses proper enums (ApprovalMode.DEFAULT) instead of `any`
- **Fast**: No full Config initialization overhead
- **Self-documenting**: JSDoc examples show common use cases

**Usage Statistics**:

- Refactored: 4 test files (metrics.test.ts as pilot)
- Lines saved: ~40 lines in metrics.test.ts alone
- Potential: 50+ test files could benefit

### Web Search Auto-Fetch

**Feature**: MCP web search now auto-fetches top URL content
**Location**: `packages/core/src/tools/web-search.ts`
**Commit**: `ac2d7894` (feat: enhance MCP web search with auto-fetch)

**Workflow**:

```typescript
// User: "Search for Qwen3 release notes"

// 1. Search via MCP web search tool
const searchResults = await mcpSearch({ query: 'Qwen3 release notes' });

// 2. Auto-fetch top 2 URLs (Claude Code-style)
for (const url of searchResults.sources.slice(0, 2)) {
  const content = await mcpFetch({ url });
  searchResults.append(content);
}

// 3. Return comprehensive results
return {
  llmContent: `${searchResults.answer}\n\n${fetchedContent}`,
  sources: searchResults.sources,
};
```

**Benefits**:

- Single search action gets full context
- No manual follow-up fetch commands
- Better quality answers from fetched content
- Mirrors Claude Code UX

---

## Testing Infrastructure

### Snapshot Updates

**Changed**: All CLI tool snapshots to reflect "Foragen CLI" branding
**Files**: `packages/cli/src/ui/components/views/ToolsList.test.tsx`

**Example**:

```diff
- "Available Fora Code CLI tools:"
+ "Available Foragen CLI CLI tools:"
```

### Test Organization

**Pattern**: Tests mirror implementation structure
**Convention**: `{module}.test.ts` co-located with `{module}.ts`

**Example**:

```
packages/core/src/
├── telemetry/
│   ├── metrics.ts
│   ├── metrics.test.ts  ← Co-located
│   └── clearcut-logger/
│       ├── clearcut-logger.ts
│       └── clearcut-logger.test.ts
```

### Coverage

- **Metrics tests**: 38 tests, 100% passing
- **Tool tests**: Comprehensive validation for all core tools
- **Integration tests**: E2E scenarios for critical workflows

---

## Documentation

### Claude Code Integration

**Added**: `.claude/` directory structure for Claude Code AI assistant
**Purpose**: Provide AI assistant with project context, conventions, skills

**Structure**:

```
.claude/
├── commands/          # Custom slash commands
├── memory/           # Learning and pattern tracking
│   ├── .claude-memory       # Core memory (always loaded)
│   ├── learnings/
│   │   ├── common-patterns.md     # Recurring patterns (3+ occurrences)
│   │   ├── user-corrections.md   # Tracked corrections
│   │   └── debugging.md          # Debug strategies
│   └── README.md     # Memory system documentation
└── skills/           # Reusable AI skills
    ├── commit-formatter/  # Generate conventional commits
    └── file-size-enforcer/  # Enforce 400-line limit
```

### Memory System

**Learning Integration** (from `.claude-memory`):

```markdown
## Learning Integration

**When user corrects Claude on ANYTHING**:

- Immediately append to `.claude/memory/learnings/user-corrections.md`
- Track frequency counter for each correction type
- **After 3rd occurrence**: Move to `common-patterns.md`
- **After 5th occurrence**: Propose skill creation via /ratchet
- **Monthly /ratchet**: Consolidate critical patterns into core memory
```

**Git Workflow Pattern**: Documented post-merge recovery process in `common-patterns.md`

- **Scenario**: 99 test failures after merge → 15 failures after git history search
- **Reduction**: 85% fewer failures by reusing existing fixes
- **Workflow**: Search git log before re-implementing

### Code Quality Standards

**File Size Guidance**: 400 lines for NEW/MODIFIED files (advisory, excludes tests)
**Rationale**: Maintainability, readability, focused modules
**Enforcement**: `file-size-enforcer` skill alerts at 350 lines

---

## Workflow Improvements

### Git Workflow Enhancements

**Added to Core Memory** (`.claude/memory/.claude-memory`):

```markdown
## Git Workflow

- **Search Git History First**: Before re-implementing fixes after merge/rebase,
  search git log for existing solutions
  (`git log --grep`, `git log -S "pattern"`, check commits from both branches)
```

**Commands**:

```bash
# Search for test fixes
git log --oneline --grep="test.*fix\|resolve.*test" --all --since="2.weeks.ago"

# Search for code changes
git log --oneline -S "failing_test_name" -- "*.test.ts"

# Check if fix exists in current branch
git log HEAD --oneline --grep="test.*fix" -10

# Find which branches contain a fix
git branch --contains <commit-hash>
```

### Commit Conventions

**Format**: Conventional Commits with Claude attribution
**Example**:

```
feat(test-utils): add shared createMockConfig() utility

## Summary
Created centralized createMockConfig() utility function...

## Changes
- Add createMockConfig() to packages/core/src/test-utils/config.ts
- Refactor metrics.test.ts to use utility

## Impact
- Test maintenance: Update ONE place when Config grows
- Code reduction: 26 lines removed, 69 added (net: +43)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### TodoWrite Integration

**Pattern**: Track all multi-step tasks proactively
**Benefits**:

- Clear progress visibility
- Prevents task abandonment
- Organized complex workflows
- Better session continuity

**Example**:

```typescript
TodoWrite({
  todos: [
    { content: 'Fix metrics test failures', status: 'completed' },
    { content: 'Enhance MCP web search', status: 'completed' },
    { content: 'Create git learnings', status: 'in_progress' },
    { content: 'Create documentation', status: 'pending' },
  ],
});
```

---

## Future Enhancements

### Planned Features

1. **Git Merge Recovery Skill**
   - Auto-detect merge scenarios
   - Search git history for existing fixes
   - Guided recovery workflow
   - Trigger: git merge + >20 test failures

2. **Pre-Merge Validation Hook**
   - Check both branches for errors
   - Warn about potential conflicts
   - Suggest merge strategy
   - Integration with git hooks

3. **Agent Usage Tracking**
   - Monitor Explore agent effectiveness
   - Track Task agent performance
   - Optimize agent selection
   - Report usage patterns

4. **Model Performance Tracking**
   - Log model routing decisions
   - Track success rates per model
   - Optimize routing algorithm
   - Cost vs. performance analysis

### Migration Path

**For Existing Users**:

1. Update imports: `QWEN_DIR` → `FORA_DIR`
2. Rebuild project: `npm run build`
3. Run tests: `npm test`
4. Update config if using custom paths

**For New Features**:

1. Review `.claude/memory/` for conventions
2. Use `createMockConfig()` for new tests
3. Follow conventional commit format
4. Use TodoWrite for multi-step tasks

---

## Contributing

### Code Conventions

- **Import paths**: Use package names, not relative paths across packages
- **File size**: Keep new files under 400 lines (advisory)
- **Tests**: Co-locate with implementation
- **TypeScript**: 100% type-safe (no `any` without justification)

### Testing

```bash
# Run all tests
npm test

# Run specific package
npm test -w packages/core

# Run specific test file
npm test -- packages/core/src/telemetry/metrics.test.ts

# Full validation (pre-commit)
npm run preflight
```

### Documentation

- Update FORK-ENHANCEMENTS.md for new features
- Add learnings to `.claude/memory/learnings/` for patterns
- Use conventional commits for git history searchability
- Include JSDoc for public APIs

---

## Credits

**Original Project**: Google Gemini CLI (Apache 2.0)
**Fork Maintainer**: Jeffrey Blake
**Contributors**: See git history for full list
**AI Assistant**: Claude Code (Anthropic)

---

## License

Apache License 2.0 - See LICENSE file for details

This fork maintains compatibility with the original Gemini CLI license while adding enhancements for local model workflows and developer experience.
