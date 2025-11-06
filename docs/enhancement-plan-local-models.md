# Enhancement Plan: Productivity Features for Local Model Usage

**Date**: 2025-11-06
**Status**: Planning Phase
**Target**: Foragen CLI v0.2.x+

---

## Executive Summary

This document outlines strategic enhancements to Foragen CLI focused on maximizing productivity when using local models (Qwen3-Coder and similar). The plan is inspired by Claude Code's features (memories, subagents, skills) while adapting them for local model constraints and capabilities.

### Current State Analysis

✅ **Already Implemented:**
- **Subagent System**: Sophisticated 3-tier agent architecture (builtin/user/project)
- **Memory System**: FORA.md files for persistent knowledge (global/project scopes)
- **Tool System**: Extensible tool registry with MCP support
- **Extension System**: Git-based extensions with context files
- **Event System**: Real-time agent lifecycle events

❌ **Missing or Limited:**
- **Skills System**: No separate reusable capability framework
- **Advanced Memory**: Text-only, no structure/search/metadata
- **Multi-agent Orchestration**: Agents work in isolation
- **Agent Templates**: Only 1 builtin agent, no marketplace
- **Workflow System**: No declarative multi-step processes
- **Context Optimization**: No automatic context window management
- **Model Routing**: Limited model selection per task type

---

## Part 1: Skills System

### What Are Skills?

**Skills** are smaller, reusable capabilities that sit between **tools** and **agents**:

- **Tools**: Low-level operations (read file, run command, search)
- **Skills**: Mid-level capabilities (analyze code, refactor function, write tests)
- **Agents**: High-level autonomous workers (general-purpose, code-reviewer)

### Comparison: Tools vs Skills vs Agents

| Feature | Tools | Skills | Agents |
|---------|-------|--------|--------|
| **Scope** | Single operation | Multi-step capability | Autonomous task execution |
| **State** | Stateless | Optional state | Stateful (chat history) |
| **Composition** | Not composable | Composable | Can use tools & skills |
| **Definition** | Code (TypeScript) | Prompt template + tools | System prompt + config |
| **Examples** | ReadFile, Grep, Shell | CodeAnalysis, RefactorFunction | general-purpose, code-reviewer |

### Proposed Skills Architecture

#### File Structure
```
~/.fora/skills/         # User-level skills
  code-analysis.md
  test-generator.md
  documentation.md

.fora/skills/           # Project-level skills
  api-endpoint.md
  database-query.md

packages/core/src/skills/builtin-skills.ts  # Built-in skills
```

#### Skills Configuration Format (Markdown + YAML)

```markdown
---
name: code-analysis
description: Analyzes code for patterns, issues, and improvements
version: 1.0.0
category: code-quality
tools: [Read, Grep, Glob]
model:
  model: qwen3-coder
  temp: 0.3
  max_tokens: 2000
parameters:
  - name: file_path
    type: string
    required: true
    description: Path to the file to analyze
  - name: focus
    type: string
    enum: [performance, security, readability, all]
    default: all
output:
  format: structured
  schema:
    issues: array
    suggestions: array
    metrics: object
---

# Code Analysis Skill

## System Prompt
You are a code analysis expert. Analyze the provided code file for ${focus} issues.

## Process
1. Read the file at ${file_path}
2. Analyze based on ${focus}:
   - performance: Look for inefficient algorithms, unnecessary operations
   - security: Check for vulnerabilities, unsafe patterns
   - readability: Assess code clarity, naming, structure
   - all: Comprehensive analysis

3. Return structured results:
   - List of issues with severity (high/medium/low)
   - Actionable suggestions for each issue
   - Code metrics (complexity, duplication, etc.)

## Examples

### Input
```
{
  "file_path": "/path/to/file.ts",
  "focus": "performance"
}
```

### Output
```
{
  "issues": [
    {
      "line": 42,
      "severity": "high",
      "category": "performance",
      "description": "Nested loop with O(n²) complexity",
      "suggestion": "Use Map for O(1) lookup instead"
    }
  ],
  "suggestions": [...],
  "metrics": {
    "cyclomatic_complexity": 12,
    "lines_of_code": 234
  }
}
```
```

#### Skill Implementation

```typescript
// packages/core/src/skills/skill.ts

export interface SkillConfig {
  name: string;
  description: string;
  version: string;
  category?: string;
  tools?: string[];
  model?: Partial<ModelConfig>;
  parameters: SkillParameter[];
  output?: SkillOutputConfig;
  systemPrompt: string;
  examples?: SkillExample[];
  level: 'builtin' | 'user' | 'project';
  filePath: string;
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  default?: unknown;
  description?: string;
  enum?: string[];
  validation?: string; // JSON Schema or regex
}

export interface SkillOutputConfig {
  format: 'text' | 'structured' | 'markdown';
  schema?: object; // JSON Schema for structured output
}

export class SkillExecutor {
  constructor(
    private config: Config,
    private skillConfig: SkillConfig
  ) {}

  async execute(
    params: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<SkillResult> {
    // 1. Validate parameters against skillConfig.parameters
    this.validateParams(params);

    // 2. Create a lightweight chat session (single-turn preferred)
    const prompt = this.buildPrompt(params);

    // 3. Execute with restricted tools and model config
    const result = await this.runSkill(prompt, signal);

    // 4. Validate output format if schema provided
    if (this.skillConfig.output?.schema) {
      this.validateOutput(result);
    }

    return result;
  }

  private buildPrompt(params: Record<string, unknown>): string {
    // Template substitution: ${param_name}
    let prompt = this.skillConfig.systemPrompt;
    for (const [key, value] of Object.entries(params)) {
      prompt = prompt.replace(
        new RegExp(`\\$\\{${key}\\}`, 'g'),
        String(value)
      );
    }
    return prompt;
  }
}
```

#### SkillTool Integration

```typescript
// packages/core/src/tools/skillTool.ts

export interface SkillToolParams {
  skill_name: string;
  parameters: Record<string, unknown>;
}

export class SkillTool extends BaseDeclarativeTool<SkillToolParams, ToolResult> {
  static readonly Name = 'use_skill';

  async execute(params: SkillToolParams): Promise<ToolResult> {
    const skillManager = this.config.getSkillManager();
    const skill = await skillManager.loadSkill(params.skill_name);

    const executor = new SkillExecutor(this.config, skill);
    const result = await executor.execute(params.parameters);

    return {
      llmContent: result.output,
      returnDisplay: {
        type: 'skill_execution',
        skillName: params.skill_name,
        result: result.output
      }
    };
  }
}
```

### Built-in Skills (Proposed)

1. **code-analysis** - Analyze code quality, performance, security
2. **test-generator** - Generate unit tests for functions/classes
3. **documentation** - Generate docs from code
4. **refactor** - Suggest/apply refactoring patterns
5. **api-design** - Design API endpoints/contracts
6. **error-diagnosis** - Analyze error messages and suggest fixes
7. **git-commit-message** - Generate conventional commit messages
8. **code-review** - Review code changes (diff-based)

### Benefits for Local Models

1. **Reduced Context**: Skills use smaller, focused prompts vs full agent context
2. **Faster Execution**: Single-turn execution instead of multi-turn agents
3. **Composability**: Chain skills for complex workflows
4. **Reusability**: Same skill used across projects
5. **Optimization**: Per-skill model config (temp, tokens) for local models

---

## Part 2: Enhanced Memory System

### Current Memory Limitations

**Existing (FORA.md):**
- Text-only append format
- No structure or metadata
- No search capabilities
- Manual organization
- No deduplication
- No context ranking

### Proposed Enhancements

#### 2.1 Structured Memory Format

```markdown
## Fora Added Memories

### Memory Entry: 2025-11-06T14:32:00Z
**ID**: mem_abc123
**Type**: preference
**Scope**: project
**Tags**: #typescript #testing #vitest
**Context**: packages/core/src/tools/
**Confidence**: 0.95

User prefers Vitest over Jest for testing. Always use `describe/it/expect` pattern.

### Memory Entry: 2025-11-06T15:45:00Z
**ID**: mem_def456
**Type**: fact
**Scope**: global
**Tags**: #api #authentication
**Context**: authentication flows
**Confidence**: 1.0

The project uses OAuth2 with Fora API. Primary model is qwen3-coder (branded as Foragen).
```

#### 2.2 Memory Metadata Schema

```typescript
export interface MemoryEntry {
  id: string;
  timestamp: Date;
  type: 'fact' | 'preference' | 'instruction' | 'example' | 'reference';
  scope: 'global' | 'project' | 'session';
  content: string;
  tags: string[];
  context?: string; // Related files/modules
  confidence: number; // 0.0 to 1.0
  source: 'user' | 'inferred' | 'explicit';
  usageCount: number;
  lastAccessed: Date;
  embedding?: number[]; // Optional: for semantic search
}
```

#### 2.3 Memory Manager

```typescript
// packages/core/src/memory/memory-manager.ts

export class MemoryManager {
  private memoryStore: Map<string, MemoryEntry> = new Map();

  async addMemory(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): Promise<string> {
    // 1. Check for duplicates (semantic similarity if embeddings available)
    const duplicate = await this.findDuplicate(entry.content);
    if (duplicate) {
      // Update confidence, usageCount instead of creating new
      await this.updateMemory(duplicate.id, { confidence: Math.max(duplicate.confidence, entry.confidence) });
      return duplicate.id;
    }

    // 2. Generate ID and timestamp
    const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullEntry: MemoryEntry = {
      ...entry,
      id,
      timestamp: new Date(),
      usageCount: 0,
      lastAccessed: new Date()
    };

    // 3. Store in memory
    this.memoryStore.set(id, fullEntry);

    // 4. Persist to file
    await this.persistMemory(fullEntry);

    return id;
  }

  async searchMemories(query: string, options?: SearchOptions): Promise<MemoryEntry[]> {
    // 1. Exact match search
    let results = Array.from(this.memoryStore.values())
      .filter(m => m.content.toLowerCase().includes(query.toLowerCase()));

    // 2. Tag-based filtering
    if (options?.tags) {
      results = results.filter(m =>
        options.tags!.some(tag => m.tags.includes(tag))
      );
    }

    // 3. Context-based filtering
    if (options?.context) {
      results = results.filter(m =>
        m.context?.includes(options.context!)
      );
    }

    // 4. Sort by relevance (confidence × recency × usage)
    results.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a, query);
      const scoreB = this.calculateRelevanceScore(b, query);
      return scoreB - scoreA;
    });

    // 5. Limit results
    return results.slice(0, options?.limit ?? 10);
  }

  private calculateRelevanceScore(entry: MemoryEntry, query: string): number {
    const recencyWeight = 0.3;
    const confidenceWeight = 0.4;
    const usageWeight = 0.3;

    const daysSince = (Date.now() - entry.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.exp(-daysSince / 30); // Exponential decay over 30 days

    return (
      recencyScore * recencyWeight +
      entry.confidence * confidenceWeight +
      Math.min(entry.usageCount / 10, 1) * usageWeight
    );
  }

  async getRelevantMemories(context: string, limit = 5): Promise<MemoryEntry[]> {
    // Get memories relevant to current context
    return this.searchMemories(context, { limit, sortBy: 'relevance' });
  }
}
```

#### 2.4 Memory Commands

```typescript
// /memory list [--tag <tag>] [--type <type>] [--scope <scope>]
// /memory search <query> [--limit <n>]
// /memory add <content> [--type <type>] [--tags <tag1,tag2>]
// /memory edit <id>
// /memory delete <id>
// /memory export [--format json|md]
// /memory import <file>
// /memory stats
```

#### 2.5 Auto-contextualization for Local Models

```typescript
// Automatically inject relevant memories based on current context
export class ContextualMemoryProvider {
  async getContextualMemories(
    currentFile?: string,
    recentMessages?: string[]
  ): Promise<MemoryEntry[]> {
    const relevantMemories: MemoryEntry[] = [];

    // 1. File-based context
    if (currentFile) {
      const fileMemories = await memoryManager.searchMemories('', {
        context: currentFile,
        limit: 3
      });
      relevantMemories.push(...fileMemories);
    }

    // 2. Conversation-based context
    if (recentMessages) {
      const conversationContext = recentMessages.join(' ');
      const tags = this.extractTags(conversationContext);
      const contextMemories = await memoryManager.searchMemories('', {
        tags,
        limit: 5
      });
      relevantMemories.push(...contextMemories);
    }

    // 3. Deduplicate and rank
    const unique = this.deduplicateById(relevantMemories);
    return unique.slice(0, 5); // Top 5 for context window efficiency
  }
}
```

### Benefits for Local Models

1. **Context Window Optimization**: Only inject relevant memories
2. **Reduced Hallucination**: Structured facts reduce model guessing
3. **Faster Inference**: Smaller context = faster local inference
4. **Better Recall**: Search finds relevant info vs full scan
5. **Deduplication**: Prevents context bloat

---

## Part 3: Multi-Agent Orchestration

### Current Agent Limitations

**Existing:**
- Agents work in isolation (single TaskTool invocation)
- No communication between agents
- No coordination or handoff
- No shared state across agents

### Proposed Enhancements

#### 3.1 Agent Coordination Patterns

```typescript
export type CoordinationPattern =
  | 'sequential'    // Agent A → Agent B → Agent C
  | 'parallel'      // Agent A, B, C run concurrently
  | 'conditional'   // If/else agent routing
  | 'map-reduce'    // Parallel agents + aggregation
  | 'supervisor';   // Supervisor delegates to workers

export interface AgentWorkflow {
  name: string;
  description: string;
  pattern: CoordinationPattern;
  agents: AgentStep[];
  sharedState?: Record<string, unknown>;
}

export interface AgentStep {
  agentName: string;
  input: string | ((state: Record<string, unknown>) => string);
  outputKey?: string; // Store result in shared state
  condition?: (state: Record<string, unknown>) => boolean;
  parallel?: AgentStep[]; // For parallel execution
}
```

#### 3.2 Workflow Execution Engine

```typescript
// packages/core/src/workflows/workflow-executor.ts

export class WorkflowExecutor {
  constructor(
    private config: Config,
    private subagentManager: SubagentManager
  ) {}

  async executeWorkflow(
    workflow: AgentWorkflow,
    signal?: AbortSignal
  ): Promise<WorkflowResult> {
    const sharedState = workflow.sharedState ?? {};

    switch (workflow.pattern) {
      case 'sequential':
        return this.executeSequential(workflow.agents, sharedState, signal);
      case 'parallel':
        return this.executeParallel(workflow.agents, sharedState, signal);
      case 'map-reduce':
        return this.executeMapReduce(workflow.agents, sharedState, signal);
      default:
        throw new Error(`Unsupported pattern: ${workflow.pattern}`);
    }
  }

  private async executeSequential(
    steps: AgentStep[],
    state: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<WorkflowResult> {
    const results: AgentStepResult[] = [];

    for (const step of steps) {
      // Check condition
      if (step.condition && !step.condition(state)) {
        continue;
      }

      // Resolve input (may reference state)
      const input = typeof step.input === 'function'
        ? step.input(state)
        : step.input;

      // Execute agent
      const subagent = await this.subagentManager.loadSubagent(step.agentName);
      const scope = await this.subagentManager.createSubagentScope(subagent, this.config);

      const contextState = new ContextState();
      contextState.set('task_prompt', input);
      Object.entries(state).forEach(([k, v]) => contextState.set(k, v));

      await scope.runNonInteractive(contextState, signal);

      const result = scope.getFinalText();
      results.push({ agentName: step.agentName, result });

      // Store in shared state
      if (step.outputKey) {
        state[step.outputKey] = result;
      }
    }

    return { results, finalState: state };
  }

  private async executeParallel(
    steps: AgentStep[],
    state: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<WorkflowResult> {
    // Execute all agents concurrently
    const promises = steps.map(async (step) => {
      const input = typeof step.input === 'function' ? step.input(state) : step.input;

      const subagent = await this.subagentManager.loadSubagent(step.agentName);
      const scope = await this.subagentManager.createSubagentScope(subagent, this.config);

      const contextState = new ContextState();
      contextState.set('task_prompt', input);

      await scope.runNonInteractive(contextState, signal);
      return { agentName: step.agentName, result: scope.getFinalText() };
    });

    const results = await Promise.all(promises);

    // Update shared state
    results.forEach((r, i) => {
      if (steps[i].outputKey) {
        state[steps[i].outputKey] = r.result;
      }
    });

    return { results, finalState: state };
  }
}
```

#### 3.3 Example Workflow: Code Review Pipeline

```yaml
# .fora/workflows/code-review.yaml
name: comprehensive-code-review
description: Multi-agent code review with specialized focus areas
pattern: parallel
sharedState:
  files: ${changed_files}

agents:
  - agentName: security-reviewer
    input: "Review ${files} for security vulnerabilities"
    outputKey: security_report

  - agentName: performance-reviewer
    input: "Analyze ${files} for performance issues"
    outputKey: performance_report

  - agentName: style-reviewer
    input: "Check ${files} for code style violations"
    outputKey: style_report

aggregator:
  agentName: review-summarizer
  input: |
    Combine the following reviews into a single summary:

    Security: ${security_report}
    Performance: ${performance_report}
    Style: ${style_report}
  outputKey: final_review
```

#### 3.4 Workflow Tool

```typescript
export class WorkflowTool extends BaseDeclarativeTool<WorkflowParams, ToolResult> {
  static readonly Name = 'run_workflow';

  async execute(params: WorkflowParams): Promise<ToolResult> {
    const workflow = await this.loadWorkflow(params.workflow_name);
    const executor = new WorkflowExecutor(this.config, this.subagentManager);

    const result = await executor.executeWorkflow(workflow);

    return {
      llmContent: result.results.map(r => `${r.agentName}: ${r.result}`).join('\n\n'),
      returnDisplay: {
        type: 'workflow_execution',
        workflowName: params.workflow_name,
        results: result.results
      }
    };
  }
}
```

### Benefits for Local Models

1. **Distributed Computation**: Parallelize across multiple local model instances
2. **Specialized Agents**: Smaller, focused agents work better than monolithic
3. **Resource Management**: Sequential execution for memory-constrained systems
4. **Fail-Safe**: Partial results if one agent fails
5. **Composability**: Reuse agents in different workflows

---

## Part 4: Agent Marketplace & Templates

### Current State

**Existing:**
- Only 1 builtin agent: `general-purpose`
- No discovery mechanism
- Manual agent creation
- No sharing/distribution

### Proposed Enhancements

#### 4.1 Agent Template Registry

```typescript
// packages/core/src/agents/agent-registry.ts

export interface AgentTemplate {
  name: string;
  category: 'research' | 'code-quality' | 'testing' | 'documentation' | 'automation';
  description: string;
  author: string;
  version: string;
  downloads: number;
  rating: number;
  tags: string[];
  modelRequirements: {
    minContext?: number;
    preferredModels?: string[];
  };
  source: 'builtin' | 'community' | 'official';
  installUrl?: string; // GitHub URL for community agents
}

export class AgentTemplateRegistry {
  private templates: Map<string, AgentTemplate> = new Map();

  async discoverTemplates(): Promise<AgentTemplate[]> {
    // 1. Load builtin templates
    const builtin = this.loadBuiltinTemplates();

    // 2. Fetch community templates (optional registry)
    // const community = await this.fetchCommunityTemplates();

    return [...builtin];
  }

  async installTemplate(template: AgentTemplate, level: 'user' | 'project'): Promise<void> {
    if (template.source === 'builtin') {
      // Copy from builtin to user/project
      await this.copyBuiltinTemplate(template, level);
    } else if (template.installUrl) {
      // Clone from GitHub
      await this.installFromGit(template.installUrl, level);
    }
  }
}
```

#### 4.2 Expanded Builtin Agents

```typescript
// packages/core/src/subagents/builtin-agents.ts

export const BUILTIN_AGENTS = [
  {
    name: 'general-purpose',
    category: 'research',
    description: 'General-purpose research and code exploration',
    // ... existing config
  },
  {
    name: 'code-reviewer',
    category: 'code-quality',
    description: 'Reviews code for quality, style, and best practices',
    systemPrompt: `You are a code review expert. Review the provided code for:
- Code quality and maintainability
- Adherence to best practices
- Potential bugs or edge cases
- Performance considerations
- Readability and clarity

Provide constructive feedback with specific suggestions.`,
    tools: ['Read', 'Grep', 'Glob'],
    modelConfig: { temp: 0.3, model: 'qwen3-coder' }
  },
  {
    name: 'test-generator',
    category: 'testing',
    description: 'Generates comprehensive unit tests for code',
    systemPrompt: `You are a test generation expert. Generate comprehensive unit tests for the provided code using the project's testing framework.

Guidelines:
- Cover happy paths, edge cases, and error conditions
- Use meaningful test descriptions
- Follow project's testing conventions
- Aim for high code coverage

Return the complete test file with all necessary imports.`,
    tools: ['Read', 'Write', 'Grep', 'Glob'],
    modelConfig: { temp: 0.5 }
  },
  {
    name: 'documentation-writer',
    category: 'documentation',
    description: 'Generates documentation from code',
    systemPrompt: `You are a documentation expert. Generate clear, comprehensive documentation for the provided code.

Include:
- High-level overview
- API documentation (parameters, return values)
- Usage examples
- Common pitfalls or gotchas

Follow the project's documentation style.`,
    tools: ['Read', 'Write', 'Grep'],
    modelConfig: { temp: 0.4 }
  },
  {
    name: 'bug-investigator',
    category: 'debugging',
    description: 'Investigates bugs and suggests fixes',
    systemPrompt: `You are a debugging expert. Investigate the reported bug by:

1. Understanding the error message and stack trace
2. Examining relevant code
3. Identifying the root cause
4. Suggesting specific fixes

Provide a clear explanation of the issue and actionable solutions.`,
    tools: ['Read', 'Grep', 'Glob', 'Shell'],
    modelConfig: { temp: 0.3 }
  },
  {
    name: 'refactoring-specialist',
    category: 'code-quality',
    description: 'Suggests and applies refactoring improvements',
    systemPrompt: `You are a refactoring expert. Analyze the code and suggest improvements for:

- Code structure and organization
- Duplication elimination
- Complexity reduction
- Naming and clarity
- Design patterns application

Provide specific refactoring suggestions with code examples.`,
    tools: ['Read', 'Edit', 'Grep', 'Glob'],
    modelConfig: { temp: 0.4 }
  },
  {
    name: 'security-auditor',
    category: 'security',
    description: 'Audits code for security vulnerabilities',
    systemPrompt: `You are a security expert. Audit the code for security vulnerabilities:

- Input validation issues
- SQL injection risks
- XSS vulnerabilities
- Authentication/authorization flaws
- Data exposure
- Dependency vulnerabilities

Categorize findings by severity (critical/high/medium/low) and provide remediation steps.`,
    tools: ['Read', 'Grep', 'Glob'],
    modelConfig: { temp: 0.2 } // Low temp for security-critical analysis
  },
  {
    name: 'performance-optimizer',
    category: 'performance',
    description: 'Analyzes and optimizes code performance',
    systemPrompt: `You are a performance optimization expert. Analyze the code for performance issues:

- Algorithmic complexity
- Memory usage
- Database query optimization
- Caching opportunities
- Network requests

Provide specific optimization recommendations with estimated impact.`,
    tools: ['Read', 'Grep', 'Glob', 'Shell'],
    modelConfig: { temp: 0.3 }
  },
  {
    name: 'api-designer',
    category: 'design',
    description: 'Designs API endpoints and contracts',
    systemPrompt: `You are an API design expert. Design well-structured, RESTful APIs with:

- Clear endpoint naming
- Appropriate HTTP methods
- Request/response schemas
- Error handling
- Versioning strategy
- Documentation

Follow REST best practices and OpenAPI specification.`,
    tools: ['Read', 'Write', 'Grep'],
    modelConfig: { temp: 0.5 }
  },
  {
    name: 'migration-assistant',
    category: 'automation',
    description: 'Assists with code migrations and upgrades',
    systemPrompt: `You are a migration expert. Help migrate code from one technology/version to another:

1. Identify deprecated patterns
2. Suggest modern equivalents
3. Provide migration steps
4. Highlight breaking changes
5. Generate migration scripts if needed

Be thorough and careful to avoid introducing bugs.`,
    tools: ['Read', 'Edit', 'Grep', 'Glob', 'Shell'],
    modelConfig: { temp: 0.3 }
  },
  {
    name: 'commit-message-writer',
    category: 'automation',
    description: 'Generates conventional commit messages',
    systemPrompt: `You are a git commit message expert. Generate concise, informative commit messages following Conventional Commits specification.

Format: <type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore
- Keep subject under 50 chars
- Use imperative mood ("add" not "added")
- Include body for complex changes

Analyze the git diff and generate an appropriate commit message.`,
    tools: ['Shell', 'Read'],
    modelConfig: { temp: 0.4 }
  }
];
```

#### 4.3 Agent Discovery UI

```bash
# CLI commands
fora agents browse                    # Browse available agent templates
fora agents search <query>            # Search agent templates
fora agents install <name> [--level user|project]
fora agents info <name>               # Show template details
fora agents list-installed            # Show installed agents
```

### Benefits for Local Models

1. **Pre-optimized Prompts**: Templates optimized for local model performance
2. **Quick Start**: No prompt engineering required
3. **Best Practices**: Community-tested patterns
4. **Specialized Agents**: Better results than generic agents
5. **Model Compatibility**: Templates specify model requirements

---

## Part 5: Context Management & Optimization

### Challenges with Local Models

Local models typically have:
- Smaller context windows (8K-32K vs 200K for Claude)
- Slower inference speed
- Higher memory requirements
- More sensitive to prompt quality

### Proposed Enhancements

#### 5.1 Smart Context Window Management

```typescript
// packages/core/src/context/context-optimizer.ts

export class ContextOptimizer {
  constructor(
    private maxTokens: number = 8192 // Default for local models
  ) {}

  async optimizeContext(
    systemPrompt: string,
    chatHistory: Content[],
    memories: MemoryEntry[],
    tools: FunctionDeclaration[]
  ): Promise<OptimizedContext> {
    const budget = this.maxTokens * 0.8; // Reserve 20% for response
    let allocated = 0;

    // 1. Essential components (always included)
    const systemTokens = this.estimateTokens(systemPrompt);
    allocated += systemTokens;

    // 2. Recent chat history (most important)
    const recentHistory = this.selectRecentHistory(
      chatHistory,
      budget - allocated,
      0.4 // 40% of remaining budget
    );
    allocated += this.estimateTokens(JSON.stringify(recentHistory));

    // 3. Relevant memories (ranked by importance)
    const relevantMemories = this.selectRelevantMemories(
      memories,
      budget - allocated,
      0.3 // 30% of remaining budget
    );
    allocated += this.estimateTokens(this.formatMemories(relevantMemories));

    // 4. Essential tools (most commonly used)
    const essentialTools = this.selectEssentialTools(
      tools,
      budget - allocated,
      0.3 // 30% of remaining budget
    );

    return {
      systemPrompt,
      chatHistory: recentHistory,
      memories: relevantMemories,
      tools: essentialTools,
      estimatedTokens: allocated
    };
  }

  private selectRecentHistory(
    history: Content[],
    maxTokens: number,
    budgetRatio: number
  ): Content[] {
    const budget = maxTokens * budgetRatio;
    const selected: Content[] = [];
    let tokens = 0;

    // Start from most recent, work backward
    for (let i = history.length - 1; i >= 0; i--) {
      const itemTokens = this.estimateTokens(JSON.stringify(history[i]));
      if (tokens + itemTokens > budget) break;

      selected.unshift(history[i]);
      tokens += itemTokens;
    }

    return selected;
  }

  private selectRelevantMemories(
    memories: MemoryEntry[],
    maxTokens: number,
    budgetRatio: number
  ): MemoryEntry[] {
    const budget = maxTokens * budgetRatio;

    // Sort by relevance score
    const sorted = memories.sort((a, b) => b.confidence - a.confidence);

    const selected: MemoryEntry[] = [];
    let tokens = 0;

    for (const memory of sorted) {
      const itemTokens = this.estimateTokens(memory.content);
      if (tokens + itemTokens > budget) break;

      selected.push(memory);
      tokens += itemTokens;
    }

    return selected;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}
```

#### 5.2 Context Compression Strategies

```typescript
export class ContextCompressor {
  async compressHistory(history: Content[]): Promise<Content[]> {
    // 1. Remove redundant tool calls
    const deduplicated = this.deduplicateToolCalls(history);

    // 2. Summarize old messages
    const summarized = await this.summarizeOldMessages(deduplicated);

    // 3. Merge consecutive user/assistant turns
    const merged = this.mergeConsecutiveTurns(summarized);

    return merged;
  }

  private deduplicateToolCalls(history: Content[]): Content[] {
    // Remove repeated tool calls with same params
    const seen = new Set<string>();
    return history.filter(item => {
      if (item.role === 'function') {
        const key = `${item.name}:${JSON.stringify(item.args)}`;
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    });
  }

  private async summarizeOldMessages(
    history: Content[],
    threshold = 10
  ): Promise<Content[]> {
    if (history.length <= threshold) return history;

    // Keep recent messages, summarize old ones
    const recent = history.slice(-threshold);
    const old = history.slice(0, -threshold);

    // Use a fast local model to summarize
    const summary = await this.generateSummary(old);

    return [
      {
        role: 'user',
        parts: [{ text: `[Previous conversation summary: ${summary}]` }]
      },
      ...recent
    ];
  }
}
```

#### 5.3 Model Routing by Task Type

```typescript
// packages/core/src/routing/model-router.ts

export interface ModelRoute {
  pattern: RegExp | ((context: TaskContext) => boolean);
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export class ModelRouter {
  private routes: ModelRoute[] = [
    // Code generation: Use larger, more creative model
    {
      pattern: /generate|create|write.*code|implement/i,
      model: 'qwen3-coder-32b',
      temperature: 0.7,
      maxTokens: 2048
    },
    // Code analysis: Use faster, focused model
    {
      pattern: /analyze|review|check|audit/i,
      model: 'qwen3-coder-8b',
      temperature: 0.3,
      maxTokens: 1024
    },
    // Simple queries: Use smallest, fastest model
    {
      pattern: /what is|how do|explain/i,
      model: 'qwen3-coder-4b',
      temperature: 0.5,
      maxTokens: 512
    },
    // Default fallback
    {
      pattern: /.*/,
      model: 'qwen3-coder-14b',
      temperature: 0.5,
      maxTokens: 1024
    }
  ];

  selectModel(context: TaskContext): ModelConfig {
    for (const route of this.routes) {
      if (typeof route.pattern === 'function') {
        if (route.pattern(context)) {
          return {
            model: route.model,
            temp: route.temperature,
            maxTokens: route.maxTokens
          };
        }
      } else if (route.pattern.test(context.prompt)) {
        return {
          model: route.model,
          temp: route.temperature,
          maxTokens: route.maxTokens
        };
      }
    }

    // Should never reach here due to catch-all route
    return { model: 'qwen3-coder-14b' };
  }
}
```

### Benefits for Local Models

1. **Fit Smaller Context Windows**: Optimize to stay within limits
2. **Faster Inference**: Smaller context = faster generation
3. **Reduced Memory**: Less RAM needed for inference
4. **Better Quality**: Relevant context > full context
5. **Model Selection**: Use right-sized model for each task

---

## Part 6: Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Priority: High**

- [ ] **Skills System Core** (packages/core/src/skills/)
  - [ ] SkillConfig interface and types
  - [ ] SkillManager (CRUD operations)
  - [ ] SkillExecutor (execution engine)
  - [ ] Skill file format (Markdown + YAML)
  - [ ] SkillTool integration

- [ ] **Enhanced Memory** (packages/core/src/memory/)
  - [ ] MemoryEntry interface with metadata
  - [ ] MemoryManager refactor
  - [ ] Structured FORA.md format
  - [ ] Memory search and ranking
  - [ ] Migration script for existing memories

- [ ] **Expand Builtin Agents**
  - [ ] Add 10 builtin agents (code-reviewer, test-generator, etc.)
  - [ ] Test each agent with Qwen3-Coder
  - [ ] Optimize prompts for local models

**Deliverables:**
- Working skills system with 3-5 builtin skills
- Enhanced memory with search and metadata
- 10 production-ready builtin agents

### Phase 2: Orchestration (Week 3-4)

**Priority: Medium**

- [ ] **Multi-Agent Workflows** (packages/core/src/workflows/)
  - [ ] WorkflowExecutor implementation
  - [ ] Sequential, parallel, map-reduce patterns
  - [ ] Workflow file format (YAML)
  - [ ] WorkflowTool integration
  - [ ] Shared state management

- [ ] **Context Optimization** (packages/core/src/context/)
  - [ ] ContextOptimizer implementation
  - [ ] Token estimation utilities
  - [ ] Context compression strategies
  - [ ] Model router implementation

**Deliverables:**
- Working workflow system with example workflows
- Context optimization reducing token usage by 30-50%
- Model routing for efficient task distribution

### Phase 3: Developer Experience (Week 5-6)

**Priority: Medium**

- [ ] **CLI Commands**
  - [ ] `/skills` - Manage skills
  - [ ] `/memory` - Enhanced memory commands
  - [ ] `/workflows` - Manage workflows
  - [ ] `/agents browse` - Browse agent templates

- [ ] **Agent Templates**
  - [ ] AgentTemplateRegistry
  - [ ] Template discovery and installation
  - [ ] Community template support (GitHub)

- [ ] **Documentation**
  - [ ] Skills guide
  - [ ] Workflow examples
  - [ ] Agent authoring guide
  - [ ] Local model optimization tips

**Deliverables:**
- Complete CLI interface for new features
- Agent marketplace with 20+ templates
- Comprehensive documentation

### Phase 4: Advanced Features (Week 7-8)

**Priority: Low**

- [ ] **Semantic Memory Search**
  - [ ] Embedding generation (optional)
  - [ ] Vector similarity search
  - [ ] Integration with local embedding models

- [ ] **Agent Analytics**
  - [ ] Performance tracking
  - [ ] Success/failure metrics
  - [ ] Cost analysis (token usage)
  - [ ] Dashboard/reporting

- [ ] **Workflow IDE**
  - [ ] Visual workflow editor
  - [ ] Workflow debugging
  - [ ] Step-by-step execution

**Deliverables:**
- Optional semantic search for memory
- Analytics dashboard for agent performance
- (Optional) Visual workflow editor

---

## Part 7: Success Metrics

### Productivity Metrics

1. **Task Completion Time**: Reduce average task time by 40%
2. **Agent Reuse**: 60%+ of tasks use existing agents/skills
3. **Context Efficiency**: 30-50% reduction in tokens per task
4. **User Satisfaction**: 4.5+ rating for new features

### Technical Metrics

1. **Memory Recall**: 80%+ relevant memories found
2. **Agent Success Rate**: 85%+ tasks completed successfully
3. **Workflow Adoption**: 30%+ of users create custom workflows
4. **Performance**: <2s overhead for context optimization

### Adoption Metrics

1. **Builtin Agent Usage**: All 10 agents used regularly
2. **Custom Agents**: Average 3+ custom agents per user
3. **Skills Created**: Average 2+ custom skills per user
4. **Workflows Created**: Average 1+ custom workflow per user

---

## Part 8: Risks & Mitigations

### Risk 1: Complexity Overload

**Risk**: Too many features confuse users
**Mitigation**:
- Progressive disclosure (advanced features hidden by default)
- Excellent defaults (works out of box)
- Clear documentation and examples
- Gradual rollout

### Risk 2: Local Model Limitations

**Risk**: Local models can't handle complex orchestration
**Mitigation**:
- Test extensively with Qwen3-Coder
- Optimize prompts for local models
- Fallback to simpler patterns if needed
- Clear model requirements in docs

### Risk 3: Performance Degradation

**Risk**: Context optimization adds overhead
**Mitigation**:
- Lazy loading (optimize only when needed)
- Caching (reuse optimization results)
- Profiling and benchmarking
- Make optimization optional

### Risk 4: Maintenance Burden

**Risk**: Too many builtin agents to maintain
**Mitigation**:
- Automated testing for all agents
- Community contributions
- Versioning and deprecation policy
- Focus on quality over quantity

---

## Part 9: Comparison to Claude Code

| Feature | Claude Code | Foragen CLI (Current) | Foragen CLI (Proposed) |
|---------|-------------|----------------------|----------------------|
| **Subagents** | ✅ Yes | ✅ Yes (basic) | ✅ Yes (enhanced) |
| **Skills** | ✅ Yes | ❌ No | ✅ Yes |
| **Memories** | ✅ Yes (structured) | ⚠️ Basic (text-only) | ✅ Yes (structured) |
| **Multi-agent orchestration** | ✅ Yes | ❌ No | ✅ Yes |
| **Agent templates** | ✅ ~10 builtin | ⚠️ 1 builtin | ✅ 10+ builtin |
| **Context optimization** | ✅ Automatic | ❌ No | ✅ Yes |
| **Workflows** | ⚠️ Limited | ❌ No | ✅ Yes |
| **Semantic search** | ✅ Yes | ❌ No | ⚠️ Optional |
| **Model routing** | ✅ Yes | ❌ No | ✅ Yes |

**Legend**: ✅ Yes | ⚠️ Partial | ❌ No

---

## Part 10: Next Steps

### Immediate Actions

1. **Review & Feedback**: Share this plan with team/community
2. **Prioritization**: Confirm phase priorities
3. **Architecture Review**: Deep dive on skills/workflow architecture
4. **Prototype**: Build MVP of skills system (2-3 days)

### Week 1 Tasks

1. Create `packages/core/src/skills/` structure
2. Implement SkillConfig and SkillManager
3. Build 2 example skills (code-analysis, test-generator)
4. Update BuiltinAgentRegistry with 10 agents
5. Write integration tests

### Questions to Answer

1. Should skills support multi-turn conversations or single-turn only?
2. What's the priority order for builtin agents?
3. Should we support Python-based skills (not just prompt-based)?
4. How should we handle versioning of agents/skills/workflows?
5. What's the migration path for existing users?

---

## Appendix A: File Structure

```
packages/
├── core/
│   └── src/
│       ├── skills/
│       │   ├── skill.ts              # Core interfaces
│       │   ├── skill-manager.ts      # CRUD operations
│       │   ├── skill-executor.ts     # Execution engine
│       │   ├── builtin-skills.ts     # Registry
│       │   └── types.ts              # Type definitions
│       ├── memory/
│       │   ├── memory-manager.ts     # Enhanced manager
│       │   ├── memory-entry.ts       # Entry interface
│       │   ├── memory-search.ts      # Search engine
│       │   └── memory-compression.ts # Compression
│       ├── workflows/
│       │   ├── workflow-executor.ts  # Execution engine
│       │   ├── workflow-parser.ts    # YAML parser
│       │   └── types.ts              # Workflow types
│       ├── context/
│       │   ├── context-optimizer.ts  # Context optimization
│       │   ├── context-compressor.ts # Compression
│       │   └── token-estimator.ts    # Token counting
│       ├── routing/
│       │   └── model-router.ts       # Model selection
│       └── subagents/
│           └── builtin-agents.ts     # Expanded agents
├── cli/
│   └── src/
│       ├── ui/
│       │   └── commands/
│       │       ├── skillsCommand.ts
│       │       ├── memoryCommand.ts
│       │       └── workflowsCommand.ts
│       └── tools/
│           ├── skillTool.ts
│           └── workflowTool.ts

~/.fora/
├── skills/                           # User skills
│   ├── code-analysis.md
│   └── custom-skill.md
├── workflows/                        # User workflows
│   └── code-review.yaml
└── agents/                           # User agents
    └── custom-agent.md

.fora/
├── skills/                           # Project skills
├── workflows/                        # Project workflows
└── agents/                           # Project agents
```

---

## Appendix B: Example Skill Definition

```markdown
---
name: api-endpoint-generator
description: Generates RESTful API endpoint implementation
version: 1.0.0
category: code-generation
tags: [api, rest, backend]
tools: [Read, Write, Grep]
model:
  model: qwen3-coder-14b
  temp: 0.6
  max_tokens: 2048
parameters:
  - name: endpoint_spec
    type: object
    required: true
    description: API endpoint specification
    schema:
      properties:
        path:
          type: string
          description: Endpoint path (e.g., /api/users/:id)
        method:
          type: string
          enum: [GET, POST, PUT, DELETE, PATCH]
        description:
          type: string
        requestSchema:
          type: object
        responseSchema:
          type: object
  - name: framework
    type: string
    enum: [express, fastify, koa]
    default: express
    description: Backend framework to use
output:
  format: structured
  schema:
    type: object
    properties:
      routeFile:
        type: string
        description: Generated route handler code
      testFile:
        type: string
        description: Generated test code
      documentation:
        type: string
        description: API documentation (Markdown)
---

# API Endpoint Generator Skill

Generate production-ready API endpoint implementation with route handler, validation, tests, and documentation.

## System Prompt

You are an expert API developer. Generate a complete API endpoint implementation based on the specification.

## Process

1. **Analyze Specification**
   - Endpoint: ${endpoint_spec.path}
   - Method: ${endpoint_spec.method}
   - Request schema: ${endpoint_spec.requestSchema}
   - Response schema: ${endpoint_spec.responseSchema}

2. **Generate Route Handler**
   - Use ${framework} framework
   - Include request validation
   - Add error handling
   - Return typed response

3. **Generate Tests**
   - Happy path tests
   - Edge case tests
   - Error handling tests
   - Use appropriate testing library

4. **Generate Documentation**
   - Endpoint description
   - Request/response examples
   - Error codes
   - OpenAPI/Swagger format

## Output Format

Return a structured object with:
```json
{
  "routeFile": "// Complete route handler code",
  "testFile": "// Complete test code",
  "documentation": "# API Documentation in Markdown"
}
```

## Example

### Input
```json
{
  "endpoint_spec": {
    "path": "/api/users/:id",
    "method": "GET",
    "description": "Get user by ID",
    "responseSchema": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "email": { "type": "string" }
      }
    }
  },
  "framework": "express"
}
```

### Output
```json
{
  "routeFile": "...",
  "testFile": "...",
  "documentation": "..."
}
```
```

---

## Appendix C: References

### Existing Codebase Files (Key References)

- **Subagents**: `packages/core/src/subagents/subagent.ts:85-116` (ContextState)
- **Subagents**: `packages/core/src/subagents/types.ts:1-261` (Config interfaces)
- **Tools**: `packages/core/src/tools/task.ts:1-564` (TaskTool implementation)
- **Memory**: `packages/core/src/tools/memoryTool.ts` (Current memory system)
- **Config**: `packages/core/src/config/config.ts` (Config class)
- **Models**: `packages/core/src/config/models.ts` (Model definitions)

### External References

- [Claude Code Documentation](https://docs.anthropic.com/claude-code/)
- [Model Context Protocol](https://spec.modelcontextprotocol.io/)
- [Qwen3 Model Documentation](https://github.com/QwenLM/Qwen)
- [LangChain Agents](https://python.langchain.com/docs/modules/agents/)
- [Semantic Kernel Skills](https://learn.microsoft.com/en-us/semantic-kernel/)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-06
**Author**: Enhancement Planning Team
**Status**: DRAFT - Awaiting Review
