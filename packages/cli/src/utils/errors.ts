/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '@jeffreysblake/foragen-cli-core';
import {
  OutputFormat,
  JsonFormatter,
  FatalTurnLimitedError,
  FatalToolExecutionError,
  FatalCancellationError,
} from '@jeffreysblake/foragen-cli-core';

/**
 * Sanitizes error messages and strings by redacting sensitive information
 * such as API keys, tokens, passwords, and other credentials.
 */
export function sanitizeSensitiveData(input: string): string {
  let sanitized = input;

  // Redact API keys (various formats)
  sanitized = sanitized.replace(
    /\b(api[_-]?key|apikey)([=:\s]+)['"]?[a-zA-Z0-9_/+=]{16,}['"]?/gi,
    '$1$2[REDACTED]',
  );

  // Redact Bearer tokens
  sanitized = sanitized.replace(
    /\b(bearer\s+)[a-zA-Z0-9_.+=]{16,}/gi,
    '$1[REDACTED]',
  );

  // Redact Authorization headers
  sanitized = sanitized.replace(
    /(authorization[=:\s]+)['"]?[^'"}\s]{16,}['"]?/gi,
    '$1[REDACTED]',
  );

  // Redact passwords
  sanitized = sanitized.replace(
    /\b(password|passwd|pwd)([=:\s]+)['"]?[^'"}\s]+['"]?/gi,
    '$1$2[REDACTED]',
  );

  // Redact tokens (access_token, refresh_token, etc.)
  sanitized = sanitized.replace(
    /\b([a-z_]*token)([=:\s]+)['"]?[a-zA-Z0-9_.+=]{16,}['"]?/gi,
    '$1$2[REDACTED]',
  );

  // Redact secret keys
  sanitized = sanitized.replace(
    /\b([a-z_]*secret[a-z_]*)([=:\s]+)['"]?[^'"}\s]{8,}['"]?/gi,
    '$1$2[REDACTED]',
  );

  // Redact OAuth codes
  sanitized = sanitized.replace(
    /\b(code|oauth[_-]?code)([=:\s]+)['"]?[a-zA-Z0-9_-]{16,}['"]?/gi,
    '$1$2[REDACTED]',
  );

  return sanitized;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

interface ErrorWithCode extends Error {
  exitCode?: number;
  code?: string | number;
  status?: string | number;
}

/**
 * Extracts the appropriate error code from an error object.
 */
function extractErrorCode(error: unknown): string | number {
  const errorWithCode = error as ErrorWithCode;

  // Prioritize exitCode for FatalError types, fall back to other codes
  if (typeof errorWithCode.exitCode === 'number') {
    return errorWithCode.exitCode;
  }
  if (errorWithCode.code !== undefined) {
    return errorWithCode.code;
  }
  if (errorWithCode.status !== undefined) {
    return errorWithCode.status;
  }

  return 1; // Default exit code
}

/**
 * Converts an error code to a numeric exit code.
 */
function getNumericExitCode(errorCode: string | number): number {
  return typeof errorCode === 'number' ? errorCode : 1;
}

/**
 * Handles errors consistently for both JSON and text output formats.
 * In JSON mode, outputs formatted JSON error and exits.
 * In text mode, outputs error message and re-throws.
 */
export function handleError(
  error: unknown,
  config: Config,
  customErrorCode?: string | number,
): never {
  // Don't log error details to avoid exposing sensitive data
  // Error details may contain API keys, tokens, or other credentials

  if (config.getOutputFormat() === OutputFormat.JSON) {
    const formatter = new JsonFormatter();
    const errorCode = customErrorCode ?? extractErrorCode(error);

    // Create generic error without sensitive details
    const genericError = new Error('An error occurred during execution.');
    const formattedError = formatter.formatError(genericError, errorCode);

    console.error(formattedError);
    process.exit(getNumericExitCode(errorCode));
  } else {
    console.error('An error occurred during execution.');
    throw error;
  }
}

/**
 * Handles tool execution errors specifically.
 * In JSON mode, outputs formatted JSON error and exits.
 * In text mode, outputs error message to stderr only.
 */
export function handleToolError(
  toolName: string,
  toolError: Error,
  config: Config,
  errorCode?: string | number,
  resultDisplay?: string,
): void {
  const errorMessage = `Error executing tool ${toolName}: ${resultDisplay || toolError.message}`;
  const toolExecutionError = new FatalToolExecutionError(errorMessage);

  if (config.getOutputFormat() === OutputFormat.JSON) {
    const formatter = new JsonFormatter();
    const formattedError = formatter.formatError(
      toolExecutionError,
      errorCode ?? toolExecutionError.exitCode,
    );

    console.error(formattedError);
    process.exit(
      typeof errorCode === 'number' ? errorCode : toolExecutionError.exitCode,
    );
  } else {
    console.error(errorMessage);
  }
}

/**
 * Handles cancellation/abort signals consistently.
 */
export function handleCancellationError(config: Config): never {
  const cancellationError = new FatalCancellationError('Operation cancelled.');

  if (config.getOutputFormat() === OutputFormat.JSON) {
    const formatter = new JsonFormatter();
    const formattedError = formatter.formatError(
      cancellationError,
      cancellationError.exitCode,
    );

    console.error(formattedError);
    process.exit(cancellationError.exitCode);
  } else {
    console.error(cancellationError.message);
    process.exit(cancellationError.exitCode);
  }
}

/**
 * Handles max session turns exceeded consistently.
 */
export function handleMaxTurnsExceededError(config: Config): never {
  const maxTurnsError = new FatalTurnLimitedError(
    'Reached max session turns for this session. Increase the number of turns by specifying maxSessionTurns in settings.json.',
  );

  if (config.getOutputFormat() === OutputFormat.JSON) {
    const formatter = new JsonFormatter();
    const formattedError = formatter.formatError(
      maxTurnsError,
      maxTurnsError.exitCode,
    );

    console.error(formattedError);
    process.exit(maxTurnsError.exitCode);
  } else {
    console.error(maxTurnsError.message);
    process.exit(maxTurnsError.exitCode);
  }
}
