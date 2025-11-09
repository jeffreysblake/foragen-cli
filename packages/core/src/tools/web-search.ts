/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolInvocation,
  type ToolResult,
  type ToolCallConfirmationDetails,
  type ToolInfoConfirmationDetails,
  ToolConfirmationOutcome,
} from './tools.js';

import type { Config } from '../config/config.js';
import { ApprovalMode } from '../config/config.js';
import { getErrorMessage } from '../utils/errors.js';
import { debugLogger, LogCategory } from '../utils/debugLogger.js';

interface TavilyResultItem {
  title: string;
  url: string;
  content?: string;
  score?: number;
  published_date?: string;
}

interface TavilySearchResponse {
  query: string;
  answer?: string;
  results: TavilyResultItem[];
}

/**
 * Parameters for the WebSearchTool.
 */
export interface WebSearchToolParams {
  /**
   * The search query.
   */
  query: string;
}

/**
 * Extends ToolResult to include sources for web search.
 */
export interface WebSearchToolResult extends ToolResult {
  sources?: Array<{ title: string; url: string }>;
}

class WebSearchToolInvocation extends BaseToolInvocation<
  WebSearchToolParams,
  WebSearchToolResult
> {
  constructor(
    private readonly config: Config,
    params: WebSearchToolParams,
    private readonly toolKind: Kind,
  ) {
    super(params);
  }

  override getDescription(): string {
    return `Searching the web for: "${this.params.query}"`;
  }

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    if (this.config.getApprovalMode() === ApprovalMode.AUTO_EDIT) {
      return false;
    }

    const confirmationDetails: ToolInfoConfirmationDetails = {
      type: 'info',
      title: 'Confirm Web Search',
      prompt: `Search the web for: "${this.params.query}"`,
      toolKind: this.toolKind,
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.config.setApprovalMode(ApprovalMode.AUTO_EDIT);
        }
      },
    };
    return confirmationDetails;
  }

  private async executeWithMcp(
    signal: AbortSignal,
  ): Promise<WebSearchToolResult> {
    const mcpServerName = this.config.getWebSearchMcpServer();
    const toolRegistry = this.config.getToolRegistry();

    debugLogger.debug(LogCategory.WEBSEARCH, 'Attempting MCP web search', {
      serverName: mcpServerName,
      query: this.params.query,
    });

    // Try to find a web search tool from the specified MCP server
    const mcpTools = toolRegistry.getToolsByServer(mcpServerName);

    if (mcpTools.length === 0) {
      debugLogger.warn(
        LogCategory.WEBSEARCH,
        'No MCP tools found for web search',
        {
          serverName: mcpServerName,
          query: this.params.query,
        },
      );
      return {
        llmContent: `MCP web search is configured but no tools found from server "${mcpServerName}". Please ensure the MCP server is configured in mcpServers settings.`,
        returnDisplay: `MCP server "${mcpServerName}" not found or has no tools.`,
      };
    }

    // Look for a tool that seems to be a web search tool
    // Prefer full/comprehensive search tools over summaries
    // Common names: full-web-search, web_search, brave_web_search, search, etc.
    let searchTool = mcpTools.find(
      (tool) =>
        tool.name.toLowerCase().includes('full') &&
        tool.name.toLowerCase().includes('search'),
    );

    // Fall back to any tool with "search" in the name (but not "summaries")
    if (!searchTool) {
      searchTool = mcpTools.find(
        (tool) =>
          tool.name.toLowerCase().includes('search') &&
          !tool.name.toLowerCase().includes('summaries') &&
          !tool.name.toLowerCase().includes('summary'),
      );
    }

    // Last resort: any tool with "search" or "web"
    if (!searchTool) {
      searchTool = mcpTools.find(
        (tool) =>
          tool.name.toLowerCase().includes('search') ||
          tool.name.toLowerCase().includes('web'),
      );
    }

    if (!searchTool) {
      const toolNames = mcpTools.map((t) => t.name).join(', ');
      debugLogger.warn(
        LogCategory.WEBSEARCH,
        'No search tool found in MCP server',
        {
          serverName: mcpServerName,
          availableTools: toolNames,
          query: this.params.query,
        },
      );
      return {
        llmContent: `MCP web search is configured but no search tool found in server "${mcpServerName}". Available tools: ${toolNames}`,
        returnDisplay: `No search tool found in MCP server "${mcpServerName}".`,
      };
    }

    try {
      // Create an invocation with the search query
      // For full-web-search, we can pass optional limit and includeContent
      const mcpParams: Record<string, unknown> = {
        query: this.params.query,
      };

      // Add optional parameters if this is full-web-search
      if (searchTool.name.toLowerCase().includes('full')) {
        mcpParams['limit'] = 5; // Default to 5 results
        mcpParams['includeContent'] = true; // Include full page content
      }

      debugLogger.info(
        LogCategory.WEBSEARCH,
        `Calling MCP search tool "${searchTool.name}"`,
        { params: mcpParams, query: this.params.query },
      );
      const invocation = searchTool.build(mcpParams);
      const result = await invocation.execute(signal);
      debugLogger.info(
        LogCategory.WEBSEARCH,
        `MCP search tool "${searchTool.name}" completed successfully`,
        { query: this.params.query },
      );

      // Build the response, checking if sources exist on the result
      const response: WebSearchToolResult = {
        llmContent: result.llmContent,
        returnDisplay: result.returnDisplay ?? 'Search completed via MCP.',
      };

      // If the MCP result has sources (extended from WebSearchToolResult), include them
      if ('sources' in result && result.sources) {
        response.sources = result.sources as Array<{
          title: string;
          url: string;
        }>;
      }

      return response;
    } catch (error: unknown) {
      const errorMessage = `Error executing MCP web search via "${searchTool.name}": ${getErrorMessage(error)}`;
      debugLogger.error(LogCategory.WEBSEARCH, errorMessage, {
        serverName: mcpServerName,
        toolName: searchTool.name,
        query: this.params.query,
        error: error instanceof Error ? error.stack : String(error),
      });
      return {
        llmContent: `Error: ${errorMessage}`,
        returnDisplay: `Error performing MCP web search.`,
      };
    }
  }

  async execute(signal: AbortSignal): Promise<WebSearchToolResult> {
    const provider = this.config.getWebSearchProvider();

    debugLogger.info(LogCategory.WEBSEARCH, 'Web search requested', {
      query: this.params.query,
      provider,
    });

    // If MCP provider is configured, delegate to MCP tool
    if (provider === 'mcp') {
      return this.executeWithMcp(signal);
    }

    // Otherwise, use Tavily (default)
    debugLogger.debug(
      LogCategory.WEBSEARCH,
      'Using Tavily API for web search',
      {
        query: this.params.query,
      },
    );
    const apiKey = this.config.getTavilyApiKey();
    if (!apiKey) {
      return {
        llmContent:
          'Web search is disabled because TAVILY_API_KEY is not configured. Please set it in your settings.json, .env file, or via --tavily-api-key command line argument to enable web search.',
        returnDisplay:
          'Web search disabled. Configure TAVILY_API_KEY to enable Tavily search.',
      };
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: this.params.query,
          search_depth: 'advanced',
          max_results: 5,
          include_answer: true,
        }),
        signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `Tavily API error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`,
        );
      }

      const data = (await response.json()) as TavilySearchResponse;

      debugLogger.info(LogCategory.WEBSEARCH, 'Tavily API search completed', {
        query: this.params.query,
        resultCount: data.results?.length ?? 0,
        hasAnswer: !!data.answer,
      });

      const sources = (data.results || []).map((r) => ({
        title: r.title,
        url: r.url,
      }));

      const sourceListFormatted = sources.map(
        (s, i) => `[${i + 1}] ${s.title || 'Untitled'} (${s.url})`,
      );

      let content = data.answer?.trim() || '';
      if (!content) {
        // Fallback: build a concise summary from top results
        content = sources
          .slice(0, 3)
          .map((s, i) => `${i + 1}. ${s.title} - ${s.url}`)
          .join('\n');
      }

      if (sourceListFormatted.length > 0) {
        content += `\n\nSources:\n${sourceListFormatted.join('\n')}`;
      }

      if (!content.trim()) {
        return {
          llmContent: `No search results or information found for query: "${this.params.query}"`,
          returnDisplay: 'No information found.',
        };
      }

      return {
        llmContent: `Web search results for "${this.params.query}":\n\n${content}`,
        returnDisplay: `Search results for "${this.params.query}" returned.`,
        sources,
      };
    } catch (error: unknown) {
      const errorMessage = `Error during web search for query "${this.params.query}": ${getErrorMessage(
        error,
      )}`;
      debugLogger.error(LogCategory.WEBSEARCH, errorMessage, {
        query: this.params.query,
        provider: 'tavily',
        error: error instanceof Error ? error.stack : String(error),
      });
      return {
        llmContent: `Error: ${errorMessage}`,
        returnDisplay: `Error performing web search.`,
      };
    }
  }
}

/**
 * A tool to perform web searches using either Tavily API or MCP web search servers.
 */
export class WebSearchTool extends BaseDeclarativeTool<
  WebSearchToolParams,
  WebSearchToolResult
> {
  static readonly Name: string = 'web_search';

  constructor(private readonly config: Config) {
    const provider = config.getWebSearchProvider();
    const description =
      provider === 'mcp'
        ? `Performs a web search using an MCP web search server and returns results with sources. Requires an MCP web search server to be configured in mcpServers (default: "${config.getWebSearchMcpServer()}").`
        : 'Performs a web search using the Tavily API and returns a concise answer with sources. Requires the TAVILY_API_KEY environment variable.';

    super(WebSearchTool.Name, 'WebSearch', description, Kind.Search, {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find information on the web.',
        },
      },
      required: ['query'],
    });
  }

  /**
   * Validates the parameters for the WebSearchTool.
   * @param params The parameters to validate
   * @returns An error message string if validation fails, null if valid
   */
  protected override validateToolParamValues(
    params: WebSearchToolParams,
  ): string | null {
    if (!params.query || params.query.trim() === '') {
      return "The 'query' parameter cannot be empty.";
    }
    return null;
  }

  protected createInvocation(
    params: WebSearchToolParams,
  ): ToolInvocation<WebSearchToolParams, WebSearchToolResult> {
    return new WebSearchToolInvocation(this.config, params, this.kind);
  }
}
