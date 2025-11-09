# Local Model Prompt Enhancements

## Overview

This document explains the prompt enhancements added to improve the behavior of local language models (such as LM Studio, Ollama, or other localhost-hosted models) when working with the Fora CLI.

## Problem Statement

### Observed Issues

Through analysis of debug logs (`~/.fora/logs/`) and session logs, we identified a consistent pattern where local models would abandon planned functionality when encountering errors:

1. **Oversimplification**: When encountering tool failures (especially edit failures), models would reduce scope instead of persisting through the error
2. **Feature Abandonment**: Planned features would be dropped without user permission or notification
3. **Misinterpreted Loop Prevention**: Loop detection messages like "Do not retry this exact call" were interpreted as "give up" rather than "fix parameters and retry"
4. **Wrong Tool Usage**: Using non-existent tool names (e.g., "list_files" instead of "glob") and then giving up when they failed

### Evidence from Logs

**Debug Logs** (`~/.fora/logs/debug-2025-11-05.log`):

- Edit tool failures: "0 occurrences found for old_string"
- Wrong tool names: Attempted to use "list_files" (doesn't exist) instead of "glob"
- Loop detection triggers on legitimate retry attempts

**Session Logs**:

- User feedback: "don't simplify anything!" (repeated 3 times across sessions)
- User frustration with repeated simplifications
- Example: User requested "2D platformer with loop de loops, dips, sprites, momentum physics" but received "simple bouncing box"

## Solution

### Local Model Detection

Added automatic detection of local models based on the `OPENAI_BASE_URL` environment variable:

```typescript
// Check environment variable that's set for local/OpenAI-compatible models
const baseUrl = process.env['OPENAI_BASE_URL'] || '';
const isLocalModel =
  baseUrl.includes('localhost') ||
  baseUrl.includes('127.0.0.1') ||
  baseUrl.includes(':1234') || // Common LM Studio port
  baseUrl.includes(':11434') || // Common Ollama port
  baseUrl.includes(':8080'); // Common local server port
```

**Note**: This detection relies on the `OPENAI_BASE_URL` environment variable that users set when configuring local models (LM Studio, Ollama, etc.). If this variable is not set, the local model enhancements will not be applied.

### Prompt Enhancement

When a local model is detected, an additional "Error Recovery & Scope Persistence" section is injected into the system prompt with these key rules:

#### Rule 1: Never Reduce Scope Without Permission

- Explicitly forbids simplifying implementation when encountering errors
- Mandates delivery of all requested features
- Clarifies that temporary setbacks don't justify removing functionality

#### Rule 2: Error Recovery Cycle (Mandatory)

A 4-step process for handling tool failures:

1. **Verify**: Use read_file to check what actually exists
2. **Adapt**: Try an alternative approach (correct tool name, adjust parameters)
3. **Retry**: Make the corrected tool call with learnings applied
4. **Continue**: Move to next task only after SUCCESS

#### Rule 3: Loop Prevention Messages Are NOT "Give Up" Messages

- Clarifies that "Do not retry this exact call" means fix and retry, not abandon
- Prevents misinterpretation of loop prevention as a signal to simplify

#### Rule 4: Tool Verification Before Use

- Explicitly forbids using non-existent tool names
- Reminds model to check available tools list
- Clarifies that wrong tool names are model errors, not reasons to simplify

#### Rule 5: User Feedback Overrides Everything

- Treats user statements like "don't simplify" as absolute mandates
- Explains that user frustration indicates scope abandonment
- Recognizes repeated instructions as failure to deliver

### Examples Provided

The prompt includes concrete examples of WRONG vs CORRECT behavior:

**WRONG**:

- ❌ "The edit failed, so I'll just create a simpler version without feature X"
- ❌ "I encountered an error, let me make a basic version instead"
- ❌ "This is taking too long, I'll skip the momentum physics"

**CORRECT**:

- ✅ "The edit failed with '0 occurrences'. Let me read the file to see the actual content, then retry with the correct pattern"
- ✅ "That tool name doesn't exist. I should use 'glob' instead and try again"
- ✅ "The file doesn't exist yet. I need to create it first, then add the remaining features"

## Implementation Details

### Location

`packages/core/src/core/prompts.ts:266-338`

The enhancement is inserted after the "Interaction Details" section and before the dynamic sections (Sandbox, Git Repository).

### Conditional Injection

The section only appears when a local model is detected. Cloud-based models (Fora OAuth, Google AI, etc.) do not receive this additional guidance.

### Integration

The enhancement seamlessly integrates with existing prompt sections:

- Uses the same formatting style
- References existing tool names via `ToolNames` constants
- Maintains consistent tone and structure

## Expected Impact

### Positive Outcomes

1. **Reduced Oversimplification**: Models should persist through errors instead of abandoning features
2. **Better Error Recovery**: Explicit recovery cycle guides models through tool failures
3. **Feature Completeness**: Users should receive all requested functionality
4. **Fewer Retry Loops**: Clearer guidance on how to interpret loop prevention

### Measurable Metrics

Track these in future logs to validate effectiveness:

- Number of times features are abandoned vs. completed
- Edit tool retry success rate
- User satisfaction with feature completeness
- Reduction in "don't simplify" user feedback

## Testing Recommendations

### Manual Testing

1. Use LM Studio or Ollama with a complex feature request
2. Introduce tool failures (e.g., edit with wrong pattern)
3. Observe if model:
   - Reads file to verify before retrying
   - Maintains all planned features
   - Uses correct tool names
   - Persists through multiple errors

### Automated Testing

Consider adding tests that:

- Verify local model detection logic
- Confirm prompt section is injected for local models only
- Validate that the section doesn't appear for cloud models

## Future Enhancements

### Potential Improvements

1. **Model-Specific Tuning**: Different guidance for different local model families (Qwen, Llama, etc.)
2. **Adaptive Guidance**: Adjust based on observed behavior patterns in logs
3. **User Configuration**: Allow users to enable/disable this guidance
4. **Telemetry**: Track which rules are most effective

### Related Features

- Enhanced debug logging (already implemented in `debugLogger.ts`)
- Loop detection refinement (consider adjusting thresholds for local models)
- Tool usage analytics (track which tools fail most often)

## Related Documentation

- **Debug Logging**: See `.claude/commands/logs.md` for viewing debug logs
- **Loop Detection**: See `loopDetectionService.ts` for loop prevention logic
- **Tool System**: See `tools/` directory for available tool implementations

## Changelog

### 2025-11-05: Initial Implementation

- Added local model detection based on baseUrl
- Created "Error Recovery & Scope Persistence" prompt section
- Implemented 5 core rules with examples
- Integrated with existing prompt structure
- Created this documentation

## Contributing

When modifying the local model guidance:

1. **Test Thoroughly**: Use real local models to verify behavior changes
2. **Update Examples**: Keep the WRONG/CORRECT examples relevant
3. **Monitor Logs**: Check debug logs to validate effectiveness
4. **Gather Feedback**: Ask users about feature completeness and error handling
5. **Document Changes**: Update this file with rationale and impact

## Contact

For questions or suggestions about local model enhancements:

- Check debug logs: `~/.fora/logs/debug-YYYY-MM-DD.log`
- Review session logs: `~/.fora/tmp/.../logs.json`
- Report issues via `/bug` command in the CLI
