/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type {
  ToolResult,
} from './tools.js';
import type { Config } from '../config/config.js';
import type { SkillManager } from '../skills/skill-manager.js';
import type { SkillConfig } from '../skills/types.js';
import { SkillExecutor } from '../skills/skill-executor.js';

export interface SkillToolParams {
  skill_name: string;
  parameters: Record<string, unknown>;
}

/**
 * Skill tool that enables agents to invoke reusable skills for focused tasks.
 * The tool dynamically loads available skills and includes them in its description
 * for the model to choose from.
 */
export class SkillTool extends BaseDeclarativeTool<SkillToolParams, ToolResult> {
  static readonly Name: string = 'use_skill';

  private skillManager: SkillManager;
  private availableSkills: SkillConfig[] = [];

  constructor(private readonly config: Config) {
    // Initialize with a basic schema first
    const initialSchema = {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          description: 'The name of the skill to execute',
        },
        parameters: {
          type: 'object',
          description: 'Input parameters for the skill',
        },
      },
      required: ['skill_name', 'parameters'],
      additionalProperties: false,
      $schema: 'http://json-schema.org/draft-07/schema#',
    };

    super(
      SkillTool.Name,
      'Skill',
      'Execute reusable skills. Loading available skills...', // Initial description
      Kind.Other,
      initialSchema,
      true, // isOutputMarkdown
      false, // Skills don't need progressive updates
    );

    this.skillManager = config.getSkillManager();
    this.skillManager.addChangeListener(() => {
      void this.refreshSkills();
    });

    // Initialize the tool asynchronously
    this.refreshSkills();
  }

  /**
   * Asynchronously initializes the tool by loading available skills
   * and updating the description and schema.
   */
  async refreshSkills(): Promise<void> {
    try {
      this.availableSkills = await this.skillManager.listSkills();
      this.updateDescriptionAndSchema();
    } catch (error) {
      console.warn('Failed to load skills for Skill tool:', error);
      this.availableSkills = [];
      this.updateDescriptionAndSchema();
    } finally {
      // Update the client with the new tools
      const geminiClient = this.config.getGeminiClient();
      if (geminiClient && geminiClient.isInitialized()) {
        await geminiClient.setTools();
      }
    }
  }

  /**
   * Updates the tool's description and schema based on available skills.
   */
  private updateDescriptionAndSchema(): void {
    let skillDescriptions = '';
    if (this.availableSkills.length === 0) {
      skillDescriptions =
        'No skills are currently configured. You can create skills using the /skills command.';
    } else {
      // Group skills by category
      const skillsByCategory = new Map<string, SkillConfig[]>();
      for (const skill of this.availableSkills) {
        const category = skill.category || 'other';
        if (!skillsByCategory.has(category)) {
          skillsByCategory.set(category, []);
        }
        skillsByCategory.get(category)!.push(skill);
      }

      const categoryDescriptions: string[] = [];
      for (const [category, skills] of skillsByCategory.entries()) {
        const skillList = skills
          .map((skill) => {
            const params = skill.parameters
              .map((p) => `${p.name}${p.required ? '*' : ''}`)
              .join(', ');
            return `  - **${skill.name}** (${params}): ${skill.description}`;
          })
          .join('\n');
        categoryDescriptions.push(`\n**${category}**:\n${skillList}`);
      }
      skillDescriptions = categoryDescriptions.join('\n');
    }

    const baseDescription = `Execute reusable skills for focused, single-purpose tasks.

Available skills:
${skillDescriptions}

When to use skills:
- For focused, single-purpose tasks (code analysis, test generation, etc.)
- When you need structured output (JSON, specific format)
- For tasks that don't require multi-turn interaction
- To leverage optimized prompts for specific use cases

When NOT to use skills:
- For complex, multi-step tasks requiring multiple tool calls (use Task tool with agents instead)
- For exploratory work requiring back-and-forth interaction
- When the task doesn't match any available skill

Usage notes:
1. Skills execute in a single turn and return immediately
2. Provide all required parameters in the "parameters" object
3. Skills are optimized for local models (efficient, focused prompts)
4. Check parameter requirements (marked with * for required)

Example usage:

<example>
user: "Analyze this file for performance issues"
assistant: I'll use the code-analysis skill to analyze the file
assistant: Uses the use_skill tool with:
{
  "skill_name": "code-analysis",
  "parameters": {
    "file_path": "/path/to/file.ts",
    "focus": "performance"
  }
}
</example>

<example>
user: "Generate tests for this module"
assistant: I'll use the test-generator skill
assistant: Uses the use_skill tool with:
{
  "skill_name": "test-generator",
  "parameters": {
    "target_path": "/path/to/module.ts",
    "framework": "vitest",
    "coverage_target": 80
  }
}
</example>
`;

    // Update description
    (this as { description: string }).description = baseDescription;

    // Generate dynamic schema with enum of available skill names
    const skillNames = this.availableSkills.map((s) => s.name);

    // Update the parameter schema
    const schema = this.parameterSchema as {
      properties?: {
        skill_name?: {
          enum?: string[];
        };
      };
    };
    if (schema.properties && schema.properties.skill_name) {
      if (skillNames.length > 0) {
        schema.properties.skill_name.enum = skillNames;
      } else {
        delete schema.properties.skill_name.enum;
      }
    }
  }

  override validateToolParams(params: SkillToolParams): string | null {
    // Validate required fields
    if (
      !params.skill_name ||
      typeof params.skill_name !== 'string' ||
      params.skill_name.trim() === ''
    ) {
      return 'Parameter "skill_name" must be a non-empty string.';
    }

    if (!params.parameters || typeof params.parameters !== 'object') {
      return 'Parameter "parameters" must be an object.';
    }

    // Validate that the skill exists
    const skillExists = this.availableSkills.some(
      (skill) => skill.name === params.skill_name,
    );

    if (!skillExists) {
      const availableNames = this.availableSkills.map((s) => s.name);
      return `Skill "${params.skill_name}" not found. Available skills: ${availableNames.join(', ')}`;
    }

    return null;
  }

  protected createInvocation(params: SkillToolParams) {
    return new SkillToolInvocation(this.config, this.skillManager, params);
  }
}

class SkillToolInvocation extends BaseToolInvocation<SkillToolParams, ToolResult> {
  constructor(
    private readonly config: Config,
    private readonly skillManager: SkillManager,
    params: SkillToolParams,
  ) {
    super(params);
  }

  getDescription(): string {
    return `Execute skill "${this.params.skill_name}"`;
  }

  override async shouldConfirmExecute(): Promise<false> {
    // Skills should execute automatically without user confirmation
    return false;
  }

  async execute(signal?: AbortSignal): Promise<ToolResult> {
    try {
      // Load the skill configuration
      const skillConfig = await this.skillManager.loadSkill(
        this.params.skill_name,
      );

      if (!skillConfig) {
        return {
          llmContent: `Skill "${this.params.skill_name}" not found`,
          returnDisplay: `Skill "${this.params.skill_name}" not found`,
        };
      }

      // Create executor
      const executor = new SkillExecutor(this.config, skillConfig);

      // Execute the skill
      const result = await executor.execute(this.params.parameters, signal);

      // Format result for display
      const resultText =
        typeof result.output === 'string'
          ? result.output
          : JSON.stringify(result.output, null, 2);

      const displayText = `Skill "${this.params.skill_name}" executed ${result.success ? 'successfully' : 'with errors'}\n\n${resultText}${result.error ? `\n\nError: ${result.error}` : ''}`;

      return {
        llmContent:
          typeof result.output === 'string'
            ? [{ text: result.output }]
            : [{ text: JSON.stringify(result.output) }],
        returnDisplay: displayText,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[SkillTool] Error executing skill: ${errorMessage}`);

      return {
        llmContent: `Failed to execute skill: ${errorMessage}`,
        returnDisplay: `Failed to execute skill "${this.params.skill_name}": ${errorMessage}`,
      };
    }
  }
}
