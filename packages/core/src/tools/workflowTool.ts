/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { ToolResult } from './tools.js';
import type { Config } from '../config/config.js';
import type { WorkflowManager } from '../workflows/workflow-manager.js';
import type { WorkflowConfig } from '../workflows/types.js';

export interface WorkflowToolParams {
  workflow_name: string;
  variables?: Record<string, unknown>;
}

/**
 * Workflow tool that enables agents to invoke multi-step workflows.
 * The tool dynamically loads available workflows and includes them in its description
 * for the model to choose from.
 */
export class WorkflowTool extends BaseDeclarativeTool<
  WorkflowToolParams,
  ToolResult
> {
  static readonly Name: string = 'run_workflow';

  private workflowManager: WorkflowManager;
  private availableWorkflows: WorkflowConfig[] = [];

  constructor(private readonly config: Config) {
    // Initialize with a basic schema first
    const initialSchema = {
      type: 'object',
      properties: {
        workflow_name: {
          type: 'string',
          description: 'The name of the workflow to execute',
        },
        variables: {
          type: 'object',
          description: 'Input variables for the workflow',
        },
      },
      required: ['workflow_name'],
      additionalProperties: false,
      $schema: 'http://json-schema.org/draft-07/schema#',
    };

    super(
      WorkflowTool.Name,
      'Workflow',
      'Execute multi-step workflows. Loading available workflows...', // Initial description
      Kind.Other,
      initialSchema,
      true, // isOutputMarkdown
      false, // Workflows don't need progressive updates
    );

    this.workflowManager = config.getWorkflowManager();

    // Initialize the tool asynchronously
    void this.refreshWorkflows();
  }

  /**
   * Asynchronously initializes the tool by loading available workflows
   * and updating the description and schema.
   */
  async refreshWorkflows(): Promise<void> {
    try {
      const workflows = await this.workflowManager.listWorkflows();
      this.availableWorkflows = [];

      // Load full configs for each workflow
      for (const workflow of workflows) {
        const config = await this.workflowManager.loadWorkflow(workflow.name);
        if (config) {
          this.availableWorkflows.push(config);
        }
      }

      this.updateDescriptionAndSchema();
    } catch (error) {
      console.warn('Failed to load workflows for Workflow tool:', error);
      this.availableWorkflows = [];
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
   * Updates the tool's description and schema based on available workflows.
   */
  private updateDescriptionAndSchema(): void {
    let workflowDescriptions = '';
    if (this.availableWorkflows.length === 0) {
      workflowDescriptions =
        'No workflows are currently configured. You can create workflows using workflow configuration files.';
    } else {
      // List workflows with descriptions
      const workflowList = this.availableWorkflows
        .map((workflow) => {
          const varNames = Object.keys(workflow.variables || {});
          const vars =
            varNames.length > 0 ? `(vars: ${varNames.join(', ')})` : '';
          return `  - **${workflow.name}** ${vars}: ${workflow.description}`;
        })
        .join('\n');
      workflowDescriptions = workflowList;
    }

    const baseDescription = `Execute multi-step workflows that coordinate multiple agents or tasks.

Available workflows:
${workflowDescriptions}

When to use workflows:
- For complex, multi-step tasks requiring orchestration
- When multiple agents need to work together (parallel or sequential)
- For repeatable processes with defined steps
- When you need to aggregate results from multiple sources

When NOT to use workflows:
- For simple, single-purpose tasks (use skills instead)
- For exploratory work (use agents directly)
- When the task doesn't match any available workflow

Workflow execution modes:
- **sequential**: Steps execute one after another
- **parallel**: Steps execute concurrently
- **conditional**: Steps execute based on conditions
- **map-reduce**: Parallel execution followed by aggregation

Usage notes:
1. Workflows can take input variables to customize execution
2. Workflows can invoke agents, skills, or other workflows
3. Results are aggregated and returned as a structured output
4. Workflow execution is asynchronous and can be long-running

Example usage:

<example>
user: "Perform a comprehensive code review of the changes"
assistant: I'll use the comprehensive-code-review workflow
assistant: Uses the run_workflow tool with:
{
  "workflow_name": "comprehensive-code-review",
  "variables": {
    "changed_files": ["src/file1.ts", "src/file2.ts"]
  }
}
</example>

<example>
user: "Run the testing pipeline"
assistant: I'll execute the testing-pipeline workflow
assistant: Uses the run_workflow tool with:
{
  "workflow_name": "testing-pipeline",
  "variables": {
    "target_branch": "main"
  }
}
</example>
`;

    // Update description
    (this as { description: string }).description = baseDescription;

    // Generate dynamic schema with enum of available workflow names
    const workflowNames = this.availableWorkflows.map((w) => w.name);

    // Update the parameter schema
    const schema = this.parameterSchema as {
      properties?: {
        workflow_name?: {
          enum?: string[];
        };
      };
    };
    if (schema.properties && schema.properties.workflow_name) {
      if (workflowNames.length > 0) {
        schema.properties.workflow_name.enum = workflowNames;
      } else {
        delete schema.properties.workflow_name.enum;
      }
    }
  }

  override validateToolParams(params: WorkflowToolParams): string | null {
    // Validate required fields
    if (
      !params.workflow_name ||
      typeof params.workflow_name !== 'string' ||
      params.workflow_name.trim() === ''
    ) {
      return 'Parameter "workflow_name" must be a non-empty string.';
    }

    if (params.variables && typeof params.variables !== 'object') {
      return 'Parameter "variables" must be an object if provided.';
    }

    // Validate that the workflow exists
    const workflowExists = this.availableWorkflows.some(
      (workflow) => workflow.name === params.workflow_name,
    );

    if (!workflowExists) {
      const availableNames = this.availableWorkflows.map((w) => w.name);
      return `Workflow "${params.workflow_name}" not found. Available workflows: ${availableNames.join(', ')}`;
    }

    return null;
  }

  protected createInvocation(params: WorkflowToolParams) {
    return new WorkflowToolInvocation(this.workflowManager, params);
  }
}

class WorkflowToolInvocation extends BaseToolInvocation<
  WorkflowToolParams,
  ToolResult
> {
  constructor(
    private readonly workflowManager: WorkflowManager,
    params: WorkflowToolParams,
  ) {
    super(params);
  }

  getDescription(): string {
    return `Execute workflow "${this.params.workflow_name}"`;
  }

  override async shouldConfirmExecute(): Promise<false> {
    // Workflows should execute automatically without user confirmation
    return false;
  }

  async execute(signal?: AbortSignal): Promise<ToolResult> {
    try {
      // Load the workflow configuration
      const workflowConfig = await this.workflowManager.loadWorkflow(
        this.params.workflow_name,
      );

      if (!workflowConfig) {
        return {
          llmContent: `Workflow "${this.params.workflow_name}" not found`,
          returnDisplay: `Workflow "${this.params.workflow_name}" not found`,
        };
      }

      // Merge provided variables with workflow defaults
      const variables = {
        ...(workflowConfig.variables || {}),
        ...(this.params.variables || {}),
      };

      // Execute the workflow
      const result = await this.workflowManager.executeWorkflow(
        this.params.workflow_name,
        variables,
        signal,
      );

      // Format result for display
      const stepResults = result.stepResults
        .map(
          (step, index) =>
            `Step ${index + 1} (${step.stepId}): ${step.status}\n${step.output}`,
        )
        .join('\n\n');

      const displayText = `Workflow "${this.params.workflow_name}" completed with status: ${result.status}\n\nResults:\n${stepResults}${result.error ? `\n\nError: ${result.error}` : ''}`;

      return {
        llmContent: [{ text: displayText }],
        returnDisplay: displayText,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[WorkflowTool] Error executing workflow: ${errorMessage}`);

      return {
        llmContent: `Failed to execute workflow: ${errorMessage}`,
        returnDisplay: `Failed to execute workflow "${this.params.workflow_name}": ${errorMessage}`,
      };
    }
  }
}
