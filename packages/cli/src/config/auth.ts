/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@qwen-code/qwen-code-core';
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

  if (authMethod === AuthType.QWEN_OAUTH) {
    // Qwen OAuth doesn't require any environment variables for basic setup
    // The OAuth flow will handle authentication
    return null;
  }

  if (authMethod === AuthType.LOCAL) {
    // Local auth uses environment variables that are set interactively
    // Check if required environment variables are set
    if (
      !process.env['OPENAI_API_KEY'] ||
      !process.env['OPENAI_BASE_URL'] ||
      !process.env['OPENAI_MODEL']
    ) {
      return 'Local authentication requires OPENAI_API_KEY, OPENAI_BASE_URL, and OPENAI_MODEL to be configured. These will be prompted for interactively.';
    }
    return null;
  }

  return 'Invalid auth method selected.';
}
