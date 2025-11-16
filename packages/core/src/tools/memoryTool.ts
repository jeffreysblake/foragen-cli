/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolEditConfirmationDetails, ToolResult } from './tools.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  ToolConfirmationOutcome,
} from './tools.js';
import type { FunctionDeclaration } from '@google/genai';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Storage } from '../config/storage.js';
import * as Diff from 'diff';
import { DEFAULT_DIFF_OPTIONS } from './diffOptions.js';
import { tildeifyPath } from '../utils/paths.js';
import type {
  ModifiableDeclarativeTool,
  ModifyContext,
} from './modifiable-tool.js';
import { ToolErrorType } from './tool-error.js';
import type { Config } from '../config/config.js';
import type { MemoryScope } from '../memory/types.js';
import { extractTags, extractContext } from '../memory/memory-utils.js';

const memoryToolSchemaData: FunctionDeclaration = {
  name: 'save_memory',
  description:
    'Saves a specific piece of information or fact to your long-term memory with enhanced metadata. Use this when the user explicitly asks you to remember something, or when they state a clear, concise fact that seems important to retain for future interactions.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      fact: {
        type: 'string',
        description:
          'The specific fact or piece of information to remember. Should be a clear, self-contained statement. You can include #hashtags to auto-tag the memory.',
      },
      scope: {
        type: 'string',
        description:
          'Where to save the memory: "global" saves to user-level ~/.fora/FORA.md (shared across all projects), "project" saves to current project\'s FORA.md (project-specific). If not specified, will prompt user to choose.',
        enum: ['global', 'project'],
      },
    },
    required: ['fact'],
  },
};

const memoryToolDescription = `
Saves a specific piece of information or fact to your long-term memory with enhanced metadata support.

Use this tool:

- When the user explicitly asks you to remember something (e.g., "Remember that I like pineapple on pizza", "Please save this: my cat's name is Whiskers").
- When the user states a clear, concise fact about themselves, their preferences, or their environment that seems important for you to retain for future interactions to provide a more personalized and effective assistance.

Do NOT use this tool:

- To remember conversational context that is only relevant for the current session.
- To save long, complex, or rambling pieces of text. The fact should be relatively short and to the point.
- If you are unsure whether the information is a fact worth remembering long-term. If in doubt, you can ask the user, "Should I remember that for you?"

## Enhanced Features

The memory system now supports:
- **Auto-tagging**: Use #hashtags in your fact to automatically tag the memory (e.g., "User prefers #typescript over JavaScript")
- **Context detection**: File paths and module names are automatically detected
- **Deduplication**: Similar memories won't be saved twice
- **Search & ranking**: Memories are ranked by relevance, recency, and usage
- **Metadata tracking**: Each memory tracks confidence, source, and usage statistics

## Parameters

- \`fact\` (string, required): The specific fact or piece of information to remember. This should be a clear, self-contained statement. You can include #hashtags to categorize the memory.

  Examples:
  - "User prefers #vitest over Jest for #testing"
  - "In packages/core/, use strict TypeScript settings"
  - "My favorite color is blue"

- \`scope\` (string, optional): Where to save the memory:
  - "global": Saves to user-level ~/.fora/FORA.md (shared across all projects)
  - "project": Saves to current project's FORA.md (project-specific)
  - If not specified, the tool will ask the user where they want to save the memory.
`;

export const FORA_CONFIG_DIR = '.fora';
export const DEFAULT_CONTEXT_FILENAME = 'FORA.md';
export const MEMORY_SECTION_HEADER = '## Fora Added Memories';

// This variable will hold the currently configured filename for FORA.md context files.
// It defaults to DEFAULT_CONTEXT_FILENAME but can be overridden by setGeminiMdFilename.
let currentGeminiMdFilename: string | string[] = DEFAULT_CONTEXT_FILENAME;

export function setGeminiMdFilename(newFilename: string | string[]): void {
  if (Array.isArray(newFilename)) {
    if (newFilename.length > 0) {
      currentGeminiMdFilename = newFilename.map((name) => name.trim());
    }
  } else if (newFilename && newFilename.trim() !== '') {
    currentGeminiMdFilename = newFilename.trim();
  }
}

export function getCurrentGeminiMdFilename(): string {
  if (Array.isArray(currentGeminiMdFilename)) {
    return currentGeminiMdFilename[0];
  }
  return currentGeminiMdFilename;
}

export function getAllGeminiMdFilenames(): string[] {
  if (Array.isArray(currentGeminiMdFilename)) {
    return currentGeminiMdFilename;
  }
  return [currentGeminiMdFilename];
}

interface SaveMemoryParams {
  fact: string;
  modified_by_user?: boolean;
  modified_content?: string;
  scope?: 'global' | 'project';
}

function getGlobalMemoryFilePath(): string {
  return path.join(Storage.getGlobalForaDir(), getCurrentGeminiMdFilename());
}

function getProjectMemoryFilePath(): string {
  return path.join(process.cwd(), getCurrentGeminiMdFilename());
}

function getMemoryFilePath(scope: 'global' | 'project' = 'global'): string {
  return scope === 'project'
    ? getProjectMemoryFilePath()
    : getGlobalMemoryFilePath();
}

/**
 * Reads the current content of the memory file (for preview/diff purposes)
 */
async function readMemoryFileContent(
  scope: 'global' | 'project' = 'global',
): Promise<string> {
  try {
    return await fs.readFile(getMemoryFilePath(scope), 'utf-8');
  } catch (err) {
    const error = err as Error & { code?: string };
    if (!(error instanceof Error) || error.code !== 'ENOENT') throw err;
    return '';
  }
}

class MemoryToolInvocation extends BaseToolInvocation<
  SaveMemoryParams,
  ToolResult
> {
  private static readonly allowlist: Set<string> = new Set();

  constructor(
    params: SaveMemoryParams,
    private readonly config: Config,
  ) {
    super(params);
  }

  getDescription(): string {
    if (!this.params.scope) {
      const globalPath = tildeifyPath(getMemoryFilePath('global'));
      const projectPath = tildeifyPath(getMemoryFilePath('project'));
      return `CHOOSE: ${globalPath} (global) OR ${projectPath} (project)`;
    }
    const scope = this.params.scope;
    const memoryFilePath = getMemoryFilePath(scope);
    return `${tildeifyPath(memoryFilePath)} (${scope})`;
  }

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<ToolEditConfirmationDetails | false> {
    // When scope is not specified, show a choice dialog defaulting to global
    if (!this.params.scope) {
      const defaultScope = 'global';
      const currentContent = await readMemoryFileContent(defaultScope);

      // Generate preview of what would be added
      const tags = extractTags(this.params.fact);
      const context = extractContext(this.params.fact);

      const previewText = `### Memory Entry: ${new Date().toISOString()}
**Type**: fact
**Scope**: ${defaultScope}
${tags.length > 0 ? `**Tags**: ${tags.map(t => `#${t}`).join(' ')}\n` : ''}${context ? `**Context**: ${context}\n` : ''}**Confidence**: 1.00
**Source**: explicit

${this.params.fact}`;

      const globalPath = tildeifyPath(getMemoryFilePath('global'));
      const projectPath = tildeifyPath(getMemoryFilePath('project'));

      const fileName = path.basename(getMemoryFilePath(defaultScope));
      const choiceText = `Choose where to save this memory:

"${this.params.fact}"

${tags.length > 0 ? `Auto-detected tags: ${tags.map(t => `#${t}`).join(', ')}\n` : ''}${context ? `Auto-detected context: ${context}\n` : ''}
Options:
- Global: ${globalPath} (shared across all projects)
- Project: ${projectPath} (current project only)

Preview of enhanced memory format (GLOBAL):
`;
      const fileDiff =
        choiceText +
        Diff.createPatch(
          fileName,
          currentContent,
          currentContent + '\n' + previewText + '\n',
          'Current',
          'Proposed (Global)',
          DEFAULT_DIFF_OPTIONS,
        );

      const confirmationDetails: ToolEditConfirmationDetails = {
        type: 'edit',
        title: `Choose Memory Location: GLOBAL (${globalPath}) or PROJECT (${projectPath})`,
        fileName,
        filePath: getMemoryFilePath(defaultScope),
        fileDiff,
        originalContent: `scope: global\n\n# INSTRUCTIONS:\n# - Click "Yes" to save to GLOBAL memory: ${globalPath}\n# - Click "Modify with external editor" and change "global" to "project" to save to PROJECT memory: ${projectPath}\n\n${currentContent}`,
        newContent: `scope: global\n\n# INSTRUCTIONS:\n# - Click "Yes" to save to GLOBAL memory: ${globalPath}\n# - Click "Modify with external editor" and change "global" to "project" to save to PROJECT memory: ${projectPath}\n\n${currentContent}\n${previewText}\n`,
        onConfirm: async (_outcome: ToolConfirmationOutcome) => {
          // Will be handled in createUpdatedParams
        },
      };
      return confirmationDetails;
    }

    // Only check allowlist when scope is specified
    const scope = this.params.scope;
    const memoryFilePath = getMemoryFilePath(scope);
    const allowlistKey = `${memoryFilePath}_${scope}`;

    if (MemoryToolInvocation.allowlist.has(allowlistKey)) {
      return false;
    }

    // Read current content for preview
    const currentContent = await readMemoryFileContent(scope);

    // Generate preview
    const tags = extractTags(this.params.fact);
    const context = extractContext(this.params.fact);

    const previewText = `### Memory Entry: ${new Date().toISOString()}
**Type**: fact
**Scope**: ${scope}
${tags.length > 0 ? `**Tags**: ${tags.map(t => `#${t}`).join(' ')}\n` : ''}${context ? `**Context**: ${context}\n` : ''}**Confidence**: 1.00
**Source**: explicit

${this.params.fact}`;

    const newContent = currentContent + '\n' + previewText + '\n';

    const fileName = path.basename(memoryFilePath);
    const fileDiff = Diff.createPatch(
      fileName,
      currentContent,
      newContent,
      'Current',
      'Proposed',
      DEFAULT_DIFF_OPTIONS,
    );

    const confirmationDetails: ToolEditConfirmationDetails = {
      type: 'edit',
      title: `Confirm Memory Save: ${tildeifyPath(memoryFilePath)} (${scope})`,
      fileName: memoryFilePath,
      filePath: memoryFilePath,
      fileDiff,
      originalContent: currentContent,
      newContent,
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          MemoryToolInvocation.allowlist.add(allowlistKey);
        }
      },
    };
    return confirmationDetails;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const { fact, modified_by_user, modified_content } = this.params;

    if (!fact || typeof fact !== 'string' || fact.trim() === '') {
      const errorMessage = 'Parameter "fact" must be a non-empty string.';
      return {
        llmContent: `Error: ${errorMessage}`,
        returnDisplay: `Error: ${errorMessage}`,
      };
    }

    // If scope is not specified and user didn't modify content, return error prompting for choice
    if (!this.params.scope && !modified_by_user) {
      const globalPath = tildeifyPath(getMemoryFilePath('global'));
      const projectPath = tildeifyPath(getMemoryFilePath('project'));
      const errorMessage = `Please specify where to save this memory:

Global: ${globalPath} (shared across all projects)
Project: ${projectPath} (current project only)`;

      return {
        llmContent: errorMessage,
        returnDisplay: errorMessage,
      };
    }

    const scope = this.params.scope || 'global';
    const memoryFilePath = getMemoryFilePath(scope);

    try {
      if (modified_by_user && modified_content !== undefined) {
        // User modified the content in external editor, write it directly
        await fs.mkdir(path.dirname(memoryFilePath), {
          recursive: true,
        });
        await fs.writeFile(memoryFilePath, modified_content, 'utf-8');

        // Also refresh the memory manager cache
        await this.config.getMemoryManager().refresh();

        const successMessage = `Okay, I've updated the ${scope} memory file with your modifications.`;
        return {
          llmContent: successMessage,
          returnDisplay: successMessage,
        };
      } else {
        // Use the enhanced MemoryManager
        const memoryManager = this.config.getMemoryManager();

        // Extract metadata from the fact
        const tags = extractTags(fact);
        const context = extractContext(fact);

        // Add memory with enhanced metadata
        await memoryManager.addMemory(fact, {
          scope: scope as MemoryScope,
          type: 'fact',
          tags,
          context,
          source: 'explicit',
          confidence: 1.0,
          checkDuplicates: true, // Auto-deduplicate
        });

        const tagsInfo = tags.length > 0 ? ` (tagged: ${tags.map(t => `#${t}`).join(', ')})` : '';
        const contextInfo = context ? ` [context: ${context}]` : '';
        const successMessage = `Okay, I've remembered that in ${scope} memory: "${fact}"${tagsInfo}${contextInfo}`;

        return {
          llmContent: successMessage,
          returnDisplay: successMessage,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[MemoryTool] Error executing save_memory for fact "${fact}" in ${scope}: ${errorMessage}`,
      );

      return {
        llmContent: `Error saving memory: ${errorMessage}`,
        returnDisplay: `Error saving memory: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.MEMORY_TOOL_EXECUTION_ERROR,
        },
      };
    }
  }
}

export class MemoryTool
  extends BaseDeclarativeTool<SaveMemoryParams, ToolResult>
  implements ModifiableDeclarativeTool<SaveMemoryParams>
{
  static readonly Name: string = memoryToolSchemaData.name!;

  constructor(private readonly config: Config) {
    super(
      MemoryTool.Name,
      'SaveMemory',
      memoryToolDescription,
      Kind.Think,
      memoryToolSchemaData.parametersJsonSchema as Record<string, unknown>,
    );
  }

  protected override validateToolParamValues(
    params: SaveMemoryParams,
  ): string | null {
    if (params.fact.trim() === '') {
      return 'Parameter "fact" must be a non-empty string.';
    }
    return null;
  }

  protected createInvocation(params: SaveMemoryParams) {
    return new MemoryToolInvocation(params, this.config);
  }

  getModifyContext(_abortSignal: AbortSignal): ModifyContext<SaveMemoryParams> {
    return {
      getFilePath: (params: SaveMemoryParams) => {
        const scope = params.scope || 'global';
        return getMemoryFilePath(scope);
      },
      getCurrentContent: async (params: SaveMemoryParams) => {
        const scope = params.scope || 'global';
        return await readMemoryFileContent(scope);
      },
      getProposedContent: async (params: SaveMemoryParams) => {
        const scope = params.scope || 'global';
        const currentContent = await readMemoryFileContent(scope);
        const tags = extractTags(params.fact);
        const context = extractContext(params.fact);

        const previewText = `### Memory Entry: ${new Date().toISOString()}
**Type**: fact
**Scope**: ${scope}
${tags.length > 0 ? `**Tags**: ${tags.map(t => `#${t}`).join(' ')}\n` : ''}${context ? `**Context**: ${context}\n` : ''}**Confidence**: 1.00
**Source**: explicit

${params.fact}`;

        return currentContent + '\n' + previewText + '\n';
      },
      createUpdatedParams: (
        _oldContent: string,
        modifiedProposedContent: string,
        originalParams: SaveMemoryParams,
      ) => {
        // Extract scope from modified content
        const scopeMatch = modifiedProposedContent.match(/^scope:\s*(global|project)/i);
        const scope = scopeMatch ? (scopeMatch[1].toLowerCase() as 'global' | 'project') : originalParams.scope;

        return {
          ...originalParams,
          scope,
          modified_by_user: true,
          modified_content: modifiedProposedContent,
        };
      },
    };
  }

  /**
   * Legacy static method for backward compatibility
   * @deprecated Use MemoryManager directly instead
   */
  static async performAddMemoryEntry(
    fact: string,
    memoryFilePath: string,
    fileSystem: {
      readFile: typeof fs.readFile;
      writeFile: typeof fs.writeFile;
      mkdir: typeof fs.mkdir;
    },
  ): Promise<void> {
    // Legacy implementation for backward compatibility
    const currentContent = await fileSystem
      .readFile(memoryFilePath, 'utf-8')
      .catch((err) => {
        if (err.code === 'ENOENT') return '';
        throw err;
      });

    let processedText = fact.trim();
    processedText = processedText.replace(/^(-+\s*)+/, '').trim();
    const newMemoryItem = `- ${processedText}`;

    const headerIndex = currentContent.indexOf(MEMORY_SECTION_HEADER);
    let newContent: string;

    if (headerIndex === -1) {
      const separator = currentContent.length === 0 ? '' : '\n\n';
      newContent = currentContent + `${separator}${MEMORY_SECTION_HEADER}\n${newMemoryItem}\n`;
    } else {
      const startOfSectionContent = headerIndex + MEMORY_SECTION_HEADER.length;
      let endOfSectionIndex = currentContent.indexOf('\n## ', startOfSectionContent);
      if (endOfSectionIndex === -1) {
        endOfSectionIndex = currentContent.length;
      }

      const beforeSectionMarker = currentContent
        .substring(0, startOfSectionContent)
        .trimEnd();
      let sectionContent = currentContent
        .substring(startOfSectionContent, endOfSectionIndex)
        .trimEnd();
      const afterSectionMarker = currentContent.substring(endOfSectionIndex);

      sectionContent += `\n${newMemoryItem}`;
      newContent =
        `${beforeSectionMarker}\n${sectionContent.trimStart()}\n${afterSectionMarker}`.trimEnd() +
        '\n';
    }

    await fileSystem.mkdir(path.dirname(memoryFilePath), { recursive: true });
    await fileSystem.writeFile(memoryFilePath, newContent, 'utf-8');
  }
}
