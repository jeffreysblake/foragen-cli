/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SkillConfig } from './types.js';

/**
 * Registry of built-in skills that are always available to all users.
 * These skills are embedded in the codebase and cannot be modified or deleted.
 */
export class BuiltinSkillRegistry {
  private static readonly BUILTIN_SKILLS: Array<
    Omit<SkillConfig, 'level' | 'filePath'>
  > = [
    {
      name: 'code-analysis',
      description:
        'Analyzes code files for quality, performance, security, and readability issues',
      version: '1.0.0',
      category: 'code-analysis',
      tags: ['analysis', 'quality', 'review'],
      tools: ['Read', 'Grep', 'Glob'],
      systemPrompt: `You are a code analysis expert. Analyze the provided code file for issues and improvements.

Your task is to analyze the code at \${file_path} with a focus on: \${focus}

Analysis focus areas:
- **performance**: Look for inefficient algorithms, unnecessary operations, O(n) complexity issues
- **security**: Check for vulnerabilities, unsafe patterns, input validation issues
- **readability**: Assess code clarity, naming conventions, structure, documentation
- **all**: Comprehensive analysis across all areas

For each issue found, provide:
1. Line number (if applicable)
2. Severity (high/medium/low)
3. Clear description of the issue
4. Specific, actionable suggestion for improvement

Also calculate basic code metrics:
- Cyclomatic complexity (if applicable)
- Lines of code
- Number of functions/methods
- Duplicated code patterns

Return your analysis in a structured format with sections for each severity level.`,
      parameters: [
        {
          name: 'file_path',
          type: 'string',
          required: true,
          description: 'Absolute path to the code file to analyze',
        },
        {
          name: 'focus',
          type: 'string',
          enum: ['performance', 'security', 'readability', 'all'],
          default: 'all',
          description: 'Area of focus for the analysis',
        },
      ],
      output: {
        format: 'structured',
        schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            issues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  line: { type: 'number' },
                  severity: { type: 'string', enum: ['high', 'medium', 'low'] },
                  category: { type: 'string' },
                  description: { type: 'string' },
                  suggestion: { type: 'string' },
                },
              },
            },
            metrics: {
              type: 'object',
              properties: {
                lines_of_code: { type: 'number' },
                cyclomatic_complexity: { type: 'number' },
                function_count: { type: 'number' },
              },
            },
          },
        },
      },
      model: {
        model: 'qwen3-coder',
        temp: 0.3,
        max_tokens: 2048,
      },
    },
    {
      name: 'test-generator',
      description:
        'Generates comprehensive unit tests for functions, classes, or modules',
      version: '1.0.0',
      category: 'testing',
      tags: ['testing', 'unit-tests', 'quality'],
      tools: ['Read', 'Write', 'Grep'],
      systemPrompt: `You are a test generation expert. Generate comprehensive unit tests for the provided code.

Target: \${target_path}
Testing framework: \${framework}

Your task:
1. Read and understand the code at the target path
2. Identify all testable units (functions, methods, classes)
3. Generate tests covering:
   - Happy path scenarios
   - Edge cases
   - Error conditions
   - Boundary values
   - Invalid inputs

Test requirements:
- Use \${framework} testing framework syntax
- Include all necessary imports
- Use descriptive test names (describe what is being tested)
- Follow AAA pattern: Arrange, Act, Assert
- Add comments explaining complex test setups
- Aim for high code coverage

If coverage_target is specified, ensure tests cover at least that percentage of the code.

Return the complete test file content, ready to be saved.`,
      parameters: [
        {
          name: 'target_path',
          type: 'string',
          required: true,
          description: 'Path to the code file to generate tests for',
        },
        {
          name: 'framework',
          type: 'string',
          enum: ['vitest', 'jest', 'mocha', 'ava'],
          default: 'vitest',
          description: 'Testing framework to use',
        },
        {
          name: 'coverage_target',
          type: 'number',
          default: 80,
          description: 'Target code coverage percentage (0-100)',
        },
      ],
      output: {
        format: 'text',
      },
      model: {
        model: 'qwen3-coder',
        temp: 0.5,
        max_tokens: 3000,
      },
    },
    {
      name: 'documentation-writer',
      description:
        'Generates clear, comprehensive documentation for code files, functions, or APIs',
      version: '1.0.0',
      category: 'documentation',
      tags: ['documentation', 'docs', 'comments'],
      tools: ['Read', 'Write', 'Grep'],
      systemPrompt: `You are a technical documentation expert. Generate clear, comprehensive documentation for the provided code.

Target: \${target_path}
Documentation style: \${style}

Your task:
1. Read and understand the code structure
2. Generate documentation including:
   - Overview/summary of what the code does
   - Detailed API documentation (for functions/methods):
     - Purpose and behavior
     - Parameters with types and descriptions
     - Return values with types and descriptions
     - Thrown exceptions/errors
     - Usage examples
   - Implementation notes or important details
   - Related files or dependencies

Documentation styles:
- **jsdoc**: JSDoc format comments (/** ... */)
- **markdown**: Markdown documentation file
- **inline**: Inline code comments
- **api**: API reference format (REST/GraphQL)

Ensure documentation is:
- Clear and concise
- Accurate and up-to-date with code
- Includes practical examples
- Follows project conventions

Return the documentation in the requested format.`,
      parameters: [
        {
          name: 'target_path',
          type: 'string',
          required: true,
          description: 'Path to the code file to document',
        },
        {
          name: 'style',
          type: 'string',
          enum: ['jsdoc', 'markdown', 'inline', 'api'],
          default: 'jsdoc',
          description: 'Documentation style to generate',
        },
      ],
      output: {
        format: 'text',
      },
      model: {
        model: 'qwen3-coder',
        temp: 0.4,
        max_tokens: 2500,
      },
    },
    {
      name: 'bug-diagnosis',
      description:
        'Diagnoses bugs from error messages, stack traces, and code inspection',
      version: '1.0.0',
      category: 'debugging',
      tags: ['debugging', 'errors', 'troubleshooting'],
      tools: ['Read', 'Grep', 'Glob', 'Shell'],
      systemPrompt: `You are a debugging expert. Diagnose the bug and provide actionable solutions.

Error information:
\${error_message}

Context:
- File: \${file_path} (if applicable)
- Additional context: \${context}

Your task:
1. Understand the error message and stack trace
2. If file_path is provided, examine the relevant code
3. Use Grep/Glob to search for related code patterns
4. Identify the root cause of the issue
5. Provide:
   - Clear explanation of what went wrong
   - Root cause analysis
   - Step-by-step fix instructions
   - Code examples showing the fix
   - Prevention tips to avoid similar issues

Investigation approach:
- Check for common issues: null/undefined, type mismatches, async/await problems
- Look for related error patterns in the codebase
- Consider environment/dependency issues
- Verify proper error handling

Be thorough but concise. Focus on actionable solutions.`,
      parameters: [
        {
          name: 'error_message',
          type: 'string',
          required: true,
          description: 'The error message or stack trace',
        },
        {
          name: 'file_path',
          type: 'string',
          description: 'Path to the file where the error occurred',
        },
        {
          name: 'context',
          type: 'string',
          description: 'Additional context about the error',
        },
      ],
      output: {
        format: 'structured',
        schema: {
          type: 'object',
          properties: {
            explanation: { type: 'string' },
            root_cause: { type: 'string' },
            fix_steps: {
              type: 'array',
              items: { type: 'string' },
            },
            code_example: { type: 'string' },
            prevention_tips: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
      model: {
        model: 'qwen3-coder',
        temp: 0.3,
        max_tokens: 2000,
      },
    },
    {
      name: 'commit-message-generator',
      description:
        'Generates conventional commit messages from git diffs or change descriptions',
      version: '1.0.0',
      category: 'automation',
      tags: ['git', 'commit', 'automation'],
      tools: ['Shell', 'Read'],
      systemPrompt: `You are a git commit message expert. Generate concise, informative commit messages following Conventional Commits specification.

Format: <type>(<scope>): <subject>

Types:
- feat: A new feature
- fix: A bug fix
- docs: Documentation only changes
- style: Changes that don't affect code meaning (formatting, etc.)
- refactor: Code change that neither fixes a bug nor adds a feature
- perf: Performance improvements
- test: Adding or updating tests
- chore: Changes to build process or auxiliary tools

Guidelines:
- Keep subject line under 50 characters
- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter of subject
- No period at the end of subject
- Include body for complex changes (optional)
- Reference issue numbers if applicable

If diff_path is provided, analyze the git diff. Otherwise, use the change_description.

Return a well-formatted commit message with optional body explaining the "why" behind the changes.`,
      parameters: [
        {
          name: 'diff_path',
          type: 'string',
          description: 'Path to file containing git diff (alternative to change_description)',
        },
        {
          name: 'change_description',
          type: 'string',
          description: 'Description of changes (alternative to diff_path)',
        },
        {
          name: 'include_body',
          type: 'boolean',
          default: false,
          description: 'Whether to include detailed body in commit message',
        },
      ],
      output: {
        format: 'text',
      },
      model: {
        model: 'qwen3-coder',
        temp: 0.4,
        max_tokens: 500,
      },
    },
  ];

  /**
   * Gets all built-in skill configurations.
   * @returns Array of built-in skill configurations
   */
  static getBuiltinSkills(): SkillConfig[] {
    return this.BUILTIN_SKILLS.map((skill) => ({
      ...skill,
      level: 'builtin' as const,
      filePath: `<builtin:${skill.name}>`,
      isBuiltin: true,
    }));
  }

  /**
   * Gets a specific built-in skill by name.
   * @param name - Name of the built-in skill
   * @returns Built-in skill configuration or null if not found
   */
  static getBuiltinSkill(name: string): SkillConfig | null {
    const skill = this.BUILTIN_SKILLS.find((s) => s.name === name);
    if (!skill) {
      return null;
    }

    return {
      ...skill,
      level: 'builtin' as const,
      filePath: `<builtin:${name}>`,
      isBuiltin: true,
    };
  }

  /**
   * Checks if a skill name corresponds to a built-in skill.
   * @param name - Skill name to check
   * @returns True if the name is a built-in skill
   */
  static isBuiltinSkill(name: string): boolean {
    return this.BUILTIN_SKILLS.some((skill) => skill.name === name);
  }

  /**
   * Gets the names of all built-in skills.
   * @returns Array of built-in skill names
   */
  static getBuiltinSkillNames(): string[] {
    return this.BUILTIN_SKILLS.map((skill) => skill.name);
  }
}
