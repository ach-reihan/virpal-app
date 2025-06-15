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

import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { app } from '@azure/functions';
import { createJWTService } from './jwtValidationService.js';

// Performance optimization: Cache configuration to avoid repeated calls
let configCache: {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
  timestamp: number;
} | null = null;

const CONFIG_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Rate limiting configuration
const RATE_LIMIT_MAX = 30; // requests per window per IP
const RATE_LIMIT_WINDOW = 60000; // 1 minute window
const requestTracker = new Map<string, { count: number; lastReset: number }>();

// Environment variable to secret name mapping for Azure Static Web Apps Managed Functions
const CONFIG_ENV_MAPPING = {
  'azure-openai-endpoint': 'AZURE_OPENAI_ENDPOINT',
  'azure-openai-key': 'AZURE_OPENAI_API_KEY',
  'azure-openai-deployment-name': 'AZURE_OPENAI_DEPLOYMENT_NAME',
  'azure-openai-api-version': 'AZURE_OPENAI_API_VERSION',
} as const;

// Default values for non-sensitive configuration
const CONFIG_DEFAULTS = {
  'azure-openai-deployment-name': 'gpt-4o-mini',
  'azure-openai-api-version': '2024-10-24',
} as const;

// JWT validation service instance
let jwtService: ReturnType<typeof createJWTService> | null = null;

// Initialize JWT service dengan lazy loading
function getJWTService() {
  if (!jwtService) {
    try {
      jwtService = createJWTService();
    } catch (error) {
      // Re-throw with more context for configuration errors
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Missing required environment variables')) {
        throw new Error(
          `JWT Authentication Configuration Error: ${errorMessage}\n` +
            'This error typically occurs when Azure authentication environment variables are not set.\n' +
            'Please check your .env file and ensure all required backend authentication variables are configured.'
        );
      }
      throw error;
    }
  }
  return jwtService;
}

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AzureOpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface UserInfo {
  userId: string;
  email?: string | undefined;
  name?: string | undefined;
  scopes: string[];
}

interface ChatCompletionRequest {
  userInput: string;
  systemPrompt?: string;
  messageHistory?: OpenAIChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

// Input validation helper with comprehensive security checks
function validateRequest(requestData: ChatCompletionRequest): {
  isValid: boolean;
  error?: string;
} {
  if (!requestData?.userInput) {
    return { isValid: false, error: 'userInput is required' };
  }

  if (typeof requestData.userInput !== 'string') {
    return { isValid: false, error: 'userInput must be a string' };
  }

  // Security: Prevent overly long inputs and potential DoS
  if (requestData.userInput.length > 4000) {
    return {
      isValid: false,
      error: 'userInput exceeds maximum length of 4000 characters',
    };
  }

  // Security: Basic XSS prevention - reject obvious script tags
  if (/<script[^>]*>.*?<\/script>/gi.test(requestData.userInput)) {
    return {
      isValid: false,
      error: 'userInput contains potentially harmful content',
    };
  }

  // Memory management: Limit message history
  if (requestData.messageHistory && requestData.messageHistory.length > 20) {
    return {
      isValid: false,
      error: 'messageHistory exceeds maximum length of 20 messages',
    };
  }

  // Validate temperature range
  if (
    requestData.temperature !== undefined &&
    (typeof requestData.temperature !== 'number' ||
      requestData.temperature < 0 ||
      requestData.temperature > 2)
  ) {
    return {
      isValid: false,
      error: 'temperature must be a number between 0 and 2',
    };
  }

  // Validate token limits
  if (
    requestData.maxTokens !== undefined &&
    (typeof requestData.maxTokens !== 'number' ||
      requestData.maxTokens < 1 ||
      requestData.maxTokens > 4000)
  ) {
    return {
      isValid: false,
      error: 'maxTokens must be a number between 1 and 4000',
    };
  }

  // Validate system prompt if provided
  if (requestData.systemPrompt !== undefined) {
    if (typeof requestData.systemPrompt !== 'string') {
      return { isValid: false, error: 'systemPrompt must be a string' };
    }
    if (requestData.systemPrompt.length > 2000) {
      return {
        isValid: false,
        error: 'systemPrompt exceeds maximum length of 2000 characters',
      };
    }
  }
  return { isValid: true };
}

// Rate limiting helper
function checkChatRateLimit(
  clientIp: string,
  context: InvocationContext
): boolean {
  // Basic IP validation
  if (!clientIp || typeof clientIp !== 'string' || clientIp.length > 45) {
    context.warn('Invalid IP address for rate limiting');
    return false; // Deny invalid IPs
  }

  // Allow localhost in development
  const isDevelopment = process.env['NODE_ENV'] === 'development';
  if (
    isDevelopment &&
    (clientIp.includes('localhost') || clientIp.includes('127.0.0.1'))
  ) {
    return true;
  }

  const now = Date.now();
  const tracker = requestTracker.get(clientIp);

  if (!tracker || now - tracker.lastReset > RATE_LIMIT_WINDOW) {
    requestTracker.set(clientIp, { count: 1, lastReset: now });
    return true;
  }

  if (tracker.count >= RATE_LIMIT_MAX) {
    context.warn(
      `Chat rate limit exceeded for IP: ${clientIp.substring(0, 8)}...`
    );
    return false;
  }

  tracker.count++;
  return true;
}

/**
 * Validate authentication from Authorization header
 * Returns user information if authentication is successful
 */
async function validateAuthentication(
  request: HttpRequest,
  context: InvocationContext
): Promise<{ isAuthenticated: boolean; user?: UserInfo; error?: string }> {
  try {
    // Check if we're in development mode
    const isDevMode = process.env['NODE_ENV'] === 'development';
    const host = request.headers.get('host') || '';
    const isLocalhost =
      host.includes('localhost') || host.includes('127.0.0.1');

    if (isDevMode && isLocalhost) {
      return {
        isAuthenticated: true,
        user: {
          userId: 'dev-user',
          email: 'dev@localhost.local',
          name: 'Development User',
          scopes: ['dev'],
        },
      };
    }

    // Extract Authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
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

    // Validasi token tidak kosong
    if (!token || token.trim() === '') {
      return {
        isAuthenticated: false,
        error: 'Token cannot be empty',
      };
    } // Validate JWT token
    const jwtValidationService = getJWTService();
    const validationResult = await jwtValidationService.validateToken(token);

    if (!validationResult.isValid) {
      return {
        isAuthenticated: false,
        error: validationResult.error || 'Invalid token',
      };
    } // Extract user information
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

/**
 * Get configuration value with Environment Variables first strategy
 * Optimized for Azure Static Web Apps Managed Functions
 */
function getConfigValue(
  configName: keyof typeof CONFIG_ENV_MAPPING,
  context: InvocationContext
): string | null {
  try {
    // Strategy 1: Check Environment Variables first (for Managed Functions)
    const envVarName =
      CONFIG_ENV_MAPPING[configName as keyof typeof CONFIG_ENV_MAPPING];
    if (envVarName && typeof envVarName === 'string') {
      const envValue = process.env[envVarName];
      if (
        envValue &&
        typeof envValue === 'string' &&
        envValue.trim() !== '' &&
        envValue.length > 0 &&
        envValue.length < 2048 // Reasonable limit for config values
      ) {
        context.info(
          `Config '${configName}' retrieved from environment variable '${envVarName}'`
        );
        return envValue.trim();
      } else {
        context.info(
          `Environment variable '${envVarName}' for config '${configName}' is empty or not set`
        );
      }
    } else {
      context.info(
        `No environment variable mapping found for config '${configName}'`
      );
    }

    // Strategy 2: Hardcoded defaults for non-sensitive configuration
    if (Object.prototype.hasOwnProperty.call(CONFIG_DEFAULTS, configName)) {
      const defaultValue =
        CONFIG_DEFAULTS[configName as keyof typeof CONFIG_DEFAULTS];
      if (defaultValue && typeof defaultValue === 'string') {
        context.info(`Using default value for '${configName}'`);
        return defaultValue;
      }
    }

    // All strategies failed
    context.warn(
      `Config '${configName}' not found in environment variables or defaults`
    );
    return null;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    context.error(`Error retrieving config '${configName}': ${errorMessage}`);
    return null;
  }
}

// Configuration retrieval with caching and error handling
async function getConfiguration(context: InvocationContext): Promise<{
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
} | null> {
  // Check cache first for performance
  const now = Date.now();
  if (configCache && now - configCache.timestamp < CONFIG_CACHE_DURATION) {
    return {
      endpoint: configCache.endpoint,
      apiKey: configCache.apiKey,
      deploymentName: configCache.deploymentName,
      apiVersion: configCache.apiVersion,
    };
  }

  try {
    // Get configuration using Environment Variables first strategy
    const endpoint = getConfigValue('azure-openai-endpoint', context);
    const apiKey = getConfigValue('azure-openai-key', context);
    const deploymentName = getConfigValue(
      'azure-openai-deployment-name',
      context
    );
    const apiVersion = getConfigValue('azure-openai-api-version', context);

    // Validate all required configuration is present
    if (!endpoint || !apiKey) {
      context.error(
        'Missing required configuration values: endpoint and apiKey are required'
      );
      return null;
    }

    // Use defaults for optional values if not provided
    const finalDeploymentName =
      deploymentName || CONFIG_DEFAULTS['azure-openai-deployment-name'];
    const finalApiVersion =
      apiVersion || CONFIG_DEFAULTS['azure-openai-api-version'];

    // Update cache with new configuration
    configCache = {
      endpoint,
      apiKey,
      deploymentName: finalDeploymentName,
      apiVersion: finalApiVersion,
      timestamp: now,
    };

    context.info(
      `Configuration loaded successfully: ${endpoint}, deployment: ${finalDeploymentName}, version: ${finalApiVersion}`
    );

    return {
      endpoint,
      apiKey,
      deploymentName: finalDeploymentName,
      apiVersion: finalApiVersion,
    };
  } catch (error) {
    context.error(
      'Failed to retrieve configuration:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

// Robust retry logic with exponential backoff
async function retryRequest<T>(
  operation: () => Promise<T>,
  context: InvocationContext,
  maxRetries: number = 3,
  baseDelay: number = 300
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on client errors (4xx) - they won't succeed on retry
      if (error instanceof Error && error.message.includes('4')) {
        throw error;
      }

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 100;
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Only log on final retry attempt
      if (attempt === maxRetries - 1) {
        context.warn(`Retrying request (attempt ${attempt + 1}/${maxRetries})`);
      }
    }
  }

  throw lastError!;
}

// Security-focused CORS headers
const getCorsHeaders = (origin?: string | null) => {
  // Allowed origins for CORS
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    // Azure Static Web Apps domains
    'https://ashy-coast-0aeebe10f.6.azurestaticapps.net',
  ];

  // Check if origin is allowed - more restrictive approach
  let allowOrigin = 'https://ashy-coast-0aeebe10f.6.azurestaticapps.net'; // default fallback
  if (origin) {
    if (allowedOrigins.includes(origin)) {
      allowOrigin = origin;
    } else if (
      origin.includes('azurestaticapps.net') &&
      origin.startsWith('https://')
    ) {
      // Allow only HTTPS azurestaticapps.net subdomains for staging
      allowOrigin = origin;
    }
  }

  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Accept, Authorization, X-Guest-Mode, X-Requested-With',
    'Access-Control-Max-Age': '3600', // 1 hour cache for preflight
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
};

/**
 * Azure Function for handling chat completion requests
 * Best practices applied:
 * - Input validation and sanitization
 * - Configuration caching for performance
 * - Proper error handling and logging
 * - Security headers
 * - Retry logic with exponential backoff
 * - Memory management for message history
 */
export async function chatCompletionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  const origin = request.headers.get('origin');

  context.info(`Chat completion request: ${request.method} ${requestId}`);

  // Enhanced debug logging for troubleshooting
  context.info('=== CHAT COMPLETION DEBUG INFO ===');
  context.info(`Request URL: ${request.url}`);
  context.info(`Request Method: ${request.method}`);
  context.info(`Origin: ${origin || 'none'}`);
  context.info(`User-Agent: ${request.headers.get('user-agent') || 'none'}`);
  context.info(
    `Content-Type: ${request.headers.get('content-type') || 'none'}`
  );
  context.info(
    `Authorization: ${
      request.headers.get('authorization') ? 'present' : 'none'
    }`
  );
  context.info(
    `X-Guest-Mode: ${request.headers.get('X-Guest-Mode') || 'none'}`
  );
  context.info('===================================');
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    context.info(`CORS preflight handled for origin: ${origin}`);
    return {
      status: 200,
      headers: getCorsHeaders(origin),
      body: '', // Empty body for OPTIONS
    };
  }
  // Security: Only allow POST requests
  if (request.method !== 'POST') {
    return {
      status: 405,
      headers: getCorsHeaders(origin),
      body: JSON.stringify({
        error: 'Method not allowed. Use POST.',
        requestId,
      }),
    };
  }

  // Rate limiting check
  const clientIp =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (!checkChatRateLimit(clientIp, context)) {
    return {
      status: 429,
      headers: getCorsHeaders(origin),
      body: JSON.stringify({
        error: 'Rate limit exceeded. Please try again later.',
        requestId,
      }),
    };
  } // Check if this is a guest mode request
  const isGuestMode = request.headers.get('X-Guest-Mode') === 'true';
  let userInfo: UserInfo | null = null;
  if (isGuestMode) {
    userInfo = {
      userId: 'guest',
      email: undefined,
      name: 'Guest User',
      scopes: ['guest'],
    };
  } else {
    // Authentication validation for non-guest requests
    const authResult = await validateAuthentication(request, context);
    if (!authResult.isAuthenticated) {
      return {
        status: 401,
        headers: getCorsHeaders(origin),
        body: JSON.stringify({
          error: 'Authentication required',
          details: authResult.error,
          requestId,
        }),
      };
    }

    userInfo = authResult.user || null;
  }

  try {
    // Parse and validate request body with error handling
    let requestData: ChatCompletionRequest;
    try {
      requestData = (await request.json()) as ChatCompletionRequest;
    } catch {
      return {
        status: 400,
        headers: getCorsHeaders(origin),
        body: JSON.stringify({
          error: 'Invalid JSON in request body',
          requestId,
        }),
      };
    }

    // Comprehensive input validation
    const validation = validateRequest(requestData);
    if (!validation.isValid) {
      return {
        status: 400,
        headers: getCorsHeaders(origin),
        body: JSON.stringify({
          error: validation.error,
          requestId,
        }),
      };
    }

    // Get configuration with error handling
    const config = await getConfiguration(context);
    if (!config) {
      return {
        status: 500,
        headers: getCorsHeaders(origin),
        body: JSON.stringify({
          error:
            'Configuration error: Unable to retrieve Azure OpenAI configuration',
          details:
            'Please ensure Key Vault is properly configured and accessible',
          requestId,
        }),
      };
    }

    // Build messages array with memory management
    const messages: OpenAIChatMessage[] = [];

    // Add system prompt if provided
    if (requestData.systemPrompt?.trim()) {
      messages.push({
        role: 'system',
        content: requestData.systemPrompt.trim(),
      });
    }
    // Add message history with intelligent truncation
    if (requestData.messageHistory && requestData.messageHistory.length > 0) {
      // Keep only the last 10 messages to prevent memory issues
      const limitedHistory = requestData.messageHistory
        .slice(-10)
        .filter((msg) => msg.content?.trim()); // Remove empty messages
      messages.push(...limitedHistory);
    }

    // Add current user input
    messages.push({
      role: 'user',
      content: requestData.userInput.trim(),
    }); // Enhanced logging for monitoring
    context.info(
      `Processing OpenAI request - Messages: ${messages.length}, Guest: ${isGuestMode}, User: ${userInfo?.userId}`
    );

    // Build the request URL
    const requestUrl = `${config.endpoint}/openai/deployments/${config.deploymentName}/chat/completions?api-version=${config.apiVersion}`;

    // Call Azure OpenAI API with retry logic
    const openAIResponse = await retryRequest(async () => {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey,
          'User-Agent': 'VIRPAL-Assistant/1.0',
        },
        body: JSON.stringify({
          messages: messages,
          temperature: requestData.temperature ?? 0.7,
          max_tokens: requestData.maxTokens ?? 800,
          stream: false, // Explicitly disable streaming for reliability
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return response;
    }, context);

    const data = (await openAIResponse.json()) as AzureOpenAIResponse;

    // Robust response validation
    if (data?.choices?.[0]?.message?.content) {
      const duration = Date.now() - startTime;
      context.info(`Chat completion successful: ${duration}ms`);

      return {
        status: 200,
        headers: getCorsHeaders(origin),
        body: JSON.stringify({
          response: data.choices[0].message.content,
          timestamp: new Date().toISOString(),
          processingTime: duration,
          requestId,
          isGuestMode: isGuestMode,
          user: {
            userId: userInfo?.userId,
            isGuest: isGuestMode,
          },
        }),
      };
    } else {
      context.error('Invalid response structure from Azure OpenAI');
      return {
        status: 500,
        headers: getCorsHeaders(origin),
        body: JSON.stringify({
          error: 'Invalid response from AI service',
          details: 'Response does not contain expected content structure',
          requestId,
        }),
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    context.error(
      `Chat completion failed (${duration}ms):`,
      error instanceof Error ? error.message : 'Unknown error'
    );

    // Return appropriate error based on error type
    const isTimeoutError =
      error instanceof Error && error.message.includes('timeout');
    const isRateLimitError =
      error instanceof Error && error.message.includes('429');

    return {
      status: isTimeoutError ? 504 : isRateLimitError ? 429 : 500,
      headers: getCorsHeaders(origin),
      body: JSON.stringify({
        error: isTimeoutError
          ? 'Request timeout'
          : isRateLimitError
          ? 'Rate limit exceeded'
          : 'Internal server error',
        details:
          error instanceof Error ? error.message : 'Unknown error occurred',
        requestId,
      }),
    };
  }
}

// Register the function with Azure Functions runtime
app.http('chat-completion', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous', // Anonymous access for Azure SWA compatibility
  handler: chatCompletionHandler,
  route: 'chat-completion', // Explicitly specify route for Azure Static Web Apps
});
