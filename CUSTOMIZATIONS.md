# Foragen CLI Customizations

This document tracks all customizations made to this fork of QwenLM/qwen-code, now rebranded as Foragen CLI.

## Fork Information

- **Original Repository**: https://github.com/QwenLM/qwen-code
- **Forked Repository**: https://github.com/jeffreysblake/foragen-cli
- **Fork Date**: November 2025
- **Purpose**: Personal customized version with enhanced features and rebranding

## Major Customizations

### 1. Complete Rebranding (November 2025)

- Renamed from "Qwen Code" to "Foragen CLI"
- Changed binary from `qwen` to `fora`
- Updated all package namespaces from `@qwen-code/*` to `@jeffreysblake/foragen-*`
- Changed configuration directory from `~/.qwen/` to `~/.fora/`
- Updated all class names, function names, and identifiers
- See FORAGEN_REBRANDING.md for complete details

### 2. Playwright MCP Integration

- Added Playwright MCP server for web automation
- Configured to run with Firefox in headless mode
- Integration allows for web scraping and testing capabilities

### 3. Local Model Configuration

- Enhanced support for local model configurations
- Improved settings for Qwen3-Coder models
- Better integration with local model endpoints

### 4. Tool Improvements

- Enhanced tool calling functionality
- Fixed boolean parameter handling in tool calls
- Improved background task execution

### 5. Docker Sandboxing

- Switched to local Docker image builds (`foragen-cli-sandbox:latest`)
- No dependency on external container registries
- Improved security and isolation

## Configuration Changes

### Settings Location

- Configuration: `~/.fora/settings.json`
- Commands: `~/.fora/commands/`
- MCP Servers: `~/.fora/mcp/`

### Disabled Features

- Auto-update disabled by default
- Update notifications disabled
- Telemetry can be optionally disabled

## Development Workflow

### Build Process

```bash
npm install
npm run build
npm test
```

### Running Locally

```bash
npm start
# or use alias
alias fora='npm start --prefix /media/decisiv/models/consult/betech/foragen_cli'
```

### Docker Build

```bash
docker build -t foragen-cli-sandbox:latest .
```

## Upstream Sync Strategy

This fork maintains compatibility with upstream changes through:

1. Dedicated `upstream-qwen` branch tracking QwenLM/qwen-code
2. Regular merges from upstream to incorporate improvements
3. Conflict resolution documented in UPSTREAM_SYNC.md
4. Automated scripts for rebranding after merges

## Future Customizations

Planned enhancements:

- [ ] Enhanced local model support
- [ ] Additional MCP server integrations
- [ ] Custom themes and UI improvements
- [ ] Extended tool capabilities
- [ ] Performance optimizations

## Contributing

This is a personal fork. For contributions to the original project, please visit:
https://github.com/QwenLM/qwen-code

## License

Maintains the same Apache 2.0 license as the original project.
