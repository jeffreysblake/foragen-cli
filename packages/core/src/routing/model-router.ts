/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  TaskContext,
  RoutingRule,
  RoutingResult,
  RouterStats,
  TaskCategory,
} from './types.js';

/**
 * Routes tasks to optimal models based on task characteristics.
 *
 * Features:
 * - Pattern-based routing (regex or function matchers)
 * - Task category classification
 * - Complexity-based model selection
 * - File type awareness
 * - Confidence scoring
 * - Usage statistics
 */
export class ModelRouter {
  private rules: RoutingRule[] = [];
  private stats: RouterStats = {
    totalDecisions: 0,
    byModel: {},
    byRule: {},
    averageConfidence: 0,
    fallbackCount: 0,
  };

  constructor(rules?: RoutingRule[]) {
    if (rules) {
      this.rules = rules;
    } else {
      this.rules = this.getDefaultRules();
    }

    // Sort rules by priority (descending)
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Routes a task to the optimal model.
   *
   * @param context - Task context
   * @returns Routing result with model configuration
   */
  route(context: TaskContext): RoutingResult {
    // Enhance context with inferred properties
    const enhancedContext = this.enhanceContext(context);

    // Try each rule in priority order
    for (const rule of this.rules) {
      if (this.matchesRule(rule, enhancedContext)) {
        const result = this.createResult(rule, enhancedContext);
        this.recordDecision(result, rule);
        return result;
      }
    }

    // Fallback to default model
    const fallbackResult = this.getFallbackResult(enhancedContext);
    this.recordDecision(fallbackResult);
    this.stats.fallbackCount++;
    return fallbackResult;
  }

  /**
   * Adds a routing rule.
   *
   * @param rule - Routing rule to add
   */
  addRule(rule: RoutingRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Removes a routing rule by name.
   *
   * @param name - Rule name
   */
  removeRule(name: string): void {
    this.rules = this.rules.filter((r) => r.name !== name);
  }

  /**
   * Gets current routing statistics.
   *
   * @returns Router statistics
   */
  getStats(): RouterStats {
    return { ...this.stats };
  }

  /**
   * Resets routing statistics.
   */
  resetStats(): void {
    this.stats = {
      totalDecisions: 0,
      byModel: {},
      byRule: {},
      averageConfidence: 0,
      fallbackCount: 0,
    };
  }

  /**
   * Gets default routing rules optimized for local models.
   *
   * @returns Default routing rules
   */
  private getDefaultRules(): RoutingRule[] {
    return [
      // Code generation - Use larger, more creative model
      {
        name: 'code-generation-complex',
        priority: 100,
        matcher: (ctx) =>
          (ctx.category === 'code-generation' ||
            ctx.isCodeGeneration ||
            /generate|create|write.*code|implement|build/i.test(ctx.prompt)) &&
          (ctx.complexity ?? 5) > 7,
        modelConfig: {
          model: 'qwen3-coder-32b',
          temperature: 0.7,
          maxTokens: 4096,
        },
        conditions: {
          minComplexity: 7,
        },
      },

      // Code generation - Medium complexity
      {
        name: 'code-generation-medium',
        priority: 90,
        matcher: (ctx) =>
          ctx.category === 'code-generation' ||
          ctx.isCodeGeneration ||
          /generate|create|write.*code|implement/i.test(ctx.prompt),
        modelConfig: {
          model: 'qwen3-coder-14b',
          temperature: 0.6,
          maxTokens: 2048,
        },
      },

      // Code analysis - Use focused model
      {
        name: 'code-analysis',
        priority: 95,
        matcher: (ctx) =>
          (ctx.category === 'code-analysis' ||
            ctx.requiresAnalysis ||
            /analyze|review|check|audit|inspect/i.test(ctx.prompt)) &&
          !ctx.requiresCreativity,
        modelConfig: {
          model: 'qwen3-coder-8b',
          temperature: 0.3,
          maxTokens: 2048,
        },
      },

      // Code review - Balance accuracy and insights
      {
        name: 'code-review',
        priority: 85,
        matcher: (ctx) =>
          ctx.category === 'code-review' ||
          /review|feedback|critique|assess/i.test(ctx.prompt),
        modelConfig: {
          model: 'qwen3-coder-14b',
          temperature: 0.4,
          maxTokens: 2048,
        },
      },

      // Testing - Structured, methodical
      {
        name: 'testing',
        priority: 80,
        matcher: (ctx) =>
          ctx.category === 'testing' ||
          /test|spec|unit.*test|integration.*test/i.test(ctx.prompt),
        modelConfig: {
          model: 'qwen3-coder-8b',
          temperature: 0.5,
          maxTokens: 2048,
        },
      },

      // Documentation - Clear and creative
      {
        name: 'documentation',
        priority: 75,
        matcher: (ctx) =>
          ctx.category === 'documentation' ||
          /document|doc|readme|comment|explain/i.test(ctx.prompt),
        modelConfig: {
          model: 'qwen3-coder-8b',
          temperature: 0.6,
          maxTokens: 2048,
        },
      },

      // Refactoring - Careful and precise
      {
        name: 'refactoring',
        priority: 82,
        matcher: (ctx) =>
          ctx.category === 'refactoring' ||
          /refactor|restructure|reorganize|improve.*structure/i.test(ctx.prompt),
        modelConfig: {
          model: 'qwen3-coder-14b',
          temperature: 0.4,
          maxTokens: 2048,
        },
      },

      // Debugging - Analytical and thorough
      {
        name: 'debugging',
        priority: 88,
        matcher: (ctx) =>
          ctx.category === 'debugging' ||
          /debug|fix.*bug|error|issue|problem|why.*not.*work/i.test(ctx.prompt),
        modelConfig: {
          model: 'qwen3-coder-14b',
          temperature: 0.3,
          maxTokens: 2048,
        },
      },

      // Research - Broad knowledge
      {
        name: 'research',
        priority: 70,
        matcher: (ctx) =>
          ctx.category === 'research' ||
          /research|investigate|find|search|look.*up/i.test(ctx.prompt),
        modelConfig: {
          model: 'qwen3-coder-8b',
          temperature: 0.5,
          maxTokens: 1536,
        },
      },

      // Planning - Strategic thinking
      {
        name: 'planning',
        priority: 72,
        matcher: (ctx) =>
          ctx.category === 'planning' ||
          /plan|design|architect|structure|organize/i.test(ctx.prompt),
        modelConfig: {
          model: 'qwen3-coder-14b',
          temperature: 0.6,
          maxTokens: 2048,
        },
      },

      // Simple queries - Fast model
      {
        name: 'simple-query',
        priority: 60,
        matcher: (ctx) => {
          const simplePatterns =
            /what is|how do|explain|define|describe|show.*example/i;
          return (
            simplePatterns.test(ctx.prompt) &&
            ctx.prompt.length < 100 &&
            (ctx.complexity ?? 5) < 3
          );
        },
        modelConfig: {
          model: 'qwen3-coder-4b',
          temperature: 0.5,
          maxTokens: 1024,
        },
        conditions: {
          maxComplexity: 3,
        },
      },

      // Default fallback (handled separately, but included for completeness)
      {
        name: 'default',
        priority: 0,
        matcher: /.*/,
        modelConfig: {
          model: 'qwen3-coder-14b',
          temperature: 0.5,
          maxTokens: 2048,
        },
      },
    ];
  }

  /**
   * Enhances context with inferred properties.
   *
   * @param context - Original context
   * @returns Enhanced context
   */
  private enhanceContext(context: TaskContext): TaskContext {
    const enhanced = { ...context };

    // Infer category if not provided
    if (!enhanced.category) {
      enhanced.category = this.inferCategory(context.prompt);
    }

    // Infer complexity if not provided
    if (enhanced.complexity === undefined) {
      enhanced.complexity = this.inferComplexity(context.prompt);
    }

    // Infer if code generation
    if (enhanced.isCodeGeneration === undefined) {
      enhanced.isCodeGeneration =
        /generate|create|write|implement|build|code/i.test(context.prompt);
    }

    // Infer if requires creativity
    if (enhanced.requiresCreativity === undefined) {
      enhanced.requiresCreativity =
        /creative|innovative|design|architect|new/i.test(context.prompt);
    }

    // Infer if requires analysis
    if (enhanced.requiresAnalysis === undefined) {
      enhanced.requiresAnalysis =
        /analyze|review|check|audit|inspect|examine/i.test(context.prompt);
    }

    // Infer language from file extension
    if (enhanced.currentFile && !enhanced.language) {
      const ext = enhanced.currentFile.split('.').pop()?.toLowerCase();
      const langMap: Record<string, string> = {
        ts: 'typescript',
        js: 'javascript',
        tsx: 'typescript-react',
        jsx: 'javascript-react',
        py: 'python',
        java: 'java',
        go: 'go',
        rs: 'rust',
        cpp: 'cpp',
        c: 'c',
      };
      enhanced.language = langMap[ext || ''];
    }

    return enhanced;
  }

  /**
   * Infers task category from prompt.
   *
   * @param prompt - Task prompt
   * @returns Inferred category
   */
  private inferCategory(prompt: string): TaskCategory {
    const lower = prompt.toLowerCase();

    if (/generate|create|write.*code|implement|build/i.test(lower))
      return 'code-generation';
    if (/analyze|review|check|audit|inspect/i.test(lower))
      return 'code-analysis';
    if (/test|spec|unit.*test/i.test(lower)) return 'testing';
    if (/document|doc|readme|comment/i.test(lower)) return 'documentation';
    if (/refactor|restructure|reorganize/i.test(lower)) return 'refactoring';
    if (/debug|fix.*bug|error|issue/i.test(lower)) return 'debugging';
    if (/research|investigate|find|search/i.test(lower)) return 'research';
    if (/plan|design|architect/i.test(lower)) return 'planning';

    return 'general-query';
  }

  /**
   * Infers task complexity from prompt.
   *
   * @param prompt - Task prompt
   * @returns Complexity score (1-10)
   */
  private inferComplexity(prompt: string): number {
    let complexity = 5; // Default medium

    // Length-based complexity
    if (prompt.length > 500) complexity += 2;
    else if (prompt.length > 200) complexity += 1;
    else if (prompt.length < 50) complexity -= 2;

    // Keyword-based complexity
    const highComplexityKeywords =
      /complex|advanced|optimize|performance|scalable|distributed|concurrent/i;
    const lowComplexityKeywords = /simple|basic|quick|easy|straightforward/i;

    if (highComplexityKeywords.test(prompt)) complexity += 2;
    if (lowComplexityKeywords.test(prompt)) complexity -= 2;

    // Multiple steps increase complexity
    const steps = (prompt.match(/\d+\./g) || []).length;
    complexity += Math.min(steps, 3);

    // Clamp to 1-10
    return Math.max(1, Math.min(10, complexity));
  }

  /**
   * Checks if a rule matches the context.
   *
   * @param rule - Routing rule
   * @param context - Task context
   * @returns True if rule matches
   */
  private matchesRule(rule: RoutingRule, context: TaskContext): boolean {
    // Check matcher
    let matcherPassed = false;
    if (rule.matcher instanceof RegExp) {
      matcherPassed = rule.matcher.test(context.prompt);
    } else if (typeof rule.matcher === 'function') {
      matcherPassed = rule.matcher(context);
    }

    if (!matcherPassed) return false;

    // Check conditions
    const conditions = rule.conditions;
    if (!conditions) return true;

    // Check complexity bounds
    if (conditions.minComplexity !== undefined) {
      if ((context.complexity ?? 5) < conditions.minComplexity) return false;
    }
    if (conditions.maxComplexity !== undefined) {
      if ((context.complexity ?? 5) > conditions.maxComplexity) return false;
    }

    // Check required categories
    if (conditions.categories && context.category) {
      if (!conditions.categories.includes(context.category)) return false;
    }

    // Check file extensions
    if (conditions.fileExtensions && context.currentFile) {
      const ext = context.currentFile.split('.').pop()?.toLowerCase();
      if (!ext || !conditions.fileExtensions.includes(ext)) return false;
    }

    return true;
  }

  /**
   * Creates a routing result from a matched rule.
   *
   * @param rule - Matched rule
   * @param context - Task context
   * @returns Routing result
   */
  private createResult(rule: RoutingRule, context: TaskContext): RoutingResult {
    // Calculate confidence based on match quality
    let confidence = 0.7; // Base confidence for rule match

    // Boost confidence if category matches
    if (context.category && rule.name.includes(context.category)) {
      confidence += 0.15;
    }

    // Boost confidence if complexity is within optimal range
    if (rule.conditions) {
      const complexity = context.complexity ?? 5;
      if (rule.conditions.minComplexity && rule.conditions.maxComplexity) {
        const min = rule.conditions.minComplexity;
        const max = rule.conditions.maxComplexity;
        if (complexity >= min && complexity <= max) {
          confidence += 0.15;
        }
      }
    }

    // Clamp confidence to 0-1
    confidence = Math.min(1.0, confidence);

    return {
      modelConfig: rule.modelConfig,
      matchedRule: rule,
      confidence,
      reason: `Matched rule: ${rule.name}`,
    };
  }

  /**
   * Gets fallback routing result when no rule matches.
   *
   * @param context - Task context
   * @returns Fallback routing result
   */
  private getFallbackResult(context: TaskContext): RoutingResult {
    // Choose fallback model based on complexity
    const complexity = context.complexity ?? 5;
    let model = 'qwen3-coder-14b';
    let temp = 0.5;
    let tokens = 2048;

    if (complexity >= 8) {
      model = 'qwen3-coder-32b';
      temp = 0.6;
      tokens = 4096;
    } else if (complexity <= 2) {
      model = 'qwen3-coder-4b';
      temp = 0.4;
      tokens = 1024;
    }

    return {
      modelConfig: {
        model,
        temperature: temp,
        maxTokens: tokens,
      },
      confidence: 0.5, // Lower confidence for fallback
      reason: 'No specific rule matched; using fallback based on complexity',
    };
  }

  /**
   * Records a routing decision for statistics.
   *
   * @param result - Routing result
   * @param rule - Matched rule (optional)
   */
  private recordDecision(result: RoutingResult, rule?: RoutingRule): void {
    this.stats.totalDecisions++;

    // Update model stats
    const model = result.modelConfig.model;
    this.stats.byModel[model] = (this.stats.byModel[model] || 0) + 1;

    // Update rule stats
    if (rule) {
      this.stats.byRule[rule.name] = (this.stats.byRule[rule.name] || 0) + 1;
    }

    // Update average confidence (running average)
    const prevTotal = this.stats.totalDecisions - 1;
    this.stats.averageConfidence =
      (this.stats.averageConfidence * prevTotal + result.confidence) /
      this.stats.totalDecisions;
  }
}
