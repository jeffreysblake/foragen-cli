/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AuthType,
  DEFAULT_FORA_MODEL,
  fetchAvailableModels,
} from '@jeffreysblake/foragen-cli-core';
import { loadSettings } from '../../config/settings.js';

export type AvailableModel = {
  id: string;
  label: string;
  description?: string;
  isVision?: boolean;
};

export const MAINLINE_VLM = 'vision-model';
export const MAINLINE_CODER = DEFAULT_FORA_MODEL;

export const AVAILABLE_MODELS_FORA: AvailableModel[] = [
  {
    id: MAINLINE_CODER,
    label: MAINLINE_CODER,
    description:
      'The latest Foragen CLIr model from Alibaba Cloud ModelStudio (version: fora3-coder-plus-2025-09-23)',
  },
  {
    id: MAINLINE_VLM,
    label: MAINLINE_VLM,
    description:
      'The latest Fora Vision model from Alibaba Cloud ModelStudio (version: fora3-vl-plus-2025-09-23)',
    isVision: true,
  },
];

/**
 * Get available Fora models filtered by vision model preview setting
 */
export function getFilteredForaModels(
  visionModelPreviewEnabled: boolean,
): AvailableModel[] {
  if (visionModelPreviewEnabled) {
    return AVAILABLE_MODELS_FORA;
  }
  return AVAILABLE_MODELS_FORA.filter((model) => !model.isVision);
}

/**
 * Currently we use the single model of `OPENAI_MODEL` in the env.
 * In the future, after settings.json is updated, we will allow users to configure this themselves.
 */
export function getOpenAIAvailableModelFromEnv(): AvailableModel | null {
  const id = process.env['OPENAI_MODEL']?.trim();
  return id ? { id, label: id } : null;
}

export function getAvailableModelsForAuthType(
  authType: AuthType,
): AvailableModel[] {
  switch (authType) {
    case AuthType.FORA_OAUTH:
      return AVAILABLE_MODELS_FORA;
    case AuthType.USE_OPENAI: {
      const openAIModel = getOpenAIAvailableModelFromEnv();
      return openAIModel ? [openAIModel] : [];
    }
    default:
      // For other auth types, return empty array for now
      // This can be expanded later according to the design doc
      return [];
  }
}

/**
/**
 * Hard code the default vision model as a string literal,
 * until our coding model supports multimodal.
 */
export function getDefaultVisionModel(): string {
  return MAINLINE_VLM;
}

export function isVisionModel(modelId: string): boolean {
  return AVAILABLE_MODELS_FORA.some(
    (model) => model.id === modelId && model.isVision,
  );
}

/**
 * Cache for local model server models
 */
interface LocalModelCache {
  models: AvailableModel[];
  timestamp: number;
  baseUrl: string;
}

let localModelCache: LocalModelCache | null = null;
const CACHE_TTL_MS = 60000; // 60 seconds

/**
 * Clear the local model cache
 */
export function clearLocalModelCache(): void {
  localModelCache = null;
}

/**
 * Fetch models from a local model server
 * @param baseUrl - The base URL of the local server
 * @param apiKey - Optional API key
 * @returns Array of available models
 */
export async function getLocalModelsFromServer(
  baseUrl: string,
  apiKey?: string,
): Promise<AvailableModel[]> {
  // Check cache first
  if (
    localModelCache &&
    localModelCache.baseUrl === baseUrl &&
    Date.now() - localModelCache.timestamp < CACHE_TTL_MS
  ) {
    return localModelCache.models;
  }

  try {
    const modelIds = await fetchAvailableModels(baseUrl, apiKey, 5000);

    const models: AvailableModel[] = modelIds.map((id) => ({
      id,
      label: id,
      description: `Local model from ${baseUrl}`,
    }));

    // Update cache
    localModelCache = {
      models,
      timestamp: Date.now(),
      baseUrl,
    };

    return models;
  } catch (error) {
    console.error(`Failed to fetch models from ${baseUrl}:`, error);
    // Return cached models if available, even if expired
    if (localModelCache && localModelCache.baseUrl === baseUrl) {
      console.log('Returning stale cached models due to fetch error');
      return localModelCache.models;
    }
    return [];
  }
}

/**
 * Async version of getAvailableModelsForAuthType that supports LOCAL auth
 * @param authType - The authentication type
 * @returns Promise of available models
 */
export async function getAvailableModelsForAuthTypeAsync(
  authType: AuthType,
): Promise<AvailableModel[]> {
  switch (authType) {
    case AuthType.FORA_OAUTH:
      return AVAILABLE_MODELS_FORA;
    case AuthType.USE_OPENAI: {
      const openAIModel = getOpenAIAvailableModelFromEnv();
      return openAIModel ? [openAIModel] : [];
    }
    case AuthType.LOCAL: {
      const settings = loadSettings();
      const baseUrl =
        process.env['OPENAI_BASE_URL'] ||
        settings.merged.security?.auth?.baseUrl;
      const apiKey =
        process.env['OPENAI_API_KEY'] || settings.merged.security?.auth?.apiKey;

      if (!baseUrl) {
        console.warn(
          'LOCAL auth type requires OPENAI_BASE_URL or security.auth.baseUrl',
        );
        return [];
      }

      return await getLocalModelsFromServer(baseUrl, apiKey);
    }
    default:
      // For other auth types, return empty array for now
      return [];
  }
}
