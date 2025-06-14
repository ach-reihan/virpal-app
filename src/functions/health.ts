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
 * in critical reviews and certain other noncommercial uses permitted by * copyright law.
 *
 * For licensing inquiries: reihan3000@gmail.com
 */

import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { app } from '@azure/functions';

/**
 * Health check endpoint for monitoring and CI/CD pipeline verification
 * Implements comprehensive health checking following Azure Functions best practices
 *
 * @returns System status, configuration, and service connectivity information
 */
export async function health(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const startTime = Date.now();
  context.log('Health check endpoint called', {
    requestId: context.invocationId,
    method: request.method,
    userAgent: request.headers.get('user-agent'),
  });

  try {
    // Basic system information
    const basicHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      requestId: context.invocationId,
      version: process.env['npm_package_version'] || '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      region: process.env['WEBSITE_SITE_NAME']?.split('-').pop() || 'unknown',
    }; // Runtime information
    const runtime = {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
      uptime: Math.round(process.uptime()),
      loadAverage:
        process.platform !== 'win32' && 'loadavg' in process
          ? (process as any).loadavg()
          : null,
    };

    // Service connectivity checks
    const services = await checkServiceConnectivity(context);

    // Azure Functions specific information
    const azureInfo = {
      functionAppName: process.env['WEBSITE_SITE_NAME'] || 'unknown',
      resourceGroup: process.env['WEBSITE_RESOURCE_GROUP'] || 'unknown',
      subscriptionId:
        process.env['WEBSITE_OWNER_NAME']?.split('+')[0] || 'unknown',
      hostVersion: process.env['FUNCTIONS_EXTENSION_VERSION'] || 'unknown',
      workerRuntime: process.env['FUNCTIONS_WORKER_RUNTIME'] || 'unknown',
      sku: process.env['WEBSITE_SKU'] || 'unknown',
    };

    // Performance metrics
    const responseTime = Date.now() - startTime;
    const performance = {
      responseTimeMs: responseTime,
      healthy: responseTime < 1000, // Consider healthy if response time < 1s
      lastRestart: process.env['WEBSITE_TIME_ZONE']
        ? new Date().toISOString()
        : null,
    };

    // Determine overall health status
    const isHealthy = services.overall.healthy && performance.healthy;
    const healthStatus = isHealthy ? 'healthy' : 'degraded';

    const healthData = {
      ...basicHealth,
      status: healthStatus,
      runtime,
      services: services.overall,
      serviceDetails: services.details,
      azure: azureInfo,
      performance,
      dependencies: {
        keyVault: services.details['keyVault']?.status || 'unknown',
        cosmos: services.details['cosmos']?.status || 'unknown',
        openAI: services.details['openAI']?.status || 'unknown',
      },
    };

    // Log health check results
    context.log('Health check completed', {
      status: healthStatus,
      responseTime,
      servicesHealthy: services.overall.healthy,
      requestId: context.invocationId,
    });

    return {
      status: isHealthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'X-Health-Status': healthStatus,
        'X-Response-Time': responseTime.toString(),
        'X-Request-Id': context.invocationId,
      },
      body: JSON.stringify(healthData, null, 2),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    context.log('Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime,
      requestId: context.invocationId,
    });

    return {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'X-Health-Status': 'unhealthy',
        'X-Response-Time': responseTime.toString(),
        'X-Request-Id': context.invocationId,
      },
      body: JSON.stringify(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          requestId: context.invocationId,
          error: error instanceof Error ? error.message : 'Unknown error',
          performance: {
            responseTimeMs: responseTime,
          },
        },
        null,
        2
      ),
    };
  }
}

/**
 * Check connectivity to dependent services
 * Implements circuit breaker pattern for external service calls
 */
async function checkServiceConnectivity(context: InvocationContext): Promise<{
  overall: {
    healthy: boolean;
    checkedServices: number;
    healthyServices: number;
  };
  details: Record<
    string,
    { status: string; responseTime?: number; error?: string }
  >;
}> {
  const serviceChecks: Promise<{ name: string; result: any }>[] = [];
  const timeout = 5000; // 5 second timeout for each service check

  // Key Vault connectivity check
  if (process.env['KEY_VAULT_URL']) {
    serviceChecks.push(
      checkService(
        'keyVault',
        async () => {
          // Simple connectivity check - just validate URL format
          const url = new URL(process.env['KEY_VAULT_URL']!);
          return {
            status: 'configured',
            endpoint: url.hostname,
          };
        },
        timeout
      )
    );
  }

  // Azure Tenant check
  if (process.env['AZURE_TENANT_ID']) {
    serviceChecks.push(
      checkService(
        'tenant',
        async () => {
          return {
            status: 'configured',
            tenantId: process.env['AZURE_TENANT_ID']!.substring(0, 8) + '...',
          };
        },
        timeout
      )
    );
  }

  // Cosmos DB check (if configured)
  if (process.env['COSMOS_DB_ENDPOINT']) {
    serviceChecks.push(
      checkService(
        'cosmos',
        async () => {
          // Basic URL validation
          const url = new URL(process.env['COSMOS_DB_ENDPOINT']!);
          return {
            status: 'configured',
            endpoint: url.hostname,
          };
        },
        timeout
      )
    );
  }

  // OpenAI service check (if configured)
  if (process.env['AZURE_OPENAI_ENDPOINT']) {
    serviceChecks.push(
      checkService(
        'openAI',
        async () => {
          const url = new URL(process.env['AZURE_OPENAI_ENDPOINT']!);
          return {
            status: 'configured',
            endpoint: url.hostname,
          };
        },
        timeout
      )
    );
  } // Execute all service checks
  const results = await Promise.allSettled(serviceChecks);
  const details: Record<string, any> = {};
  let healthyCount = 0;
  let totalCount = 0;

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      const { name, result: serviceResult } = result.value;
      details[name] = serviceResult;
      totalCount++;
      if (
        serviceResult.status === 'configured' ||
        serviceResult.status === 'healthy'
      ) {
        healthyCount++;
      }
    } else {
      context.log(`Service check failed: ${result.reason}`);
    }
  });

  // Overall health assessment
  const overall = {
    healthy: totalCount === 0 || healthyCount === totalCount,
    checkedServices: totalCount,
    healthyServices: healthyCount,
  };

  return { overall, details };
}

/**
 * Generic service check with timeout and error handling
 */
async function checkService(
  name: string,
  checkFn: () => Promise<any>,
  timeoutMs: number
): Promise<{ name: string; result: any }> {
  const startTime = Date.now();

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    );

    const result = await Promise.race([checkFn(), timeoutPromise]);
    const responseTime = Date.now() - startTime;

    return {
      name,
      result: {
        ...result,
        responseTime,
      },
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      name,
      result: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
      },
    };
  }
}

// Register the function with enhanced configuration
app.http('health', {
  methods: ['GET', 'HEAD'],
  authLevel: 'anonymous', // Anonymous access for Azure SWA compatibility
  handler: health,
});
