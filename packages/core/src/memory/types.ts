/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Memory scope - determines where the memory is stored and accessible.
 */
export type MemoryScope = 'global' | 'project' | 'session';

/**
 * Memory type - categorizes the kind of information stored.
 */
export type MemoryType =
  | 'fact'        // Factual information
  | 'preference'  // User preferences
  | 'instruction' // Explicit instructions
  | 'example'     // Examples or patterns
  | 'reference';  // Reference information

/**
 * Memory source - how the memory was created.
 */
export type MemorySource =
  | 'user'      // Explicitly provided by user
  | 'inferred'  // Inferred from conversation
  | 'explicit'; // Explicitly saved via tool

/**
 * Enhanced memory entry with metadata.
 */
export interface MemoryEntry {
  /** Unique identifier */
  id: string;

  /** Memory creation timestamp */
  timestamp: Date;

  /** Memory type */
  type: MemoryType;

  /** Scope of memory */
  scope: MemoryScope;

  /** The actual memory content */
  content: string;

  /** Tags for categorization and search */
  tags: string[];

  /** Related context (file paths, modules, etc.) */
  context?: string;

  /** Confidence level (0.0 to 1.0) */
  confidence: number;

  /** How the memory was created */
  source: MemorySource;

  /** Number of times this memory has been accessed/used */
  usageCount: number;

  /** Last time this memory was accessed */
  lastAccessed: Date;

  /** Optional: Vector embedding for semantic search */
  embedding?: number[];

  /** Optional: Related memory IDs */
  relatedMemories?: string[];
}

/**
 * Serialized memory entry format for storage.
 */
export interface SerializedMemoryEntry {
  id: string;
  timestamp: string; // ISO string
  type: MemoryType;
  scope: MemoryScope;
  content: string;
  tags: string[];
  context?: string;
  confidence: number;
  source: MemorySource;
  usageCount: number;
  lastAccessed: string; // ISO string
  relatedMemories?: string[];
}

/**
 * Options for searching memories.
 */
export interface SearchMemoryOptions {
  /** Query string */
  query?: string;

  /** Filter by type */
  type?: MemoryType;

  /** Filter by scope */
  scope?: MemoryScope;

  /** Filter by tags */
  tags?: string[];

  /** Filter by context */
  context?: string;

  /** Minimum confidence level */
  minConfidence?: number;

  /** Sort by field */
  sortBy?: 'relevance' | 'recency' | 'usage' | 'confidence';

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';

  /** Maximum number of results */
  limit?: number;

  /** Include related memories */
  includeRelated?: boolean;
}

/**
 * Memory search result.
 */
export interface MemorySearchResult {
  /** Matching memory entries */
  entries: MemoryEntry[];

  /** Total count (before limit) */
  totalCount: number;

  /** Search query used */
  query?: string;
}

/**
 * Options for adding a new memory.
 */
export interface AddMemoryOptions {
  /** Memory type */
  type?: MemoryType;

  /** Memory scope */
  scope: MemoryScope;

  /** Tags */
  tags?: string[];

  /** Context */
  context?: string;

  /** Confidence */
  confidence?: number;

  /** Source */
  source?: MemorySource;

  /** Check for duplicates before adding */
  checkDuplicates?: boolean;
}

/**
 * Memory statistics.
 */
export interface MemoryStats {
  /** Total number of memories */
  total: number;

  /** Count by scope */
  byScope: Record<MemoryScope, number>;

  /** Count by type */
  byType: Record<MemoryType, number>;

  /** Most used memories (top 10) */
  mostUsed: Array<{ id: string; content: string; usageCount: number }>;

  /** Recently added */
  recentlyAdded: number; // Count in last 7 days

  /** Average confidence */
  averageConfidence: number;
}

/**
 * Result of deduplication check.
 */
export interface DuplicateCheckResult {
  /** Whether a duplicate was found */
  isDuplicate: boolean;

  /** Duplicate memory entry if found */
  duplicate?: MemoryEntry;

  /** Similarity score (0.0 to 1.0) */
  similarity?: number;
}
