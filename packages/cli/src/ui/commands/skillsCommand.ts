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
 * /skills command for managing skills (list, create, edit, delete).
 *
 * TODO: Implement dialog components for:
 * - skill_list: Display all available skills (builtin/user/project)
 * - skill_create: Guided skill creation wizard
 * - skill_edit: Edit existing skill configuration
 * - skill_execute: Execute a skill with parameters
 */
export const skillsCommand: SlashCommand = {
  name: 'skills',
  description: 'Manage reusable skills for focused AI tasks.',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'list',
      description: 'List all available skills (builtin, user, project).',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'skill_list',
      }),
    },
    {
      name: 'create',
      description: 'Create a new skill with guided setup.',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'skill_create',
      }),
    },
    {
      name: 'edit',
      description: 'Edit an existing skill configuration.',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'skill_edit',
      }),
    },
    {
      name: 'execute',
      description: 'Execute a skill with specified parameters.',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'skill_execute',
      }),
    },
  ],
};
