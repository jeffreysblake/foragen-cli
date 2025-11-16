/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Types for multi-agent workflow orchestration.
 * Enables coordinated execution of multiple agents with dependencies and data flow.
 */

/**
 * Workflow execution modes
 */
export type WorkflowExecutionMode = 'sequential' | 'parallel' | 'conditional';

/**
 * Workflow step status
 */
export type WorkflowStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * A single step in a workflow
 */
export interface WorkflowStep {
  /** Unique identifier for this step */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this step does */
  description?: string;

  /** Agent to execute for this step */
  agent: string;

  /** Task prompt for the agent */
  task: string;

  /** Dependencies - step IDs that must complete before this step */
  dependsOn?: string[];

  /** Variables to extract from this step's output */
  outputs?: Array<{
    /** Variable name to store */
    name: string;
    /** JSONPath or regex to extract value */
    extractor: string;
  }>;

  /** Condition to determine if this step should run */
  condition?: {
    /** Type of condition check */
    type: 'success' | 'failure' | 'output_matches' | 'variable_equals';
    /** Step ID to check */
    stepId?: string;
    /** Pattern to match against */
    pattern?: string;
    /** Variable to check */
    variable?: string;
    /** Expected value */
    value?: unknown;
  };

  /** Maximum time this step can run (minutes) */
  timeout?: number;

  /** Number of retries on failure */
  retries?: number;
}

/**
 * Complete workflow configuration
 */
export interface WorkflowConfig {
  /** Workflow name */
  name: string;

  /** Description */
  description: string;

  /** Version */
  version: string;

  /** Author */
  author?: string;

  /** Tags for categorization */
  tags?: string[];

  /** Execution mode */
  mode: WorkflowExecutionMode;

  /** Initial variables */
  variables?: Record<string, unknown>;

  /** Workflow steps */
  steps: WorkflowStep[];

  /** Maximum total execution time (minutes) */
  maxTotalTime?: number;

  /** Whether to continue on step failure */
  continueOnError?: boolean;
}

/**
 * Result of a workflow step execution
 */
export interface WorkflowStepResult {
  /** Step ID */
  stepId: string;

  /** Status */
  status: WorkflowStepStatus;

  /** Output from the agent */
  output: string;

  /** Extracted variables */
  extractedVariables?: Record<string, unknown>;

  /** Error message if failed */
  error?: string;

  /** Start time */
  startTime: Date;

  /** End time */
  endTime: Date;

  /** Duration in milliseconds */
  duration: number;

  /** Agent name used */
  agent: string;
}

/**
 * Complete workflow execution result
 */
export interface WorkflowResult {
  /** Workflow name */
  workflowName: string;

  /** Overall status */
  status: 'completed' | 'failed' | 'partial' | 'cancelled';

  /** Results for each step */
  stepResults: WorkflowStepResult[];

  /** Final variables state */
  variables: Record<string, unknown>;

  /** Total execution time */
  totalDuration: number;

  /** Start time */
  startTime: Date;

  /** End time */
  endTime: Date;

  /** Error if workflow failed */
  error?: string;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  /** Current variables */
  variables: Record<string, unknown>;

  /** Results of completed steps */
  completedSteps: Map<string, WorkflowStepResult>;

  /** Execution start time */
  startTime: Date;

  /** Abort signal */
  signal?: AbortSignal;
}

/**
 * Event types for workflow execution
 */
export enum WorkflowEventType {
  WORKFLOW_START = 'workflow_start',
  WORKFLOW_END = 'workflow_end',
  STEP_START = 'step_start',
  STEP_END = 'step_end',
  STEP_SKIP = 'step_skip',
  VARIABLE_UPDATE = 'variable_update',
}

/**
 * Base workflow event
 */
export interface WorkflowEvent {
  type: WorkflowEventType;
  timestamp: Date;
  workflowName: string;
}

/**
 * Workflow start event
 */
export interface WorkflowStartEvent extends WorkflowEvent {
  type: WorkflowEventType.WORKFLOW_START;
  totalSteps: number;
  mode: WorkflowExecutionMode;
}

/**
 * Workflow end event
 */
export interface WorkflowEndEvent extends WorkflowEvent {
  type: WorkflowEventType.WORKFLOW_END;
  status: WorkflowResult['status'];
  duration: number;
  successfulSteps: number;
  failedSteps: number;
}

/**
 * Step start event
 */
export interface WorkflowStepStartEvent extends WorkflowEvent {
  type: WorkflowEventType.STEP_START;
  stepId: string;
  stepName: string;
  agent: string;
}

/**
 * Step end event
 */
export interface WorkflowStepEndEvent extends WorkflowEvent {
  type: WorkflowEventType.STEP_END;
  stepId: string;
  stepName: string;
  status: WorkflowStepStatus;
  duration: number;
}

/**
 * Step skip event
 */
export interface WorkflowStepSkipEvent extends WorkflowEvent {
  type: WorkflowEventType.STEP_SKIP;
  stepId: string;
  stepName: string;
  reason: string;
}

/**
 * Variable update event
 */
export interface WorkflowVariableUpdateEvent extends WorkflowEvent {
  type: WorkflowEventType.VARIABLE_UPDATE;
  variableName: string;
  value: unknown;
  stepId?: string;
}

/**
 * Union of all workflow events
 */
export type WorkflowEventUnion =
  | WorkflowStartEvent
  | WorkflowEndEvent
  | WorkflowStepStartEvent
  | WorkflowStepEndEvent
  | WorkflowStepSkipEvent
  | WorkflowVariableUpdateEvent;

/**
 * Workflow event listener
 */
export type WorkflowEventListener = (event: WorkflowEventUnion) => void;

/**
 * Workflow storage level (same pattern as skills/agents)
 */
export type WorkflowLevel = 'builtin' | 'user' | 'project';

/**
 * Error codes for workflow operations
 */
export const WorkflowErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  INVALID_CONFIG: 'INVALID_CONFIG',
  STEP_FAILED: 'STEP_FAILED',
  DEPENDENCY_FAILED: 'DEPENDENCY_FAILED',
  TIMEOUT: 'TIMEOUT',
  CANCELLED: 'CANCELLED',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
} as const;

export type WorkflowErrorCode =
  (typeof WorkflowErrorCode)[keyof typeof WorkflowErrorCode];

/**
 * Workflow error
 */
export class WorkflowError extends Error {
  constructor(
    message: string,
    readonly code: WorkflowErrorCode,
    readonly workflowName?: string,
    readonly stepId?: string,
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}
