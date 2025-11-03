/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SlashCommand,
  CommandContext,
  OpenDialogActionReturn,
  MessageActionReturn,
} from './types.js';
import { CommandKind } from './types.js';
import {
  getAvailableModelsForAuthType,
  getAvailableModelsForAuthTypeAsync,
  clearLocalModelCache,
  type AvailableModel,
} from '../models/availableModels.js';
import {
  AuthType,
  ModelSlashCommandEvent,
  logModelSlashCommand,
} from '@jeffreysblake/foragen-cli-core';
import { AsyncFzf } from 'fzf';
import { loadSettings, SettingScope } from '../../config/settings.js';

export const modelCommand: SlashCommand = {
  name: 'model',
  description:
    'Switch the model for this session. Use /model refresh to clear cache.',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
  ): Promise<OpenDialogActionReturn | MessageActionReturn> => {
    const { services, invocation } = context;
    const { config } = services;

    // Handle refresh subcommand
    const args = invocation?.args?.trim();
    if (args?.toLowerCase() === 'refresh') {
      clearLocalModelCache();
      return {
        type: 'message',
        messageType: 'info',
        content: 'Model cache cleared. Run /model again to fetch fresh models.',
      };
    }

    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Configuration not available.',
      };
    }

    const contentGeneratorConfig = config.getContentGeneratorConfig();
    if (!contentGeneratorConfig) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Content generator configuration not available.',
      };
    }

    const authType = contentGeneratorConfig.authType;
    if (!authType) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Authentication type not available.',
      };
    }

    // For LOCAL auth type, use async model fetching
    let availableModels: AvailableModel[];
    if (authType === AuthType.LOCAL) {
      try {
        availableModels = await getAvailableModelsForAuthTypeAsync(authType);
      } catch (error) {
        return {
          type: 'message',
          messageType: 'error',
          content: `Failed to fetch models from local server: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    } else {
      availableModels = getAvailableModelsForAuthType(authType);
    }

    if (availableModels.length === 0) {
      return {
        type: 'message',
        messageType: 'error',
        content: `No models available for the current authentication type (${authType}). ${authType === AuthType.LOCAL ? 'Please check that your local model server is running and accessible.' : ''}`,
      };
    }

    // Handle direct model selection via argument
    if (args && args.toLowerCase() !== 'refresh') {
      const modelId = args;
      const model = availableModels.find((m) => m.id === modelId);

      if (model) {
        await config.setModel(modelId);
        const event = new ModelSlashCommandEvent(modelId);
        logModelSlashCommand(config, event);

        // Persist model selection to settings
        const settings = loadSettings();
        settings.setValue(SettingScope.User, 'model.name', modelId);

        return {
          type: 'message',
          messageType: 'info',
          content: `Model changed to: ${modelId}`,
        };
      } else {
        return {
          type: 'message',
          messageType: 'error',
          content: `Model "${modelId}" not found. Available models: ${availableModels.map((m) => m.id).join(', ')}`,
        };
      }
    }

    // Trigger model selection dialog (no args provided)
    return {
      type: 'dialog',
      dialog: 'model',
    };
  },

  // Autocomplete function for model names
  completion: async (context: CommandContext, partialArg: string) => {
    const { services } = context;
    const { config } = services;

    if (!config) {
      return [];
    }

    const contentGeneratorConfig = config.getContentGeneratorConfig();
    if (!contentGeneratorConfig) {
      return [];
    }

    const authType = contentGeneratorConfig.authType;
    if (!authType) {
      return [];
    }

    // Handle refresh as special case
    const trimmed = partialArg.trim().toLowerCase();
    if ('refresh'.startsWith(trimmed)) {
      return ['refresh'];
    }

    // Fetch available models
    let availableModels: AvailableModel[];
    try {
      if (authType === AuthType.LOCAL) {
        availableModels = await getAvailableModelsForAuthTypeAsync(authType);
      } else {
        availableModels = getAvailableModelsForAuthType(authType);
      }
    } catch (error) {
      console.error('Failed to fetch models for completion:', error);
      return [];
    }

    if (availableModels.length === 0) {
      return [];
    }

    const modelIds = availableModels.map((m) => m.id);

    // If no partial argument, return all models
    if (!partialArg.trim()) {
      return modelIds;
    }

    // Use FZF for fuzzy matching
    try {
      const fzf = new AsyncFzf(modelIds, {
        fuzzy: 'v2',
        casing: 'case-insensitive',
      });

      const results = await fzf.find(partialArg.trim());
      return results.map((r: { item: string }) => r.item);
    } catch (_error) {
      // Fallback to simple includes matching if FZF fails
      const query = partialArg.trim().toLowerCase();
      return modelIds.filter((id) => id.toLowerCase().includes(query));
    }
  },
};
