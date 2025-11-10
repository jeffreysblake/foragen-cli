/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  parse as parseYaml,
  stringify as stringifyYaml,
} from '../utils/yaml-parser.js';
import type {
  SkillConfig,
  SkillLevel,
  SkillCategory,
  ListSkillsOptions,
  CreateSkillOptions,
  SkillParameter,
  SkillOutputConfig,
  SkillModelConfig,
  SkillExample,
} from './types.js';
import { SkillError, SkillErrorCode } from './types.js';
import { SkillValidator } from './validation.js';
import type { Config } from '../config/config.js';
import { BuiltinSkillRegistry } from './builtin-skills.js';

const FORA_CONFIG_DIR = '.fora';
const SKILL_CONFIG_DIR = 'skills';

/**
 * Manages skill configurations stored as Markdown files with YAML frontmatter.
 * Provides CRUD operations, validation, and integration with the runtime system.
 */
export class SkillManager {
  private readonly validator: SkillValidator;
  private skillsCache: Map<SkillLevel, SkillConfig[]> | null = null;
  private readonly changeListeners: Set<() => void> = new Set();

  constructor(
    // @ts-expect-error - Config parameter reserved for future use
    private readonly _config: Config,
  ) {
    this.validator = new SkillValidator();
  }

  addChangeListener(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private notifyChangeListeners(): void {
    for (const listener of this.changeListeners) {
      try {
        listener();
      } catch (error) {
        console.warn('Skill change listener threw an error:', error);
      }
    }
  }

  /**
   * Creates a new skill configuration.
   *
   * @param config - Skill configuration to create
   * @param options - Creation options
   * @throws SkillError if creation fails
   */
  async createSkill(
    config: SkillConfig,
    options: CreateSkillOptions,
  ): Promise<void> {
    this.validator.validateOrThrow(config);

    // Determine file path
    const filePath =
      options.customPath || this.getSkillPath(config.name, options.level);

    // Check if file already exists
    if (!options.overwrite) {
      try {
        await fs.access(filePath);
        throw new SkillError(
          `Skill "${config.name}" already exists at ${filePath}`,
          SkillErrorCode.ALREADY_EXISTS,
          config.name,
        );
      } catch (error) {
        if (error instanceof SkillError) throw error;
        // File doesn't exist, which is what we want
      }
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Update config with actual file path and level
    const finalConfig: SkillConfig = {
      ...config,
      level: options.level,
      filePath,
    };

    // Serialize and write the file
    const content = this.serializeSkill(finalConfig);

    try {
      await fs.writeFile(filePath, content, 'utf8');
      // Refresh cache after successful creation
      await this.refreshCache();
    } catch (error) {
      throw new SkillError(
        `Failed to write skill file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        SkillErrorCode.FILE_ERROR,
        config.name,
      );
    }
  }

  /**
   * Loads a skill configuration by name.
   * If level is specified, only searches that level.
   * If level is omitted, searches project-level first, then user-level, then built-in.
   *
   * @param name - Name of the skill to load
   * @param level - Optional level to limit search to specific level
   * @returns SkillConfig or null if not found
   */
  async loadSkill(
    name: string,
    level?: SkillLevel,
  ): Promise<SkillConfig | null> {
    if (level) {
      // Search only the specified level
      if (level === 'builtin') {
        return BuiltinSkillRegistry.getBuiltinSkill(name);
      }

      return this.findSkillByNameAtLevel(name, level);
    }

    // Try project level first
    const projectConfig = await this.findSkillByNameAtLevel(name, 'project');
    if (projectConfig) {
      return projectConfig;
    }

    // Try user level next
    const userConfig = await this.findSkillByNameAtLevel(name, 'user');
    if (userConfig) {
      return userConfig;
    }

    // Finally check built-in
    return BuiltinSkillRegistry.getBuiltinSkill(name);
  }

  /**
   * Updates an existing skill configuration.
   *
   * @param name - Name of the skill to update
   * @param updates - Partial configuration with fields to update
   * @throws SkillError if update fails
   */
  async updateSkill(
    name: string,
    updates: Partial<SkillConfig>,
  ): Promise<void> {
    // Check if it's a built-in skill
    if (BuiltinSkillRegistry.isBuiltinSkill(name)) {
      throw new SkillError(
        `Cannot update built-in skill "${name}"`,
        SkillErrorCode.INVALID_CONFIG,
        name,
      );
    }

    // Load existing configuration
    const existing = await this.loadSkill(name);
    if (!existing) {
      throw new SkillError(
        `Skill "${name}" not found`,
        SkillErrorCode.NOT_FOUND,
        name,
      );
    }

    // Merge updates with existing config
    const updatedConfig: SkillConfig = {
      ...existing,
      ...updates,
      // Preserve these fields
      name: existing.name,
      filePath: existing.filePath,
      level: existing.level,
    };

    // Validate updated config
    this.validator.validateOrThrow(updatedConfig);

    // Serialize and write the file
    const content = this.serializeSkill(updatedConfig);

    try {
      await fs.writeFile(existing.filePath, content, 'utf8');
      // Refresh cache after successful update
      await this.refreshCache();
    } catch (error) {
      throw new SkillError(
        `Failed to update skill file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        SkillErrorCode.FILE_ERROR,
        name,
      );
    }
  }

  /**
   * Deletes a skill configuration.
   *
   * @param name - Name of the skill to delete
   * @param level - Specific level to delete from, or undefined to delete from both
   * @throws SkillError if deletion fails
   */
  async deleteSkill(name: string, level?: SkillLevel): Promise<void> {
    // Check if it's a built-in skill first
    if (BuiltinSkillRegistry.isBuiltinSkill(name)) {
      throw new SkillError(
        `Cannot delete built-in skill "${name}"`,
        SkillErrorCode.INVALID_CONFIG,
        name,
      );
    }

    const levelsToCheck: SkillLevel[] = level ? [level] : ['project', 'user'];
    let deleted = false;

    for (const currentLevel of levelsToCheck) {
      // Skip builtin level for deletion
      if (currentLevel === 'builtin') {
        continue;
      }

      // Find the actual skill file by scanning and parsing
      const config = await this.findSkillByNameAtLevel(name, currentLevel);
      if (config && config.filePath) {
        try {
          await fs.unlink(config.filePath);
          deleted = true;
        } catch (_error) {
          // File might not exist or be accessible, continue
        }
      }
    }

    if (!deleted) {
      throw new SkillError(
        `Skill "${name}" not found`,
        SkillErrorCode.NOT_FOUND,
        name,
      );
    }

    // Refresh cache after successful deletion
    await this.refreshCache();
  }

  /**
   * Lists all available skills.
   *
   * @param options - Filtering and sorting options
   * @returns Array of skill metadata
   */
  async listSkills(options: ListSkillsOptions = {}): Promise<SkillConfig[]> {
    const skills: SkillConfig[] = [];
    const seenNames = new Set<string>();

    const levelsToCheck: SkillLevel[] = options.level
      ? [options.level]
      : ['project', 'user', 'builtin'];

    // Check if we should use cache or force refresh
    const shouldUseCache = !options.force && this.skillsCache !== null;

    // Initialize cache if it doesn't exist or we're forcing a refresh
    if (!shouldUseCache) {
      await this.refreshCache();
    }

    // Collect skills from each level (project takes precedence over user, user takes precedence over builtin)
    for (const level of levelsToCheck) {
      const levelSkills = this.skillsCache?.get(level) || [];

      for (const skill of levelSkills) {
        // Skip if we've already seen this name (precedence: project > user > builtin)
        if (seenNames.has(skill.name)) {
          continue;
        }

        // Apply filters
        if (options.category && skill.category !== options.category) {
          continue;
        }

        if (options.tag && !skill.tags?.includes(options.tag)) {
          continue;
        }

        if (options.hasTool && !skill.tools?.includes(options.hasTool)) {
          continue;
        }

        skills.push(skill);
        seenNames.add(skill.name);
      }
    }

    // Sort results
    if (options.sortBy) {
      skills.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';

        switch (options.sortBy) {
          case 'name':
            aVal = a.name;
            bVal = b.name;
            break;
          case 'category':
            aVal = a.category || '';
            bVal = b.category || '';
            break;
          case 'version':
            aVal = a.version;
            bVal = b.version;
            break;
          case 'level': {
            const levelOrder = { builtin: 0, user: 1, project: 2 };
            aVal = levelOrder[a.level];
            bVal = levelOrder[b.level];
            break;
          }
          default:
            // No sorting for unknown sortBy values
            break;
        }

        const comparison =
          typeof aVal === 'string'
            ? aVal.localeCompare(String(bVal))
            : aVal - (bVal as number);

        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return skills;
  }

  /**
   * Refreshes the skills cache by reloading from disk.
   */
  private async refreshCache(): Promise<void> {
    const skillsCache = new Map<SkillLevel, SkillConfig[]>();
    const levels: SkillLevel[] = ['project', 'user', 'builtin'];

    for (const level of levels) {
      const levelSkills = await this.listSkillsAtLevel(level);
      skillsCache.set(level, levelSkills);
    }

    this.skillsCache = skillsCache;
    this.notifyChangeListeners();
  }

  /**
   * Finds a skill by name at a specific level.
   *
   * @param name - Skill name to find
   * @param level - Level to search
   * @returns SkillConfig or null if not found
   */
  private async findSkillByNameAtLevel(
    name: string,
    level: SkillLevel,
  ): Promise<SkillConfig | null> {
    if (level === 'builtin') {
      return BuiltinSkillRegistry.getBuiltinSkill(name);
    }

    const skills = await this.listSkillsAtLevel(level);
    return skills.find((skill) => skill.name === name) || null;
  }

  /**
   * Lists all skills at a specific level.
   *
   * @param level - Level to list skills from
   * @returns Array of skill configurations
   */
  private async listSkillsAtLevel(level: SkillLevel): Promise<SkillConfig[]> {
    if (level === 'builtin') {
      return BuiltinSkillRegistry.getBuiltinSkills();
    }

    const skillDir = this.getSkillDirectory(level);

    try {
      await fs.access(skillDir);
    } catch {
      // Directory doesn't exist, return empty array
      return [];
    }

    const files = await fs.readdir(skillDir);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    const skills: SkillConfig[] = [];

    for (const file of mdFiles) {
      const filePath = path.join(skillDir, file);
      try {
        const skill = await this.parseSkillFile(filePath, level);
        skills.push(skill);
      } catch (error) {
        console.warn(`Failed to parse skill file ${filePath}:`, error);
        // Continue with other files
      }
    }

    return skills;
  }

  /**
   * Parses a skill file and returns the configuration.
   *
   * @param filePath - Path to the skill file
   * @param level - Storage level
   * @returns SkillConfig
   * @throws SkillError if parsing fails
   */
  async parseSkillFile(
    filePath: string,
    level: SkillLevel,
  ): Promise<SkillConfig> {
    let content: string;

    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      throw new SkillError(
        `Failed to read skill file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        SkillErrorCode.FILE_ERROR,
      );
    }

    return this.parseSkillContent(content, filePath, level);
  }

  /**
   * Parses skill content from a string.
   *
   * @param content - File content
   * @param filePath - File path for error reporting
   * @param level - Storage level
   * @returns SkillConfig
   * @throws SkillError if parsing fails
   */
  parseSkillContent(
    content: string,
    filePath: string,
    level: SkillLevel,
  ): SkillConfig {
    try {
      // Split frontmatter and content
      const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
      const match = content.match(frontmatterRegex);

      if (!match) {
        throw new Error('Invalid format: missing YAML frontmatter');
      }

      const [, frontmatterYaml, systemPrompt] = match;

      // Parse YAML frontmatter
      const frontmatter = parseYaml(frontmatterYaml) as Record<string, unknown>;

      // Extract required fields
      const name = String(frontmatter['name'] || '');
      const description = String(frontmatter['description'] || '');
      const version = String(frontmatter['version'] || '1.0.0');

      if (!name) {
        throw new Error('Missing "name" in frontmatter');
      }

      if (!description) {
        throw new Error('Missing "description" in frontmatter');
      }

      // Extract optional fields
      const category = frontmatter['category'] as string | undefined;
      const tags = frontmatter['tags'] as string[] | undefined;
      const tools = frontmatter['tools'] as string[] | undefined;
      const parameters = frontmatter['parameters'] as SkillParameter[] | [];
      const output = frontmatter['output'] as SkillOutputConfig | undefined;
      const model = frontmatter['model'] as SkillModelConfig | undefined;
      const examples = frontmatter['examples'] as SkillExample[] | undefined;
      const author = frontmatter['author'] as string | undefined;
      const license = frontmatter['license'] as string | undefined;

      const config: SkillConfig = {
        name,
        description,
        version,
        category: category as SkillCategory | undefined,
        tags,
        tools,
        systemPrompt: systemPrompt.trim(),
        parameters: parameters || [],
        output,
        model,
        examples,
        filePath,
        level,
        author,
        license,
      };

      // Validate the parsed configuration
      const validation = this.validator.validateConfig(config);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      return config;
    } catch (error) {
      throw new SkillError(
        `Failed to parse skill file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        SkillErrorCode.INVALID_CONFIG,
      );
    }
  }

  /**
   * Serializes a skill configuration to Markdown format.
   *
   * @param config - Configuration to serialize
   * @returns Markdown content with YAML frontmatter
   */
  serializeSkill(config: SkillConfig): string {
    // Build frontmatter object
    const frontmatter: Record<string, unknown> = {
      name: config.name,
      description: config.description,
      version: config.version,
    };

    if (config.category) {
      frontmatter['category'] = config.category;
    }

    if (config.tags && config.tags.length > 0) {
      frontmatter['tags'] = config.tags;
    }

    if (config.tools && config.tools.length > 0) {
      frontmatter['tools'] = config.tools;
    }

    if (config.parameters && config.parameters.length > 0) {
      frontmatter['parameters'] = config.parameters;
    }

    if (config.output) {
      frontmatter['output'] = config.output;
    }

    if (config.model) {
      frontmatter['model'] = config.model;
    }

    if (config.examples && config.examples.length > 0) {
      frontmatter['examples'] = config.examples;
    }

    if (config.author) {
      frontmatter['author'] = config.author;
    }

    if (config.license) {
      frontmatter['license'] = config.license;
    }

    // Serialize frontmatter to YAML
    const frontmatterYaml = stringifyYaml(frontmatter);

    // Combine frontmatter and system prompt
    return `---\n${frontmatterYaml}---\n${config.systemPrompt}\n`;
  }

  /**
   * Gets the file path for a skill at a given level.
   *
   * @param name - Skill name
   * @param level - Storage level
   * @returns Absolute file path
   */
  private getSkillPath(name: string, level: SkillLevel): string {
    const skillDir = this.getSkillDirectory(level);
    return path.join(skillDir, `${name}.md`);
  }

  /**
   * Gets the directory for skills at a given level.
   *
   * @param level - Storage level
   * @returns Absolute directory path
   */
  private getSkillDirectory(level: SkillLevel): string {
    if (level === 'builtin') {
      throw new Error('Cannot get directory for builtin skills');
    }

    const baseDir = level === 'project' ? process.cwd() : os.homedir();
    return path.join(baseDir, FORA_CONFIG_DIR, SKILL_CONFIG_DIR);
  }

  /**
   * Creates a SubAgentScope for a skill's execution (reserved for future use).
   *
   * Note: This method is currently not needed as SkillExecutor handles
   * skill execution directly using the content generator. It is reserved
   * for future advanced integration scenarios where skills might need
   * multi-turn conversational capabilities.
   *
   * @param _skillConfig - Skill configuration
   * @param _config - Runtime configuration
   * @returns Promise resolving to a skill scope
   */
  async createSkillScope(
    _skillConfig: SkillConfig,
    _config: Config,
  ): Promise<unknown> {
    throw new Error(
      'createSkillScope is reserved for future use. ' +
        'Use SkillExecutor.execute() for skill execution.',
    );
  }
}
