/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Represents the storage level for a skill configuration.
 * - 'project': Stored in `.fora/skills/` within the project directory
 * - 'user': Stored in `~/.fora/skills/` in the user's home directory
 * - 'builtin': Built-in skills embedded in the codebase, always available
 */
export type SkillLevel = 'project' | 'user' | 'builtin';

/**
 * Skill categories for organization and discovery.
 */
export type SkillCategory =
  | 'code-generation'
  | 'code-analysis'
  | 'code-quality'
  | 'testing'
  | 'documentation'
  | 'debugging'
  | 'refactoring'
  | 'security'
  | 'performance'
  | 'automation'
  | 'design'
  | 'other';

/**
 * Parameter type for skill inputs.
 */
export type SkillParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object';

/**
 * Output format for skill results.
 */
export type SkillOutputFormat = 'text' | 'structured' | 'markdown';

/**
 * Definition of a single skill parameter.
 */
export interface SkillParameter {
  /** Parameter name */
  name: string;

  /** Parameter type */
  type: SkillParameterType;

  /** Whether this parameter is required */
  required?: boolean;

  /** Default value if not provided */
  default?: unknown;

  /** Human-readable description */
  description?: string;

  /** Allowed values (for enum-like parameters) */
  enum?: string[];

  /** JSON Schema for complex validation */
  schema?: Record<string, unknown>;
}

/**
 * Configuration for skill output format and validation.
 */
export interface SkillOutputConfig {
  /** Expected output format */
  format: SkillOutputFormat;

  /** JSON Schema for structured output validation */
  schema?: Record<string, unknown>;

  /** Whether to validate output against schema */
  validateOutput?: boolean;
}

/**
 * Example demonstrating skill usage.
 */
export interface SkillExample {
  /** Example name/description */
  name: string;

  /** Example input parameters */
  input: Record<string, unknown>;

  /** Expected output */
  output: string | Record<string, unknown>;

  /** Optional explanation */
  explanation?: string;
}

/**
 * Model configuration for skill execution.
 * Similar to subagent ModelConfig but focused on single-turn execution.
 */
export interface SkillModelConfig {
  /** Model name to use (e.g., 'qwen3-coder') */
  model?: string;

  /** Temperature for generation (0.0-1.0) */
  temp?: number;

  /** Top-p value for nucleus sampling */
  top_p?: number;

  /** Maximum tokens to generate */
  max_tokens?: number;
}

/**
 * Core configuration for a skill as stored in Markdown files.
 * This interface represents the file-based configuration that gets
 * converted to runtime execution.
 */
export interface SkillConfig {
  /** Unique name identifier for the skill */
  name: string;

  /** Human-readable description of what the skill does */
  description: string;

  /** Skill version (semantic versioning) */
  version: string;

  /** Category for organization */
  category?: SkillCategory;

  /** Tags for search and discovery */
  tags?: string[];

  /**
   * Optional list of tool names that this skill can use.
   * If omitted, inherits all available tools.
   */
  tools?: string[];

  /**
   * System prompt/instructions for the skill.
   * Supports ${variable} templating for parameters.
   */
  systemPrompt: string;

  /** Input parameters definition */
  parameters: SkillParameter[];

  /** Output configuration */
  output?: SkillOutputConfig;

  /** Model configuration for execution */
  model?: SkillModelConfig;

  /** Usage examples */
  examples?: SkillExample[];

  /** Storage level - determines where the configuration file is stored */
  level: SkillLevel;

  /** Absolute path to the configuration file */
  filePath: string;

  /**
   * Indicates whether this is a built-in skill.
   * Built-in skills cannot be modified or deleted.
   */
  readonly isBuiltin?: boolean;

  /** Optional author information */
  author?: string;

  /** Optional license information */
  license?: string;
}

/**
 * Result of a skill execution.
 */
export interface SkillResult {
  /** Whether the skill executed successfully */
  success: boolean;

  /** Skill output (format depends on SkillOutputConfig) */
  output: string | Record<string, unknown>;

  /** Error message if execution failed */
  error?: string;

  /** Execution metadata */
  metadata?: SkillExecutionMetadata;
}

/**
 * Metadata about skill execution.
 */
export interface SkillExecutionMetadata {
  /** Skill name */
  skillName: string;

  /** Input parameters provided */
  inputParams: Record<string, unknown>;

  /** Execution start time */
  startTime: Date;

  /** Execution end time */
  endTime: Date;

  /** Duration in milliseconds */
  duration: number;

  /** Model used */
  model?: string;

  /** Tokens used (if available) */
  tokensUsed?: number;

  /** Tools invoked during execution */
  toolsInvoked?: string[];
}

/**
 * Result of a validation operation on a skill configuration.
 */
export interface SkillValidationResult {
  /** Whether the configuration is valid */
  isValid: boolean;

  /** Array of error messages if validation failed */
  errors: string[];

  /** Array of warning messages (non-blocking issues) */
  warnings: string[];
}

/**
 * Options for listing skills.
 */
export interface ListSkillsOptions {
  /** Filter by storage level */
  level?: SkillLevel;

  /** Filter by category */
  category?: SkillCategory;

  /** Filter by tag */
  tag?: string;

  /** Filter by tool availability */
  hasTool?: string;

  /** Sort order for results */
  sortBy?: 'name' | 'category' | 'version' | 'level';

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';

  /** Force refresh from disk, bypassing cache */
  force?: boolean;
}

/**
 * Options for creating a new skill.
 */
export interface CreateSkillOptions {
  /** Storage level for the new skill */
  level: SkillLevel;

  /** Whether to overwrite existing skill with same name */
  overwrite?: boolean;

  /** Custom directory path (overrides default level-based path) */
  customPath?: string;
}

/**
 * Error thrown when a skill operation fails.
 */
export class SkillError extends Error {
  constructor(
    message: string,
    readonly code: SkillErrorCode,
    readonly skillName?: string,
  ) {
    super(message);
    this.name = 'SkillError';
  }
}

/**
 * Error codes for skill operations.
 */
export const SkillErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  INVALID_CONFIG: 'INVALID_CONFIG',
  INVALID_NAME: 'INVALID_NAME',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  INVALID_OUTPUT: 'INVALID_OUTPUT',
  FILE_ERROR: 'FILE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  EXECUTION_ERROR: 'EXECUTION_ERROR',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  PARAMETER_MISSING: 'PARAMETER_MISSING',
  PARAMETER_INVALID: 'PARAMETER_INVALID',
} as const;

export type SkillErrorCode =
  (typeof SkillErrorCode)[keyof typeof SkillErrorCode];

/**
 * Context for skill execution (internal).
 */
export interface SkillExecutionContext {
  /** Skill configuration */
  config: SkillConfig;

  /** Resolved input parameters */
  params: Record<string, unknown>;

  /** Available tools */
  tools?: string[];

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}
