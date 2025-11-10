/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Version identifier following semantic versioning.
 */
export interface Version {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Component type for marketplace.
 */
export type ComponentType = 'agent' | 'skill' | 'workflow';

/**
 * Component level/scope.
 */
export type ComponentLevel = 'builtin' | 'user' | 'project';

/**
 * Template metadata for sharing and discovery.
 */
export interface TemplateMetadata {
  /** Unique template identifier (e.g., "code-reviewer-v1") */
  id: string;

  /** Display name */
  name: string;

  /** Detailed description */
  description: string;

  /** Component type */
  type: ComponentType;

  /** Version information */
  version: Version;

  /** Author information */
  author: {
    name: string;
    email?: string;
    url?: string;
  };

  /** License identifier (e.g., "Apache-2.0", "MIT") */
  license: string;

  /** Tags for discovery and categorization */
  tags: string[];

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Number of times this template has been used */
  usageCount: number;

  /** Average rating (0-5) */
  rating?: number;

  /** Dependencies on other templates */
  dependencies?: Array<{
    /** Template ID */
    templateId: string;
    /** Version constraint (e.g., "^1.0.0", ">=2.0.0") */
    version: string;
  }>;

  /** Compatible Fora CLI versions */
  compatibility: {
    /** Minimum CLI version */
    minVersion: string;
    /** Maximum CLI version (optional) */
    maxVersion?: string;
  };

  /** Example usage or documentation URL */
  examples?: string[];

  /** Repository or source URL */
  repository?: string;

  /** Homepage or documentation URL */
  homepage?: string;
}

/**
 * Complete template package including metadata and configuration.
 */
export interface Template {
  /** Template metadata */
  metadata: TemplateMetadata;

  /** The actual configuration (SubagentConfig, SkillConfig, or WorkflowConfig) */
  config: unknown;

  /** Optional files (e.g., additional prompts, documentation) */
  files?: Array<{
    path: string;
    content: string;
  }>;
}

/**
 * Template search filters.
 */
export interface TemplateSearchOptions {
  /** Filter by type */
  type?: ComponentType;

  /** Filter by tags (any match) */
  tags?: string[];

  /** Search query (matches name, description, author) */
  query?: string;

  /** Filter by author */
  author?: string;

  /** Minimum rating */
  minRating?: number;

  /** Sort order */
  sortBy?: 'name' | 'usage' | 'rating' | 'created' | 'updated';

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';

  /** Limit results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Template search result.
 */
export interface TemplateSearchResult {
  /** Matching templates */
  templates: TemplateMetadata[];

  /** Total count (before pagination) */
  totalCount: number;

  /** Current offset */
  offset: number;

  /** Result limit */
  limit: number;
}

/**
 * Template installation options.
 */
export interface InstallTemplateOptions {
  /** Target level for installation */
  level: ComponentLevel;

  /** Override template name */
  name?: string;

  /** Skip dependency installation */
  skipDependencies?: boolean;

  /** Force overwrite existing component */
  force?: boolean;
}

/**
 * Template installation result.
 */
export interface InstallTemplateResult {
  /** Whether installation succeeded */
  success: boolean;

  /** Installed component name */
  componentName?: string;

  /** Installed component level */
  level?: ComponentLevel;

  /** Error message if failed */
  error?: string;

  /** Installed dependencies */
  dependencies?: Array<{
    templateId: string;
    componentName: string;
  }>;
}

/**
 * Template export options.
 */
export interface ExportTemplateOptions {
  /** Component to export */
  componentName: string;

  /** Component type */
  type: ComponentType;

  /** Component level */
  level: ComponentLevel;

  /** Template metadata (will be merged with auto-generated) */
  metadata?: Partial<TemplateMetadata>;

  /** Output file path */
  outputPath: string;

  /** Include dependencies in export */
  includeDependencies?: boolean;
}

/**
 * Template export result.
 */
export interface ExportTemplateResult {
  /** Whether export succeeded */
  success: boolean;

  /** Output file path */
  filePath?: string;

  /** Template ID */
  templateId?: string;

  /** Error message if failed */
  error?: string;
}

/**
 * Template validation result.
 */
export interface TemplateValidationResult {
  /** Whether template is valid */
  isValid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings */
  warnings: string[];

  /** Missing dependencies */
  missingDependencies?: string[];

  /** Compatibility issues */
  compatibilityIssues?: string[];
}

/**
 * Error thrown during template operations.
 */
export class TemplateError extends Error {
  constructor(
    message: string,
    readonly code: TemplateErrorCode,
    readonly templateId?: string,
  ) {
    super(message);
    this.name = 'TemplateError';
  }
}

/**
 * Error codes for template operations.
 */
export const TemplateErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  INVALID_TEMPLATE: 'INVALID_TEMPLATE',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
  INSTALLATION_FAILED: 'INSTALLATION_FAILED',
  EXPORT_FAILED: 'EXPORT_FAILED',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  INCOMPATIBLE: 'INCOMPATIBLE',
} as const;

export type TemplateErrorCode =
  (typeof TemplateErrorCode)[keyof typeof TemplateErrorCode];
