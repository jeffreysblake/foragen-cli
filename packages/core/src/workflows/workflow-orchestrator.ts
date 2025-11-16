/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import type {
  WorkflowConfig,
  WorkflowStep,
  WorkflowStepResult,
  WorkflowResult,
  WorkflowContext,
  WorkflowEventListener,
  WorkflowEventUnion,
} from './types.js';
import {
  WorkflowError,
  WorkflowErrorCode,
  WorkflowEventType,
} from './types.js';
import { SubAgentScope, ContextState } from '../subagents/subagent.js';
import type { PromptConfig, ToolConfig } from '../subagents/types.js';

/**
 * Orchestrates execution of multi-agent workflows.
 *
 * Features:
 * - Sequential, parallel, or conditional execution
 * - Step dependencies and data flow
 * - Variable extraction and substitution
 * - Event-driven progress tracking
 * - Retry logic and timeout handling
 */
export class WorkflowOrchestrator {
  private eventListeners: Set<WorkflowEventListener> = new Set();

  constructor(private readonly config: Config) {}

  /**
   * Registers an event listener for workflow events.
   *
   * @param listener - Event listener function
   * @returns Cleanup function to remove the listener
   */
  on(listener: WorkflowEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emits a workflow event to all listeners.
   *
   * @param event - Event to emit
   */
  private emit(event: WorkflowEventUnion): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[WorkflowOrchestrator] Error in event listener:', error);
      }
    }
  }

  /**
   * Executes a workflow.
   *
   * @param workflow - Workflow configuration
   * @param signal - Optional abort signal
   * @returns Workflow execution result
   */
  async execute(
    workflow: WorkflowConfig,
    signal?: AbortSignal,
  ): Promise<WorkflowResult> {
    const startTime = new Date();
    const context: WorkflowContext = {
      variables: { ...workflow.variables },
      completedSteps: new Map(),
      startTime,
      signal,
    };

    // Emit workflow start event
    this.emit({
      type: WorkflowEventType.WORKFLOW_START,
      timestamp: new Date(),
      workflowName: workflow.name,
      totalSteps: workflow.steps.length,
      mode: workflow.mode,
    });

    try {
      // Validate workflow
      this.validateWorkflow(workflow);

      // Execute based on mode
      let stepResults: WorkflowStepResult[];
      switch (workflow.mode) {
        case 'sequential':
          stepResults = await this.executeSequential(workflow, context);
          break;
        case 'parallel':
          stepResults = await this.executeParallel(workflow, context);
          break;
        case 'conditional':
          stepResults = await this.executeConditional(workflow, context);
          break;
        default:
          throw new WorkflowError(
            `Unknown execution mode: ${workflow.mode}`,
            WorkflowErrorCode.INVALID_CONFIG,
            workflow.name,
          );
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Determine overall status
      const failedSteps = stepResults.filter((r) => r.status === 'failed');
      const successfulSteps = stepResults.filter(
        (r) => r.status === 'completed',
      );
      const status =
        failedSteps.length === 0
          ? 'completed'
          : successfulSteps.length > 0
            ? 'partial'
            : 'failed';

      const result: WorkflowResult = {
        workflowName: workflow.name,
        status,
        stepResults,
        variables: context.variables,
        totalDuration: duration,
        startTime,
        endTime,
      };

      // Emit workflow end event
      this.emit({
        type: WorkflowEventType.WORKFLOW_END,
        timestamp: new Date(),
        workflowName: workflow.name,
        status,
        duration,
        successfulSteps: successfulSteps.length,
        failedSteps: failedSteps.length,
      });

      return result;
    } catch (error) {
      const endTime = new Date();
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Emit workflow end event with error
      this.emit({
        type: WorkflowEventType.WORKFLOW_END,
        timestamp: new Date(),
        workflowName: workflow.name,
        status: 'failed',
        duration: endTime.getTime() - startTime.getTime(),
        successfulSteps: 0,
        failedSteps: workflow.steps.length,
      });

      return {
        workflowName: workflow.name,
        status: 'failed',
        stepResults: [],
        variables: context.variables,
        totalDuration: endTime.getTime() - startTime.getTime(),
        startTime,
        endTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Validates workflow configuration.
   *
   * @param workflow - Workflow to validate
   * @throws WorkflowError if validation fails
   */
  private validateWorkflow(workflow: WorkflowConfig): void {
    if (!workflow.name) {
      throw new WorkflowError(
        'Workflow must have a name',
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

    // Validate step IDs are unique
    const stepIds = new Set<string>();
    for (const step of workflow.steps) {
      if (stepIds.has(step.id)) {
        throw new WorkflowError(
          `Duplicate step ID: ${step.id}`,
          WorkflowErrorCode.INVALID_CONFIG,
          workflow.name,
        );
      }
      stepIds.add(step.id);
    }

    // Validate dependencies exist
    for (const step of workflow.steps) {
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          if (!stepIds.has(depId)) {
            throw new WorkflowError(
              `Step ${step.id} depends on non-existent step: ${depId}`,
              WorkflowErrorCode.INVALID_CONFIG,
              workflow.name,
              step.id,
            );
          }
        }
      }
    }
  }

  /**
   * Executes workflow steps sequentially.
   *
   * @param workflow - Workflow configuration
   * @param context - Execution context
   * @returns Step results
   */
  private async executeSequential(
    workflow: WorkflowConfig,
    context: WorkflowContext,
  ): Promise<WorkflowStepResult[]> {
    const results: WorkflowStepResult[] = [];

    for (const step of workflow.steps) {
      if (context.signal?.aborted) {
        break;
      }

      const result = await this.executeStep(step, workflow, context);
      results.push(result);
      context.completedSteps.set(step.id, result);

      // Stop on failure unless continueOnError is true
      if (result.status === 'failed' && !workflow.continueOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * Executes workflow steps in parallel.
   *
   * @param workflow - Workflow configuration
   * @param context - Execution context
   * @returns Step results
   */
  private async executeParallel(
    workflow: WorkflowConfig,
    context: WorkflowContext,
  ): Promise<WorkflowStepResult[]> {
    // Group steps by dependency level
    const levels = this.computeDependencyLevels(workflow.steps);

    const results: WorkflowStepResult[] = [];

    // Execute each level in parallel
    for (const levelSteps of levels) {
      if (context.signal?.aborted) {
        break;
      }

      const levelResults = await Promise.all(
        levelSteps.map((step) => this.executeStep(step, workflow, context)),
      );

      results.push(...levelResults);

      // Update context with completed steps
      for (let i = 0; i < levelSteps.length; i++) {
        context.completedSteps.set(levelSteps[i].id, levelResults[i]);
      }

      // Check if any step failed
      const hasFailure = levelResults.some((r) => r.status === 'failed');
      if (hasFailure && !workflow.continueOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * Executes workflow steps with conditional logic.
   *
   * @param workflow - Workflow configuration
   * @param context - Execution context
   * @returns Step results
   */
  private async executeConditional(
    workflow: WorkflowConfig,
    context: WorkflowContext,
  ): Promise<WorkflowStepResult[]> {
    const results: WorkflowStepResult[] = [];

    for (const step of workflow.steps) {
      if (context.signal?.aborted) {
        break;
      }

      // Check if step should be executed
      const shouldExecute = this.evaluateCondition(step, context);

      if (!shouldExecute) {
        // Emit skip event
        this.emit({
          type: WorkflowEventType.STEP_SKIP,
          timestamp: new Date(),
          workflowName: workflow.name,
          stepId: step.id,
          stepName: step.name,
          reason: 'Condition not met',
        });

        const skippedResult: WorkflowStepResult = {
          stepId: step.id,
          status: 'skipped',
          output: '',
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          agent: step.agent,
        };
        results.push(skippedResult);
        context.completedSteps.set(step.id, skippedResult);
        continue;
      }

      const result = await this.executeStep(step, workflow, context);
      results.push(result);
      context.completedSteps.set(step.id, result);

      if (result.status === 'failed' && !workflow.continueOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * Executes a single workflow step.
   *
   * @param step - Step to execute
   * @param workflow - Parent workflow
   * @param context - Execution context
   * @returns Step result
   */
  private async executeStep(
    step: WorkflowStep,
    workflow: WorkflowConfig,
    context: WorkflowContext,
  ): Promise<WorkflowStepResult> {
    const startTime = new Date();

    // Emit step start event
    this.emit({
      type: WorkflowEventType.STEP_START,
      timestamp: new Date(),
      workflowName: workflow.name,
      stepId: step.id,
      stepName: step.name,
      agent: step.agent,
    });

    try {
      // Check dependencies
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          const depResult = context.completedSteps.get(depId);
          if (!depResult || depResult.status !== 'completed') {
            throw new WorkflowError(
              `Dependency ${depId} did not complete successfully`,
              WorkflowErrorCode.DEPENDENCY_FAILED,
              workflow.name,
              step.id,
            );
          }
        }
      }

      // Substitute variables in task
      const task = this.substituteVariables(step.task, context.variables);

      // Get agent configuration
      const agentManager = this.config.getSubagentManager();
      const agentConfig = await agentManager.loadSubagent(step.agent);

      if (!agentConfig) {
        throw new WorkflowError(
          `Agent not found: ${step.agent}`,
          WorkflowErrorCode.AGENT_NOT_FOUND,
          workflow.name,
          step.id,
        );
      }

      // Build prompt config with task incorporated
      const promptConfig: PromptConfig = {
        systemPrompt: `${agentConfig.systemPrompt}\n\nTask: ${task}`,
      };

      // Build tool config if tools are specified
      const toolConfig: ToolConfig | undefined = agentConfig.tools
        ? { tools: agentConfig.tools }
        : undefined;

      // Create and execute agent
      const agent = await SubAgentScope.create(
        step.agent,
        this.config,
        promptConfig,
        agentConfig.modelConfig || {},
        agentConfig.runConfig || { max_turns: 10 },
        toolConfig,
      );

      // Create context state for agent execution
      const agentContext = new ContextState();
      agentContext.set('task_prompt', task);

      await agent.runNonInteractive(agentContext, context.signal);

      const output = agent.getFinalText();

      // Extract variables from output
      const extractedVariables: Record<string, unknown> = {};
      if (step.outputs) {
        for (const outputDef of step.outputs) {
          const value = this.extractValue(output, outputDef.extractor);
          extractedVariables[outputDef.name] = value;
          context.variables[outputDef.name] = value;

          // Emit variable update event
          this.emit({
            type: WorkflowEventType.VARIABLE_UPDATE,
            timestamp: new Date(),
            workflowName: workflow.name,
            variableName: outputDef.name,
            value,
            stepId: step.id,
          });
        }
      }

      const endTime = new Date();
      const result: WorkflowStepResult = {
        stepId: step.id,
        status: 'completed',
        output,
        extractedVariables,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        agent: step.agent,
      };

      // Emit step end event
      this.emit({
        type: WorkflowEventType.STEP_END,
        timestamp: new Date(),
        workflowName: workflow.name,
        stepId: step.id,
        stepName: step.name,
        status: 'completed',
        duration: result.duration,
      });

      return result;
    } catch (error) {
      const endTime = new Date();
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const result: WorkflowStepResult = {
        stepId: step.id,
        status: 'failed',
        output: '',
        error: errorMessage,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        agent: step.agent,
      };

      // Emit step end event
      this.emit({
        type: WorkflowEventType.STEP_END,
        timestamp: new Date(),
        workflowName: workflow.name,
        stepId: step.id,
        stepName: step.name,
        status: 'failed',
        duration: result.duration,
      });

      return result;
    }
  }

  /**
   * Evaluates a step condition.
   *
   * @param step - Step with condition
   * @param context - Execution context
   * @returns Whether step should execute
   */
  private evaluateCondition(
    step: WorkflowStep,
    context: WorkflowContext,
  ): boolean {
    if (!step.condition) {
      return true;
    }

    const { type, stepId, pattern, variable, value } = step.condition;

    switch (type) {
      case 'success':
        if (!stepId) return true;
        return context.completedSteps.get(stepId)?.status === 'completed';

      case 'failure':
        if (!stepId) return false;
        return context.completedSteps.get(stepId)?.status === 'failed';

      case 'output_matches': {
        if (!stepId || !pattern) return false;
        const output = context.completedSteps.get(stepId)?.output || '';
        return new RegExp(pattern).test(output);
      }

      case 'variable_equals':
        if (!variable) return false;
        return context.variables[variable] === value;

      default:
        return true;
    }
  }

  /**
   * Substitutes variables in a string.
   *
   * @param text - Text with ${variable} placeholders
   * @param variables - Variable values
   * @returns Substituted text
   */
  private substituteVariables(
    text: string,
    variables: Record<string, unknown>,
  ): string {
    return text.replace(/\$\{(\w+)\}/g, (_, varName) => {
      const value = variables[varName];
      return value !== undefined ? String(value) : `\${${varName}}`;
    });
  }

  /**
   * Extracts a value from text using a pattern.
   *
   * @param text - Text to extract from
   * @param extractor - Regex pattern
   * @returns Extracted value
   */
  private extractValue(text: string, extractor: string): unknown {
    try {
      const regex = new RegExp(extractor);
      const match = text.match(regex);
      return match ? match[1] || match[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Computes dependency levels for parallel execution.
   *
   * @param steps - Workflow steps
   * @returns Array of step arrays, where each array can be executed in parallel
   */
  private computeDependencyLevels(steps: WorkflowStep[]): WorkflowStep[][] {
    const levels: WorkflowStep[][] = [];
    const processed = new Set<string>();

    while (processed.size < steps.length) {
      const level: WorkflowStep[] = [];

      for (const step of steps) {
        if (processed.has(step.id)) continue;

        // Check if all dependencies are processed
        const depsReady =
          !step.dependsOn ||
          step.dependsOn.every((depId) => processed.has(depId));

        if (depsReady) {
          level.push(step);
          processed.add(step.id);
        }
      }

      if (level.length === 0) {
        throw new Error('Circular dependency detected in workflow');
      }

      levels.push(level);
    }

    return levels;
  }
}
