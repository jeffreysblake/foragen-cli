import OpenAI from 'openai';
import type { Config } from '../../../config/config.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import { DEFAULT_TIMEOUT, DEFAULT_MAX_RETRIES } from '../constants.js';
import type { OpenAICompatibleProvider } from './types.js';

/**
 * Default provider for standard OpenAI-compatible APIs
 */
export class DefaultOpenAICompatibleProvider
  implements OpenAICompatibleProvider
{
  protected contentGeneratorConfig: ContentGeneratorConfig;
  protected cliConfig: Config;

  constructor(
    contentGeneratorConfig: ContentGeneratorConfig,
    cliConfig: Config,
  ) {
    this.cliConfig = cliConfig;
    this.contentGeneratorConfig = contentGeneratorConfig;
  }

  buildHeaders(): Record<string, string | undefined> {
    const version = this.cliConfig.getCliVersion() || 'unknown';
    const userAgent = `ForagenCli/${version} (${process.platform}; ${process.arch})`;
    return {
      'User-Agent': userAgent,
    };
  }

  buildClient(): OpenAI {
    const {
      apiKey,
      baseUrl,
      timeout = DEFAULT_TIMEOUT,
      maxRetries = DEFAULT_MAX_RETRIES,
    } = this.contentGeneratorConfig;
    const defaultHeaders = this.buildHeaders();

    // Normalize baseURL to include /v1 suffix for OpenAI-compatible endpoints
    // The OpenAI SDK will append paths like /chat/completions to this base URL
    const normalizedBaseUrl =
      baseUrl && !baseUrl.endsWith('/v1') ? `${baseUrl}/v1` : baseUrl;

    return new OpenAI({
      apiKey,
      baseURL: normalizedBaseUrl,
      timeout,
      maxRetries,
      defaultHeaders,
    });
  }

  buildRequest(
    request: OpenAI.Chat.ChatCompletionCreateParams,
    _userPromptId: string,
  ): OpenAI.Chat.ChatCompletionCreateParams {
    // Default provider doesn't need special enhancements, just pass through all parameters
    return {
      ...request, // Preserve all original parameters including sampling params
    };
  }
}
