/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@jeffreysblake/foragen-cli-core';
import { loadEnvironment, loadSettings } from './settings.js';

export function validateAuthMethod(authMethod: string): string | null {
  const settings = loadSettings();
  loadEnvironment(settings.merged);

  if (authMethod === AuthType.USE_OPENAI) {
    const hasApiKey =
      process.env['OPENAI_API_KEY'] || settings.merged.security?.auth?.apiKey;
    if (!hasApiKey) {
      return 'OPENAI_API_KEY environment variable not found. You can enter it interactively or add it to your .env file.';
    }
    return null;
  }

  if (authMethod === AuthType.FORA_OAUTH) {
    // Fora OAuth doesn't require any environment variables for basic setup
    // The OAuth flow will handle authentication
    return null;
  }

  if (authMethod === AuthType.LOCAL) {
    // Local auth requires a base URL (server address) and model
    // API key is optional for local servers
    const hasBaseUrl =
      process.env['OPENAI_BASE_URL'] || settings.merged.security?.auth?.baseUrl;
    const hasModel =
      process.env['OPENAI_MODEL'] ||
      process.env['FORA_MODEL'] ||
      settings.merged.model?.name;

    if (!hasBaseUrl) {
      return 'Local authentication requires a server URL (OPENAI_BASE_URL or security.auth.baseUrl). Please configure your local model server.';
    }

    if (!hasModel) {
      return 'Local authentication requires a model to be specified (OPENAI_MODEL, FORA_MODEL, or model.name). Please select a model from your local server.';
    }

    return null;
  }

  return 'Invalid auth method selected.';
}
