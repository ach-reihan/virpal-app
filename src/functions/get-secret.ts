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
 * Azure Function: Get Secret from Key Vault
 *
 * Secure proxy function untuk mengakses Azure Key Vault dari frontend
 * Menggunakan Managed Identity untuk autentikasi dengan best practices
 *
 * Best Practices Applied:
 * - Input validation and sanitization
 * - Rate limiting considerations
 * - Security whitelisting
 * - Proper error handling and logging
 * - Configuration caching
 * - Request ID tracking
 */

import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { app } from '@azure/functions';
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { createJWTService } from './jwtValidationService.js';

interface KeyVaultResponse {
  success: boolean;
  data?: {
    name: string;
    value: string;
  };
  error?: string;
  requestId?: string;
  timestamp?: string;
}

// Configuration with validation
const KEY_VAULT_URL = process.env['KEY_VAULT_URL'] || '';

// Security: Allowed secret names whitelist (in lowercase for consistency with sanitization)
// Following principle of least privilege - only essential secrets are allowed
const ALLOWED_SECRETS = [
  // Azure Speech Service - Core TTS functionality
  'azure-speech-service-key',
  'azure-speech-service-region',
  'azure-speech-service-endpoint',

  // Azure OpenAI - Chat completion functionality
  'openai-api-key',
  'azure-openai-endpoint',
  'azure-openai-api-key',

  // Azure Cosmos DB - Cloud storage functionality
  'azure-cosmos-db-endpoint-uri',
  'azure-cosmos-db-key',
  'azure-cosmos-db-connection-string',
  'azure-cosmos-db-database-name',

  // Legacy secret names for backward compatibility
  'speech-key',
  'speech-region',
] as const;

// Performance: Cache clients and configuration
let secretClient: SecretClient | null = null;
let configCache: { isValid: boolean; timestamp: number } | null = null;

// Security: Rate limiting configuration
const RATE_LIMIT_MAX = 100; // requests per window
const RATE_LIMIT_WINDOW = 60000; // 1 minute window
const CONFIG_CACHE_DURATION = 300000; // 5 minutes

// Request tracking for rate limiting and audit
const requestTracker = new Map<string, { count: number; lastReset: number }>();

// Security: Request sanitization patterns
const SANITIZATION_PATTERNS = {
  // Remove special characters that could be used in injection attacks
  secretName: /[^a-z0-9\-_.]/gi,
  // Log sanitization for audit purposes
  logUnsafeChars: /[<>\"'&\x00-\x1f\x7f-\x9f]/g,
} as const;

// JWT validation service instance
let jwtService: ReturnType<typeof createJWTService> | null = null;

// Initialize JWT service dengan lazy loading
function getJWTService() {
  if (!jwtService) {
    jwtService = createJWTService();
  }
  return jwtService;
}

/**
 * Validate authentication from Authorization header
 * Returns user information if authentication is successful
 */
async function validateAuthentication(
  request: HttpRequest,
  context: InvocationContext
): Promise<{ isAuthenticated: boolean; user?: any; error?: string }> {
  try {
    // Extract Authorization header
    const authHeader = request.headers.get('authorization');

    // Debug: Log all request headers to see what we receive
    context.log('=== REQUEST HEADERS DEBUG ===');
    const headerEntries = Array.from(request.headers.entries());
    headerEntries.forEach(([key, value]) => {
      const logValue =
        key.toLowerCase() === 'authorization'
          ? value.substring(0, 20) + '...' // Only log first 20 chars of auth header
          : value;
      context.log(`${key}: ${logValue}`);
    });
    context.log('=== END HEADERS DEBUG ===');

    if (!authHeader) {
      context.warn('No Authorization header found in request');
      return {
        isAuthenticated: false,
        error: 'Authorization header is required',
      };
    }

    // Check Bearer token format
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
      return {
        isAuthenticated: false,
        error: 'Invalid authorization header format. Expected: Bearer <token>',
      };
    }
    const token = tokenMatch[1];
    if (!token || token.trim() === '') {
      return {
        isAuthenticated: false,
        error: 'Token cannot be empty',
      };
    }

    // Debug: Log token info (without exposing the actual token)
    context.log('=== TOKEN DEBUG ===');
    context.log(`Token length: ${token.length}`);
    context.log(`Token starts with: ${token.substring(0, 20)}...`);
    // Try to decode token payload for debugging (without validation)
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3 && tokenParts[1]) {
        const payload = JSON.parse(
          Buffer.from(tokenParts[1], 'base64').toString()
        );
        context.log('Token payload (debug):');
        context.log(`- aud: ${payload.aud}`);
        context.log(`- iss: ${payload.iss}`);
        context.log(`- sub: ${payload.sub}`);
        context.log(`- scp: ${payload.scp}`);
        context.log(
          `- exp: ${payload.exp} (${new Date(
            payload.exp * 1000
          ).toISOString()})`
        );
      }
    } catch (decodeError) {
      context.warn('Could not decode token for debugging:', decodeError);
    }
    context.log('=== END TOKEN DEBUG ==='); // Validate JWT token
    const jwtValidationService = getJWTService();
    const validationResult = await jwtValidationService.validateToken(token);

    if (!validationResult.isValid) {
      return {
        isAuthenticated: false,
        error: validationResult.error || 'Invalid token',
      };
    }

    // Extract user information
    const userInfo = jwtValidationService.extractUserInfo(
      validationResult.claims!
    );

    return {
      isAuthenticated: true,
      user: {
        userId: userInfo.userId,
        email: userInfo.email,
        name: userInfo.name,
        scopes: validationResult.scopes || [],
      },
    };
  } catch (error) {
    context.error(
      'Authentication validation error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return {
      isAuthenticated: false,
      error: 'Authentication validation failed',
    };
  }
}

// Initialize Key Vault client with secure credential management
function initializeKeyVaultClient(): SecretClient | null {
  try {
    if (!KEY_VAULT_URL) {
      return null;
    }

    // Validate Key Vault URL format for security
    if (
      !KEY_VAULT_URL.startsWith('https://') ||
      !KEY_VAULT_URL.includes('.vault.azure.net')
    ) {
      return null;
    }

    // Use DefaultAzureCredential following Azure best practices
    // This automatically handles: Managed Identity, Azure CLI, Visual Studio, etc.
    const credential = new DefaultAzureCredential();
    return new SecretClient(KEY_VAULT_URL, credential);
  } catch (error) {
    return null;
  }
}

// Rate limiting helper
function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const tracker = requestTracker.get(clientIp);

  if (!tracker || now - tracker.lastReset > RATE_LIMIT_WINDOW) {
    requestTracker.set(clientIp, { count: 1, lastReset: now });
    return true;
  }

  if (tracker.count >= RATE_LIMIT_MAX) {
    return false;
  }

  tracker.count++;
  return true;
}

// Input validation and sanitization helper
function validateAndSanitizeSecretName(
  secretName: string,
  context: InvocationContext
): { isValid: boolean; sanitized: string; errors: string[] } {
  const errors: string[] = [];

  // Basic validation
  if (!secretName || typeof secretName !== 'string') {
    errors.push('Secret name is required and must be a string');
    return { isValid: false, sanitized: '', errors };
  }

  // Detect potentially unsafe characters for logging
  const unsafeChars = secretName.match(SANITIZATION_PATTERNS.logUnsafeChars);
  if (unsafeChars) {
    context.warn(
      `Potentially unsafe characters detected in secret name: ${unsafeChars.join(
        ', '
      )}`
    );
  }

  // Sanitize the secret name
  const sanitized = secretName
    .toLowerCase()
    .replace(SANITIZATION_PATTERNS.secretName, '');

  // Check if sanitization changed the input (potential security issue)
  if (sanitized !== secretName.toLowerCase()) {
    context.warn(
      `Secret name was sanitized: "${secretName}" -> "${sanitized}"`
    );
  }

  // Validate against whitelist
  const isAllowed = ALLOWED_SECRETS.includes(sanitized as any);
  if (!isAllowed) {
    errors.push(`Secret '${sanitized}' is not in the allowed secrets list`);
    context.warn(`Attempted access to non-whitelisted secret: ${sanitized}`);
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    errors,
  };
}

// Configuration validation
function validateConfiguration(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!KEY_VAULT_URL) {
    errors.push('KEY_VAULT_URL environment variable is not set');
  }

  if (KEY_VAULT_URL && !KEY_VAULT_URL.startsWith('https://')) {
    errors.push('KEY_VAULT_URL must use HTTPS');
  }

  return { isValid: errors.length === 0, errors };
}

export async function getSecret(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const requestId = context.invocationId;
  const timestamp = new Date().toISOString();
  const startTime = performance.now();
  // Minimal structured logging for production
  context.info(`Key Vault secret request: ${request.method} ${requestId}`); // Security: Add comprehensive CORS headers with flexible origin support
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    // Azure Static Web Apps domains
    'https://ashy-coast-0aeebe10f.6.azurestaticapps.net',
    // Allow any azurestaticapps.net subdomain for staging
    /^https:\/\/.*\.azurestaticapps\.net$/,
  ];

  const origin = request.headers.get('origin');
  let allowOrigin = 'http://localhost:5173'; // default fallback

  if (origin) {
    // Check exact matches first
    if (allowedOrigins.filter((o) => typeof o === 'string').includes(origin)) {
      allowOrigin = origin;
    } else {
      // Check regex patterns
      const regexOrigins = allowedOrigins.filter(
        (o) => o instanceof RegExp
      ) as RegExp[];
      for (const pattern of regexOrigins) {
        if (pattern.test(origin)) {
          allowOrigin = origin;
          break;
        }
      }
    }
  }

  const headers = {
    'Access-Control-Allow-Origin': allowOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Accept, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
    'X-Request-ID': requestId,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  }; // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: headers,
    };
  }
  try {
    // Skip authentication for development environment
    const isDevelopment =
      process.env['NODE_ENV'] === 'development' ||
      process.env['AZURE_FUNCTIONS_ENVIRONMENT'] === 'Development' ||
      request.headers.get('host')?.includes('localhost') ||
      request.headers.get('host')?.includes('127.0.0.1') ||
      process.env['FUNCTIONS_WORKER_RUNTIME'] === undefined;

    if (!isDevelopment) {
      // Production authentication validation
      const authResult = await validateAuthentication(request, context);
      if (!authResult.isAuthenticated) {
        context.warn(`Authentication failed: ${authResult.error}`, {
          requestId,
        });
        return {
          status: 401,
          headers: headers,
          jsonBody: {
            success: false,
            error: authResult.error || 'Authentication required',
            requestId,
            timestamp,
          } as KeyVaultResponse,
        };
      }
    } // Rate limiting check
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    if (!checkRateLimit(clientIp)) {
      return {
        status: 429,
        headers: headers,
        jsonBody: {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          requestId,
          timestamp,
        } as KeyVaultResponse,
      };
    }

    // Configuration validation (cached)
    const now = Date.now();
    if (!configCache || now - configCache.timestamp > CONFIG_CACHE_DURATION) {
      const configValidation = validateConfiguration();
      configCache = { isValid: configValidation.isValid, timestamp: now };
      if (!configValidation.isValid) {
        context.error(
          `Configuration error: ${configValidation.errors.join(', ')}`
        );
        return {
          status: 500,
          headers: headers,
          jsonBody: {
            success: false,
            error: 'Service configuration error',
            requestId,
            timestamp,
          } as KeyVaultResponse,
        };
      }
    } // Initialize client if needed
    if (!secretClient) {
      secretClient = initializeKeyVaultClient();
      if (!secretClient) {
        context.error('Key Vault client initialization failed');
        return {
          status: 500,
          headers: headers,
          jsonBody: {
            success: false,
            error: 'Key Vault client not initialized',
            requestId,
            timestamp,
          } as KeyVaultResponse,
        };
      }
    } // Input validation
    const secretName = request.query.get('name');
    if (!secretName) {
      return {
        status: 400,
        headers: headers,
        jsonBody: {
          success: false,
          error: 'Secret name is required',
          requestId,
          timestamp,
        } as KeyVaultResponse,
      };
    }
    // Enhanced validation and sanitization
    const validation = validateAndSanitizeSecretName(secretName, context);
    if (!validation.isValid) {
      return {
        status: 403,
        headers: headers,
        jsonBody: {
          success: false,
          error: validation.errors[0] || 'Access to this secret is not allowed',
          requestId,
          timestamp,
        } as KeyVaultResponse,
      };
    }
    const sanitizedSecretName = validation.sanitized;

    // Get secret from Key Vault with proper error handling
    let secret;
    try {
      secret = await secretClient.getSecret(sanitizedSecretName);
    } catch (keyVaultError: any) {
      // Log critical errors only
      context.error(
        `Key Vault access failed for '${sanitizedSecretName}': ${
          keyVaultError.code || keyVaultError.statusCode
        }`
      );

      if (keyVaultError.statusCode === 404) {
        return {
          status: 404,
          headers: headers,
          jsonBody: {
            success: false,
            error: `Secret '${sanitizedSecretName}' does not exist in Key Vault`,
            requestId,
            timestamp,
          } as KeyVaultResponse,
        };
      } else if (keyVaultError.statusCode === 403) {
        return {
          status: 403,
          headers: headers,
          jsonBody: {
            success: false,
            error: `Access denied to secret '${sanitizedSecretName}' in Key Vault`,
            requestId,
            timestamp,
          } as KeyVaultResponse,
        };
      } else {
        throw keyVaultError; // Re-throw for general error handling
      }
    }
    if (!secret.value) {
      return {
        status: 404,
        headers: headers,
        jsonBody: {
          success: false,
          error: `Secret '${sanitizedSecretName}' exists but has no value`,
          requestId,
          timestamp,
        } as KeyVaultResponse,
      };
    }

    const endTime = performance.now();
    const processingTime = Math.round(endTime - startTime);

    // Log successful operations for monitoring
    context.info(
      `Secret retrieved successfully: ${sanitizedSecretName} (${processingTime}ms)`
    );

    return {
      status: 200,
      headers: headers,
      jsonBody: {
        success: true,
        data: {
          name: sanitizedSecretName,
          value: secret.value,
        },
        requestId,
        timestamp,
      } as KeyVaultResponse,
    };
  } catch (error) {
    const endTime = performance.now();
    const processingTime = Math.round(endTime - startTime);

    context.error(
      `Secret retrieval failed (${processingTime}ms):`,
      error instanceof Error ? error.message : 'Unknown error'
    );

    // Don't expose internal error details to client
    let errorMessage = 'Internal server error occurred';
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        errorMessage = 'Secret not found';
      } else if (error.message.includes('access')) {
        errorMessage = 'Access denied to Key Vault';
      }
    }

    return {
      status: 500,
      headers: headers,
      jsonBody: {
        success: false,
        error: errorMessage,
        requestId,
        timestamp,
      } as KeyVaultResponse,
    };
  }
}

// Register the function
app.http('get-secret', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous', // Anonymous access for Azure SWA compatibility
  handler: getSecret,
});
