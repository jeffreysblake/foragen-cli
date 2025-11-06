/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { Config } from '../config/config.js';
import type { WorkflowConfig, WorkflowResult } from './types.js';
import { WorkflowError, WorkflowErrorCode } from './types.js';
import { WorkflowOrchestrator } from './workflow-orchestrator.js';

/**
 * Storage level for workflows.
 */
export type WorkflowLevel = 'builtin' | 'user' | 'project';

/**
 * Options for creating a workflow.
 */
export interface CreateWorkflowOptions {
  /** Storage level */
  level: WorkflowLevel;
  /** Whether to overwrite existing workflow */
  overwrite?: boolean;
}

/**
 * Options for listing workflows.
 */
export interface ListWorkflowsOptions {
  /** Filter by level */
  level?: WorkflowLevel;
  /** Sort by name or lastModified */
  sortBy?: 'name' | 'lastModified';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Workflow metadata for listing.
 */
export interface WorkflowMetadata {
  name: string;
  description: string;
  version: string;
  level: WorkflowLevel;
  filePath: string;
  lastModified: Date;
  stepCount: number;
  mode: 'sequential' | 'parallel' | 'conditional';
}

/**
 * Manages workflow storage and execution.
 *
 * Features:
 * - 3-tier storage (builtin/user/project)
 * - CRUD operations for workflows
 * - Workflow execution with orchestrator
 * - Workflow validation
 */
export class WorkflowManager {
  private orchestrator: WorkflowOrchestrator;
  private cache: Map<string, WorkflowConfig> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 60000; // 1 minute

  constructor(private readonly config: Config) {
    this.orchestrator = new WorkflowOrchestrator(config);
  }

  /**
   * Creates a new workflow.
   *
   * @param workflow - Workflow configuration
   * @param options - Creation options
   */
  async createWorkflow(
    workflow: WorkflowConfig,
    options: CreateWorkflowOptions,
  ): Promise<void> {
    // Validate workflow
    this.validateWorkflow(workflow);

    // Get storage directory
    const dir = this.getWorkflowDirectory(options.level);
    await fs.mkdir(dir, { recursive: true });

    // Check if exists
    const filePath = path.join(dir, `${workflow.name}.json`);
    try {
      await fs.access(filePath);
      if (!options.overwrite) {
        throw new WorkflowError(
          `Workflow already exists: ${workflow.name}`,
          WorkflowErrorCode.ALREADY_EXISTS,
          workflow.name,
        );
      }
    } catch (error) {
      // File doesn't exist, which is fine for creation
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    // Write workflow
    await fs.writeFile(filePath, JSON.stringify(workflow, null, 2), 'utf-8');

    // Invalidate cache
    this.invalidateCache();
  }

  /**
   * Loads a workflow by name.
   *
   * @param name - Workflow name
   * @returns Workflow config or null if not found
   */
  async loadWorkflow(name: string): Promise<WorkflowConfig | null> {
    await this.ensureCacheLoaded();
    return this.cache.get(name) ?? null;
  }

  /**
   * Lists all workflows.
   *
   * @param options - List options
   * @returns Array of workflow metadata
   */
  async listWorkflows(
    options: ListWorkflowsOptions = {},
  ): Promise<WorkflowMetadata[]> {
    await this.ensureCacheLoaded();

    let workflows = Array.from(this.cache.values()).map((workflow) => {
      const level = this.getWorkflowLevel(workflow);
      return {
        name: workflow.name,
        description: workflow.description,
        version: workflow.version,
        level,
        filePath: path.join(
          this.getWorkflowDirectory(level),
          `${workflow.name}.json`,
        ),
        lastModified: new Date(), // TODO: Get actual file mtime
        stepCount: workflow.steps.length,
        mode: workflow.mode,
      };
    });

    // Filter by level
    if (options.level) {
      workflows = workflows.filter((w) => w.level === options.level);
    }

    // Sort
    const sortBy = options.sortBy ?? 'name';
    const sortOrder = options.sortOrder ?? 'asc';
    workflows.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'lastModified':
          comparison = a.lastModified.getTime() - b.lastModified.getTime();
          break;
        default:
          comparison = a.name.localeCompare(b.name);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return workflows;
  }

  /**
   * Updates an existing workflow.
   *
   * @param name - Workflow name
   * @param workflow - Updated workflow config
   */
  async updateWorkflow(name: string, workflow: WorkflowConfig): Promise<void> {
    // Ensure workflow exists
    const existing = await this.loadWorkflow(name);
    if (!existing) {
      throw new WorkflowError(
        `Workflow not found: ${name}`,
        WorkflowErrorCode.NOT_FOUND,
        name,
      );
    }

    // Validate new config
    this.validateWorkflow(workflow);

    // Determine level and update
    const level = this.getWorkflowLevel(existing);
    const filePath = path.join(
      this.getWorkflowDirectory(level),
      `${name}.json`,
    );

    await fs.writeFile(filePath, JSON.stringify(workflow, null, 2), 'utf-8');

    // Invalidate cache
    this.invalidateCache();
  }

  /**
   * Deletes a workflow.
   *
   * @param name - Workflow name
   */
  async deleteWorkflow(name: string): Promise<void> {
    const workflow = await this.loadWorkflow(name);
    if (!workflow) {
      throw new WorkflowError(
        `Workflow not found: ${name}`,
        WorkflowErrorCode.NOT_FOUND,
        name,
      );
    }

    const level = this.getWorkflowLevel(workflow);
    const filePath = path.join(
      this.getWorkflowDirectory(level),
      `${name}.json`,
    );

    await fs.unlink(filePath);

    // Invalidate cache
    this.invalidateCache();
  }

  /**
   * Executes a workflow.
   *
   * @param name - Workflow name
   * @param variables - Optional variable overrides
   * @param signal - Optional abort signal
   * @returns Workflow execution result
   */
  async executeWorkflow(
    name: string,
    variables?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<WorkflowResult> {
    const workflow = await this.loadWorkflow(name);
    if (!workflow) {
      throw new WorkflowError(
        `Workflow not found: ${name}`,
        WorkflowErrorCode.NOT_FOUND,
        name,
      );
    }

    // Merge variables
    if (variables) {
      workflow.variables = { ...workflow.variables, ...variables };
    }

    // Execute with orchestrator
    return await this.orchestrator.execute(workflow, signal);
  }

  /**
   * Validates a workflow configuration.
   *
   * @param workflow - Workflow to validate
   * @throws WorkflowError if validation fails
   */
  private validateWorkflow(workflow: WorkflowConfig): void {
    if (!workflow.name) {
      throw new WorkflowError(
        'Workflow name is required',
        WorkflowErrorCode.INVALID_CONFIG,
      );
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      throw new WorkflowError(
        'Workflow must have at least one step',
        WorkflowErrorCode.INVALID_CONFIG,
        workflow.name,
      );
    }

    if (!workflow.mode) {
      throw new WorkflowError(
        'Workflow mode is required',
        WorkflowErrorCode.INVALID_CONFIG,
        workflow.name,
      );
    }

    // Additional validation performed by orchestrator
  }

  /**
   * Gets the storage directory for a level.
   *
   * @param level - Storage level
   * @returns Directory path
   */
  private getWorkflowDirectory(level: WorkflowLevel): string {
    switch (level) {
      case 'builtin':
        return path.join(
          path.dirname(new URL(import.meta.url).pathname),
          '../../data/workflows/builtin',
        );
      case 'user':
        return path.join(os.homedir(), '.fora/workflows');
      case 'project':
        return path.join(this.config.getWorkingDir(), '.fora/workflows');
      default:
        // Default to user level
        return path.join(os.homedir(), '.fora/workflows');
    }
  }

  /**
   * Determines the level of a workflow.
   *
   * @param workflow - Workflow config
   * @returns Storage level
   */
  private getWorkflowLevel(_workflow: WorkflowConfig): WorkflowLevel {
    // TODO: Store level metadata in workflow
    // For now, assume user level
    return 'user';
  }

  /**
   * Ensures the cache is loaded and fresh.
   */
  private async ensureCacheLoaded(): Promise<void> {
    const now = Date.now();
    if (now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return; // Cache is still fresh
    }

    this.cache.clear();

    // Load from all levels
    for (const level of ['builtin', 'user', 'project'] as WorkflowLevel[]) {
      await this.loadWorkflowsFromLevel(level);
    }

    this.cacheTimestamp = now;
  }

  /**
   * Loads workflows from a storage level.
   *
   * @param level - Storage level
   */
  private async loadWorkflowsFromLevel(level: WorkflowLevel): Promise<void> {
    const dir = this.getWorkflowDirectory(level);

    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(dir, file);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const workflow = JSON.parse(content) as WorkflowConfig;
            this.cache.set(workflow.name, workflow);
          } catch (error) {
            console.warn(`Failed to load workflow from ${filePath}:`, error);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Failed to load workflows from ${level}:`, error);
      }
    }
  }

  /**
   * Invalidates the cache.
   */
  private invalidateCache(): void {
    this.cacheTimestamp = 0;
  }

  /**
   * Registers an event listener for workflow events.
   *
   * @param listener - Event listener function
   * @returns Cleanup function
   */
  on(listener: Parameters<typeof this.orchestrator.on>[0]): () => void {
    return this.orchestrator.on(listener);
  }
}
