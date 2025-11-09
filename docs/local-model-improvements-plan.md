# Local LLM Behavior Improvements - Analysis & Implementation Plan

## Analysis Summary

### Key Patterns Identified from Logs

Based on analysis of `~/.fora/logs/debug-2025-11-05.log`:

#### 1. **Edit Tool Failures (Most Common)**

```
[ERROR] Tool returned error result {"toolName":"edit","errorType":"edit_no_occurrence_found"}
[ERROR] Tool returned error result {"errorName":"edit","errorType":"edit_no_change"}
```

**Frequency**: Multiple occurrences across sessions
**Impact**: High - leads to scope abandonment

**Root Causes**:

- Whitespace/indentation mismatches
- Model hallucinating content that doesn't exist
- Copy-paste errors from previous responses
- No verification before attempting edit

#### 2. **Wrong Tool Names**

```
[ERROR] Tool execution failed {"toolName":"list_files","errorType":"tool_not_registered"}
```

**Frequency**: Moderate
**Impact**: High - wastes turns and triggers loop detection

**Root Cause**: Model not aware of correct tool names or confusing with other frameworks

#### 3. **Loop Detection Triggering Too Aggressively**

```
[WARN] Consecutive identical tool calls detected {"repetitionCount":5,"threshold":5}
```

**Frequency**: Common
**Impact**: High - prevents legitimate retry attempts

**Root Cause**: Threshold of 5 is too low for local models that struggle with tool parameters

#### 4. **Edit with Identical Strings**

```
[ERROR] No changes to apply. The old_string and new_string are identical
```

**Frequency**: Occasional
**Impact**: Medium - wastes tool call budget

**Root Cause**: Model confusion about what needs to be changed

## Proposed Improvements

### Priority 1: Configuration for Local Models

**Goal**: Allow different thresholds and limits for local models

**Implementation**:

1. Add `localModelOptimizations` config option
2. When enabled (auto-detect or manual):
   - Increase loop detection threshold from 5 to 8
   - Increase max tool calls per turn from 15 to 20
   - Add grace period for edit tool retries

**Files to Modify**:

- `packages/core/src/config/config.ts` - Add config options
- `packages/core/src/services/loopDetectionService.ts` - Use dynamic threshold
- `packages/cli/src/config/settingsSchema.ts` - Add to settings schema

**Code Example**:

```typescript
export interface LocalModelConfig {
  enabled: boolean;
  loopDetectionThreshold?: number; // default: 8
  maxToolCallsPerTurn?: number; // default: 20
  editToolGracePeriod?: number; // default: 3 retries
}
```

### Priority 2: Enhanced Error Messages for Edit Tool

**Goal**: Provide actionable guidance when edit fails

**Current Error**:

```
Failed to edit, 0 occurrences found for old_string
```

**Improved Error**:

```
Failed to edit, 0 occurrences found for old_string in {file}.

NEXT STEPS:
1. Use read_file to check the actual content
2. Look for whitespace/indentation differences
3. Try selecting a larger context block
4. Verify the file hasn't changed since you last read it

COMMON CAUSES:
- Extra/missing spaces or tabs
- Line endings (\\n vs \\r\\n)
- Content was already edited in a previous turn
```

**Files to Modify**:

- `packages/core/src/tools/edit.ts` - Enhance error messages
- `packages/core/src/tools/tool-error.ts` - Add detailed error context

### Priority 3: Tool Name Suggestions

**Goal**: Help model find correct tool when using wrong name

**Current Error**:

```
Tool "list_files" not found in registry
```

**Improved Error**:

```
Tool "list_files" not found in registry.

DID YOU MEAN?
- glob (search for files by pattern)
- grep (search for content in files)
- read_file (read a single file)

AVAILABLE TOOLS:
{list of all tool names}
```

**Files to Modify**:

- `packages/core/src/tools/tool-registry.ts` - Add fuzzy matching
- `packages/core/src/utils/stringUtils.ts` - Add Levenshtein distance helper

### Priority 4: Pre-Edit Validation

**Goal**: Warn model before edit attempt if likely to fail

**Implementation**:
Add validation logic that checks:

1. Does file exist?
2. Does old_string exist in file? (before sending to execute)
3. Are old_string and new_string identical?

**Files to Modify**:

- `packages/core/src/tools/edit.ts` - Add validateToolParamValues enhancement

**Note**: This is tricky because we don't want to read files twice, but could add a "check" mode

### Priority 5: Tool Usage Hints in Prompts

**Goal**: Provide common patterns in system prompt

**Implementation**:
Add section to local model prompt enhancement:

```markdown
## Common Tool Usage Patterns

### Edit Tool Best Practices

1. ALWAYS read the file first to verify content
2. Include sufficient context (3-5 lines around change)
3. Match whitespace exactly (use Read tool to check)
4. If edit fails, don't retry with same string - read file first

### File Search Tools

- Use "glob" for finding files by name pattern (NOT "list_files")
- Use "grep" for searching file contents
- Use "read_file" for reading a specific file
- Use "read_many_files" for batch reading

### Common Mistakes to Avoid

❌ Using tool names from other frameworks ("list_files", "search_files")
❌ Retrying edit without reading file
❌ Editing with identical old/new strings
✅ Read → Verify → Edit → Verify pattern
```

**Files to Modify**:

- `packages/core/src/core/prompts.ts` - Add to local model section

### Priority 6: Smart Loop Detection

**Goal**: Distinguish between harmful loops and legitimate retries

**Implementation**:

1. Don't count as loop if:
   - Tool name changed (trying different approach)
   - Parameters significantly different (>30% change)
   - Error message changed (making progress)
2. Special handling for edit tool:
   - Allow 3 retries if file_path is same but old_string changes
   - Don't penalize read_file → edit_file pattern

**Files to Modify**:

- `packages/core/src/services/loopDetectionService.ts` - Smarter detection logic

## Implementation Priority

### Phase 1 (High Impact, Low Effort)

1. ✅ **COMPLETED**: Prompt enhancements for local models
2. **Priority 2**: Enhanced error messages for edit tool
3. **Priority 3**: Tool name suggestions
4. **Priority 5**: Tool usage hints in prompts

### Phase 2 (High Impact, Medium Effort)

5. **Priority 1**: Configuration for local models
6. **Priority 6**: Smart loop detection

### Phase 3 (Medium Impact, Higher Effort)

7. **Priority 4**: Pre-edit validation
8. Additional telemetry for local model performance
9. Adaptive thresholds based on model performance

## Metrics to Track

After implementation, monitor these metrics:

1. **Edit Tool Success Rate**
   - Before: ~60% (estimated from logs)
   - Target: >80%

2. **Loop Detection False Positives**
   - Before: 30% of triggers (estimated)
   - Target: <10%

3. **Wrong Tool Name Errors**
   - Before: 2-3 per session
   - Target: <1 per session

4. **Task Completion Rate**
   - Before: ~40% without simplification
   - Target: >70%

## Testing Strategy

### Manual Testing

1. Use LM Studio with known problematic scenarios
2. Test edit tool with various whitespace issues
3. Test loop detection with legitimate retries
4. Test wrong tool names to verify suggestions

### Automated Testing

1. Add unit tests for enhanced error messages
2. Add tests for tool name fuzzy matching
3. Add tests for smart loop detection logic
4. Integration tests for local model config

## Related Issues

- Edit tool failures documented in session logs
- User feedback: "don't simplify anything!" (repeated)
- Loop detection preventing legitimate work
- Confusion about available tool names

## References

- Debug logs: `~/.fora/logs/debug-2025-11-05.log`
- Session logs: `~/.fora/tmp/.../logs.json`
- Existing enhancement: `docs/local-model-enhancements.md`
