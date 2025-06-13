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
 * Frontend Key Vault Service
 *
 * Service untuk mengakses Azure Key Vault melalui Azure Functions
 * Karena frontend tidak bisa langsung akses Key Vault, kita gunakan Azure Functions sebagai proxy
 */
import { ENV_CONFIG, getApiEndpoint } from '../config/environment';
import { logger } from '../utils/logger';
import { authService } from './authService';

// Global warning tracking to persist across hot reloads and module reloads
const getGlobalFallbackWarnings = (): Set<string> => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = sessionStorage.getItem('fallbackWarningsShown');
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (error) {
      // Silently fail to avoid console noise
    }
  }
  return new Set<string>();
};

const updateGlobalFallbackWarnings = (warnings: Set<string>) => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.setItem(
        'fallbackWarningsShown',
        JSON.stringify([...warnings])
      );
    } catch (error) {
      // Silently fail to avoid console noise
    }
  }
};

class FrontendKeyVaultService {
  private functionUrl: string;
  private secretCache: Map<string, { value: string; timestamp: number }> =
    new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes cache
  private fallbackWarningsShown = getGlobalFallbackWarnings(); // Use persistent tracking
  // Circuit breaker pattern for resilience - Azure best practices
  private failureCount = 0;
  private lastFailureTime = 0;
  private circuitBreakerThreshold = 3; // failures before opening circuit
  private circuitBreakerTimeout = 30000; // 30 seconds before retry
  private halfOpenMaxRetries = 1; // single retry in half-open state
  private consecutiveSuccesses = 0; // track consecutive successes in half-open state
  private isHalfOpen = false; // half-open state tracking
  constructor() {
    // Use centralized environment configuration
    const config = ENV_CONFIG;
    this.functionUrl = config.functionBaseUrl || window.location.origin;

    // Log initialization status only once per session
    logger.once(
      'debug',
      `FrontendKeyVaultService initialized - Environment: ${
        config.isProduction ? 'Production' : 'Development'
      }, Azure SWA: ${config.isAzureStaticWebApp}, Endpoint: ${
        this.functionUrl
      }`
    );
  }
  /**
   * Enhanced circuit breaker implementation following Azure best practices
   * States: Closed -> Open -> Half-Open -> Closed
   */
  private isCircuitOpen(): boolean {
    if (this.failureCount < this.circuitBreakerThreshold) {
      return false; // Circuit is closed - normal operation
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    if (timeSinceLastFailure > this.circuitBreakerTimeout) {
      // Move to half-open state after timeout
      this.isHalfOpen = true;
      logger.info(
        'Circuit breaker moved to half-open state - allowing limited requests'
      );
      return false;
    }

    return true; // Circuit is open - blocking requests
  }

  private recordSuccess(): void {
    if (this.isHalfOpen) {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.halfOpenMaxRetries) {
        // Successful recovery - close the circuit
        this.failureCount = 0;
        this.consecutiveSuccesses = 0;
        this.isHalfOpen = false;
        logger.info('Circuit breaker closed - service recovered successfully');
      }
    } else {
      // Normal operation - reset failure count
      this.failureCount = 0;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.consecutiveSuccesses = 0;

    if (this.isHalfOpen) {
      // Failure in half-open state - go back to open
      this.isHalfOpen = false;
      logger.warn('Circuit breaker opened - service still unhealthy');
    } else if (this.failureCount >= this.circuitBreakerThreshold) {
      // Threshold reached - open the circuit
      logger.error(
        `Circuit breaker opened after ${this.failureCount} failures`
      );
    }
  }

  /**
   * Get authentication headers for API requests
   * Returns Authorization header with Bearer token if user is authenticated
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    try {
      // Use safe authentication check to avoid MSAL initialization errors
      if (authService.isSafelyAuthenticated()) {
        const accessToken = await authService.safeGetAccessToken();
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
          logger.debug(
            'Successfully obtained access token for Key Vault request'
          );
        } else {
          logger.warn('Access token is empty or null');
        }
      } else {
        logger.debug('User not safely authenticated, cannot get access token');
      }
    } catch (error) {
      logger.error('Failed to get access token for Key Vault request', error);
      // Continue without auth header - let the backend handle unauthorized requests
    }

    return headers;
  }
  /**
   * Get secret from Azure Key Vault via Azure Functions with Circuit Breaker pattern
   */
  async getSecret(secretName: string): Promise<string | null> {
    try {
      // Circuit breaker check - Azure best practice for resilience
      if (this.isCircuitOpen()) {
        logger.warn(
          `Circuit breaker is open - rejecting request for secret: ${secretName}`
        );
        // Try development fallback when circuit is open
        const fallbackValue = this.getDevelopmentFallback(secretName);
        if (fallbackValue) {
          logger.info(
            `Using development fallback for ${secretName} due to open circuit`
          );
          return fallbackValue;
        }
        throw new Error(
          'Service temporarily unavailable - circuit breaker is open'
        );
      }

      // Check cache first - but only use cache if value is not null/empty
      const cached = this.secretCache.get(secretName);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        // Only return cached value if it's not null/empty
        if (cached.value && cached.value.trim() !== '') {
          logger.debug(`Using cached value for secret: ${secretName}`);
          return cached.value;
        } else {
          // Remove null/empty cached values to force retry
          logger.debug(
            `Removing null/empty cached value for secret: ${secretName}`
          );
          this.secretCache.delete(secretName);
        }
      }

      // In development, provide fallback values for common secrets
      if (import.meta.env.DEV && this.isDevelopmentEnvironment()) {
        // Special handling for Azure Speech Service - Key Vault only
        if (
          secretName.includes('azure-speech-service') ||
          secretName === 'SPEECH-KEY' ||
          secretName === 'SPEECH-REGION'
        ) {
          // Only show warning once per secret to reduce console noise
          if (!this.fallbackWarningsShown.has(`keyvault-only-${secretName}`)) {
            logger.warn(
              `[KEY VAULT ONLY] ${secretName} must be configured in Azure Key Vault - no fallback available`
            );
            this.fallbackWarningsShown.add(`keyvault-only-${secretName}`);
            updateGlobalFallbackWarnings(this.fallbackWarningsShown);
          }
          // Continue to try Key Vault access - no fallback for Speech Service
        } else {
          // Only show warning once per secret to reduce console noise
          if (!this.fallbackWarningsShown.has(secretName)) {
            logger.debug(`[DEV MODE] Using fallback for secret: ${secretName}`);
            this.fallbackWarningsShown.add(secretName);
            updateGlobalFallbackWarnings(this.fallbackWarningsShown);
            logger.debug(
              `Added ${secretName} to fallback warnings. Total tracked: ${this.fallbackWarningsShown.size}`
            );
          } else {
            logger.debug(
              `Skipping duplicate warning for secret: ${secretName} (already shown)`
            );
          }
          const fallbackValue = this.getDevelopmentFallback(secretName);
          if (fallbackValue) {
            // Cache the fallback value to prevent repeated calls
            this.secretCache.set(secretName, {
              value: fallbackValue,
              timestamp: Date.now(),
            });
            return fallbackValue;
          }
        }
      }

      // Get authentication headers (may be empty for unauthenticated users)
      const headers = await this.getAuthHeaders();

      // Call Azure Function to get secret with timeout handling and circuit breaker
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      let response: Response;
      try {
        response = await fetch(
          getApiEndpoint(`get-secret?name=${secretName}`),
          {
            method: 'GET',
            headers,
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        // Check for successful response
        if (response.ok) {
          // Record success for circuit breaker
          this.recordSuccess();
        } else {
          // Record failure for circuit breaker on HTTP errors
          this.recordFailure();
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        // Record failure for circuit breaker on network errors
        this.recordFailure();

        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error(
            'Request timeout - Azure Function may be starting up'
          );
        }
        throw fetchError;
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Special handling for Azure Speech Service - no fallback
          if (
            secretName.includes('azure-speech-service') ||
            secretName === 'SPEECH-KEY' ||
            secretName === 'SPEECH-REGION'
          ) {
            if (
              !this.fallbackWarningsShown.has(`keyvault-auth-${secretName}`)
            ) {
              logger.error(
                `[KEY VAULT AUTH FAILED] Cannot access ${secretName} - Azure Speech Service requires Key Vault authentication`
              );
              logger.error(
                `[ACTION REQUIRED] Please sign in to Azure or configure Key Vault permissions`
              );
              this.fallbackWarningsShown.add(`keyvault-auth-${secretName}`);
              updateGlobalFallbackWarnings(this.fallbackWarningsShown);
            }
            return null; // Force null return for Speech Service secrets
          }

          // Only show auth warning once per secret to reduce console noise
          if (!this.fallbackWarningsShown.has(`auth-${secretName}`)) {
            logger.warn(
              `Authentication failed for Key Vault access (${response.status}). Using development fallback if available.`
            );
            this.fallbackWarningsShown.add(`auth-${secretName}`);
            updateGlobalFallbackWarnings(this.fallbackWarningsShown);
          }
          const fallbackValue = this.getDevelopmentFallback(secretName);
          if (fallbackValue) {
            return fallbackValue;
          }
        }

        // Handle other HTTP errors
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Ignore JSON parsing errors
        }

        throw new Error(`Failed to get secret: ${errorMessage}`);
      }

      const data = await response.json();

      // Handle response structure from Azure Function
      let secretValue: string | null = null;

      if (data.success && data.data && data.data.value) {
        secretValue = data.data.value;
      } else if (data.value) {
        // Fallback for direct value response
        secretValue = data.value;
      } else {
        logger.warn(
          `Unexpected response structure for secret ${secretName}:`,
          data
        );
      }

      // Only cache the secret if it's not null/empty
      if (secretValue && secretValue.trim() !== '') {
        this.secretCache.set(secretName, {
          value: secretValue,
          timestamp: Date.now(),
        });
        logger.debug(`Successfully cached secret: ${secretName}`);
      } else {
        logger.warn(
          `Received null/empty value for secret: ${secretName}, not caching`
        );
      }

      return secretValue;
    } catch (error) {
      // Record failure for circuit breaker
      this.recordFailure();

      logger.error(`Error fetching secret ${secretName}:`, error);

      // Handle specific error types with appropriate messages
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        // Provide user-friendly error messages
        if (errorMessage.includes('timeout')) {
          logger.warn(
            `[TIMEOUT] Azure Function timeout for ${secretName} - it may be starting up`
          );
        } else if (
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('NetworkError')
        ) {
          logger.warn(
            `[NETWORK] Cannot connect to Azure Function - check if it's running`
          );
        } else if (errorMessage.includes('ECONNREFUSED')) {
          logger.warn(
            `[CONNECTION] Azure Function is not running on ${this.functionUrl}`
          );
        }
      }

      // Try development fallback as last resort
      const fallbackValue = this.getDevelopmentFallback(secretName);
      if (fallbackValue) {
        // Only show error fallback warning once per secret
        if (!this.fallbackWarningsShown.has(`error-${secretName}`)) {
          logger.warn(
            `Using development fallback for ${secretName} due to error: ${errorMessage}`
          );
          this.fallbackWarningsShown.add(`error-${secretName}`);
          updateGlobalFallbackWarnings(this.fallbackWarningsShown);
        }
        return fallbackValue;
      }

      return null;
    }
  }

  private isDevelopmentEnvironment(): boolean {
    return (
      import.meta.env.DEV ||
      this.functionUrl.includes('localhost') ||
      this.functionUrl.includes('127.0.0.1')
    );
  }
  /**
   * Get development fallback values for local development
   * These should only be used when Key Vault is not accessible
   * In production, all credentials should come from Key Vault
   */
  private getDevelopmentFallback(secretName: string): string | null {
    // Only provide fallbacks in development mode
    if (import.meta.env.MODE !== 'development') {
      return null;
    } // Development fallback values - these come from environment variables only
    // Never hardcode actual credentials in the source code
    const fallbacks: Record<string, string> = {
      // Azure Cosmos DB - Cloud storage functionality
      'azure-cosmos-db-endpoint-uri':
        import.meta.env['VITE_AZURE_COSMOS_ENDPOINT'] || '',
      'azure-cosmos-db-database-name':
        import.meta.env['VITE_AZURE_COSMOS_DATABASE_NAME'] || 'virpal-db',
      'azure-cosmos-db-key': import.meta.env['VITE_AZURE_COSMOS_KEY'] || '',
      'azure-cosmos-db-connection-string':
        import.meta.env['VITE_AZURE_COSMOS_CONNECTION_STRING'] || '',

      // Azure Speech Service - NO FALLBACKS, Key Vault only
      // 'azure-speech-service-endpoint': Key Vault only
      // 'azure-speech-service-key': Key Vault only
      // 'azure-speech-service-region': Key Vault only

      // OpenAI secrets
      'OPENAI-API-KEY': import.meta.env['VITE_OPENAI_API_KEY'] || '',
      'AZURE-OPENAI-ENDPOINT':
        import.meta.env['VITE_AZURE_OPENAI_ENDPOINT'] || '',
      'AZURE-OPENAI-API-KEY':
        import.meta.env['VITE_AZURE_OPENAI_API_KEY'] || '',

      // Legacy support for older secret names - NO FALLBACKS for Speech
      // 'SPEECH-KEY': Key Vault only
      // 'SPEECH-REGION': Key Vault only
    };

    const fallbackValue = fallbacks[secretName];
    if (fallbackValue && fallbackValue.trim() !== '') {
      // Only show detailed log once per session to reduce noise
      if (!this.fallbackWarningsShown.has(`detailed-${secretName}`)) {
        logger.debug(`[DEV] Using fallback value for secret: ${secretName}`);
        this.fallbackWarningsShown.add(`detailed-${secretName}`);
        updateGlobalFallbackWarnings(this.fallbackWarningsShown);
      }
      return fallbackValue;
    }

    // If no fallback value found, provide helpful message (but only once)
    if (!this.fallbackWarningsShown.has(`missing-${secretName}`)) {
      logger.warn(
        `[DEV] No fallback value configured for secret: ${secretName}`
      );
      logger.warn(`[DEV] Please add VITE_* environment variable to .env file`);
      this.fallbackWarningsShown.add(`missing-${secretName}`);
      updateGlobalFallbackWarnings(this.fallbackWarningsShown);
    }
    return null;
  }

  /**
   * Get multiple secrets at once
   */
  async getSecrets(
    secretNames: string[]
  ): Promise<Record<string, string | null>> {
    const promises = secretNames.map(async (name) => {
      const value = await this.getSecret(name);
      return { name, value };
    });

    const results = await Promise.all(promises);

    const secretsMap: Record<string, string | null> = {};
    results.forEach(({ name, value }) => {
      secretsMap[name] = value;
    });

    return secretsMap;
  }
  /**
   * Clear cache
   */
  clearCache(): void {
    this.secretCache.clear();
    logger.debug('Key Vault cache cleared');
  }

  /**
   * Clear cache for specific secrets (useful when authentication status changes)
   */
  clearSecretsCache(secretNames: string[]): void {
    secretNames.forEach((name) => {
      this.secretCache.delete(name);
      logger.debug(`Cleared cache for secret: ${name}`);
    });
  }

  /**
   * Force refresh a secret (bypass cache)
   */
  async refreshSecret(secretName: string): Promise<string | null> {
    // Remove from cache first
    this.secretCache.delete(secretName);
    // Fetch fresh value
    return await this.getSecret(secretName);
  }

  /**
   * Clear warning cache (useful for testing or reset)
   */ clearWarningCache(): void {
    this.fallbackWarningsShown.clear();
    updateGlobalFallbackWarnings(this.fallbackWarningsShown);
    logger.debug('[DEV] Cleared fallback warning cache');
  }
  /**
   * Check if service is configured properly
   */
  isConfigured(): boolean {
    return Boolean(this.functionUrl);
  }
  /**
   * Health check untuk Azure Function with Circuit Breaker status
   * Mengecek apakah Azure Function dapat diakses
   */
  async healthCheck(): Promise<{
    isHealthy: boolean;
    message: string;
    functionUrl: string;
    circuitBreaker: {
      isOpen: boolean;
      isHalfOpen: boolean;
      failureCount: number;
      lastFailureTime: number;
    };
  }> {
    try {
      // Check circuit breaker status first
      const circuitOpen = this.isCircuitOpen();
      if (circuitOpen && !this.isHalfOpen) {
        return {
          isHealthy: false,
          message: 'Circuit breaker is open - service temporarily unavailable',
          functionUrl: this.functionUrl,
          circuitBreaker: {
            isOpen: true,
            isHalfOpen: false,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime,
          },
        };
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(
        getApiEndpoint('get-secret?name=azure-cosmos-db-database-name'),
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      // Record success/failure for circuit breaker
      if (response.ok) {
        this.recordSuccess();
      } else {
        this.recordFailure();
      }

      return {
        isHealthy: true,
        message: `Azure Function is accessible (status: ${response.status})`,
        functionUrl: this.functionUrl,
        circuitBreaker: {
          isOpen: false,
          isHalfOpen: this.isHalfOpen,
          failureCount: this.failureCount,
          lastFailureTime: this.lastFailureTime,
        },
      };
    } catch (error) {
      // Record failure for circuit breaker
      this.recordFailure();

      let message = 'Azure Function is not accessible';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          message = 'Azure Function timeout - it may be starting up';
        } else if (error.message.includes('Failed to fetch')) {
          message = "Cannot connect to Azure Function - check if it's running";
        } else {
          message = `Azure Function error: ${error.message}`;
        }
      }

      return {
        isHealthy: false,
        message,
        functionUrl: this.functionUrl,
        circuitBreaker: {
          isOpen: this.isCircuitOpen(),
          isHalfOpen: this.isHalfOpen,
          failureCount: this.failureCount,
          lastFailureTime: this.lastFailureTime,
        },
      };
    }
  }
  /**
   * Get current service status for debugging including Circuit Breaker state
   */
  getStatus(): {
    functionUrl: string;
    cacheSize: number;
    warningsCount: number;
    isConfigured: boolean;
    circuitBreaker: {
      isOpen: boolean;
      isHalfOpen: boolean;
      failureCount: number;
      lastFailureTime: number;
      threshold: number;
      timeout: number;
    };
  } {
    return {
      functionUrl: this.functionUrl,
      cacheSize: this.secretCache.size,
      warningsCount: this.fallbackWarningsShown.size,
      isConfigured: this.isConfigured(),
      circuitBreaker: {
        isOpen: this.isCircuitOpen(),
        isHalfOpen: this.isHalfOpen,
        failureCount: this.failureCount,
        lastFailureTime: this.lastFailureTime,
        threshold: this.circuitBreakerThreshold,
        timeout: this.circuitBreakerTimeout,
      },
    };
  }

  /**
   * Manually reset circuit breaker (useful for testing or administrative reset)
   */
  resetCircuitBreaker(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.consecutiveSuccesses = 0;
    this.isHalfOpen = false;
    logger.info('Circuit breaker manually reset');
  }

  /**
   * Get circuit breaker metrics for monitoring
   */
  getCircuitBreakerMetrics(): {
    state: 'closed' | 'open' | 'half-open';
    failureCount: number;
    lastFailureTime: number;
    timeSinceLastFailure: number;
    consecutiveSuccesses: number;
  } {
    const now = Date.now();
    let state: 'closed' | 'open' | 'half-open' = 'closed';

    if (this.isHalfOpen) {
      state = 'half-open';
    } else if (this.isCircuitOpen()) {
      state = 'open';
    }

    return {
      state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      timeSinceLastFailure:
        this.lastFailureTime > 0 ? now - this.lastFailureTime : 0,
      consecutiveSuccesses: this.consecutiveSuccesses,
    };
  }
}

// Export singleton instance
export const frontendKeyVaultService = new FrontendKeyVaultService();
export default frontendKeyVaultService;
