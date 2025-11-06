/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Context for task-based model routing decisions.
 */
export interface TaskContext {
  /** User prompt or task description */
  prompt: string;

  /** Task category (optional) */
  category?: TaskCategory;

  /** Current file being worked on (optional) */
  currentFile?: string;

  /** Programming language (optional) */
  language?: string;

  /** Estimated complexity (1-10) */
  complexity?: number;

  /** Whether task requires creativity */
  requiresCreativity?: boolean;

  /** Whether task requires analysis */
  requiresAnalysis?: boolean;

  /** Whether task is code generation */
  isCodeGeneration?: boolean;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task categories for model routing.
 */
export type TaskCategory =
  | 'code-generation'
  | 'code-analysis'
  | 'code-review'
  | 'refactoring'
  | 'testing'
  | 'documentation'
  | 'debugging'
  | 'general-query'
  | 'research'
  | 'planning';

/**
 * Model configuration for routing.
 */
export interface RoutingModelConfig {
  /** Model identifier */
  model: string;

  /** Temperature (0-1) */
  temperature?: number;

  /** Maximum output tokens */
  maxTokens?: number;

  /** Top-P sampling */
  topP?: number;

  /** Custom model parameters */
  params?: Record<string, unknown>;
}

/**
 * Routing rule for model selection.
 */
export interface RoutingRule {
  /** Rule name/description */
  name: string;

  /** Priority (higher = checked first) */
  priority: number;

  /** Matcher function or regex */
  matcher: RegExp | ((context: TaskContext) => boolean);

  /** Model configuration to use */
  modelConfig: RoutingModelConfig;

  /** Optional conditions */
  conditions?: {
    /** Minimum complexity required */
    minComplexity?: number;

    /** Maximum complexity allowed */
    maxComplexity?: number;

    /** Required task categories */
    categories?: TaskCategory[];

    /** Required file extensions */
    fileExtensions?: string[];
  };
}

/**
 * Result of model routing.
 */
export interface RoutingResult {
  /** Selected model configuration */
  modelConfig: RoutingModelConfig;

  /** Matched rule (if any) */
  matchedRule?: RoutingRule;

  /** Confidence in selection (0-1) */
  confidence: number;

  /** Reason for selection */
  reason: string;
}

/**
 * Statistics for model router.
 */
export interface RouterStats {
  /** Total routing decisions */
  totalDecisions: number;

  /** Decisions by model */
  byModel: Record<string, number>;

  /** Decisions by rule */
  byRule: Record<string, number>;

  /** Average confidence */
  averageConfidence: number;

  /** Fallback usage count */
  fallbackCount: number;
}
