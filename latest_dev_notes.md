# Latest Development Notes - Local Model Enhancements

_Last Updated: 2025-09-05_

## Recently Completed ✅

### 1. Boolean Parameter Normalization Fix

**Issue**: LLM APIs returning boolean parameters as strings (`"False"`, `"True"`) causing schema validation errors.

**Solution**: Enhanced `normalizeParams()` function in `/packages/core/src/tools/tools.ts`:

- Case-insensitive conversion (`"TRUE"`, `"false"`, etc.)
- Whitespace trimming (`"  False  "` → `false`)
- Recursive object normalization
- Comprehensive test coverage (42 tests passing)

### 2. MCP Tool Rejection Feedback Interface

**Issue**: Users couldn't provide feedback when rejecting MCP tool calls.

**Solution**: Complete implementation including:

- New `ToolConfirmationOutcome.RejectWithFeedback` enum
- `TextInput` UI component for feedback collection
- Updated `ToolConfirmationMessage` with feedback interface
- Core scheduler integration passing feedback to LLM
- Telemetry support

**Result**: Users can now select "No, tell me what to do differently" and provide specific guidance.

---

## Recommended Local Model Enhancements

Based on comprehensive codebase analysis, here are prioritized enhancement opportunities:

### HIGH PRIORITY 🔴

#### 1. Dynamic Memory Management

**Target**: `/packages/core/src/core/tokenLimits.ts`

```typescript
// Add adaptive token limits for local models
function getLocalModelTokenLimit(model: string): number {
  const configLimit = process.env['LOCAL_MODEL_TOKEN_LIMIT'];
  if (configLimit) return parseInt(configLimit);

  // Conservative defaults for local models
  return 8192; // Reasonable default for most local deployments
}
```

#### 2. Enhanced Context Compression

**Target**: `/packages/core/src/core/client.ts` (lines 538-540)

```typescript
// More aggressive compression for resource-constrained local models
private getCompressionThreshold(isLocalModel: boolean): number {
  if (!isLocalModel) return 0.9;

  // Adaptive based on system resources
  const availableMemory = process.memoryUsage().heapUsed;
  return availableMemory > 1e9 ? 0.6 : 0.4;
}
```

#### 3. Local Model Error Handling

**Target**: `/packages/core/src/utils/retry.ts`

```typescript
// Specialized retry logic for local model failures
const LOCAL_MODEL_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 2000,
  shouldRetry: (error) => !error.message?.includes('out of memory'),
};
```

### MEDIUM PRIORITY 🟡

#### 4. Optimized Sampling Parameters

**Target**: `/packages/core/src/core/openaiContentGenerator.ts`

```typescript
// Local model optimized defaults
const localModelDefaults = {
  temperature: 0.3,
  max_tokens: 1024, // Conservative for memory
  repetition_penalty: 1.1,
};
```

#### 5. Request Concurrency Control

**Target**: New utility class

```typescript
export class LocalModelToolExecutor {
  private semaphore: Semaphore;

  constructor(maxConcurrency = 2) {
    this.semaphore = new Semaphore(maxConcurrency);
  }
}
```

#### 6. Adaptive Streaming Buffer

**Target**: `/packages/core/src/core/openaiContentGenerator.ts`

```typescript
private getStreamingConfig(isLocal: boolean) {
  return {
    bufferSize: isLocal ? 256 : 1024,
    yieldInterval: isLocal ? 50 : 100,
  };
}
```

### LOW PRIORITY 🟢

#### 7. Tool Call Batching

**Target**: `/packages/core/src/core/turn.ts`

- Group similar tool calls for batch execution
- Add configurable delays between batches
- Prevent overwhelming local models

#### 8. Performance Monitoring

**Target**: `/packages/core/src/config/config.ts`

- Memory usage tracking
- Response time monitoring
- Adaptive configuration adjustments

#### 9. Enhanced Loop Detection

**Target**: `/packages/core/src/services/loopDetectionService.ts`

- More lenient thresholds for local models
- Account for slower/less consistent local responses

---

## Implementation Plan

### Phase 1: Core Optimizations (Week 1)

- [ ] Implement dynamic token limits
- [ ] Enhance context compression logic
- [ ] Add local model error handling
- [ ] Update sampling parameter defaults

### Phase 2: Performance Improvements (Week 2)

- [ ] Add concurrency control for tool execution
- [ ] Optimize streaming buffer management
- [ ] Implement adaptive timeout handling
- [ ] Add performance monitoring hooks

### Phase 3: Advanced Features (Week 3)

- [ ] Tool call batching implementation
- [ ] Loop detection optimization
- [ ] Memory pressure detection
- [ ] Configuration auto-tuning

---

## Configuration Changes Required

### Environment Variables

```bash
# New environment variables for local model optimization
LOCAL_MODEL_TOKEN_LIMIT=8192
LOCAL_MODEL_MAX_CONCURRENCY=2
LOCAL_MODEL_AGGRESSIVE_COMPRESSION=true
LOCAL_MODEL_ADAPTIVE_TIMEOUT=true
```

### Config Schema Updates

```typescript
export interface LocalModelConfig {
  maxConcurrentRequests?: number;
  adaptiveTimeout?: boolean;
  memoryConstraints?: {
    maxContextSize?: number;
    aggressiveCompression?: boolean;
  };
  hardwareOptimization?: {
    useGPU?: boolean;
    batchSize?: number;
    modelQuantization?: string;
  };
}
```

---

## Key Benefits Expected

1. **Memory Efficiency**: 30-50% reduction in memory usage through aggressive compression
2. **Response Time**: 20-30% improvement in perceived performance via adaptive streaming
3. **Reliability**: Better error handling and recovery for local model edge cases
4. **Resource Utilization**: Optimized concurrency preventing resource exhaustion
5. **User Experience**: Smoother interaction with resource-constrained local models

---

## Testing Strategy

### Unit Tests

- [ ] Token limit detection logic
- [ ] Compression threshold calculations
- [ ] Error classification functions
- [ ] Concurrency control mechanisms

### Integration Tests

- [ ] End-to-end tool execution with local models
- [ ] Memory pressure scenarios
- [ ] Network interruption handling
- [ ] Performance degradation recovery

### Performance Tests

- [ ] Memory usage benchmarks
- [ ] Response time measurements
- [ ] Throughput analysis under load
- [ ] Resource constraint simulation

---

## Notes for Implementation

1. **Backward Compatibility**: All enhancements must maintain compatibility with existing cloud model usage
2. **Configuration Driven**: Features should be configurable rather than hardcoded
3. **Graceful Degradation**: System should handle resource constraints gracefully
4. **Monitoring Integration**: Add metrics for performance analysis
5. **Documentation**: Update user guides for local model optimization

---

## Related Issues & References

- Boolean parameter issue: Fixed in `/packages/core/src/tools/tools.ts:275-293`
- MCP tool feedback: Complete UI and backend implementation
- Context compression: Current logic in `/packages/core/src/core/client.ts:538-540`
- Token limits: Defined in `/packages/core/src/core/tokenLimits.ts:10-32`
- Error handling: Base implementation in `/packages/core/src/utils/retry.ts`

---

_This document tracks ongoing development priorities for optimizing Foragen CLI with local model deployments. Updates should be made as features are implemented or priorities change._
