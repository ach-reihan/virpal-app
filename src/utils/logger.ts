/**
 * VirPal App - AI Assistant with Azure Functions
 * Copyright (c) 2025 Achmad Reihan Alfaiz. All rights reserved.
 *
 * This file is part of VirPal App, a proprietary software application.
 *
 * PROPRIETARY AND CONFIDENTIAL
 *
 * This source code is the exclusive property of Achmad Reihan Alfaiz.
 * No part of this software may be reproduced, distributed, or transmitted
 * in any form or by any means, including photocopying, recording, or other
 * electronic or mechanical methods, without the prior written permission
 * of the copyright holder, except in the case of brief quotations embodied
 * in critical reviews and certain other noncommercial uses permitted by
 * copyright law.
 *
 * For licensing inquiries: reihan3000@gmail.com
 */

/**
 * Centralized logging utility for VIRPAL application
 *
 * This provides a consistent way to handle logging across the application
 * with environment-based log levels to reduce console noise in production.
 *
 * Features:
 * - Environment-based log levels
 * - PII sanitization
 * - Rate limiting for repetitive logs
 * - Structured logging format
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

interface LogEntry {
  message: string;
  timestamp: number;
  count: number;
}

class Logger {
  private level: LogLevel;
  private logHistory = new Map<string, LogEntry>();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_REPETITIONS = 3; // Max same log per window

  constructor() {
    // Set log level based on environment (cross-platform detection)
    this.level = this.getEnvironmentLogLevel();
  }
  private getEnvironmentLogLevel(): LogLevel {
    // Enhanced environment detection for Azure SWA production
    const isNodeJS = typeof process !== 'undefined' && process.env;

    if (isNodeJS) {
      // Azure Functions / Node.js environment detection
      const nodeEnv = process.env['NODE_ENV'];
      const azureFunctionEnv = process.env['AZURE_FUNCTIONS_ENVIRONMENT'];
      const websiteSiteName = process.env['WEBSITE_SITE_NAME']; // Azure SWA indicator
      const functionsWorkerRuntime = process.env['FUNCTIONS_WORKER_RUNTIME'];

      // Production environment indicators for Azure SWA
      const isAzureProduction = !!(websiteSiteName || functionsWorkerRuntime);
      const isProductionEnv =
        nodeEnv === 'production' || azureFunctionEnv === 'Production';

      // Development environment indicators
      const isDevelopmentEnv =
        nodeEnv === 'development' ||
        azureFunctionEnv === 'Development' ||
        !nodeEnv ||
        nodeEnv === 'local';

      // For Azure SWA production: Use INFO level for better monitoring
      if (isAzureProduction && isProductionEnv) {
        return LogLevel.INFO; // Balanced logging for production monitoring
      }

      // For development environments: Use DEBUG for full visibility
      if (isDevelopmentEnv) {
        return LogLevel.DEBUG;
      }

      // For staging or unknown production: Use WARN level
      if (isProductionEnv) {
        return LogLevel.WARN;
      }

      // Default for Azure Functions: INFO level
      if (isAzureProduction) {
        return LogLevel.INFO;
      }

      // Default for other Node.js environments
      return LogLevel.DEBUG;
    }

    // Browser environment detection for frontend
    try {
      const globalWindow = (globalThis as any).window;
      if (globalWindow && globalWindow.location) {
        const hostname = globalWindow.location.hostname;
        const port = globalWindow.location.port;

        // Development indicators
        const isLocalDev =
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          port === '5173' || // Vite dev server
          port === '3000'; // Common dev port

        // Azure SWA production domain indicators
        const isAzureSWA =
          hostname.includes('.azurestaticapps.net') ||
          hostname.includes('.azurewebsites.net');

        if (isLocalDev) {
          return LogLevel.DEBUG;
        } else if (isAzureSWA) {
          return LogLevel.ERROR; // Minimal logging in production frontend
        } else {
          return LogLevel.WARN; // Unknown production environment
        }
      }
    } catch {
      // Browser environment not available or error accessing window
    }

    // Fallback: Conservative logging level for unknown environments
    return LogLevel.ERROR;
  }
  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  /**
   * Check if we should skip this log due to rate limiting
   */
  private shouldSkipLog(message: string): boolean {
    const now = Date.now();
    const entry = this.logHistory.get(message);

    if (!entry) {
      this.logHistory.set(message, { message, timestamp: now, count: 1 });
      return false;
    }

    // Check if we're within the rate limit window
    if (now - entry.timestamp < this.RATE_LIMIT_WINDOW) {
      entry.count++;

      // Skip if we've exceeded the max repetitions
      if (entry.count > this.MAX_REPETITIONS) {
        return true;
      }

      // Log rate limit warning on the threshold
      if (entry.count === this.MAX_REPETITIONS) {
        console.warn(
          `[VIRPAL] Rate limit reached for log: "${message.substring(
            0,
            50
          )}..." (suppressing further instances)`
        );
      }

      return false;
    } else {
      // Reset the entry for a new window
      entry.timestamp = now;
      entry.count = 1;
      return false;
    }
  }
  /**
   * Sanitize message to remove PII (Personal Identifiable Information)
   */
  private sanitizeMessage(message: string): string {
    return (
      message
        // Remove email addresses
        .replace(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
        // Remove potential user IDs (UUIDs and similar)
        .replace(
          /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
          '[USER_ID]'
        )
        // Remove display names in quotes or after common patterns
        .replace(/displayName[:\s]*["']([^"']+)["']/gi, 'displayName: "[NAME]"')
        .replace(/name[:\s]*["']([^"']+)["']/gi, 'name: "[NAME]"')
        // Remove usernames after common patterns
        .replace(/username[:\s]*["']([^"']+)["']/gi, 'username: "[USERNAME]"')
        // Remove specific user references
        .replace(/for user [^\s]+/gi, 'for user [USER]')
        .replace(/User [^\s]+ /gi, 'User [USER] ')
        // Remove bearer tokens (partial, keep structure for debugging)
        .replace(/Bearer [A-Za-z0-9+/=]{10,}/g, 'Bearer [TOKEN]')
        // Remove account IDs and username from objects like {accountId: '...', username: '...'}
        .replace(/accountId[:\s]*['"][^'"]+['"]/gi, 'accountId: "[ACCOUNT_ID]"')
        .replace(/username[:\s]*['"][^'"]+['"]/gi, 'username: "[EMAIL]"')
        // Remove email addresses in object literals
        .replace(/'[^']*@[^']*\.[^']*'/g, "'[EMAIL]'")
        .replace(/"[^"]*@[^"]*\.[^"]*"/g, '"[EMAIL]"')
        // Remove any standalone GUIDs that might be account identifiers
        .replace(
          /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi,
          '[ACCOUNT_ID]'
        )
    );
  }
  /**
   * Sanitize arguments to remove PII from objects and arrays
   */
  private sanitizeArgs(args: any[]): any[] {
    return args.map((arg) => {
      if (typeof arg === 'string') {
        return this.sanitizeMessage(arg);
      } else if (typeof arg === 'object' && arg !== null) {
        // Handle arrays
        if (Array.isArray(arg)) {
          return arg.map((item) => this.sanitizeValue(item));
        }
        // Handle objects
        const sanitizedObj: any = {};
        for (const [key, value] of Object.entries(arg)) {
          sanitizedObj[key] = this.sanitizeValue(value);
        }
        return sanitizedObj;
      } else {
        return arg;
      }
    });
  }

  /**
   * Sanitize individual values
   */
  private sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      return this.sanitizeMessage(value);
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map((item) => this.sanitizeValue(item));
      }
      const sanitizedObj: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitizedObj[key] = this.sanitizeValue(val);
      }
      return sanitizedObj;
    } else {
      return value;
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const sanitizedMessage = this.sanitizeMessage(message);
      const sanitizedArgs = this.sanitizeArgs(args);
      if (!this.shouldSkipLog(sanitizedMessage)) {
        console.error(`[VIRPAL] ${sanitizedMessage}`, ...sanitizedArgs);
      }
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const sanitizedMessage = this.sanitizeMessage(message);
      const sanitizedArgs = this.sanitizeArgs(args);
      if (!this.shouldSkipLog(sanitizedMessage)) {
        console.warn(`[VIRPAL] ${sanitizedMessage}`, ...sanitizedArgs);
      }
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const sanitizedMessage = this.sanitizeMessage(message);
      const sanitizedArgs = this.sanitizeArgs(args);
      if (!this.shouldSkipLog(sanitizedMessage)) {
        console.info(`[VIRPAL] ${sanitizedMessage}`, ...sanitizedArgs);
      }
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const sanitizedMessage = this.sanitizeMessage(message);
      const sanitizedArgs = this.sanitizeArgs(args);
      if (!this.shouldSkipLog(sanitizedMessage)) {
        console.log(`[VIRPAL] ${sanitizedMessage}`, ...sanitizedArgs);
      }
    }
  }

  auth(message: string, ...args: any[]): void {
    // Auth logs are debug level and specially handled to prevent spam
    if (this.shouldLog(LogLevel.DEBUG)) {
      const sanitizedMessage = this.sanitizeMessage(message);
      const sanitizedArgs = this.sanitizeArgs(args);
      if (!this.shouldSkipLog(sanitizedMessage)) {
        console.log(`[VIRPAL Auth] ${sanitizedMessage}`, ...sanitizedArgs);
      }
    }
  }
  /**
   * Log only once per session - useful for configuration logs
   */
  private sessionLogs = new Set<string>();

  once(
    level: 'error' | 'warn' | 'info' | 'debug',
    message: string,
    ...args: any[]
  ): void {
    const key = `${level}:${message}`;
    if (!this.sessionLogs.has(key)) {
      this.sessionLogs.add(key);
      this[level](message, ...args);
    }
  }

  /**
   * Azure SWA production-specific logging methods
   */

  /**
   * Production performance logging for Azure SWA monitoring
   */
  performance(
    operation: string,
    durationMs: number,
    metadata?: Record<string, any>
  ): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const sanitizedMetadata = metadata
        ? this.sanitizeArgs([metadata])[0]
        : {};
      const logData = {
        operation: this.sanitizeMessage(operation),
        duration: durationMs,
        timestamp: new Date().toISOString(),
        ...sanitizedMetadata,
      };

      if (!this.shouldSkipLog(`perf:${operation}`)) {
        console.info(
          `[VIRPAL PERF] ${operation} completed in ${durationMs}ms`,
          logData
        );
      }
    }
  }

  /**
   * Azure service health logging for production monitoring
   */
  serviceHealth(
    serviceName: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    details?: string
  ): void {
    const level =
      status === 'healthy'
        ? LogLevel.INFO
        : status === 'degraded'
        ? LogLevel.WARN
        : LogLevel.ERROR;

    if (this.shouldLog(level)) {
      const sanitizedServiceName = this.sanitizeMessage(serviceName);
      const sanitizedDetails = details
        ? this.sanitizeMessage(details)
        : undefined;

      const logData = {
        service: sanitizedServiceName,
        status,
        details: sanitizedDetails,
        timestamp: new Date().toISOString(),
      };

      const logMethod =
        status === 'healthy'
          ? this.info
          : status === 'degraded'
          ? this.warn
          : this.error;

      logMethod.call(
        this,
        `Service ${sanitizedServiceName} is ${status}`,
        logData
      );
    }
  }

  /**
   * Security event logging for Azure SWA production
   */
  security(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details?: Record<string, any>
  ): void {
    const level =
      severity === 'low'
        ? LogLevel.INFO
        : severity === 'medium'
        ? LogLevel.WARN
        : LogLevel.ERROR;

    if (this.shouldLog(level)) {
      const sanitizedEvent = this.sanitizeMessage(event);
      const sanitizedDetails = details ? this.sanitizeArgs([details])[0] : {};

      const logData = {
        event: sanitizedEvent,
        severity,
        timestamp: new Date().toISOString(),
        ...sanitizedDetails,
      };

      const logMethod =
        severity === 'low'
          ? this.info
          : severity === 'medium'
          ? this.warn
          : this.error;

      logMethod.call(
        this,
        `[SECURITY ${severity.toUpperCase()}] ${sanitizedEvent}`,
        logData
      );
    }
  }

  /**
   * Azure Functions cold start logging
   */
  coldStart(functionName: string, durationMs: number): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const sanitizedFunctionName = this.sanitizeMessage(functionName);
      if (!this.shouldSkipLog(`coldstart:${functionName}`)) {
        this.info(`Cold start detected for ${sanitizedFunctionName}`, {
          function: sanitizedFunctionName,
          coldStartDuration: durationMs,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Request tracing for Azure SWA production debugging
   */
  request(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    requestId?: string
  ): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const sanitizedPath = this.sanitizeMessage(path);
      const logData = {
        method,
        path: sanitizedPath,
        statusCode,
        duration: durationMs,
        requestId: requestId ? this.sanitizeMessage(requestId) : undefined,
        timestamp: new Date().toISOString(),
      };

      if (!this.shouldSkipLog(`request:${method}:${path}`)) {
        const level =
          statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
        this[level](
          `${method} ${sanitizedPath} ${statusCode} (${durationMs}ms)`,
          logData
        );
      }
    }
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger;
