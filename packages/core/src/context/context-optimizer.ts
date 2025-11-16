/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Content } from '@google/genai';
import type { Config } from '../config/config.js';
import type { MemoryEntry } from '../memory/types.js';

/**
 * Configuration for context optimization.
 */
export interface ContextOptimizerConfig {
  /** Maximum token budget for context */
  maxTokens: number;

  /** Reserve tokens for system prompt */
  systemPromptReserve: number;

  /** Reserve tokens for model response */
  responseReserve: number;

  /** Minimum messages to keep (most recent) */
  minMessages: number;

  /** Maximum memories to include */
  maxMemories: number;

  /** Strategy for pruning old messages */
  pruningStrategy: 'oldest-first' | 'least-relevant' | 'sliding-window';

  /** Whether to compress tool results */
  compressToolResults: boolean;

  /** Maximum length for compressed tool results */
  maxToolResultLength: number;
}

/**
 * Result of context optimization.
 */
export interface OptimizationResult {
  /** Optimized message history */
  messages: Content[];

  /** Selected memories to include */
  memories: MemoryEntry[];

  /** Estimated token usage */
  estimatedTokens: {
    system: number;
    messages: number;
    memories: number;
    reserve: number;
    total: number;
  };

  /** Statistics about optimization */
  stats: {
    originalMessageCount: number;
    optimizedMessageCount: number;
    prunedMessageCount: number;
    memoriesIncluded: number;
    tokensReclaimed: number;
  };
}

/**
 * Message relevance score for pruning decisions.
 */
interface MessageRelevance {
  index: number;
  message: Content;
  score: number;
  estimatedTokens: number;
}

/**
 * Optimizes context for local models with limited context windows.
 *
 * Features:
 * - Token-aware message pruning
 * - Memory integration and prioritization
 * - Tool result compression
 * - Relevance-based message selection
 * - Sliding window context management
 */
export class ContextOptimizer {
  private readonly config: ContextOptimizerConfig;

  constructor(
    _runtimeConfig: Config,
    config?: Partial<ContextOptimizerConfig>,
  ) {
    this.config = {
      maxTokens: config?.maxTokens ?? 8192,
      systemPromptReserve: config?.systemPromptReserve ?? 512,
      responseReserve: config?.responseReserve ?? 2048,
      minMessages: config?.minMessages ?? 4,
      maxMemories: config?.maxMemories ?? 5,
      pruningStrategy: config?.pruningStrategy ?? 'sliding-window',
      compressToolResults: config?.compressToolResults ?? true,
      maxToolResultLength: config?.maxToolResultLength ?? 500,
    };
  }

  /**
   * Optimizes message history and memory selection for token budget.
   *
   * @param systemPrompt - System prompt content
   * @param messages - Full message history
   * @param availableMemories - Available memories for context
   * @returns Optimized context
   */
  async optimize(
    systemPrompt: string,
    messages: Content[],
    availableMemories: MemoryEntry[] = [],
  ): Promise<OptimizationResult> {
    // 1. Estimate token counts
    const systemTokens = this.estimateTokens(systemPrompt);
    const messageTokens = messages.map((msg) => ({
      message: msg,
      tokens: this.estimateTokens(this.contentToString(msg)),
    }));

    // 2. Calculate available budget
    const availableTokens =
      this.config.maxTokens -
      this.config.systemPromptReserve -
      this.config.responseReserve;

    // 3. Select and prioritize memories
    const selectedMemories = await this.selectMemories(
      availableMemories,
      availableTokens * 0.2, // Use 20% of budget for memories
    );
    const memoryTokens = selectedMemories.reduce(
      (sum, mem) => sum + this.estimateTokens(mem.content),
      0,
    );

    // 4. Calculate remaining budget for messages
    const messagesBudget = availableTokens - memoryTokens;

    // 5. Optimize messages based on strategy
    let optimizedMessages: Content[];
    let prunedCount: number;

    switch (this.config.pruningStrategy) {
      case 'oldest-first':
        ({ messages: optimizedMessages, prunedCount } = this.pruneOldestFirst(
          messages,
          messageTokens,
          messagesBudget,
        ));
        break;

      case 'least-relevant':
        ({ messages: optimizedMessages, prunedCount } =
          await this.pruneLeastRelevant(
            messages,
            messageTokens,
            messagesBudget,
          ));
        break;

      case 'sliding-window':
      default:
        ({ messages: optimizedMessages, prunedCount } = this.pruneSlidingWindow(
          messages,
          messageTokens,
          messagesBudget,
        ));
        break;
    }

    // 6. Compress tool results if enabled
    if (this.config.compressToolResults) {
      optimizedMessages = this.compressToolResults(optimizedMessages);
    }

    // 7. Calculate final token estimates
    const finalMessageTokens = optimizedMessages.reduce(
      (sum, msg) => sum + this.estimateTokens(this.contentToString(msg)),
      0,
    );

    const totalTokens =
      systemTokens +
      finalMessageTokens +
      memoryTokens +
      this.config.responseReserve;

    return {
      messages: optimizedMessages,
      memories: selectedMemories,
      estimatedTokens: {
        system: systemTokens,
        messages: finalMessageTokens,
        memories: memoryTokens,
        reserve: this.config.responseReserve,
        total: totalTokens,
      },
      stats: {
        originalMessageCount: messages.length,
        optimizedMessageCount: optimizedMessages.length,
        prunedMessageCount: prunedCount,
        memoriesIncluded: selectedMemories.length,
        tokensReclaimed:
          messageTokens.reduce((sum, mt) => sum + mt.tokens, 0) -
          finalMessageTokens,
      },
    };
  }

  /**
   * Selects most relevant memories within token budget.
   *
   * @param memories - Available memories
   * @param tokenBudget - Token budget for memories
   * @returns Selected memories
   */
  private async selectMemories(
    memories: MemoryEntry[],
    tokenBudget: number,
  ): Promise<MemoryEntry[]> {
    if (memories.length === 0) return [];

    // Sort by relevance (confidence × recency)
    const scoredMemories = memories
      .map((mem) => ({
        memory: mem,
        score: this.calculateMemoryScore(mem),
        tokens: this.estimateTokens(mem.content),
      }))
      .sort((a, b) => b.score - a.score);

    // Select memories within budget
    const selected: MemoryEntry[] = [];
    let usedTokens = 0;

    for (const { memory, tokens } of scoredMemories) {
      if (
        selected.length >= this.config.maxMemories ||
        usedTokens + tokens > tokenBudget
      ) {
        break;
      }
      selected.push(memory);
      usedTokens += tokens;
    }

    return selected;
  }

  /**
   * Calculates relevance score for a memory.
   *
   * @param memory - Memory to score
   * @returns Relevance score (0-1)
   */
  private calculateMemoryScore(memory: MemoryEntry): number {
    // Base score from confidence
    let score = memory.confidence ?? 0.5;

    // Boost recent memories
    const daysSinceUpdate =
      (Date.now() - memory.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.exp(-daysSinceUpdate / 7); // Decay over 7 days
    score *= 0.7 + 0.3 * recencyBoost;

    // Boost high-access memories
    if (memory.usageCount && memory.usageCount > 3) {
      score *= 1.1;
    }

    // Boost project-scoped memories
    if (memory.scope === 'project') {
      score *= 1.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Prunes oldest messages first (FIFO).
   *
   * @param messages - Message history
   * @param messageTokens - Token estimates per message
   * @param tokenBudget - Token budget
   * @returns Optimized messages and prune count
   */
  private pruneOldestFirst(
    messages: Content[],
    messageTokens: Array<{ message: Content; tokens: number }>,
    tokenBudget: number,
  ): { messages: Content[]; prunedCount: number } {
    let currentTokens = messageTokens.reduce((sum, mt) => sum + mt.tokens, 0);
    let startIndex = 0;

    // Remove oldest messages until within budget
    while (currentTokens > tokenBudget && startIndex < messages.length) {
      currentTokens -= messageTokens[startIndex].tokens;
      startIndex++;
    }

    // Always keep minimum messages
    const keepCount = Math.max(
      messages.length - startIndex,
      this.config.minMessages,
    );
    startIndex = Math.max(0, messages.length - keepCount);

    return {
      messages: messages.slice(startIndex),
      prunedCount: startIndex,
    };
  }

  /**
   * Prunes messages using sliding window (keep recent N messages).
   *
   * @param messages - Message history
   * @param messageTokens - Token estimates per message
   * @param tokenBudget - Token budget
   * @returns Optimized messages and prune count
   */
  private pruneSlidingWindow(
    messages: Content[],
    messageTokens: Array<{ message: Content; tokens: number }>,
    tokenBudget: number,
  ): { messages: Content[]; prunedCount: number } {
    // Start from most recent and work backwards
    let currentTokens = 0;
    let keepCount = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const tokens = messageTokens[i].tokens;
      if (currentTokens + tokens > tokenBudget) {
        break;
      }
      currentTokens += tokens;
      keepCount++;
    }

    // Always keep minimum messages if possible
    keepCount = Math.max(keepCount, this.config.minMessages);
    const startIndex = Math.max(0, messages.length - keepCount);

    return {
      messages: messages.slice(startIndex),
      prunedCount: startIndex,
    };
  }

  /**
   * Prunes least relevant messages based on content analysis.
   *
   * @param messages - Message history
   * @param messageTokens - Token estimates per message
   * @param tokenBudget - Token budget
   * @returns Optimized messages and prune count
   */
  private async pruneLeastRelevant(
    messages: Content[],
    messageTokens: Array<{ message: Content; tokens: number }>,
    tokenBudget: number,
  ): Promise<{ messages: Content[]; prunedCount: number }> {
    // Calculate relevance scores
    const scoredMessages: MessageRelevance[] = messages.map((msg, index) => ({
      index,
      message: msg,
      score: this.calculateMessageRelevance(msg, index, messages.length),
      estimatedTokens: messageTokens[index].tokens,
    }));

    // Sort by relevance (descending)
    scoredMessages.sort((a, b) => b.score - a.score);

    // Select messages within budget, prioritizing relevance
    const selected: MessageRelevance[] = [];
    let usedTokens = 0;

    for (const scoredMsg of scoredMessages) {
      if (usedTokens + scoredMsg.estimatedTokens <= tokenBudget) {
        selected.push(scoredMsg);
        usedTokens += scoredMsg.estimatedTokens;
      }
    }

    // Ensure minimum messages
    if (selected.length < this.config.minMessages) {
      const mostRecent = messages.slice(-this.config.minMessages);
      return {
        messages: mostRecent,
        prunedCount: messages.length - mostRecent.length,
      };
    }

    // Re-sort by original index to maintain chronological order
    selected.sort((a, b) => a.index - b.index);

    return {
      messages: selected.map((s) => s.message),
      prunedCount: messages.length - selected.length,
    };
  }

  /**
   * Calculates relevance score for a message.
   *
   * @param message - Message to score
   * @param index - Message index in history
   * @param totalMessages - Total message count
   * @returns Relevance score (0-1)
   */
  private calculateMessageRelevance(
    message: Content,
    index: number,
    totalMessages: number,
  ): number {
    let score = 0;

    // Recency boost (recent messages are more relevant)
    const recencyScore = index / totalMessages;
    score += recencyScore * 0.5;

    // Content-based scoring
    const text = this.contentToString(message);

    // Boost messages with questions
    if (text.includes('?')) {
      score += 0.2;
    }

    // Boost messages with code
    if (text.includes('```') || text.includes('`')) {
      score += 0.15;
    }

    // Boost messages with tool calls
    if (message.parts && message.parts.some((part) => 'functionCall' in part)) {
      score += 0.25;
    }

    // Boost user messages slightly
    if (message.role === 'user') {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Compresses tool results to reduce token usage.
   *
   * @param messages - Message history
   * @returns Messages with compressed tool results
   */
  private compressToolResults(messages: Content[]): Content[] {
    return messages.map((msg) => {
      if (msg.role !== 'model' || !msg.parts) return msg;

      // Compress function responses
      const compressedParts = msg.parts.map((part) => {
        if ('functionResponse' in part && part.functionResponse) {
          const response = part.functionResponse.response;
          const responseStr = JSON.stringify(response);

          if (responseStr.length > this.config.maxToolResultLength) {
            // Truncate long responses
            const truncated = responseStr.substring(
              0,
              this.config.maxToolResultLength,
            );
            return {
              functionResponse: {
                name: part.functionResponse.name,
                response: {
                  truncated: true,
                  content: truncated + '...[truncated]',
                  originalLength: responseStr.length,
                },
              },
            };
          }
        }
        return part;
      });

      return { ...msg, parts: compressedParts };
    });
  }

  /**
   * Estimates token count for text (rough approximation).
   *
   * @param text - Text to estimate
   * @returns Estimated token count
   */
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    // This is a simplification; actual tokenization varies by model
    return Math.ceil(text.length / 4);
  }

  /**
   * Converts Content to string for token estimation.
   *
   * @param content - Content to convert
   * @returns String representation
   */
  private contentToString(content: Content): string {
    if (!content.parts) return '';

    return content.parts
      .map((part) => {
        if ('text' in part) return part.text;
        if ('functionCall' in part && part.functionCall)
          return JSON.stringify(part.functionCall.args);
        if ('functionResponse' in part && part.functionResponse)
          return JSON.stringify(part.functionResponse.response);
        return '';
      })
      .join(' ');
  }
}
