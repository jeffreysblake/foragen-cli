/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MemoryEntry, MemoryScope, MemoryType, MemorySource } from './types.js';
import { generateMemoryId } from './memory-utils.js';

const MEMORY_SECTION_HEADER = '## Fora Added Memories';
const MEMORY_ENTRY_PREFIX = '### Memory Entry:';

/**
 * Parses a FORA.md file and extracts memory entries.
 * Supports both legacy (simple text) and enhanced (structured with metadata) formats.
 *
 * @param content - File content
 * @param scope - Memory scope
 * @returns Array of memory entries
 */
export function parseMemoryFile(
  content: string,
  scope: MemoryScope,
): MemoryEntry[] {
  const memories: MemoryEntry[] = [];

  // Find the memory section
  const sectionIndex = content.indexOf(MEMORY_SECTION_HEADER);
  if (sectionIndex === -1) {
    // No memory section found
    return memories;
  }

  const memorySection = content.substring(
    sectionIndex + MEMORY_SECTION_HEADER.length,
  );

  // Try to parse as enhanced format first
  const enhancedMemories = parseEnhancedFormat(memorySection, scope);
  if (enhancedMemories.length > 0) {
    return enhancedMemories;
  }

  // Fall back to legacy format
  return parseLegacyFormat(memorySection, scope);
}

/**
 * Parses enhanced memory format with metadata headers.
 *
 * Example:
 * ### Memory Entry: 2025-11-06T14:32:00Z
 * **ID**: mem_abc123
 * **Type**: preference
 * **Scope**: project
 * **Tags**: #typescript #testing
 * **Context**: packages/core/src/
 * **Confidence**: 0.95
 *
 * User prefers Vitest over Jest for testing.
 *
 * @param content - Memory section content
 * @param scope - Memory scope
 * @returns Array of memory entries
 */
function parseEnhancedFormat(
  content: string,
  scope: MemoryScope,
): MemoryEntry[] {
  const memories: MemoryEntry[] = [];
  const entries = content.split(MEMORY_ENTRY_PREFIX).slice(1); // Skip before first entry

  for (const entryText of entries) {
    try {
      const memory = parseEnhancedEntry(entryText.trim(), scope);
      if (memory) {
        memories.push(memory);
      }
    } catch (error) {
      console.warn('Failed to parse memory entry:', error);
      // Continue with other entries
    }
  }

  return memories;
}

/**
 * Parses a single enhanced memory entry.
 *
 * @param entryText - Entry text
 * @param scope - Memory scope
 * @returns Memory entry or null if parsing fails
 */
function parseEnhancedEntry(
  entryText: string,
  scope: MemoryScope,
): MemoryEntry | null {
  const lines = entryText.split('\n');

  // First line should have timestamp
  const timestampMatch = lines[0].match(/(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/);
  if (!timestampMatch) {
    return null;
  }

  const timestamp = new Date(timestampMatch[1]);

  // Parse metadata fields
  let id = generateMemoryId();
  let type: MemoryType = 'fact';
  let tags: string[] = [];
  let context: string | undefined;
  let confidence = 1.0;
  let source: MemorySource = 'explicit';
  let usageCount = 0;
  let lastAccessed = timestamp;

  let contentStartIndex = 1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('**ID**:')) {
      id = line.replace('**ID**:', '').trim();
    } else if (line.startsWith('**Type**:')) {
      type = line.replace('**Type**:', '').trim() as MemoryType;
    } else if (line.startsWith('**Tags**:')) {
      const tagsStr = line.replace('**Tags**:', '').trim();
      tags = tagsStr
        .split(/\s+/)
        .map((t) => t.replace(/^#/, ''))
        .filter((t) => t.length > 0);
    } else if (line.startsWith('**Context**:')) {
      context = line.replace('**Context**:', '').trim();
    } else if (line.startsWith('**Confidence**:')) {
      confidence = parseFloat(line.replace('**Confidence**:', '').trim());
    } else if (line.startsWith('**Source**:')) {
      source = line.replace('**Source**:', '').trim() as MemorySource;
    } else if (line.startsWith('**Usage**:')) {
      usageCount = parseInt(line.replace('**Usage**:', '').trim(), 10);
    } else if (line.startsWith('**Last Accessed**:')) {
      lastAccessed = new Date(
        line.replace('**Last Accessed**:', '').trim(),
      );
    } else if (line === '') {
      // Empty line marks end of metadata
      contentStartIndex = i + 1;
      break;
    }
  }

  // Extract content (everything after metadata)
  const content = lines.slice(contentStartIndex).join('\n').trim();

  if (!content) {
    return null;
  }

  return {
    id,
    timestamp,
    type,
    scope,
    content,
    tags,
    context,
    confidence,
    source,
    usageCount,
    lastAccessed,
  };
}

/**
 * Parses legacy memory format (simple text list).
 *
 * Example:
 * - User prefers tabs over spaces
 * - Project uses TypeScript strict mode
 *
 * @param content - Memory section content
 * @param scope - Memory scope
 * @returns Array of memory entries
 */
function parseLegacyFormat(
  content: string,
  scope: MemoryScope,
): MemoryEntry[] {
  const memories: MemoryEntry[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and section headers
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse bullet points or numbered lists
    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);

    let memoryContent: string | null = null;

    if (bulletMatch) {
      memoryContent = bulletMatch[1];
    } else if (numberedMatch) {
      memoryContent = numberedMatch[1];
    } else if (trimmed.length > 0) {
      // Plain text line
      memoryContent = trimmed;
    }

    if (memoryContent) {
      const now = new Date();
      memories.push({
        id: generateMemoryId(),
        timestamp: now,
        type: 'fact',
        scope,
        content: memoryContent,
        tags: [],
        confidence: 1.0,
        source: 'explicit',
        usageCount: 0,
        lastAccessed: now,
      });
    }
  }

  return memories;
}

/**
 * Serializes memory entries to enhanced FORA.md format.
 *
 * @param memories - Memory entries to serialize
 * @returns Formatted content
 */
export function serializeMemoryFile(memories: MemoryEntry[]): string {
  let content = `${MEMORY_SECTION_HEADER}\n\n`;

  // Sort by timestamp (newest first)
  const sorted = [...memories].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  );

  for (const memory of sorted) {
    content += serializeMemoryEntry(memory);
    content += '\n';
  }

  return content;
}

/**
 * Serializes a single memory entry.
 *
 * @param memory - Memory entry
 * @returns Formatted entry
 */
function serializeMemoryEntry(memory: MemoryEntry): string {
  let entry = `${MEMORY_ENTRY_PREFIX} ${memory.timestamp.toISOString()}\n`;
  entry += `**ID**: ${memory.id}\n`;
  entry += `**Type**: ${memory.type}\n`;
  entry += `**Scope**: ${memory.scope}\n`;

  if (memory.tags.length > 0) {
    entry += `**Tags**: ${memory.tags.map((t) => `#${t}`).join(' ')}\n`;
  }

  if (memory.context) {
    entry += `**Context**: ${memory.context}\n`;
  }

  entry += `**Confidence**: ${memory.confidence.toFixed(2)}\n`;
  entry += `**Source**: ${memory.source}\n`;
  entry += `**Usage**: ${memory.usageCount}\n`;
  entry += `**Last Accessed**: ${memory.lastAccessed.toISOString()}\n`;
  entry += `\n${memory.content}\n`;

  return entry;
}

/**
 * Migrates legacy format to enhanced format.
 *
 * @param legacyContent - Legacy FORA.md content
 * @param scope - Memory scope
 * @returns Enhanced format content
 */
export function migrateLegacyToEnhanced(
  legacyContent: string,
  scope: MemoryScope,
): string {
  const memories = parseMemoryFile(legacyContent, scope);

  // Preserve any content before the memory section
  const sectionIndex = legacyContent.indexOf(MEMORY_SECTION_HEADER);
  const preContent =
    sectionIndex > 0 ? legacyContent.substring(0, sectionIndex) : '';

  return preContent + serializeMemoryFile(memories);
}
