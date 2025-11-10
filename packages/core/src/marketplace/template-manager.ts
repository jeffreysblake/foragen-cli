/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Config } from '../config/config.js';
import type {
  Template,
  TemplateMetadata,
  TemplateSearchOptions,
  TemplateSearchResult,
  InstallTemplateOptions,
  InstallTemplateResult,
  ExportTemplateOptions,
  ExportTemplateResult,
  TemplateValidationResult,
} from './types.js';
import {
  TemplateError,
  TemplateErrorCode,
  type ComponentType,
  type ComponentLevel,
} from './types.js';
import type { SubagentConfig } from '../subagents/types.js';
import type { SkillConfig } from '../skills/types.js';
import type { WorkflowConfig } from '../workflows/types.js';

/**
 * Manages templates for agents, skills, and workflows.
 *
 * Features:
 * - Template import/export
 * - Version management
 * - Dependency resolution
 * - Search and discovery
 * - Compatibility checking
 */
export class TemplateManager {
  private templateCache: Map<string, Template> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 60000; // 1 minute

  constructor(
    private readonly config: Config,
    private readonly templatesDir?: string,
  ) {}

  /**
   * Searches for templates matching the given criteria.
   *
   * @param options - Search filters
   * @returns Search results
   */
  async search(
    options: TemplateSearchOptions = {},
  ): Promise<TemplateSearchResult> {
    await this.ensureCacheLoaded();

    let templates = Array.from(this.templateCache.values());

    // Apply filters
    if (options.type) {
      templates = templates.filter((t) => t.metadata.type === options.type);
    }

    if (options.tags && options.tags.length > 0) {
      templates = templates.filter((t) =>
        options.tags!.some((tag) => t.metadata.tags.includes(tag)),
      );
    }

    if (options.author) {
      templates = templates.filter((t) =>
        t.metadata.author.name
          .toLowerCase()
          .includes(options.author!.toLowerCase()),
      );
    }

    if (options.minRating !== undefined) {
      templates = templates.filter(
        (t) => (t.metadata.rating ?? 0) >= options.minRating!,
      );
    }

    if (options.query) {
      const query = options.query.toLowerCase();
      templates = templates.filter(
        (t) =>
          t.metadata.name.toLowerCase().includes(query) ||
          t.metadata.description.toLowerCase().includes(query) ||
          t.metadata.author.name.toLowerCase().includes(query),
      );
    }

    // Sort
    const sortBy = options.sortBy ?? 'name';
    const sortOrder = options.sortOrder ?? 'asc';
    templates.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.metadata.name.localeCompare(b.metadata.name);
          break;
        case 'usage':
          comparison = a.metadata.usageCount - b.metadata.usageCount;
          break;
        case 'rating':
          comparison = (a.metadata.rating ?? 0) - (b.metadata.rating ?? 0);
          break;
        case 'created':
          comparison =
            a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime();
          break;
        case 'updated':
          comparison =
            a.metadata.updatedAt.getTime() - b.metadata.updatedAt.getTime();
          break;
        default:
          // Default to name sort
          comparison = a.metadata.name.localeCompare(b.metadata.name);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    const totalCount = templates.length;

    // Paginate
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;
    templates = templates.slice(offset, offset + limit);

    return {
      templates: templates.map((t) => t.metadata),
      totalCount,
      offset,
      limit,
    };
  }

  /**
   * Gets a template by ID.
   *
   * @param templateId - Template identifier
   * @returns Template or null if not found
   */
  async getTemplate(templateId: string): Promise<Template | null> {
    await this.ensureCacheLoaded();
    return this.templateCache.get(templateId) ?? null;
  }

  /**
   * Installs a template as a component.
   *
   * @param templateId - Template to install
   * @param options - Installation options
   * @returns Installation result
   */
  async install(
    templateId: string,
    options: InstallTemplateOptions,
  ): Promise<InstallTemplateResult> {
    try {
      // 1. Get template
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new TemplateError(
          `Template not found: ${templateId}`,
          TemplateErrorCode.NOT_FOUND,
          templateId,
        );
      }

      // 2. Validate template
      const validation = await this.validate(template);
      if (!validation.isValid) {
        throw new TemplateError(
          `Invalid template: ${validation.errors.join(', ')}`,
          TemplateErrorCode.INVALID_TEMPLATE,
          templateId,
        );
      }

      // 3. Check compatibility
      if (
        validation.compatibilityIssues &&
        validation.compatibilityIssues.length > 0
      ) {
        throw new TemplateError(
          `Incompatible template: ${validation.compatibilityIssues.join(', ')}`,
          TemplateErrorCode.INCOMPATIBLE,
          templateId,
        );
      }

      // 4. Install dependencies
      const installedDeps: Array<{
        templateId: string;
        componentName: string;
      }> = [];
      if (!options.skipDependencies && template.metadata.dependencies) {
        for (const dep of template.metadata.dependencies) {
          const depResult = await this.install(dep.templateId, {
            ...options,
            skipDependencies: true, // Avoid recursive dependency installation
          });
          if (!depResult.success) {
            throw new TemplateError(
              `Failed to install dependency ${dep.templateId}: ${depResult.error}`,
              TemplateErrorCode.DEPENDENCY_ERROR,
              templateId,
            );
          }
          installedDeps.push({
            templateId: dep.templateId,
            componentName: depResult.componentName!,
          });
        }
      }

      // 5. Install the component based on type
      const componentName = options.name ?? template.metadata.name;
      await this.installComponent(
        template,
        componentName,
        options.level,
        options.force ?? false,
      );

      return {
        success: true,
        componentName,
        level: options.level,
        dependencies: installedDeps,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Exports a component as a template.
   *
   * @param options - Export options
   * @returns Export result
   */
  async export(options: ExportTemplateOptions): Promise<ExportTemplateResult> {
    try {
      // 1. Load the component
      const component = await this.loadComponent(
        options.componentName,
        options.type,
        options.level,
      );

      if (!component) {
        throw new TemplateError(
          `Component not found: ${options.componentName}`,
          TemplateErrorCode.NOT_FOUND,
        );
      }

      // 2. Build template metadata
      const now = new Date();
      const metadata: TemplateMetadata = {
        id: options.metadata?.id ?? `${options.componentName}-v1`,
        name: options.metadata?.name ?? options.componentName,
        description: options.metadata?.description ?? '',
        type: options.type,
        version: options.metadata?.version ?? { major: 1, minor: 0, patch: 0 },
        author: options.metadata?.author ?? { name: 'Unknown' },
        license: options.metadata?.license ?? 'Apache-2.0',
        tags: options.metadata?.tags ?? [],
        createdAt: options.metadata?.createdAt ?? now,
        updatedAt: options.metadata?.updatedAt ?? now,
        usageCount: options.metadata?.usageCount ?? 0,
        rating: options.metadata?.rating,
        dependencies: options.metadata?.dependencies,
        compatibility: options.metadata?.compatibility ?? {
          minVersion: '0.1.0',
        },
        examples: options.metadata?.examples,
        repository: options.metadata?.repository,
        homepage: options.metadata?.homepage,
      };

      // 3. Build template
      const template: Template = {
        metadata,
        config: component,
      };

      // 4. Write to file
      await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
      await fs.writeFile(
        options.outputPath,
        JSON.stringify(template, null, 2),
        'utf-8',
      );

      return {
        success: true,
        filePath: options.outputPath,
        templateId: metadata.id,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Validates a template.
   *
   * @param template - Template to validate
   * @returns Validation result
   */
  async validate(template: Template): Promise<TemplateValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingDependencies: string[] = [];
    const compatibilityIssues: string[] = [];

    // Validate metadata
    if (!template.metadata.id) {
      errors.push('Template ID is required');
    }
    if (!template.metadata.name) {
      errors.push('Template name is required');
    }
    if (!template.metadata.type) {
      errors.push('Template type is required');
    }

    // Validate version
    const version = template.metadata.version;
    if (
      !version ||
      version.major < 0 ||
      version.minor < 0 ||
      version.patch < 0
    ) {
      errors.push('Invalid version format');
    }

    // Check dependencies
    if (template.metadata.dependencies) {
      for (const dep of template.metadata.dependencies) {
        const depTemplate = await this.getTemplate(dep.templateId);
        if (!depTemplate) {
          missingDependencies.push(dep.templateId);
        }
      }
    }

    // Check compatibility
    const cliVersion = this.getCurrentCliVersion();
    if (
      !this.isVersionCompatible(cliVersion, template.metadata.compatibility)
    ) {
      compatibilityIssues.push(
        `Requires CLI version ${template.metadata.compatibility.minVersion}` +
          (template.metadata.compatibility.maxVersion
            ? ` to ${template.metadata.compatibility.maxVersion}`
            : ' or higher'),
      );
    }

    // Validate config structure based on type
    if (!template.config) {
      errors.push('Template config is required');
    }

    return {
      isValid: errors.length === 0 && compatibilityIssues.length === 0,
      errors,
      warnings,
      missingDependencies:
        missingDependencies.length > 0 ? missingDependencies : undefined,
      compatibilityIssues:
        compatibilityIssues.length > 0 ? compatibilityIssues : undefined,
    };
  }

  /**
   * Ensures the template cache is loaded and fresh.
   */
  private async ensureCacheLoaded(): Promise<void> {
    const now = Date.now();
    if (now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return; // Cache is still fresh
    }

    this.templateCache.clear();

    // Load templates from directory
    if (this.templatesDir) {
      await this.loadTemplatesFromDirectory(this.templatesDir);
    }

    this.cacheTimestamp = now;
  }

  /**
   * Loads templates from a directory.
   *
   * @param directory - Directory path
   */
  private async loadTemplatesFromDirectory(directory: string): Promise<void> {
    try {
      const files = await fs.readdir(directory);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(directory, file);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const template = JSON.parse(content) as Template;

            // Convert date strings back to Date objects
            template.metadata.createdAt = new Date(template.metadata.createdAt);
            template.metadata.updatedAt = new Date(template.metadata.updatedAt);

            this.templateCache.set(template.metadata.id, template);
          } catch (error) {
            console.warn(`Failed to load template from ${filePath}:`, error);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
      console.warn(`Failed to load templates from ${directory}:`, error);
    }
  }

  /**
   * Installs a component based on template.
   *
   * @param template - Template to install
   * @param name - Component name
   * @param level - Installation level
   * @param force - Force overwrite
   */
  private async installComponent(
    template: Template,
    name: string,
    level: ComponentLevel,
    force: boolean,
  ): Promise<void> {
    switch (template.metadata.type) {
      case 'agent': {
        const agentManager = this.config.getSubagentManager();
        const config = template.config as SubagentConfig;
        await agentManager.createSubagent(
          { ...config, name },
          { level, overwrite: force },
        );
        break;
      }
      case 'skill': {
        const skillManager = this.config.getSkillManager();
        const config = template.config as SkillConfig;
        await skillManager.createSkill(
          { ...config, name },
          { level, overwrite: force },
        );
        break;
      }
      case 'workflow': {
        const workflowManager = this.config.getWorkflowManager();
        const config = template.config as WorkflowConfig;
        await workflowManager.createWorkflow(
          { ...config, name },
          { level, overwrite: force },
        );
        break;
      }
      default:
        throw new TemplateError(
          `Unknown component type: ${template.metadata.type}`,
          TemplateErrorCode.INVALID_TEMPLATE,
          template.metadata.id,
        );
    }
  }

  /**
   * Loads a component configuration.
   *
   * @param name - Component name
   * @param type - Component type
   * @param level - Component level
   * @returns Component config or null
   */
  private async loadComponent(
    name: string,
    type: ComponentType,
    _level: ComponentLevel,
  ): Promise<SubagentConfig | SkillConfig | WorkflowConfig | null> {
    switch (type) {
      case 'agent': {
        const agentManager = this.config.getSubagentManager();
        return await agentManager.loadSubagent(name);
      }
      case 'skill': {
        const skillManager = this.config.getSkillManager();
        return await skillManager.loadSkill(name);
      }
      case 'workflow': {
        const workflowManager = this.config.getWorkflowManager();
        return await workflowManager.loadWorkflow(name);
      }
      default:
        return null;
    }
  }

  /**
   * Gets the current CLI version.
   *
   * @returns Version string
   */
  private getCurrentCliVersion(): string {
    return this.config.getCliVersion() ?? '0.1.3';
  }

  /**
   * Checks if a version is compatible with requirements.
   *
   * @param version - Version to check
   * @param compatibility - Compatibility requirements
   * @returns True if compatible
   */
  private isVersionCompatible(
    version: string,
    compatibility: { minVersion: string; maxVersion?: string },
  ): boolean {
    const versionParts = version.split('.').map(Number);
    const minParts = compatibility.minVersion.split('.').map(Number);

    // Check minimum version
    for (let i = 0; i < 3; i++) {
      if (versionParts[i] > minParts[i]) return true;
      if (versionParts[i] < minParts[i]) return false;
    }

    // Check maximum version if specified
    if (compatibility.maxVersion) {
      const maxParts = compatibility.maxVersion.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if (versionParts[i] < maxParts[i]) return true;
        if (versionParts[i] > maxParts[i]) return false;
      }
    }

    return true;
  }
}
