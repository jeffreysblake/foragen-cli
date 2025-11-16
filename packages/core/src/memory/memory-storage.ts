/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  MemoryEntry,
  MemoryScope,
  SerializedMemoryEntry,
} from './types.js';
import { parseMemoryFile, serializeMemoryFile } from './memory-parser.js';

const FORA_CONFIG_DIR = '.fora';
const MEMORY_FILENAME = 'FORA.md';

/**
 * Handles storage and retrieval of memories from FORA.md files.
 */
export class MemoryStorage {
  constructor(
    private readonly projectRoot: string,
    private readonly userHome: string,
  ) {}

  /**
   * Loads all memories from all scopes.
   *
   * @returns Array of all memory entries
   */
  async loadAllMemories(): Promise<MemoryEntry[]> {
    const memories: MemoryEntry[] = [];

    // Load global memories
    try {
      const globalMemories = await this.loadMemoriesFromScope('global');
      memories.push(...globalMemories);
    } catch (_error) {
      // File might not exist yet
    }

    // Load project memories
    try {
      const projectMemories = await this.loadMemoriesFromScope('project');
      memories.push(...projectMemories);
    } catch (_error) {
      // File might not exist yet
    }

    return memories;
  }

  /**
   * Loads memories from a specific scope.
   *
   * @param scope - Memory scope
   * @returns Array of memory entries
   */
  async loadMemoriesFromScope(scope: MemoryScope): Promise<MemoryEntry[]> {
    if (scope === 'session') {
      // Session memories are not persisted to disk
      return [];
    }

    const filePath = this.getMemoryFilePath(scope);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      return parseMemoryFile(content, scope);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist yet
        return [];
      }
      throw error;
    }
  }

  /**
   * Saves a memory entry to the appropriate file.
   *
   * @param memory - Memory entry to save
   */
  async saveMemory(memory: MemoryEntry): Promise<void> {
    if (memory.scope === 'session') {
      // Session memories are not persisted
      return;
    }

    const filePath = this.getMemoryFilePath(memory.scope);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Load existing memories
    const existingMemories = await this.loadMemoriesFromScope(memory.scope);

    // Update or add the memory
    const index = existingMemories.findIndex((m) => m.id === memory.id);
    if (index >= 0) {
      existingMemories[index] = memory;
    } else {
      existingMemories.push(memory);
    }

    // Serialize and write
    const content = serializeMemoryFile(existingMemories);
    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * Deletes a memory entry from storage.
   *
   * @param memory - Memory entry to delete
   */
  async deleteMemory(memory: MemoryEntry): Promise<void> {
    if (memory.scope === 'session') {
      // Session memories are not persisted
      return;
    }

    const filePath = this.getMemoryFilePath(memory.scope);

    // Load existing memories
    const existingMemories = await this.loadMemoriesFromScope(memory.scope);

    // Filter out the deleted memory
    const updatedMemories = existingMemories.filter((m) => m.id !== memory.id);

    // Serialize and write
    const content = serializeMemoryFile(updatedMemories);
    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * Gets the file path for a memory scope.
   *
   * @param scope - Memory scope
   * @returns Absolute file path
   */
  private getMemoryFilePath(scope: MemoryScope): string {
    if (scope === 'global') {
      return path.join(this.userHome, FORA_CONFIG_DIR, MEMORY_FILENAME);
    } else if (scope === 'project') {
      return path.join(this.projectRoot, FORA_CONFIG_DIR, MEMORY_FILENAME);
    }
    throw new Error(`Cannot get file path for scope: ${scope}`);
  }

  /**
   * Exports memories to JSON format.
   *
   * @param memories - Memories to export
   * @returns JSON string
   */
  exportToJson(memories: MemoryEntry[]): string {
    const serialized: SerializedMemoryEntry[] = memories.map((m) => ({
      id: m.id,
      timestamp: m.timestamp.toISOString(),
      type: m.type,
      scope: m.scope,
      content: m.content,
      tags: m.tags,
      context: m.context,
      confidence: m.confidence,
      source: m.source,
      usageCount: m.usageCount,
      lastAccessed: m.lastAccessed.toISOString(),
      relatedMemories: m.relatedMemories,
    }));

    return JSON.stringify(serialized, null, 2);
  }

  /**
   * Imports memories from JSON format.
   *
   * @param json - JSON string
   * @returns Array of memory entries
   */
  importFromJson(json: string): MemoryEntry[] {
    const serialized: SerializedMemoryEntry[] = JSON.parse(json);

    return serialized.map((s) => ({
      id: s.id,
      timestamp: new Date(s.timestamp),
      type: s.type,
      scope: s.scope,
      content: s.content,
      tags: s.tags,
      context: s.context,
      confidence: s.confidence,
      source: s.source,
      usageCount: s.usageCount,
      lastAccessed: new Date(s.lastAccessed),
      relatedMemories: s.relatedMemories,
    }));
  }
}
