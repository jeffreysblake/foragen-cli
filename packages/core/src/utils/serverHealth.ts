/**
 * Utilities for checking local model server health and availability
 */

export interface ServerHealthStatus {
  isReachable: boolean;
  error?: string;
  models?: string[];
  responseTime?: number;
}

export interface ModelInfo {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  context_length?: number;
  max_model_len?: number;
}

export interface ModelsResponse {
  object: string;
  data: ModelInfo[];
}

export interface ModelContextInfo {
  modelId: string;
  contextLength: number;
  timestamp: number;
}

/**
 * Common local model server ports to check
 */
export const COMMON_LOCAL_PORTS = [
  1234, // LM Studio default
  11434, // Ollama default
  8080, // Common alternative
  8000, // Common alternative
  5000, // Common alternative
];

/**
 * Ping a local server to check if it's reachable
 * @param url - Full server URL (e.g., http://192.168.1.227:1234)
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Server health status
 */
export async function pingLocalServer(
  url: string,
  timeoutMs: number = 5000,
): Promise<ServerHealthStatus> {
  const startTime = Date.now();

  try {
    // Ensure URL ends with /v1 for OpenAI-compatible endpoints
    const baseUrl = url.endsWith('/v1') ? url : `${url}/v1`;
    const healthUrl = `${baseUrl}/models`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          isReachable: false,
          error: `Server responded with status ${response.status}`,
          responseTime,
        };
      }

      // Try to parse the response to verify it's a valid OpenAI-compatible server
      const data = (await response.json()) as ModelsResponse;

      if (!data.data || !Array.isArray(data.data)) {
        return {
          isReachable: false,
          error: 'Invalid server response format',
          responseTime,
        };
      }

      return {
        isReachable: true,
        models: data.data.map((model) => model.id),
        responseTime,
      };
    } catch (fetchError) {
      clearTimeout(timeout);

      if ((fetchError as Error).name === 'AbortError') {
        return {
          isReachable: false,
          error: `Connection timeout after ${timeoutMs}ms`,
          responseTime: Date.now() - startTime,
        };
      }

      throw fetchError;
    }
  } catch (error) {
    return {
      isReachable: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Fetch available models from a local server
 * @param url - Full server URL
 * @param apiKey - Optional API key (some local servers don't require this)
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns List of available models or empty array if fetch fails
 */
export async function fetchAvailableModels(
  url: string,
  apiKey?: string,
  timeoutMs: number = 5000,
): Promise<string[]> {
  try {
    const baseUrl = url.endsWith('/v1') ? url : `${url}/v1`;
    const modelsUrl = `${baseUrl}/models`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    try {
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(
          `Failed to fetch models from ${url}: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      const data = (await response.json()) as ModelsResponse;

      if (!data.data || !Array.isArray(data.data)) {
        console.warn(`Invalid models response format from ${url}`);
        return [];
      }

      return data.data.map((model) => model.id);
    } catch (fetchError) {
      clearTimeout(timeout);

      if ((fetchError as Error).name === 'AbortError') {
        console.warn(`Timeout fetching models from ${url}`);
      } else {
        console.warn(`Error fetching models from ${url}:`, fetchError);
      }

      return [];
    }
  } catch (error) {
    console.warn(`Error fetching models from ${url}:`, error);
    return [];
  }
}

/**
 * Auto-detect local model servers by checking common configurations
 * @param knownServers - Array of known server URLs to check first
 * @param scanCommonPorts - Whether to scan common ports on localhost (default: true)
 * @returns First reachable server or null if none found
 */
export async function autoDetectLocalServer(
  knownServers: string[] = [],
  scanCommonPorts: boolean = true,
): Promise<{ url: string; models: string[] } | null> {
  const serversToCheck: string[] = [...knownServers];

  // Add common localhost configurations if scanning is enabled
  if (scanCommonPorts) {
    for (const port of COMMON_LOCAL_PORTS) {
      serversToCheck.push(`http://localhost:${port}`);
      serversToCheck.push(`http://127.0.0.1:${port}`);
    }
  }

  // Check all servers in parallel
  const results = await Promise.all(
    serversToCheck.map(async (url) => {
      const health = await pingLocalServer(url, 3000); // Shorter timeout for auto-detection
      return { url, health };
    }),
  );

  // Return the first reachable server
  for (const { url, health } of results) {
    if (health.isReachable && health.models && health.models.length > 0) {
      return { url, models: health.models };
    }
  }

  return null;
}

/**
 * Normalize a server URL to ensure it has the correct format
 * @param url - User-provided URL
 * @returns Normalized URL
 */
export function normalizeServerUrl(url: string): string {
  let normalized = url.trim();

  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `http://${normalized}`;
  }

  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');

  // Remove /v1 suffix if present (we'll add it when making requests)
  normalized = normalized.replace(/\/v1$/, '');

  return normalized;
}

/**
 * Cache for model context lengths
 */
const contextLengthCache = new Map<string, ModelContextInfo>();
const CONTEXT_CACHE_TTL_MS = 300000; // 5 minutes

/**
 * Clear the context length cache
 */
export function clearContextLengthCache(): void {
  contextLengthCache.clear();
}

/**
 * Fetch model information including context length from the server
 * @param baseUrl - The base URL of the server
 * @param modelId - The specific model ID to get info for
 * @param apiKey - Optional API key
 * @returns Model info with context length, or null if not found
 */
export async function fetchModelContextLength(
  baseUrl: string,
  modelId: string,
  apiKey?: string,
): Promise<number | null> {
  // Check cache first
  const cacheKey = `${baseUrl}:${modelId}`;
  const cached = contextLengthCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CONTEXT_CACHE_TTL_MS) {
    return cached.contextLength;
  }

  try {
    const normalizedUrl = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
    const modelsUrl = `${normalizedUrl}/models`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      console.warn(
        `Failed to fetch model info from ${baseUrl}: ${response.status}`,
      );
      return null;
    }

    const data = (await response.json()) as ModelsResponse;

    if (!data.data || !Array.isArray(data.data)) {
      console.warn(`Invalid models response format from ${baseUrl}`);
      return null;
    }

    // Find the specific model
    const modelInfo = data.data.find((m) => m.id === modelId);

    if (!modelInfo) {
      console.warn(`Model ${modelId} not found in server response`);
      return null;
    }

    // Extract context length - try multiple possible field names
    const contextLength =
      modelInfo.context_length || modelInfo.max_model_len || null;

    if (contextLength && contextLength > 0) {
      // Cache the result
      contextLengthCache.set(cacheKey, {
        modelId,
        contextLength,
        timestamp: Date.now(),
      });

      console.log(
        `Detected context length for ${modelId}: ${contextLength} tokens`,
      );
      return contextLength;
    }

    return null;
  } catch (error) {
    console.warn(`Error fetching model context length from ${baseUrl}:`, error);
    return null;
  }
}
