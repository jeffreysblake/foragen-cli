# Plan Mode Read-Only Tools Implementation

## Overview

This document describes the implementation of allowing read-only tools (Search, Fetch, Think, Read) to work with user confirmation in plan mode, while continuing to block mutator tools (Edit, Delete, Move, Execute).

## Problem

Previously, plan mode blocked ALL tools that required confirmation, including read-only research tools like WebSearch and WebFetch. This made plan mode less useful for research-heavy tasks where the agent needs to search the web or fetch content to create a comprehensive plan.

## Solution

The implementation introduces a distinction between read-only and mutator tools in plan mode, with session-based "don't ask again" functionality.

### Key Components

#### 1. Tool Kind Categorization

**File**: `packages/core/src/tools/tools.ts`

Added constants to categorize tool kinds:

```typescript
// Function kinds that have side effects
export const MUTATOR_KINDS: Kind[] = [
  Kind.Edit,
  Kind.Delete,
  Kind.Move,
  Kind.Execute,
] as const;

// Function kinds that are read-only (safe to use in plan mode)
export const READONLY_KINDS: Kind[] = [
  Kind.Read,
  Kind.Search,
  Kind.Fetch,
  Kind.Think,
] as const;

export function isReadOnlyKind(kind: Kind): boolean {
  return READONLY_KINDS.includes(kind);
}
```

Also added a new confirmation outcome:

```typescript
export enum ToolConfirmationOutcome {
  ProceedOnce = 'proceed_once',
  ProceedAlways = 'proceed_always',
  ProceedAlwaysServer = 'proceed_always_server',
  ProceedAlwaysTool = 'proceed_always_tool',
  ProceedAlwaysToolKind = 'proceed_always_tool_kind', // NEW
  ModifyWithEditor = 'modify_with_editor',
  Cancel = 'cancel',
  RejectWithFeedback = 'reject_with_feedback',
}
```

#### 2. Session-Based Configuration Storage

**File**: `packages/core/src/config/config.ts`

Added storage for allowed tool kinds in plan mode:

```typescript
private allowedToolKindsInPlanMode: Set<string> = new Set();

isToolKindAllowedInPlanMode(kind: string): boolean {
  return this.allowedToolKindsInPlanMode.has(kind);
}

allowToolKindInPlanMode(kind: string): void {
  this.allowedToolKindsInPlanMode.add(kind);
}
```

This is session-based storage that resets each time the CLI is restarted.

#### 3. Plan Mode Logic Updates

**File**: `packages/core/src/core/coreToolScheduler.ts` (lines 794-831)

Modified the plan mode validation logic:

- **Read-only tools**: Allowed with confirmation (unless previously approved)
- **Mutator tools**: Blocked as before
- **Previously allowed kinds**: Skip confirmation for tool kinds the user has already approved

```typescript
if (isPlanMode && !isExitPlanModeTool) {
  if (confirmationDetails) {
    // In plan mode, allow read-only tools with confirmation,
    // but block mutator tools (edit, delete, move, execute)
    if (!isReadOnlyTool) {
      // Block mutator tools in plan mode
      this.setStatusInternal(reqInfo.callId, 'error', {
        callId: reqInfo.callId,
        responseParts: convertToFunctionResponse(
          reqInfo.name,
          reqInfo.callId,
          getPlanModeSystemReminder(),
        ),
        resultDisplay: 'Plan mode blocked a non-read-only tool call.',
        error: undefined,
        errorType: undefined,
      });
      continue;
    }

    // Check if this tool kind has been previously allowed in plan mode
    if (this.config.isToolKindAllowedInPlanMode(toolCall.tool.kind)) {
      // Skip confirmation for previously-allowed tool kinds
      this.setToolCallOutcome(
        reqInfo.callId,
        ToolConfirmationOutcome.ProceedAlwaysToolKind,
      );
      this.setStatusInternal(reqInfo.callId, 'scheduled');
      continue;
    }

    // Read-only tools fall through to normal confirmation flow
  } else {
    // Tools that don't need confirmation can proceed
    this.setStatusInternal(reqInfo.callId, 'scheduled');
    continue;
  }
}
```

#### 4. Confirmation Handler Updates

**File**: `packages/core/src/core/coreToolScheduler.ts` (lines 936-939)

Updated `handleConfirmationResponse` to remember allowed tool kinds:

```typescript
if (
  outcome === ToolConfirmationOutcome.ProceedAlwaysToolKind &&
  toolCall?.tool
) {
  // Remember this tool kind for the session
  this.config.allowToolKindInPlanMode(toolCall.tool.kind);
}
```

#### 5. Tool Confirmation Details Enhancement

**File**: `packages/core/src/tools/tools.ts`

Added optional `toolKind` field to `ToolInfoConfirmationDetails`:

```typescript
export interface ToolInfoConfirmationDetails {
  type: 'info';
  title: string;
  onConfirm: (
    outcome: ToolConfirmationOutcome,
    payload?: ToolConfirmationPayload,
  ) => Promise<void>;
  prompt: string;
  urls?: string[];
  toolKind?: Kind; // NEW
}
```

#### 6. WebFetch and WebSearch Updates

**Files**:

- `packages/core/src/tools/web-fetch.ts`
- `packages/core/src/tools/web-search.ts`

Both tools were updated to:

1. Accept and store the tool kind in their invocation constructors
2. Include `toolKind` in confirmation details
3. Pass the kind when creating invocations

Example from WebFetchTool:

```typescript
class WebFetchToolInvocation extends BaseToolInvocation<
  WebFetchToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: WebFetchToolParams,
    private readonly toolKind: Kind, // NEW
  ) {
    super(params);
  }

  override async shouldConfirmExecute(): Promise<
    ToolCallConfirmationDetails | false
  > {
    // ...
    const confirmationDetails: ToolCallConfirmationDetails = {
      type: 'info',
      title: `Confirm Web Fetch`,
      prompt: `Fetch content from ${this.params.url} and process with: ${this.params.prompt}`,
      urls: [this.params.url],
      toolKind: this.toolKind, // NEW
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.config.setApprovalMode(ApprovalMode.AUTO_EDIT);
        }
      },
    };
    return confirmationDetails;
  }
}

export class WebFetchTool extends BaseDeclarativeTool<
  WebFetchToolParams,
  ToolResult
> {
  // ...
  protected createInvocation(
    params: WebFetchToolParams,
  ): ToolInvocation<WebFetchToolParams, ToolResult> {
    return new WebFetchToolInvocation(this.config, params, this.kind); // NEW: Pass kind
  }
}
```

#### 7. UI Component Updates

**File**: `packages/cli/src/ui/components/messages/ToolConfirmationMessage.tsx`

Added a new option to the 'info' type confirmations when in plan mode:

```typescript
// In plan mode, show option to allow this tool kind in plan mode
if (infoProps.toolKind && config.getApprovalMode() === ApprovalMode.PLAN) {
  const kindLabel =
    infoProps.toolKind.charAt(0).toUpperCase() + infoProps.toolKind.slice(1);
  options.push({
    label: `Don't ask again for ${kindLabel} tools in plan mode`,
    value: ToolConfirmationOutcome.ProceedAlwaysToolKind,
    key: `Don't ask again for ${kindLabel} tools in plan mode`,
  });
}
```

This option appears between "Yes, allow always" and "No, suggest changes (esc)".

#### 8. ZedIntegration Exhaustive Check

**File**: `packages/cli/src/zed-integration/zedIntegration.ts` (lines 461)

Added the new outcome to the exhaustive switch statement:

```typescript
case ToolConfirmationOutcome.ProceedAlwaysToolKind:  // NEW
```

## User Experience

### Before

In plan mode, when the agent tried to call WebSearch or WebFetch:

- Tool call was completely blocked
- No option to approve the call
- Agent couldn't perform research during planning

### After

In plan mode, when the agent tries to call WebSearch or WebFetch:

1. User receives a confirmation prompt with options:
   - "Yes, allow once" - Allow just this one call
   - "Yes, allow always" - Exit plan mode and allow all tools
   - "Don't ask again for [Fetch/Search] tools in plan mode" - Remember this tool kind for the session
   - "No, suggest changes (esc)" - Cancel the call

2. If user selects "Don't ask again for Fetch tools in plan mode":
   - All subsequent Fetch tool calls in plan mode proceed without confirmation
   - This preference persists for the current session only
   - Restarting the CLI resets these preferences

3. Mutator tools (Edit, Delete, Move, Execute) remain blocked in plan mode

## Benefits

1. **Better Research in Plan Mode**: Agent can search the web and fetch content while creating plans
2. **Maintains Safety**: Mutator tools still blocked to prevent accidental changes during planning
3. **Reduced Friction**: Session-based "don't ask again" reduces repetitive confirmations
4. **User Control**: User still has full control over what tools execute
5. **Similar to Claude Web**: Behavior now matches Claude's web interface where tools work with approval in plan mode

## Future Enhancements

The infrastructure is in place for these optional features:

- **Persistent Storage**: Save "don't ask again" preferences across sessions in settings.json
- **Settings Schema**: Add configuration options to settings schema
- **Per-Project Settings**: Allow different tool approval settings per project
- **Fine-Grained Control**: Configure which specific read-only tools are allowed in plan mode

## Files Modified

1. `packages/core/src/tools/tools.ts` - Added READONLY_KINDS, MUTATOR_KINDS, isReadOnlyKind(), ProceedAlwaysToolKind outcome, toolKind field
2. `packages/core/src/config/config.ts` - Added session-based storage for allowed tool kinds
3. `packages/core/src/core/coreToolScheduler.ts` - Updated plan mode logic and confirmation handler
4. `packages/core/src/tools/web-fetch.ts` - Added toolKind to invocation and confirmation details
5. `packages/core/src/tools/web-search.ts` - Added toolKind to invocation and confirmation details
6. `packages/cli/src/ui/components/messages/ToolConfirmationMessage.tsx` - Added "Don't ask again" option in plan mode
7. `packages/cli/src/zed-integration/zedIntegration.ts` - Added exhaustive check for new outcome

## Testing

Build completed successfully with all TypeScript checks passing.

Manual testing recommended:

1. Enter plan mode (`/plan`)
2. Ask agent to search for something (should show confirmation with "Don't ask again" option)
3. Select "Don't ask again for Search tools in plan mode"
4. Ask agent to search again (should proceed without confirmation)
5. Ask agent to fetch a URL (should show confirmation again for Fetch kind)
6. Try to edit a file (should still be blocked)
7. Restart CLI and verify preferences reset
