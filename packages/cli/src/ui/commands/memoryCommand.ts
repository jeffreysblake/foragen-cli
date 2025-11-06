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
 * /memory command for enhanced memory management with search and analytics.
 *
 * TODO: Implement dialog components for:
 * - memory_search: Search memories with filters (tags, type, scope, confidence)
 * - memory_analytics: View memory usage statistics and insights
 * - memory_cleanup: Deduplicate and cleanup old memories
 * - memory_export: Export memories in various formats
 */
export const memoryCommand: SlashCommand = {
  name: 'memory',
  description: 'Manage enhanced memories with search and analytics.',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'search',
      description: 'Search memories with advanced filters.',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'memory_search',
      }),
    },
    {
      name: 'analytics',
      description: 'View memory usage statistics and insights.',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'memory_analytics',
      }),
    },
    {
      name: 'cleanup',
      description: 'Deduplicate and cleanup old memories.',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'memory_cleanup',
      }),
    },
    {
      name: 'export',
      description: 'Export memories in various formats (JSON, MD, CSV).',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'memory_export',
      }),
    },
  ],
};
