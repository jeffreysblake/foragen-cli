/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CommandKind,
  type SlashCommand,
  type OpenDialogActionReturn,
} from './types.js';

/**
 * /workflow command for managing multi-agent workflows.
 *
 * TODO: Implement dialog components for:
 * - workflow_list: Display all available workflows (builtin/user/project)
 * - workflow_create: Guided workflow creation wizard
 * - workflow_edit: Edit existing workflow configuration
 * - workflow_execute: Execute a workflow with parameters
 * - workflow_status: View running workflow status
 */
export const workflowCommand: SlashCommand = {
  name: 'workflow',
  description: 'Manage and execute multi-agent workflows.',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'list',
      description: 'List all available workflows (builtin, user, project).',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'workflow_list',
      }),
    },
    {
      name: 'create',
      description: 'Create a new workflow with guided setup.',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'workflow_create',
      }),
    },
    {
      name: 'edit',
      description: 'Edit an existing workflow configuration.',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'workflow_edit',
      }),
    },
    {
      name: 'execute',
      description: 'Execute a workflow with specified parameters.',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'workflow_execute',
      }),
    },
    {
      name: 'status',
      description: 'View status of running workflows.',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'workflow_status',
      }),
    },
  ],
};
