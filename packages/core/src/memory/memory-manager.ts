/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  MemoryEntry,
  MemoryScope,
  MemoryType,
  SearchMemoryOptions,
  MemorySearchResult,
  AddMemoryOptions,
  MemoryStats,
  DuplicateCheckResult,
} from './types.js';
import { MemoryStorage } from './memory-storage.js';
import { generateMemoryId, calculateSimilarity } from './memory-utils.js';

/**
 * Manages enhanced memory with search, ranking, and deduplication.
 */
export class MemoryManager {
  private memoryCache: Map<string, MemoryEntry> = new Map();
  private cacheInitialized = false;
  private readonly storage: MemoryStorage;

  constructor(
    projectRoot: string,
    userHome: string,
  ) {
    this.storage = new MemoryStorage(projectRoot, userHome);
  }

  /**
   * Adds a new memory entry.
   *
   * @param content - Memory content
   * @param options - Memory options
   * @returns The created memory ID
   */
  async addMemory(
    content: string,
    options: AddMemoryOptions,
  ): Promise<string> {
    await this.ensureCacheInitialized();

    // Check for duplicates if requested
    if (options.checkDuplicates !== false) {
      const duplicateCheck = await this.checkDuplicate(content, options.scope);
      if (duplicateCheck.isDuplicate && duplicateCheck.duplicate) {
        // Update existing memory instead of creating duplicate
        await this.updateMemoryUsage(duplicateCheck.duplicate.id);
        return duplicateCheck.duplicate.id;
      }
    }

    // Create new memory entry
    const now = new Date();
    const entry: MemoryEntry = {
      id: generateMemoryId(),
      timestamp: now,
      type: options.type || 'fact',
      scope: options.scope,
      content: content.trim(),
      tags: options.tags || [],
      context: options.context,
      confidence: options.confidence ?? 1.0,
      source: options.source || 'explicit',
      usageCount: 0,
      lastAccessed: now,
    };

    // Add to cache
    this.memoryCache.set(entry.id, entry);

    // Persist to storage
    await this.storage.saveMemory(entry);

    return entry.id;
  }

  /**
   * Searches memories with flexible filtering and ranking.
   *
   * @param options - Search options
   * @returns Search results
   */
  async searchMemories(
    options: SearchMemoryOptions = {},
  ): Promise<MemorySearchResult> {
    await this.ensureCacheInitialized();

    let results = Array.from(this.memoryCache.values());

    // Apply filters
    if (options.type) {
      results = results.filter((m) => m.type === options.type);
    }

    if (options.scope) {
      results = results.filter((m) => m.scope === options.scope);
    }

    if (options.tags && options.tags.length > 0) {
      results = results.filter((m) =>
        options.tags!.some((tag) => m.tags.includes(tag)),
      );
    }

    if (options.context) {
      results = results.filter(
        (m) => m.context && m.context.includes(options.context!),
      );
    }

    if (options.minConfidence !== undefined) {
      results = results.filter((m) => m.confidence >= options.minConfidence!);
    }

    // Text search if query provided
    if (options.query && options.query.trim() !== '') {
      const query = options.query.toLowerCase();
      results = results.filter(
        (m) =>
          m.content.toLowerCase().includes(query) ||
          m.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          (m.context && m.context.toLowerCase().includes(query)),
      );
    }

    const totalCount = results.length;

    // Sort results
    const sortBy = options.sortBy || 'relevance';
    results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'relevance':
          comparison = this.calculateRelevanceScore(b, options.query || '') -
            this.calculateRelevanceScore(a, options.query || '');
          break;
        case 'recency':
          comparison = b.timestamp.getTime() - a.timestamp.getTime();
          break;
        case 'usage':
          comparison = b.usageCount - a.usageCount;
          break;
        case 'confidence':
          comparison = b.confidence - a.confidence;
          break;
      }

      return options.sortOrder === 'asc' ? -comparison : comparison;
    });

    // Apply limit
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    // Update usage count for accessed memories
    for (const memory of results) {
      memory.usageCount++;
      memory.lastAccessed = new Date();
    }

    // Include related memories if requested
    if (options.includeRelated) {
      const relatedMemories = await this.getRelatedMemories(results);
      results = [...results, ...relatedMemories];
    }

    return {
      entries: results,
      totalCount,
      query: options.query,
    };
  }

  /**
   * Gets relevant memories based on current context.
   *
   * @param context - Context string (file path, topic, etc.)
   * @param limit - Maximum number of memories to return
   * @returns Relevant memory entries
   */
  async getRelevantMemories(
    context: string,
    limit = 5,
  ): Promise<MemoryEntry[]> {
    const result = await this.searchMemories({
      query: context,
      sortBy: 'relevance',
      limit,
    });
    return result.entries;
  }

  /**
   * Gets a memory by ID.
   *
   * @param id - Memory ID
   * @returns Memory entry or null if not found
   */
  async getMemory(id: string): Promise<MemoryEntry | null> {
    await this.ensureCacheInitialized();
    return this.memoryCache.get(id) || null;
  }

  /**
   * Updates a memory entry.
   *
   * @param id - Memory ID
   * @param updates - Fields to update
   */
  async updateMemory(
    id: string,
    updates: Partial<MemoryEntry>,
  ): Promise<void> {
    await this.ensureCacheInitialized();

    const existing = this.memoryCache.get(id);
    if (!existing) {
      throw new Error(`Memory ${id} not found`);
    }

    const updated: MemoryEntry = {
      ...existing,
      ...updates,
      // Preserve these fields
      id: existing.id,
      timestamp: existing.timestamp,
      scope: existing.scope,
    };

    this.memoryCache.set(id, updated);
    await this.storage.saveMemory(updated);
  }

  /**
   * Deletes a memory entry.
   *
   * @param id - Memory ID
   */
  async deleteMemory(id: string): Promise<void> {
    await this.ensureCacheInitialized();

    const memory = this.memoryCache.get(id);
    if (!memory) {
      throw new Error(`Memory ${id} not found`);
    }

    this.memoryCache.delete(id);
    await this.storage.deleteMemory(memory);
  }

  /**
   * Gets memory statistics.
   *
   * @returns Memory statistics
   */
  async getStats(): Promise<MemoryStats> {
    await this.ensureCacheInitialized();

    const memories = Array.from(this.memoryCache.values());

    // Count by scope
    const byScope: Record<MemoryScope, number> = {
      global: 0,
      project: 0,
      session: 0,
    };
    for (const memory of memories) {
      byScope[memory.scope]++;
    }

    // Count by type
    const byType: Record<MemoryType, number> = {
      fact: 0,
      preference: 0,
      instruction: 0,
      example: 0,
      reference: 0,
    };
    for (const memory of memories) {
      byType[memory.type]++;
    }

    // Most used memories
    const sortedByUsage = [...memories].sort(
      (a, b) => b.usageCount - a.usageCount,
    );
    const mostUsed = sortedByUsage.slice(0, 10).map((m) => ({
      id: m.id,
      content: m.content.substring(0, 100), // Truncate for display
      usageCount: m.usageCount,
    }));

    // Recently added (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentlyAdded = memories.filter(
      (m) => m.timestamp > sevenDaysAgo,
    ).length;

    // Average confidence
    const averageConfidence =
      memories.length > 0
        ? memories.reduce((sum, m) => sum + m.confidence, 0) / memories.length
        : 0;

    return {
      total: memories.length,
      byScope,
      byType,
      mostUsed,
      recentlyAdded,
      averageConfidence,
    };
  }

  /**
   * Checks if a memory is a duplicate.
   *
   * @param content - Memory content to check
   * @param scope - Memory scope
   * @returns Duplicate check result
   */
  async checkDuplicate(
    content: string,
    scope: MemoryScope,
  ): Promise<DuplicateCheckResult> {
    await this.ensureCacheInitialized();

    const memories = Array.from(this.memoryCache.values()).filter(
      (m) => m.scope === scope,
    );

    let bestMatch: MemoryEntry | undefined;
    let highestSimilarity = 0;

    for (const memory of memories) {
      const similarity = calculateSimilarity(content, memory.content);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = memory;
      }
    }

    // Consider it a duplicate if similarity > 0.85
    const isDuplicate = highestSimilarity > 0.85;

    return {
      isDuplicate,
      duplicate: isDuplicate ? bestMatch : undefined,
      similarity: highestSimilarity,
    };
  }

  /**
   * Updates the usage count for a memory.
   *
   * @param id - Memory ID
   */
  private async updateMemoryUsage(id: string): Promise<void> {
    const memory = this.memoryCache.get(id);
    if (memory) {
      memory.usageCount++;
      memory.lastAccessed = new Date();
      // Update confidence slightly on repeated access
      memory.confidence = Math.min(1.0, memory.confidence + 0.01);
      await this.storage.saveMemory(memory);
    }
  }

  /**
   * Calculates relevance score for a memory.
   *
   * @param entry - Memory entry
   * @param query - Search query
   * @returns Relevance score (0.0 to 1.0)
   */
  private calculateRelevanceScore(entry: MemoryEntry, query: string): number {
    const recencyWeight = 0.3;
    const confidenceWeight = 0.4;
    const usageWeight = 0.3;

    // Recency score (exponential decay over 30 days)
    const daysSinceAccessed =
      (Date.now() - entry.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.exp(-daysSinceAccessed / 30);

    // Confidence score (already 0-1)
    const confidenceScore = entry.confidence;

    // Usage score (normalized to 0-1, capped at 10 uses)
    const usageScore = Math.min(entry.usageCount / 10, 1);

    // Text relevance bonus if query matches
    let textRelevanceBonus = 0;
    if (query) {
      const queryLower = query.toLowerCase();
      const contentLower = entry.content.toLowerCase();
      if (contentLower.includes(queryLower)) {
        textRelevanceBonus = 0.2;
      }
    }

    return (
      recencyScore * recencyWeight +
      confidenceScore * confidenceWeight +
      usageScore * usageWeight +
      textRelevanceBonus
    );
  }

  /**
   * Gets related memories for a set of memory entries.
   *
   * @param entries - Memory entries
   * @returns Related memory entries
   */
  private async getRelatedMemories(
    entries: MemoryEntry[],
  ): Promise<MemoryEntry[]> {
    const relatedIds = new Set<string>();

    for (const entry of entries) {
      if (entry.relatedMemories) {
        for (const id of entry.relatedMemories) {
          relatedIds.add(id);
        }
      }
    }

    const related: MemoryEntry[] = [];
    for (const id of relatedIds) {
      const memory = this.memoryCache.get(id);
      if (memory) {
        related.push(memory);
      }
    }

    return related;
  }

  /**
   * Ensures the cache is initialized by loading from storage.
   */
  private async ensureCacheInitialized(): Promise<void> {
    if (this.cacheInitialized) {
      return;
    }

    const memories = await this.storage.loadAllMemories();
    for (const memory of memories) {
      this.memoryCache.set(memory.id, memory);
    }

    this.cacheInitialized = true;
  }

  /**
   * Clears the cache and reloads from storage.
   */
  async refresh(): Promise<void> {
    this.memoryCache.clear();
    this.cacheInitialized = false;
    await this.ensureCacheInitialized();
  }
}
