/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import { SkillError, SkillErrorCode } from './types.js';
import type {
  SkillConfig,
  SkillValidationResult,
  SkillParameter,
  SkillModelConfig,
  SkillOutputConfig,
} from './types.js';

/**
 * Validates skill configurations to ensure they are well-formed
 * and compatible with the runtime system.
 */
export class SkillValidator {
  /**
   * Validates a complete skill configuration.
   *
   * @param config - The skill configuration to validate
   * @returns SkillValidationResult with errors and warnings
   */
  validateConfig(config: SkillConfig): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate name
    const nameValidation = this.validateName(config.name);
    if (!nameValidation.isValid) {
      errors.push(...nameValidation.errors);
    }

    // Validate description
    if (!config.description || config.description.trim().length === 0) {
      errors.push('Description is required and cannot be empty');
    } else if (config.description.length > 500) {
      warnings.push(
        'Description is quite long (>500 chars), consider shortening for better readability',
      );
    }

    // Validate version
    const versionValidation = this.validateVersion(config.version);
    if (!versionValidation.isValid) {
      errors.push(...versionValidation.errors);
    }

    // Validate system prompt
    const promptValidation = this.validateSystemPrompt(config.systemPrompt);
    if (!promptValidation.isValid) {
      errors.push(...promptValidation.errors);
    }
    warnings.push(...promptValidation.warnings);

    // Validate parameters
    const paramsValidation = this.validateParameters(config.parameters);
    if (!paramsValidation.isValid) {
      errors.push(...paramsValidation.errors);
    }
    warnings.push(...paramsValidation.warnings);

    // Validate tools if specified
    if (config.tools) {
      const toolsValidation = this.validateTools(config.tools);
      if (!toolsValidation.isValid) {
        errors.push(...toolsValidation.errors);
      }
      warnings.push(...toolsValidation.warnings);
    }

    // Validate model config if specified
    if (config.model) {
      const modelValidation = this.validateModelConfig(config.model);
      if (!modelValidation.isValid) {
        errors.push(...modelValidation.errors);
      }
      warnings.push(...modelValidation.warnings);
    }

    // Validate output config if specified
    if (config.output) {
      const outputValidation = this.validateOutputConfig(config.output);
      if (!outputValidation.isValid) {
        errors.push(...outputValidation.errors);
      }
      warnings.push(...outputValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates a skill name.
   *
   * @param name - Name to validate
   * @returns ValidationResult
   */
  validateName(name: string): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!name || name.trim().length === 0) {
      errors.push('Name is required and cannot be empty');
      return { isValid: false, errors, warnings };
    }

    // Name should be kebab-case
    const kebabCaseRegex = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    if (!kebabCaseRegex.test(name)) {
      errors.push(
        'Name must be in kebab-case format (lowercase letters, numbers, and hyphens only)',
      );
    }

    // Name length constraints
    if (name.length < 3) {
      errors.push('Name must be at least 3 characters long');
    } else if (name.length > 50) {
      errors.push('Name must be at most 50 characters long');
    }

    // Reserved names
    const reservedNames = ['builtin', 'system', 'internal'];
    if (reservedNames.includes(name)) {
      errors.push(`Name "${name}" is reserved and cannot be used`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates a version string (semantic versioning).
   *
   * @param version - Version to validate
   * @returns ValidationResult
   */
  validateVersion(version: string): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!version || version.trim().length === 0) {
      errors.push('Version is required and cannot be empty');
      return { isValid: false, errors, warnings };
    }

    // Basic semantic versioning check (major.minor.patch)
    const semverRegex = /^\d+\.\d+\.\d+(-[a-z0-9.-]+)?(\+[a-z0-9.-]+)?$/i;
    if (!semverRegex.test(version)) {
      errors.push(
        'Version must follow semantic versioning format (e.g., 1.0.0, 1.2.3-beta.1)',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates a system prompt.
   *
   * @param systemPrompt - System prompt to validate
   * @returns ValidationResult
   */
  validateSystemPrompt(systemPrompt: string): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!systemPrompt || systemPrompt.trim().length === 0) {
      errors.push('System prompt is required and cannot be empty');
      return { isValid: false, errors, warnings };
    }

    // Minimum length for meaningful prompts
    if (systemPrompt.length < 50) {
      warnings.push(
        'System prompt is quite short (<50 chars), consider providing more detailed instructions',
      );
    }

    // Maximum length (to avoid token limits)
    if (systemPrompt.length > 10000) {
      warnings.push(
        'System prompt is very long (>10000 chars), this may consume significant tokens',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates skill parameters.
   *
   * @param parameters - Parameters to validate
   * @returns ValidationResult
   */
  validateParameters(parameters: SkillParameter[]): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(parameters)) {
      errors.push('Parameters must be an array');
      return { isValid: false, errors, warnings };
    }

    const paramNames = new Set<string>();

    for (let i = 0; i < parameters.length; i++) {
      const param = parameters[i];

      // Validate name
      if (!param.name || param.name.trim().length === 0) {
        errors.push(`Parameter at index ${i} is missing a name`);
        continue;
      }

      // Check for duplicate names
      if (paramNames.has(param.name)) {
        errors.push(`Duplicate parameter name: "${param.name}"`);
      }
      paramNames.add(param.name);

      // Validate type
      const validTypes = ['string', 'number', 'boolean', 'array', 'object'];
      if (!validTypes.includes(param.type)) {
        errors.push(
          `Parameter "${param.name}" has invalid type: ${param.type}`,
        );
      }

      // Validate enum if present
      if (param.enum && (!Array.isArray(param.enum) || param.enum.length === 0)) {
        errors.push(
          `Parameter "${param.name}" enum must be a non-empty array`,
        );
      }

      // Warn if required parameter has a default value
      if (param.required && param.default !== undefined) {
        warnings.push(
          `Parameter "${param.name}" is marked as required but has a default value`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates a list of tool names.
   *
   * @param tools - Tool names to validate
   * @returns ValidationResult
   */
  validateTools(tools: string[]): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(tools)) {
      errors.push('Tools must be an array of strings');
      return { isValid: false, errors, warnings };
    }

    if (tools.length === 0) {
      warnings.push(
        'No tools specified - skill will have access to all available tools',
      );
    }

    // Check for duplicates
    const uniqueTools = new Set(tools);
    if (uniqueTools.size !== tools.length) {
      warnings.push('Tools list contains duplicates');
    }

    // Validate tool names
    for (const tool of tools) {
      if (typeof tool !== 'string' || tool.trim().length === 0) {
        errors.push('All tool names must be non-empty strings');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates model configuration.
   *
   * @param modelConfig - Model configuration to validate
   * @returns ValidationResult
   */
  validateModelConfig(modelConfig: SkillModelConfig): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate temperature
    if (modelConfig.temp !== undefined) {
      if (
        typeof modelConfig.temp !== 'number' ||
        modelConfig.temp < 0 ||
        modelConfig.temp > 1
      ) {
        errors.push('Temperature must be a number between 0 and 1');
      }
    }

    // Validate top_p
    if (modelConfig.top_p !== undefined) {
      if (
        typeof modelConfig.top_p !== 'number' ||
        modelConfig.top_p < 0 ||
        modelConfig.top_p > 1
      ) {
        errors.push('top_p must be a number between 0 and 1');
      }
    }

    // Validate max_tokens
    if (modelConfig.max_tokens !== undefined) {
      if (
        typeof modelConfig.max_tokens !== 'number' ||
        modelConfig.max_tokens < 1
      ) {
        errors.push('max_tokens must be a positive number');
      } else if (modelConfig.max_tokens > 32000) {
        warnings.push(
          'max_tokens is very large (>32000), this may exceed model limits',
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates output configuration.
   *
   * @param outputConfig - Output configuration to validate
   * @returns ValidationResult
   */
  validateOutputConfig(outputConfig: SkillOutputConfig): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate format
    const validFormats = ['text', 'structured', 'markdown'];
    if (!validFormats.includes(outputConfig.format)) {
      errors.push(
        `Invalid output format: ${outputConfig.format}. Must be one of: ${validFormats.join(', ')}`,
      );
    }

    // Validate schema if format is structured
    if (outputConfig.format === 'structured') {
      if (!outputConfig.schema) {
        warnings.push(
          'Structured output format specified but no schema provided',
        );
      } else if (typeof outputConfig.schema !== 'object') {
        errors.push('Output schema must be an object (JSON Schema)');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates a configuration and throws an error if invalid.
   *
   * @param config - Configuration to validate
   * @throws SkillError if validation fails
   */
  validateOrThrow(config: SkillConfig): void {
    const result = this.validateConfig(config);

    if (!result.isValid) {
      throw new SkillError(
        `Skill configuration validation failed: ${result.errors.join('; ')}`,
        SkillErrorCode.VALIDATION_ERROR,
        config.name,
      );
    }

    // Log warnings
    if (result.warnings.length > 0) {
      console.warn(
        `Skill "${config.name}" validation warnings:`,
        result.warnings,
      );
    }
  }
}
