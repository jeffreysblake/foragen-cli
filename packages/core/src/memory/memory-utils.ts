/**
 * @license
 * Copyright 2025 Fora
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates a unique memory ID.
 *
 * @returns Unique memory ID
 */
export function generateMemoryId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `mem_${timestamp}_${random}`;
}

/**
 * Calculates similarity between two strings using simple word overlap.
 * For production, consider using more sophisticated algorithms like
 * Levenshtein distance or semantic embeddings.
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score (0.0 to 1.0)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const words1 = new Set(normalize(str1));
  const words2 = new Set(normalize(str2));

  if (words1.size === 0 && words2.size === 0) {
    return 1.0;
  }
  if (words1.size === 0 || words2.size === 0) {
    return 0.0;
  }

  // Calculate Jaccard similarity (intersection over union)
  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Extracts tags from content using common patterns.
 * Looks for #hashtags and @mentions.
 *
 * @param content - Content to extract tags from
 * @returns Array of extracted tags
 */
export function extractTags(content: string): string[] {
  const tags = new Set<string>();

  // Extract hashtags
  const hashtagRegex = /#(\w+)/g;
  let match;
  while ((match = hashtagRegex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase());
  }

  // Extract @mentions as potential tags
  const mentionRegex = /@(\w+)/g;
  while ((match = mentionRegex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase());
  }

  return Array.from(tags);
}

/**
 * Extracts context from content (file paths, modules, etc.).
 *
 * @param content - Content to extract context from
 * @returns Extracted context string or undefined
 */
export function extractContext(content: string): string | undefined {
  // Look for file paths
  const pathRegex = /(?:^|\s)([/\w\-_.]+\.[a-z]{1,4})/gi;
  const paths = [];
  let match;
  while ((match = pathRegex.exec(content)) !== null) {
    paths.push(match[1]);
  }

  if (paths.length > 0) {
    return paths[0]; // Return first path found
  }

  // Look for module/package names (e.g., "in the auth module")
  const moduleRegex =
    /(?:in|from|at|within)\s+(?:the\s+)?(\w+)\s+(?:module|package|component)/i;
  match = content.match(moduleRegex);
  if (match) {
    return match[1];
  }

  return undefined;
}

/**
 * Truncates text to a maximum length with ellipsis.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Formats a date as a relative time string.
 *
 * @param date - Date to format
 * @returns Relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  if (diffWeek < 4) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
  if (diffMonth < 12)
    return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
  return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
}
