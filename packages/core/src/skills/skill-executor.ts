/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FunctionDeclaration } from '@google/genai';
import type { Config } from '../config/config.js';
import type {
  SkillConfig,
  SkillResult,
  SkillExecutionMetadata,
} from './types.js';
import { SkillError, SkillErrorCode } from './types.js';
import { reportError } from '../utils/errorReporting.js';

/**
 * Executes skills in a lightweight, single-turn fashion.
 * Unlike SubAgentScope which supports multi-turn conversations,
 * SkillExecutor is optimized for focused, single-purpose tasks.
 *
 * Features:
 * - Single-turn model execution using content generator
 * - Parameter validation and substitution
 * - Optional tool access
 * - Output schema validation
 * - Structured or text-based outputs
 */
export class SkillExecutor {
  constructor(
    private readonly config: Config,
    private readonly skillConfig: SkillConfig,
  ) {}

  /**
   * Executes the skill with the provided parameters.
   *
   * @param params - Input parameters for the skill
   * @param signal - Optional abort signal for cancellation
   * @returns SkillResult containing the output
   */
  async execute(
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<SkillResult> {
    const startTime = new Date();

    try {
      // 1. Validate parameters
      this.validateParams(params);

      // 2. Build the prompt with parameter substitution
      const prompt = this.buildPrompt(params);

      // 3. Prepare model configuration
      const modelConfig = {
        model: this.skillConfig.model?.model || 'qwen3-coder',
        temp: this.skillConfig.model?.temp ?? 0.5,
        top_p: this.skillConfig.model?.top_p,
        max_tokens: this.skillConfig.model?.max_tokens ?? 2048,
      };

      // 4. Prepare tools (if specified)
      const toolDeclarations = this.prepareTools();

      // 5. Execute the skill (single-turn)
      const result = await this.executeSingleTurn(
        prompt,
        modelConfig,
        toolDeclarations,
        signal,
      );

      // 6. Validate output if schema provided
      if (
        this.skillConfig.output?.validateOutput &&
        this.skillConfig.output?.schema
      ) {
        this.validateOutput(result);
      }

      // 7. Build execution metadata
      const endTime = new Date();
      const metadata: SkillExecutionMetadata = {
        skillName: this.skillConfig.name,
        inputParams: params,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        model: modelConfig.model,
      };

      return {
        success: true,
        output: result,
        metadata,
      };
    } catch (error) {
      const endTime = new Date();
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await reportError(
        error,
        `Skill execution failed for "${this.skillConfig.name}"`,
      );

      return {
        success: false,
        output: '',
        error: errorMessage,
        metadata: {
          skillName: this.skillConfig.name,
          inputParams: params,
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
        },
      };
    }
  }

  /**
   * Validates that all required parameters are provided and valid.
   *
   * @param params - Parameters to validate
   * @throws SkillError if validation fails
   */
  private validateParams(params: Record<string, unknown>): void {
    for (const paramDef of this.skillConfig.parameters) {
      const value = params[paramDef.name];

      // Check required parameters
      if (paramDef.required && value === undefined) {
        throw new SkillError(
          `Required parameter "${paramDef.name}" is missing`,
          SkillErrorCode.PARAMETER_MISSING,
          this.skillConfig.name,
        );
      }

      // Use default value if not provided
      if (value === undefined && paramDef.default !== undefined) {
        params[paramDef.name] = paramDef.default;
        continue;
      }

      // Skip validation if value is undefined and not required
      if (value === undefined) {
        continue;
      }

      // Type validation
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== paramDef.type && paramDef.type !== 'object') {
        throw new SkillError(
          `Parameter "${paramDef.name}" has invalid type. Expected ${paramDef.type}, got ${actualType}`,
          SkillErrorCode.PARAMETER_INVALID,
          this.skillConfig.name,
        );
      }

      // Enum validation
      if (paramDef.enum && paramDef.enum.length > 0) {
        if (!paramDef.enum.includes(String(value))) {
          throw new SkillError(
            `Parameter "${paramDef.name}" must be one of: ${paramDef.enum.join(', ')}. Got: ${value}`,
            SkillErrorCode.PARAMETER_INVALID,
            this.skillConfig.name,
          );
        }
      }
    }
  }

  /**
   * Builds the prompt by substituting parameters into the system prompt.
   *
   * @param params - Input parameters
   * @returns Formatted prompt string
   */
  private buildPrompt(params: Record<string, unknown>): string {
    let prompt = this.skillConfig.systemPrompt;

    // Simple template substitution: ${param_name}
    for (const [key, value] of Object.entries(params)) {
      const valueStr = String(value);
      prompt = prompt.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), valueStr);
    }

    return prompt;
  }

  /**
   * Prepares tool declarations based on skill configuration.
   *
   * @returns Array of tool declarations or undefined if no tools specified
   */
  private prepareTools(): FunctionDeclaration[] | undefined {
    if (!this.skillConfig.tools || this.skillConfig.tools.length === 0) {
      return undefined;
    }

    // Get all available tools from the tool registry
    const toolRegistry = this.config.getToolRegistry();
    const allTools = toolRegistry.getAllTools();

    // Filter to only include tools specified in skill config
    const selectedTools = allTools.filter((tool) =>
      this.skillConfig.tools!.includes(tool.name),
    );

    // Convert to function declarations
    return selectedTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameterSchema,
    })) as FunctionDeclaration[];
  }

  /**
   * Executes a single-turn interaction with the model.
   *
   * @param prompt - The formatted prompt
   * @param modelConfig - Model configuration
   * @param tools - Optional tool declarations
   * @param signal - Optional abort signal
   * @returns Generated output
   */
  private async executeSingleTurn(
    prompt: string,
    modelConfig: Record<string, unknown>,
    tools: FunctionDeclaration[] | undefined,
    _signal?: AbortSignal,
  ): Promise<string | Record<string, unknown>> {
    const contentGenerator = this.config.getContentGenerator();

    // Build generation config
    const generationConfig = {
      temperature: (modelConfig['temperature'] as number) ?? 0.7,
      topP: (modelConfig['topP'] as number) ?? 1.0,
      maxOutputTokens: (modelConfig['maxTokens'] as number) ?? 2048,
    };

    // Build contents array (user message)
    const contents = [
      {
        role: 'user' as const,
        parts: [{ text: prompt }],
      },
    ];

    // Execute single-turn generation
    // Wrap tools in Tool object structure if provided
    const toolsConfig = tools ? [{ functionDeclarations: tools }] : undefined;
    const response = await contentGenerator.generateContent(
      {
        model: this.config.getModel(),
        contents,
        config: {
          ...generationConfig,
          tools: toolsConfig,
        },
      },
      'skill-execution',
    );

    // Extract text from response candidates
    const candidate = response.candidates?.[0];
    if (
      !candidate ||
      !candidate.content?.parts ||
      candidate.content.parts.length === 0
    ) {
      throw new SkillError(
        'Empty response from model',
        SkillErrorCode.EXECUTION_ERROR,
        this.skillConfig.name,
      );
    }

    const parts = candidate.content.parts;

    // If expecting structured output, try to parse JSON
    if (this.skillConfig.output?.schema) {
      const textPart = parts.find((part) => 'text' in part);
      if (textPart && 'text' in textPart) {
        try {
          return JSON.parse(textPart.text as string);
        } catch (_error) {
          // If JSON parsing fails, return the text
          return textPart.text as string;
        }
      }
    }

    // Otherwise return concatenated text
    return parts
      .filter((part) => 'text' in part)
      .map((part) => ('text' in part ? (part.text as string) : ''))
      .join('');
  }

  /**
   * Validates output against the schema if provided.
   *
   * @param output - Output to validate
   * @throws SkillError if validation fails
   */
  private validateOutput(output: string | Record<string, unknown>): void {
    // Basic validation - proper JSON Schema validation would require a library
    if (!this.skillConfig.output?.schema) {
      return;
    }

    if (typeof output !== 'object') {
      throw new SkillError(
        'Expected structured output but got text',
        SkillErrorCode.INVALID_OUTPUT,
        this.skillConfig.name,
      );
    }

    // Check required properties if schema has them
    const schema = this.skillConfig.output.schema;
    if (schema && schema['properties'] && schema['required']) {
      const outputObj = output as Record<string, unknown>;
      const required = schema['required'] as string[];
      for (const requiredProp of required) {
        if (!(requiredProp in outputObj)) {
          throw new SkillError(
            `Output missing required property: ${requiredProp}`,
            SkillErrorCode.INVALID_OUTPUT,
            this.skillConfig.name,
          );
        }
      }
    }
  }
}
