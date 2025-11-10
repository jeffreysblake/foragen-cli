#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import './src/gemini.js';
import { main } from './src/gemini.js';
import { FatalError } from '@jeffreysblake/foragen-cli-core';

// --- Global Entry Point ---
main().catch((error) => {
  if (error instanceof FatalError) {
    // Log generic error to avoid exposing potentially sensitive error details
    const genericMessage = 'An error occurred during execution.';
    if (!process.env['NO_COLOR']) {
      console.error(`\x1b[31m${genericMessage}\x1b[0m`);
    } else {
      console.error(genericMessage);
    }
    process.exit(error.exitCode);
  }
  // Log generic error without details to avoid exposing sensitive data
  console.error(
    'An unexpected critical error occurred. Enable debug mode for details.',
  );
  process.exit(1);
});
