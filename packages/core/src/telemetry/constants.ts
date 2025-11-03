/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const SERVICE_NAME = 'foragen-cli';

export const EVENT_USER_PROMPT = 'foragen-cli.user_prompt';
export const EVENT_TOOL_CALL = 'foragen-cli.tool_call';
export const EVENT_API_REQUEST = 'foragen-cli.api_request';
export const EVENT_API_ERROR = 'foragen-cli.api_error';
export const EVENT_API_CANCEL = 'foragen-cli.api_cancel';
export const EVENT_API_RESPONSE = 'foragen-cli.api_response';
export const EVENT_CLI_CONFIG = 'foragen-cli.config';
export const EVENT_EXTENSION_DISABLE = 'foragen-cli.extension_disable';
export const EVENT_EXTENSION_ENABLE = 'foragen-cli.extension_enable';
export const EVENT_EXTENSION_INSTALL = 'foragen-cli.extension_install';
export const EVENT_EXTENSION_UNINSTALL = 'foragen-cli.extension_uninstall';
export const EVENT_FLASH_FALLBACK = 'foragen-cli.flash_fallback';
export const EVENT_RIPGREP_FALLBACK = 'foragen-cli.ripgrep_fallback';
export const EVENT_NEXT_SPEAKER_CHECK = 'foragen-cli.next_speaker_check';
export const EVENT_SLASH_COMMAND = 'foragen-cli.slash_command';
export const EVENT_IDE_CONNECTION = 'foragen-cli.ide_connection';
export const EVENT_CHAT_COMPRESSION = 'foragen-cli.chat_compression';
export const EVENT_INVALID_CHUNK = 'foragen-cli.chat.invalid_chunk';
export const EVENT_CONTENT_RETRY = 'foragen-cli.chat.content_retry';
export const EVENT_CONTENT_RETRY_FAILURE =
  'foragen-cli.chat.content_retry_failure';
export const EVENT_CONVERSATION_FINISHED = 'foragen-cli.conversation_finished';
export const EVENT_MALFORMED_JSON_RESPONSE =
  'foragen-cli.malformed_json_response';
export const EVENT_FILE_OPERATION = 'foragen-cli.file_operation';
export const EVENT_MODEL_SLASH_COMMAND = 'foragen-cli.slash_command.model';
export const EVENT_SUBAGENT_EXECUTION = 'foragen-cli.subagent_execution';

// Performance Events
export const EVENT_STARTUP_PERFORMANCE = 'foragen-cli.startup.performance';
export const EVENT_MEMORY_USAGE = 'foragen-cli.memory.usage';
export const EVENT_PERFORMANCE_BASELINE = 'foragen-cli.performance.baseline';
export const EVENT_PERFORMANCE_REGRESSION = 'foragen-cli.performance.regression';
