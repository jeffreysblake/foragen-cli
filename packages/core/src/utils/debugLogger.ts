/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Log levels for debug logging
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Log categories for organizing debug output
 */
export enum LogCategory {
  WEBSEARCH = 'websearch',
  TOOLS = 'tools',
  LOOP_DETECTION = 'loop-detection',
  MCP = 'mcp',
  ERRORS = 'errors',
  GENERAL = 'general',
}

/**
 * Configuration for the debug logger
 */
export interface DebugLoggerConfig {
  /**
   * Base directory for logs (default: ~/.fora/logs)
   */
  logDir?: string;
  /**
   * Maximum age of log files in days before rotation (default: 7)
   */
  maxLogAgeDays?: number;
  /**
   * Maximum size of a single log file in bytes (default: 10MB)
   * When exceeded, a new file with suffix will be created
   */
  maxFileSizeBytes?: number;
  /**
   * Whether logging is enabled (default: true)
   */
  enabled?: boolean;
  /**
   * Minimum log level to write (default: DEBUG)
   */
  minLevel?: LogLevel;
}

/**
 * Persistent debug logger that writes to ~/.fora/logs/
 *
 * This logger provides persistent debug logging for the TUI application where
 * console.log output is not visible. Logs are written to daily files with
 * automatic rotation.
 *
 * Usage:
 * ```typescript
 * import { debugLogger, LogLevel, LogCategory } from './utils/debugLogger.js';
 *
 * debugLogger.log(LogLevel.INFO, LogCategory.WEBSEARCH, 'Starting search', { query: 'test' });
 * debugLogger.info(LogCategory.WEBSEARCH, 'Search completed');
 * debugLogger.error(LogCategory.WEBSEARCH, 'Search failed', { error: err.message });
 * ```
 */
class DebugLogger {
  private config: Required<DebugLoggerConfig>;
  private initialized = false;
  private currentLogFile: string | null = null;

  constructor(config: DebugLoggerConfig = {}) {
    // Defer path.join until initialization to avoid issues with mocked os.homedir() in tests
    const defaultLogDir = config.logDir ?? ''; // Will be set in initialize()
    this.config = {
      logDir: defaultLogDir,
      maxLogAgeDays: config.maxLogAgeDays ?? 7,
      maxFileSizeBytes: config.maxFileSizeBytes ?? 10 * 1024 * 1024, // 10MB default
      enabled: config.enabled ?? true,
      minLevel: config.minLevel ?? LogLevel.DEBUG,
    };
  }

  /**
   * Initialize the logger (creates log directory if needed)
   */
  private initialize(): void {
    if (this.initialized || !this.config.enabled) {
      return;
    }

    try {
      // Set default log directory if not configured
      if (!this.config.logDir) {
        this.config.logDir = path.join(os.homedir(), '.fora', 'logs');
      }

      // Create log directory if it doesn't exist
      if (!fs.existsSync(this.config.logDir)) {
        fs.mkdirSync(this.config.logDir, { recursive: true });
      }

      // Rotate old logs
      this.rotateLogs();

      this.initialized = true;
    } catch (error) {
      // If we can't initialize logging, fail silently to not break the app
      console.error('Failed to initialize debug logger:', error);
      this.config.enabled = false;
    }
  }

  /**
   * Get the log file path for today
   * @param suffix Optional suffix for size-based rotation (e.g., -1, -2)
   */
  private getLogFilePath(suffix?: number): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const suffixStr = suffix !== undefined ? `-${suffix}` : '';
    return path.join(this.config.logDir, `debug-${date}${suffixStr}.log`);
  }

  /**
   * Check if current log file exceeds size limit and rotate if needed
   */
  private checkFileSizeAndRotate(): void {
    if (!this.currentLogFile) {
      return;
    }

    try {
      const stats = fs.statSync(this.currentLogFile);
      if (stats.size >= this.config.maxFileSizeBytes) {
        // Find next available suffix
        let suffix = 1;
        const baseDate = new Date().toISOString().split('T')[0];
        const basePath = path.join(this.config.logDir, `debug-${baseDate}`);

        while (fs.existsSync(`${basePath}-${suffix}.log`)) {
          suffix++;
        }

        // Switch to new log file with suffix
        this.currentLogFile = `${basePath}-${suffix}.log`;
      }
    } catch (_error) {
      // If we can't check size, continue with current file
      // Fail silently to not break logging
    }
  }

  /**
   * Rotate old log files (delete files older than maxLogAgeDays)
   * Handles both regular files (debug-YYYY-MM-DD.log) and suffixed files (debug-YYYY-MM-DD-N.log)
   */
  private rotateLogs(): void {
    try {
      const files = fs.readdirSync(this.config.logDir);
      const now = Date.now();
      const maxAgeMs = this.config.maxLogAgeDays * 24 * 60 * 60 * 1000;

      for (const file of files) {
        // Match debug-YYYY-MM-DD.log or debug-YYYY-MM-DD-N.log
        if (!file.startsWith('debug-') || !file.endsWith('.log')) {
          continue;
        }

        const filePath = path.join(this.config.logDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAgeMs) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      // Fail silently - log rotation is not critical
      console.error('Failed to rotate logs:', error);
    }
  }

  /**
   * Check if a log level should be written based on configuration
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    const minLevelIndex = levels.indexOf(this.config.minLevel);
    const currentLevelIndex = levels.indexOf(level);

    return currentLevelIndex >= minLevelIndex;
  }

  /**
   * Format a log entry
   */
  private formatLogEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    context?: unknown,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] [${category}] ${message}${contextStr}\n`;
  }

  /**
   * Write a log entry to the file
   */
  private writeLog(entry: string): void {
    if (!this.config.enabled) {
      return;
    }

    this.initialize();

    if (!this.initialized) {
      return;
    }

    try {
      const logFile = this.getLogFilePath();

      // Check if we need to rotate to a new day's log file
      if (this.currentLogFile !== logFile) {
        this.currentLogFile = logFile;
        // Optionally rotate logs when switching to a new day
        this.rotateLogs();
      }

      // Check if current file exceeds size limit
      this.checkFileSizeAndRotate();

      // Append to log file (use currentLogFile which may have been rotated)
      fs.appendFileSync(this.currentLogFile!, entry, 'utf-8');
    } catch (error) {
      // Fail silently - don't break the app if logging fails
      console.error('Failed to write log:', error);
    }
  }

  /**
   * Log a message at the specified level
   */
  log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    context?: unknown,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.formatLogEntry(level, category, message, context);
    this.writeLog(entry);
  }

  /**
   * Log a debug message
   */
  debug(category: LogCategory, message: string, context?: unknown): void {
    this.log(LogLevel.DEBUG, category, message, context);
  }

  /**
   * Log an info message
   */
  info(category: LogCategory, message: string, context?: unknown): void {
    this.log(LogLevel.INFO, category, message, context);
  }

  /**
   * Log a warning message
   */
  warn(category: LogCategory, message: string, context?: unknown): void {
    this.log(LogLevel.WARN, category, message, context);
  }

  /**
   * Log an error message
   */
  error(category: LogCategory, message: string, context?: unknown): void {
    this.log(LogLevel.ERROR, category, message, context);
  }

  /**
   * Configure the logger
   */
  configure(config: Partial<DebugLoggerConfig>): void {
    this.config = { ...this.config, ...config };
    // Reset initialization if config changes
    if (config.logDir) {
      this.initialized = false;
      this.currentLogFile = null;
    }
  }

  /**
   * Get the current log directory
   */
  getLogDir(): string {
    return this.config.logDir;
  }

  /**
   * Get the current log file path
   */
  getCurrentLogFile(): string | null {
    if (!this.initialized) {
      this.initialize();
    }
    return this.currentLogFile ?? this.getLogFilePath();
  }
}

/**
 * Singleton instance of the debug logger
 */
export const debugLogger = new DebugLogger();
