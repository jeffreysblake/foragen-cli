/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType, DEFAULT_FORA_MODEL } from '@jeffreysblake/foragen-cli-core';

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
