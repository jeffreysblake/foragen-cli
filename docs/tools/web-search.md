# Web Search Tool (`web_search`)

This document describes the `web_search` tool.

## Description

Use `web_search` to perform a web search using either the **Tavily API** (default) or an **MCP web search server**. The tool returns search results with sources when possible.

### Arguments

`web_search` takes one argument:

- `query` (string, required): The search query.

## Backend Options

The `web_search` tool supports two backend providers:

### 1. Tavily API (Default)

The default backend uses the Tavily Search API directly. You must configure the `TAVILY_API_KEY` through one of the following methods:

1. **Settings file**: Add `"tavilyApiKey": "your-key-here"` to your `settings.json` under `advanced`
2. **Environment variable**: Set `TAVILY_API_KEY` in your environment or `.env` file
3. **Command line**: Use `--tavily-api-key your-key-here` when running the CLI

### 2. MCP Web Search Server

Alternatively, you can use an MCP (Model Context Protocol) web search server like **web-search-mcp** or **Brave Search MCP**. This option is particularly useful for local models or when you prefer to use a different search backend.

#### Configuration for MCP Backend

Add the following to your `settings.json`:

```json
{
  "advanced": {
    "webSearchProvider": "mcp",
    "webSearchMcpServer": "web-search"
  },
  "mcpServers": {
    "web-search": {
      "command": "node",
      "args": ["/path/to/web-search-mcp/dist/index.js"]
    }
  }
}
```

**Configuration options:**

- `webSearchProvider`: Set to `"mcp"` to use MCP backend, or `"tavily"` for Tavily (default: `"tavily"`)
- `webSearchMcpServer`: Name of the MCP server to use for web search (default: `"web-search"`)
- `mcpServers`: Standard MCP server configuration - ensure the server name matches `webSearchMcpServer`

**Example with Brave Search MCP:**

```json
{
  "advanced": {
    "webSearchProvider": "mcp",
    "webSearchMcpServer": "brave-search"
  },
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "$BRAVE_API_KEY"
      }
    }
  }
}
```

If the backend is not configured (no API key for Tavily, or no MCP server for MCP), the tool will be disabled and not registered.

Usage:

```
web_search(query="Your query goes here.")
```

## `web_search` examples

Get information on a topic:

```
web_search(query="latest advancements in AI-powered code generation")
```

## Important notes

- **Response returned:** The `web_search` tool returns search results with sources. Format varies by backend:
  - **Tavily**: Returns a concise answer when available, with numbered source links
  - **MCP**: Returns results in the format provided by the MCP server
- **Citations:** Source links are typically included in the response
- **Configuration:**
  - For Tavily: Configure `TAVILY_API_KEY` via settings.json, environment variables, .env files, or command line arguments
  - For MCP: Configure `webSearchProvider: "mcp"` in advanced settings and ensure an MCP web search server is configured
  - If neither backend is configured, the tool will not be registered
- **Provider selection:** The tool automatically delegates to the configured backend (Tavily or MCP) based on the `webSearchProvider` setting
