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
import { keyVaultService } from '../services/azureKeyVaultService.js';
import { createJWTService } from './jwtValidationService.js';

// Performance optimization: Cache configuration to avoid repeated Key Vault calls
let configCache: {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
  timestamp: number;
} | null = null;

const CONFIG_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// JWT validation service instance
let jwtService: ReturnType<typeof createJWTService> | null = null;

// Initialize JWT service dengan lazy loading
function getJWTService() {
  if (!jwtService) {
    jwtService = createJWTService();
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

  // Security: Prevent overly long inputs
  if (requestData.userInput.length > 4000) {
    return {
      isValid: false,
      error: 'userInput exceeds maximum length of 4000 characters',
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
    (requestData.temperature < 0 || requestData.temperature > 2)
  ) {
    return { isValid: false, error: 'temperature must be between 0 and 2' };
  }

  // Validate token limits
  if (
    requestData.maxTokens !== undefined &&
    (requestData.maxTokens < 1 || requestData.maxTokens > 4000)
  ) {
    return { isValid: false, error: 'maxTokens must be between 1 and 4000' };
  }

  return { isValid: true };
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
    }

    // Validate JWT token
    const jwtValidationService = getJWTService();
    const validationResult = await jwtValidationService.validateToken(
      token,
      context
    );

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
    // Defensive programming: Check service availability
    if (!keyVaultService) {
      context.error('Key Vault service not available');
      return null;
    }

    // Parallel execution for better performance
    const [endpoint, deploymentName, apiVersion, apiKey] = await Promise.all([
      keyVaultService.getSecret('azure-openai-endpoint'),
      keyVaultService.getSecret('azure-openai-deployment-name'),
      keyVaultService.getSecret('azure-openai-api-version'),
      keyVaultService.getSecret('azure-openai-key'),
    ]);

    // Validate all required configuration is present
    if (!endpoint || !apiKey || !deploymentName || !apiVersion) {
      context.error('Missing required configuration values');
      return null;
    }

    // Update cache with new configuration
    configCache = {
      endpoint,
      apiKey,
      deploymentName,
      apiVersion,
      timestamp: now,
    };

    return {
      endpoint,
      apiKey,
      deploymentName,
      apiVersion,
    };
  } catch (error) {
    context.error(
      'Failed to retrieve configuration from Key Vault:',
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

  // Check if origin is allowed
  let allowOrigin = 'http://localhost:5173'; // default fallback
  if (origin) {
    if (allowedOrigins.includes(origin)) {
      allowOrigin = origin;
    } else if (origin.includes('azurestaticapps.net')) {
      // Allow any azurestaticapps.net subdomain for staging
      allowOrigin = origin;
    }
  }

  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Accept, Authorization, X-Guest-Mode',
    'Access-Control-Max-Age': '86400', // 24 hours cache for preflight
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
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

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: getCorsHeaders(origin),
      body: '',
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
  } // Check if this is a guest mode request
  const isGuestMode = request.headers.get('X-Guest-Mode') === 'true';
  let userInfo: any = null;

  if (isGuestMode) {
    userInfo = {
      userId: 'guest',
      email: null,
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

    userInfo = authResult.user;
  }

  try {
    // Parse and validate request body with error handling
    let requestData: ChatCompletionRequest;
    try {
      requestData = (await request.json()) as ChatCompletionRequest;
    } catch (parseError) {
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
});
