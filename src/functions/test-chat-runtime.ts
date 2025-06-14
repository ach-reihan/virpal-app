/**
 * VirPal App - AI Assistant with Azure Functions
 * Copyright (c) 2025 Achmad Reihan Alfaiz. All rights reserved.
 *
 * Azure Functions Status Check
 *
 * Simple test endpoint untuk memastikan chat-completion function terdaftar
 */

import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { app } from '@azure/functions';

/**
 * Test endpoint untuk memastikan chat completion runtime berjalan
 */
export async function testChatRuntime(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const timestamp = new Date().toISOString();
  const requestId = context.invocationId;

  context.info(`Test chat runtime request: ${request.method} ${requestId}`);

  // CORS headers for frontend compatibility
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Accept, Authorization, X-Guest-Mode',
    'Access-Control-Max-Age': '86400',
    'X-Request-ID': requestId,
  };

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: headers,
      body: '',
    };
  }

  try {
    // Test basic functionality
    const testInfo = {
      status: 'chat-completion-runtime-available',
      timestamp,
      requestId,
      endpoints: {
        chatCompletion: '/api/chat-completion',
        getSecret: '/api/get-secret',
        health: '/api/health',
        testRuntime: '/api/test-chat-runtime',
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        region: process.env['REGION_NAME'] || 'unknown',
        functionApp: process.env['WEBSITE_SITE_NAME'] || 'local',
      },
      message: 'Chat completion Azure Function runtime is working properly',
    };

    context.info('Test chat runtime successful', { requestId });

    return {
      status: 200,
      headers: headers,
      body: JSON.stringify(testInfo, null, 2),
    };
  } catch (error) {
    context.error('Test chat runtime failed:', error);

    return {
      status: 500,
      headers: headers,
      body: JSON.stringify({
        status: 'chat-completion-runtime-error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
        requestId,
      }),
    };
  }
}

// Register the test function
app.http('test-chat-runtime', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: testChatRuntime,
  route: 'test-chat-runtime',
});
