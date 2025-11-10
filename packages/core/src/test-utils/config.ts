/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ConfigParameters } from '../config/config.js';
import { Config, ApprovalMode } from '../config/config.js';
import type { ToolRegistry } from '../tools/tool-registry.js';
import type { GeminiClient } from '../core/client.js';

/**
 * Default parameters used for {@link FAKE_CONFIG}
 */
export const DEFAULT_CONFIG_PARAMETERS: ConfigParameters = {
  usageStatisticsEnabled: true,
  debugMode: false,
  sessionId: 'test-session-id',
  proxy: undefined,
  model: 'fora-9001-super-duper',
  targetDir: '/',
  cwd: '/',
  telemetry: {
    enabled: false,
    performanceMonitoring: true,
  },
};

/**
 * Produces a config.  Default paramters are set to
 * {@link DEFAULT_CONFIG_PARAMETERS}, optionally, fields can be specified to
 * override those defaults.
 */
export function makeFakeConfig(
  config: Partial<ConfigParameters> = {
    ...DEFAULT_CONFIG_PARAMETERS,
  },
): Config {
  return new Config({
    ...DEFAULT_CONFIG_PARAMETERS,
    ...config,
  });
}

/**
 * Creates a lightweight mock Config object for tests that only need specific methods.
 * This is more efficient than creating a full Config instance when you only need
 * a few methods (e.g., for metrics tests, telemetry tests).
 *
 * @param overrides - Partial Config implementation to override defaults
 * @returns A mock Config object with commonly-needed methods
 *
 * @example
 * ```typescript
 * const mockConfig = createMockConfig({
 *   getModel: () => 'custom-model',
 *   getDebugMode: () => true,
 * });
 * ```
 *
 * **Common use cases**:
 * - Telemetry/metrics tests: Need getSessionId, getTelemetryEnabled, getPerformanceMonitoringEnabled
 * - Tool tests: Need getApprovalMode, getToolRegistry, getProxy
 * - Client tests: Need getModel, getApiKey, getDebugMode
 *
 * **Benefits over full Config**:
 * - Faster test execution (no full Config initialization)
 * - Explicit about which methods are needed
 * - Easy to see what the test depends on
 * - Prevents "missing method" errors when Config grows
 */
export function createMockConfig(overrides: Partial<Config> = {}): Config {
  return {
    // Common methods used across most tests
    getSessionId: () => 'test-session-id',
    getTelemetryEnabled: () => true,
    getPerformanceMonitoringEnabled: () => true,
    getDebugMode: () => false,
    getModel: () => 'fora-9001-super-duper',

    // Web search methods
    getWebSearchProvider: () => 'tavily' as const,
    getWebSearchMcpServer: () => 'web-search',
    getTavilyApiKey: () => 'test-api-key',

    // Approval and tool methods
    getApprovalMode: () => ApprovalMode.DEFAULT,
    setApprovalMode: () => {},
    getToolRegistry: () =>
      ({
        getToolsByServer: () => [],
      }) as unknown as ToolRegistry,

    // Proxy and network
    getProxy: () => undefined,

    // Client access
    getGeminiClient: () => null as unknown as GeminiClient,

    // Apply overrides
    ...overrides,
  } as unknown as Config;
}
