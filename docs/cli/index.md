# Foragen CLI CLI

Within Foragen CLI, `packages/cli` is the frontend for users to send and receive prompts with Fora and other AI models and their associated tools. For a general overview of Foragen CLI

## Navigating this section

- **[Authentication](./authentication.md):** A guide to setting up authentication with Fora OAuth and OpenAI-compatible providers.
- **[Commands](./commands.md):** A reference for Foragen CLI CLI commands (e.g., `/help`, `/tools`, `/theme`).
- **[Configuration](./configuration.md):** A guide to tailoring Foragen CLI CLI behavior using configuration files.
- **[Themes](./themes.md)**: A guide to customizing the CLI's appearance with different themes.
- **[Tutorials](tutorials.md)**: A tutorial showing how to use Foragen CLI to automate a development task.

## Non-interactive mode

Foragen CLI can be run in a non-interactive mode, which is useful for scripting and automation. In this mode, you pipe input to the CLI, it executes the command, and then it exits.

The following example pipes a command to Foragen CLI from your terminal:

```bash
echo "What is fine tuning?" | fora
```

You can also use the `--prompt` or `-p` flag:

```bash
fora -p "What is fine tuning?"
```

For comprehensive documentation on headless usage, scripting, automation, and advanced examples, see the **[Headless Mode](../headless.md)** guide.
