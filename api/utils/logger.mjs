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
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (LogLevel = {}));
class Logger {
    constructor() {
        this.logHistory = new Map();
        this.RATE_LIMIT_WINDOW = 60000; // 1 minute
        this.MAX_REPETITIONS = 3; // Max same log per window
        /**
         * Log only once per session - useful for configuration logs
         */
        this.sessionLogs = new Set();
        // Set log level based on environment (cross-platform detection)
        this.level = this.getEnvironmentLogLevel();
    }
    getEnvironmentLogLevel() {
        // Check if we're in Node.js environment (Azure Functions)
        if (typeof process !== 'undefined' && process.env) {
            const nodeEnv = process.env['NODE_ENV'];
            const azureFunctionEnv = process.env['AZURE_FUNCTIONS_ENVIRONMENT'];
            // Development environments
            if (nodeEnv === 'development' ||
                azureFunctionEnv === 'Development' ||
                !nodeEnv || nodeEnv === 'local') {
                return LogLevel.DEBUG;
            }
            // Production/staging environments
            return LogLevel.ERROR;
        }
        // Check if we're in a browser environment (Vite/frontend)
        // Use globalThis to safely check for browser environment
        try {
            const globalWindow = globalThis.window;
            if (globalWindow && globalWindow.location) {
                // In browser environment, check for development indicators
                const isDev = globalWindow.location.hostname === 'localhost' ||
                    globalWindow.location.hostname === '127.0.0.1' ||
                    globalWindow.location.port === '5173' || // Default Vite dev port
                    globalWindow.location.port === '3000'; // Common dev port
                return isDev ? LogLevel.DEBUG : LogLevel.ERROR;
            }
        }
        catch {
            // Browser environment not available
        }
        // Fallback to error level for unknown environments
        return LogLevel.ERROR;
    }
    shouldLog(level) {
        return level <= this.level;
    }
    /**
     * Check if we should skip this log due to rate limiting
     */
    shouldSkipLog(message) {
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
                console.warn(`[VIRPAL] Rate limit reached for log: "${message.substring(0, 50)}..." (suppressing further instances)`);
            }
            return false;
        }
        else {
            // Reset the entry for a new window
            entry.timestamp = now;
            entry.count = 1;
            return false;
        }
    }
    /**
     * Sanitize message to remove PII (Personal Identifiable Information)
     */
    sanitizeMessage(message) {
        return message
            // Remove email addresses
            .replace(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
            // Remove potential user IDs (UUIDs and similar)
            .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '[USER_ID]')
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
            .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, '[ACCOUNT_ID]');
    } /**
     * Sanitize arguments to remove PII from objects and arrays
     */
    sanitizeArgs(args) {
        return args.map(arg => {
            if (typeof arg === 'string') {
                return this.sanitizeMessage(arg);
            }
            else if (typeof arg === 'object' && arg !== null) {
                // Handle arrays
                if (Array.isArray(arg)) {
                    return arg.map(item => this.sanitizeValue(item));
                }
                // Handle objects
                const sanitizedObj = {};
                for (const [key, value] of Object.entries(arg)) {
                    sanitizedObj[key] = this.sanitizeValue(value);
                }
                return sanitizedObj;
            }
            else {
                return arg;
            }
        });
    }
    /**
     * Sanitize individual values
     */
    sanitizeValue(value) {
        if (typeof value === 'string') {
            return this.sanitizeMessage(value);
        }
        else if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                return value.map(item => this.sanitizeValue(item));
            }
            const sanitizedObj = {};
            for (const [key, val] of Object.entries(value)) {
                sanitizedObj[key] = this.sanitizeValue(val);
            }
            return sanitizedObj;
        }
        else {
            return value;
        }
    }
    error(message, ...args) {
        if (this.shouldLog(LogLevel.ERROR)) {
            const sanitizedMessage = this.sanitizeMessage(message);
            const sanitizedArgs = this.sanitizeArgs(args);
            if (!this.shouldSkipLog(sanitizedMessage)) {
                console.error(`[VIRPAL] ${sanitizedMessage}`, ...sanitizedArgs);
            }
        }
    }
    warn(message, ...args) {
        if (this.shouldLog(LogLevel.WARN)) {
            const sanitizedMessage = this.sanitizeMessage(message);
            const sanitizedArgs = this.sanitizeArgs(args);
            if (!this.shouldSkipLog(sanitizedMessage)) {
                console.warn(`[VIRPAL] ${sanitizedMessage}`, ...sanitizedArgs);
            }
        }
    }
    info(message, ...args) {
        if (this.shouldLog(LogLevel.INFO)) {
            const sanitizedMessage = this.sanitizeMessage(message);
            const sanitizedArgs = this.sanitizeArgs(args);
            if (!this.shouldSkipLog(sanitizedMessage)) {
                console.info(`[VIRPAL] ${sanitizedMessage}`, ...sanitizedArgs);
            }
        }
    }
    debug(message, ...args) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            const sanitizedMessage = this.sanitizeMessage(message);
            const sanitizedArgs = this.sanitizeArgs(args);
            if (!this.shouldSkipLog(sanitizedMessage)) {
                console.log(`[VIRPAL] ${sanitizedMessage}`, ...sanitizedArgs);
            }
        }
    }
    auth(message, ...args) {
        // Auth logs are debug level and specially handled to prevent spam
        if (this.shouldLog(LogLevel.DEBUG)) {
            const sanitizedMessage = this.sanitizeMessage(message);
            const sanitizedArgs = this.sanitizeArgs(args);
            if (!this.shouldSkipLog(sanitizedMessage)) {
                console.log(`[VIRPAL Auth] ${sanitizedMessage}`, ...sanitizedArgs);
            }
        }
    }
    once(level, message, ...args) {
        const key = `${level}:${message}`;
        if (!this.sessionLogs.has(key)) {
            this.sessionLogs.add(key);
            this[level](message, ...args);
        }
    }
}
// Export singleton instance
export const logger = new Logger();
export default logger;
//# sourceMappingURL=logger.js.map