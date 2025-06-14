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

import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { logger } from '../utils/logger';

/**
 * Azure Key Vault Service for secure credential management
 * Uses Managed Identity for authentication - no hardcoded credentials needed
 *
 * Production-optimized for Azure SWA with Azure Functions backend
 *
 * Authentication Chain (Azure SWA/Functions):
 * 1. In Azure: System-assigned Managed Identity (preferred for SWA)
 * 2. User-assigned Managed Identity (if configured)
 * 3. Service Principal via environment variables (fallback)
 * 4. Local development: Azure CLI, VS Code
 */
class AzureKeyVaultService {
  private secretClient: SecretClient | null = null;
  private keyVaultUrl: string;
  private credential: DefaultAzureCredential;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    // Get Key Vault URL from environment
    this.keyVaultUrl = process.env['KEY_VAULT_URL'] || '';

    // Production-optimized credential configuration for Azure SWA
    this.credential = this.createOptimizedCredential();

    // Lazy initialization for better performance in Azure Functions
    this.initializeClient();
  }

  /**
   * Create optimized credential chain for Azure SWA production
   */
  private createOptimizedCredential(): DefaultAzureCredential {
    const azureClientId = process.env['AZURE_CLIENT_ID'];

    // Production configuration optimized for Azure SWA
    const credentialOptions = {
      // Prefer system-assigned managed identity in Azure SWA
      managedIdentityClientId: azureClientId,
      // Optimize timeout for Azure Functions cold start
      managedIdentityRequestTimeout: 10000, // 10 seconds
      // Disable unnecessary credential types for production
      excludeAzureCliCredential: false, // Keep for local dev
      excludeAzurePowerShellCredential: true, // Not needed in production
      excludeEnvironmentCredential: false, // Keep for service principal fallback
      excludeManagedIdentityCredential: false, // Essential for Azure SWA
      excludeSharedTokenCacheCredential: true, // Not needed in Functions
      excludeVisualStudioCodeCredential: false, // Keep for local dev
      excludeInteractiveBrowserCredential: true, // Not needed in Functions
      // Add retry configuration for production reliability
      retryOptions: {
        maxRetries: 3,
        retryDelayInMs: 1000,
        maxRetryDelayInMs: 5000,
      },
    };

    return new DefaultAzureCredential(credentialOptions);
  }

  /**
   * Initialize Key Vault client with proper error handling
   */
  private async initializeClient(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      if (!this.keyVaultUrl) {
        logger.error('Key Vault URL not configured in environment variables');
        return;
      }

      // Validate Key Vault URL format
      if (
        !this.keyVaultUrl.startsWith('https://') ||
        !this.keyVaultUrl.includes('.vault.azure.net')
      ) {
        logger.error(
          'Invalid Key Vault URL format. Expected: https://<vault-name>.vault.azure.net/'
        );
        return;
      }

      this.secretClient = new SecretClient(this.keyVaultUrl, this.credential);

      // Test credential by attempting to get a test secret (non-blocking)
      // This helps identify auth issues early in Azure SWA
      this.validateCredentials();

      this.isInitialized = true;
      logger.info('Key Vault service initialized successfully for production');
    } catch (error: any) {
      logger.error('Failed to initialize Key Vault service', {
        error: error.message,
        keyVaultUrl: this.keyVaultUrl ? '[CONFIGURED]' : '[NOT_SET]',
      });
    }
  }

  /**
   * Validate credentials asynchronously (non-blocking)
   */
  private async validateCredentials(): Promise<void> {
    try {
      if (!this.secretClient) return;

      // Try to list secrets (requires minimal permissions)
      // This validates the credential without exposing sensitive data
      const iterator = this.secretClient.listPropertiesOfSecrets();
      const firstResult = await iterator.next();

      if (firstResult.done === false || firstResult.value) {
        logger.debug('Key Vault credentials validated successfully');
      }
    } catch (error: any) {
      // Log validation error but don't fail initialization
      logger.warn('Key Vault credential validation failed', {
        errorCode: error.code,
        statusCode: error.statusCode,
      });
    }
  }
  /**
   * Retrieves a secret from Azure Key Vault with production optimizations
   * @param secretName The name of the secret to retrieve
   * @returns The secret value or null if not found/error
   */
  async getSecret(secretName: string): Promise<string | null> {
    try {
      // Ensure client is initialized
      await this.initializeClient();

      if (!this.secretClient || !this.isInitialized) {
        logger.warn('Key Vault client not properly initialized');
        return null;
      }

      // Input validation for production security
      if (!secretName || typeof secretName !== 'string') {
        logger.error('Invalid secret name provided');
        return null;
      }

      // Sanitize secret name (Azure Key Vault naming requirements)
      const sanitizedSecretName = secretName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-');
      if (sanitizedSecretName !== secretName.toLowerCase()) {
        logger.debug('Secret name was sanitized for Key Vault compatibility');
      }

      logger.debug('Retrieving secret from Key Vault', {
        secretName: '[REDACTED]',
      });

      // Implement retry logic for production reliability
      const secret = await this.retryOperation(
        () => this.secretClient!.getSecret(sanitizedSecretName),
        3, // max retries
        1000 // base delay ms
      );

      if (secret.value) {
        logger.debug('Successfully retrieved secret from Key Vault');
        return secret.value;
      } else {
        logger.warn('Secret exists but has no value', {
          secretName: '[REDACTED]',
        });
        return null;
      }
    } catch (error: any) {
      logger.error('Failed to retrieve secret from Key Vault', {
        secretName: '[REDACTED]',
        errorCode: error.code,
        statusCode: error.statusCode,
        message: error.message,
      });

      // Handle specific Azure Key Vault errors for better debugging
      if (error.code === 'SecretNotFound') {
        logger.warn('Secret not found in Key Vault');
      } else if (error.code === 'Forbidden') {
        logger.error(
          'Access denied to Key Vault. Check Managed Identity permissions.'
        );
      } else if (error.code === 'VaultNotFound') {
        logger.error('Key Vault not found. Check KEY_VAULT_URL configuration.');
      }

      return null;
    }
  }

  /**
   * Retry operation with exponential backoff for production reliability
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    baseDelayMs: number
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (
          error.statusCode &&
          error.statusCode >= 400 &&
          error.statusCode < 500
        ) {
          throw error;
        }

        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff with jitter
        const delay =
          baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
        logger.debug(
          `Retrying Key Vault operation in ${delay}ms (attempt ${attempt}/${maxRetries})`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Check if Key Vault service is properly configured and ready
   * @returns boolean indicating if the service is ready for production use
   */
  async isConfigured(): Promise<boolean> {
    try {
      await this.initializeClient();
      return this.isInitialized && !!this.keyVaultUrl && !!this.secretClient;
    } catch {
      return false;
    }
  }

  /**
   * Get Key Vault URL for debugging purposes (production-safe)
   */
  getKeyVaultUrl(): string {
    // Return masked URL for security in production logs
    if (this.keyVaultUrl) {
      const url = new URL(this.keyVaultUrl);
      return `https://[VAULT-NAME].vault.azure.net/`;
    }
    return '[NOT_CONFIGURED]';
  }

  /**
   * Health check method for Azure Functions health endpoint
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();

    try {
      await this.initializeClient();

      if (!this.isInitialized || !this.secretClient) {
        return {
          status: 'unhealthy',
          details: 'Key Vault client not initialized',
          responseTime: Date.now() - startTime,
        };
      }

      // Quick connectivity test
      const iterator = this.secretClient.listPropertiesOfSecrets();
      await iterator.next();

      return {
        status: 'healthy',
        details: 'Key Vault accessible',
        responseTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        status: 'degraded',
        details: `Key Vault connectivity issue: ${
          error.code || 'Unknown error'
        }`,
        responseTime: Date.now() - startTime,
      };
    }
  }
}

// Production-optimized service initialization for Azure SWA
// Only export if running in Node.js environment (Azure Functions backend)
let keyVaultService: AzureKeyVaultService | null = null;

// Enhanced environment detection for Azure SWA production
const isNodeJSEnvironment = (): boolean => {
  try {
    return (
      typeof process !== 'undefined' &&
      process.env !== undefined &&
      typeof process.versions?.node === 'string'
    );
  } catch {
    return false;
  }
};

const isAzureFunctionsEnvironment = (): boolean => {
  try {
    return !!(
      process.env['FUNCTIONS_WORKER_RUNTIME'] ||
      process.env['AZURE_FUNCTIONS_ENVIRONMENT'] ||
      process.env['WEBSITE_SITE_NAME']
    );
  } catch {
    return false;
  }
};

if (isNodeJSEnvironment()) {
  if (isAzureFunctionsEnvironment()) {
    // Running in Azure Functions (production or local)
    logger.info(
      'Initializing Key Vault service for Azure Functions environment'
    );
    keyVaultService = new AzureKeyVaultService();
  } else {
    // Running in Node.js but not Azure Functions (development build)
    logger.debug(
      'Initializing Key Vault service for Node.js development environment'
    );
    keyVaultService = new AzureKeyVaultService();
  }
} else {
  // Running in browser - should not be used
  logger.warn('AzureKeyVaultService should not be used in browser environment');
}

export { AzureKeyVaultService, keyVaultService };
export default keyVaultService;
