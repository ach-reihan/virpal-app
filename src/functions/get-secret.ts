// /**
//  * VirPal App - AI Assistant with Azure Functions
//  * Copyright (c) 2025 Achmad Reihan Alfaiz. All rights reserved.
//  *
//  * This file is part of VirPal App, a proprietary software application.
//  *
//  * PROPRIETARY AND CONFIDENTIAL
//  *
//  * This source code is the exclusive property of Achmad Reihan Alfaiz.
//  * No part of this software may be reproduced, distributed, or transmitted
//  * in any form or by any means, including photocopying, recording, or other
//  * electronic or mechanical methods, without the prior written permission
//  * of the copyright holder, except in the case of brief quotations embodied
//  * in critical reviews and certain other noncommercial uses permitted by
//  * copyright law.
//  *
//  * For licensing inquiries: reihan3000@gmail.com
//  */

// /**
//  * Azure Function: Get Secret from Key Vault
//  *
//  * Secure proxy function untuk mengakses Azure Key Vault dari frontend
//  * Menggunakan Managed Identity untuk autentikasi dengan best practices
//  *
//  * Best Practices Applied:
//  * - Input validation and sanitization
//  * - Rate limiting considerations
//  * - Security whitelisting
//  * - Proper error handling and logging
//  * - Configuration caching
//  * - Request ID tracking
//  */

// import type {
//   HttpRequest,
//   HttpResponseInit,
//   InvocationContext,
// } from '@azure/functions';
// import { app } from '@azure/functions';
// import { DefaultAzureCredential } from '@azure/identity';
// import { SecretClient } from '@azure/keyvault-secrets';
// // import { getCredentials } from '../config/credentials.js';
// import { createJWTService } from './jwtValidationService.js';

// // 🚨 HACKATHON HARDCODED CREDENTIALS - REAL VALUES FOR DEMO 🚨
// const HACKATHON_CREDENTIALS = {
//   speechService: {
//     key: 'CvyiT40aYjGzlXOETsRL7lcjE5DbLUGTaTxzCaFzUQfSQfBNU11LJQQJ99BFACqBBLyXJ3w3AAAYACOGLSeZ',
//     region: 'southeastasia',
//     endpoint: 'https://southeastasia.tts.speech.microsoft.com/',
//   },
//   openAI: {
//     endpoint: 'https://reiha-matmpsh6-eastus2.cognitiveservices.azure.com/',
//     apiKey:
//       '61g44dK4hEeZIBrk5EHiNVfNzxkRXu3Uhj0dKNQXGQFUYcPcEKD4JQQJ99BEACHYHv6XJ3w3AAAAACOGl55q',
//     deploymentName: 'gpt-4o-mini',
//     apiVersion: '2024-10-24',
//   },
//   cosmosDB: {
//     endpoint:
//       'https://project-ai-assistant-virpal-cosmos-db-nosql.documents.azure.com:443/',
//     key: 'hIxpJsstOtRnPX57GaCizYmtbvxkhoAjFSQAyOebQbIuKWR2fVDITiUmHiHgPZn6nsTVyvGDEaxrACDbE8E8GQ==',
//     database: 'virpal-db',
//     container: 'conversations',
//     connectionString:
//       'AccountEndpoint=https://project-ai-assistant-virpal-cosmos-db-nosql.documents.azure.com:443/;AccountKey=hIxpJsstOtRnPX57GaCizYmtbvxkhoAjFSQAyOebQbIuKWR2fVDITiUmHiHgPZn6nsTVyvGDEaxrACDbE8E8GQ==;',
//   },
//   entraID: {
//     clientId: '9ae4699e-0823-453e-b0f7-b614491a80a2',
//     clientSecret: '0212c17c-ec83-4107-8eda-e4588c11eb79',
//     tenantId: 'db0374b9-bb6f-4410-ad04-db7fe70f4d7b',
//     authority:
//       'https://db0374b9-bb6f-4410-ad04-db7fe70f4d7b.ciamlogin.com/db0374b9-bb6f-4410-ad04-db7fe70f4d7b/v2.0',
//   },
//   jwt: {
//     secret:
//       'b2086164e136965e909c05a132b2bd97619ee3b25f201e856afff18cacbf1e966794288205372b5274ff09bc37c5d85968b8a3c12dc79157ba7e2215aece0680',
//     issuer:
//       'https://db0374b9-bb6f-4410-ad04-db7fe70f4d7b.ciamlogin.com/db0374b9-bb6f-4410-ad04-db7fe70f4d7b/v2.0',
//     audience: '9ae4699e-0823-453e-b0f7-b614491a80a2',
//   },
// };

// interface KeyVaultResponse {
//   success: boolean;
//   data?: {
//     name: string;
//     value: string;
//   };
//   error?: string;
//   source?: string; // 'environment', 'keyvault', 'default', 'error', 'none'
//   requestId?: string;
//   timestamp?: string;
// }

// // Configuration with validation
// const KEY_VAULT_URL = process.env['KEY_VAULT_URL'] || '';

// // Security: Allowed secret names whitelist (in lowercase for consistency with sanitization)
// // Following principle of least privilege - only essential secrets are allowed
// const ALLOWED_SECRETS = [
//   // Azure Speech Service - Core TTS functionality
//   'azure-speech-service-key',
//   'azure-speech-service-region',
//   'azure-speech-service-endpoint',

//   // Azure OpenAI - Chat completion functionality
//   'openai-api-key',
//   'azure-openai-endpoint',
//   'azure-openai-api-key',

//   // Azure Cosmos DB - Cloud storage functionality
//   'azure-cosmos-db-endpoint-uri',
//   'azure-cosmos-db-key',
//   'azure-cosmos-db-connection-string',
//   'azure-cosmos-db-database-name',

//   // Legacy secret names for backward compatibility
//   'speech-key',
//   'speech-region',
// ] as const;

// // Performance: Cache clients and configuration
// let secretClient: SecretClient | null = null;
// let configCache: { isValid: boolean; timestamp: number } | null = null;

// // Environment variable to secret name mapping for Azure Static Web Apps Managed Functions
// const ENV_VAR_MAPPING: Record<string, string> = {
//   // Azure Speech Service
//   'azure-speech-service-key': 'AZURE_SPEECH_SERVICE_KEY',
//   'azure-speech-service-region': 'AZURE_SPEECH_SERVICE_REGION',
//   'azure-speech-service-endpoint': 'AZURE_SPEECH_SERVICE_ENDPOINT',

//   // Azure OpenAI
//   'azure-openai-endpoint': 'AZURE_OPENAI_ENDPOINT',
//   'azure-openai-key': 'AZURE_OPENAI_API_KEY',
//   'azure-openai-api-key': 'AZURE_OPENAI_API_KEY',
//   'openai-api-key': 'AZURE_OPENAI_API_KEY',
//   'azure-openai-deployment-name': 'AZURE_OPENAI_DEPLOYMENT_NAME',
//   'azure-openai-api-version': 'AZURE_OPENAI_API_VERSION',

//   // Azure Cosmos DB
//   'azure-cosmos-db-endpoint-uri': 'AZURE_COSMOS_DB_ENDPOINT',
//   'azure-cosmos-db-endpoint': 'AZURE_COSMOS_DB_ENDPOINT',
//   'azure-cosmos-db-key': 'AZURE_COSMOS_DB_KEY',
//   'azure-cosmos-db-connection-string': 'AZURE_COSMOS_DB_CONNECTION_STRING',
//   'azure-cosmos-db-database-name': 'AZURE_COSMOS_DB_DATABASE_NAME',

//   // Azure Entra External ID (CIAM)
//   'azure-tenant-name': 'AZURE_TENANT_NAME',
//   'azure-backend-client-id': 'AZURE_BACKEND_CLIENT_ID',
//   'azure-frontend-client-id': 'AZURE_FRONTEND_CLIENT_ID',
//   'azure-user-flow': 'AZURE_USER_FLOW',

//   // Legacy mappings
//   'speech-key': 'AZURE_SPEECH_SERVICE_KEY',
//   'speech-region': 'AZURE_SPEECH_SERVICE_REGION',
// } as const;

// // Security: Rate limiting configuration
// const RATE_LIMIT_MAX = 50; // requests per window (reduced for security)
// const RATE_LIMIT_WINDOW = 60000; // 1 minute window
// const CONFIG_CACHE_DURATION = 300000; // 5 minutes

// // Request tracking for rate limiting and audit
// const requestTracker = new Map<string, { count: number; lastReset: number }>();

// // Security: Request sanitization patterns
// const SANITIZATION_PATTERNS = {
//   // Remove special characters that could be used in injection attacks
//   secretName: /[^a-z0-9\-_.]/gi,
//   // Log sanitization for audit purposes - detect potentially unsafe characters
//   logUnsafeChars: /[<>"'&]/g,
// } as const;

// // JWT validation service instance
// let jwtService: ReturnType<typeof createJWTService> | null = null;

// // Initialize JWT service dengan lazy loading
// function getJWTService() {
//   if (!jwtService) {
//     try {
//       jwtService = createJWTService();
//     } catch (error) {
//       // Re-throw with more context for configuration errors
//       const errorMessage =
//         error instanceof Error ? error.message : 'Unknown error';
//       if (errorMessage.includes('Missing required environment variables')) {
//         throw new Error(
//           `JWT Authentication Configuration Error: ${errorMessage}\n` +
//             'This error typically occurs when Azure authentication environment variables are not set.\n' +
//             'Please check your .env file and ensure all required backend authentication variables are configured.'
//         );
//       }
//       throw error;
//     }
//   }
//   return jwtService;
// }

// interface UserInfo {
//   userId: string;
//   email?: string | undefined;
//   name?: string | undefined;
//   scopes?: string[] | undefined;
// }

// /**
//  * Validate authentication from Authorization header
//  * Returns user information if authentication is successful
//  */
// async function validateAuthentication(
//   request: HttpRequest,
//   context: InvocationContext
// ): Promise<{ isAuthenticated: boolean; user?: UserInfo; error?: string }> {
//   try {
//     // Extract Authorization header
//     const authHeader = request.headers.get('authorization');

//     // Debug: Log all request headers to see what we receive
//     context.log('=== REQUEST HEADERS DEBUG ===');
//     const headerEntries = Array.from(request.headers.entries());
//     headerEntries.forEach(([key, value]) => {
//       const logValue =
//         key.toLowerCase() === 'authorization'
//           ? value.substring(0, 20) + '...' // Only log first 20 chars of auth header
//           : value;
//       context.log(`${key}: ${logValue}`);
//     });
//     context.log('=== END HEADERS DEBUG ===');

//     if (!authHeader) {
//       context.warn('No Authorization header found in request');
//       return {
//         isAuthenticated: false,
//         error: 'Authorization header is required',
//       };
//     }

//     // Check Bearer token format
//     const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
//     if (!tokenMatch) {
//       return {
//         isAuthenticated: false,
//         error: 'Invalid authorization header format. Expected: Bearer <token>',
//       };
//     }
//     const token = tokenMatch[1];
//     if (!token || token.trim() === '') {
//       return {
//         isAuthenticated: false,
//         error: 'Token cannot be empty',
//       };
//     }

//     // Debug: Log token info (without exposing the actual token)
//     context.log('=== TOKEN DEBUG ===');
//     context.log(`Token length: ${token.length}`);
//     context.log(`Token starts with: ${token.substring(0, 20)}...`);
//     // Try to decode token payload for debugging (without validation)
//     try {
//       const tokenParts = token.split('.');
//       if (tokenParts.length === 3 && tokenParts[1]) {
//         const payload = JSON.parse(
//           Buffer.from(tokenParts[1], 'base64').toString()
//         );
//         context.log('Token payload (debug):');
//         context.log(`- aud: ${payload.aud}`);
//         context.log(`- iss: ${payload.iss}`);
//         context.log(`- sub: ${payload.sub}`);
//         context.log(`- scp: ${payload.scp}`);
//         context.log(
//           `- exp: ${payload.exp} (${new Date(
//             payload.exp * 1000
//           ).toISOString()})`
//         );
//       }
//     } catch (decodeError) {
//       context.warn('Could not decode token for debugging:', decodeError);
//     }
//     context.log('=== END TOKEN DEBUG ==='); // Validate JWT token
//     const jwtValidationService = getJWTService();
//     const validationResult = await jwtValidationService.validateToken(token);

//     if (!validationResult.isValid) {
//       return {
//         isAuthenticated: false,
//         error: validationResult.error || 'Invalid token',
//       };
//     }

//     // Extract user information
//     const userInfo = jwtValidationService.extractUserInfo(
//       validationResult.claims!
//     );

//     return {
//       isAuthenticated: true,
//       user: {
//         userId: userInfo.userId,
//         email: userInfo.email,
//         name: userInfo.name,
//         scopes: validationResult.scopes || [],
//       },
//     };
//   } catch (error) {
//     context.error(
//       'Authentication validation error:',
//       error instanceof Error ? error.message : 'Unknown error'
//     );
//     return {
//       isAuthenticated: false,
//       error: 'Authentication validation failed',
//     };
//   }
// }

// /**
//  * Get secret value with Hardcoded Credentials first (for hackathon), then Environment Variables, then Key Vault fallback
//  * Optimized for Azure Static Web Apps Managed Functions
//  */
// async function getSecretValue(
//   secretName: string,
//   context: InvocationContext
// ): Promise<{
//   success: boolean;
//   value?: string;
//   error?: string;
//   source?: string;
// }> {
//   try {
//     // Strategy 1: Use hardcoded credentials for hackathon (priority)
//     try {
//       const hardcodedValues: Record<string, string> = {
//         // Azure Speech Service
//         'azure-speech-service-key': HACKATHON_CREDENTIALS.speechService.key,
//         'azure-speech-service-region':
//           HACKATHON_CREDENTIALS.speechService.region,
//         'azure-speech-service-endpoint':
//           HACKATHON_CREDENTIALS.speechService.endpoint,

//         // Azure OpenAI
//         'azure-openai-endpoint': HACKATHON_CREDENTIALS.openAI.endpoint,
//         'azure-openai-api-key': HACKATHON_CREDENTIALS.openAI.apiKey,
//         'openai-api-key': HACKATHON_CREDENTIALS.openAI.apiKey,
//         'azure-openai-deployment-name':
//           HACKATHON_CREDENTIALS.openAI.deploymentName,
//         'azure-openai-api-version': HACKATHON_CREDENTIALS.openAI.apiVersion,

//         // Azure Cosmos DB
//         'azure-cosmos-db-endpoint-uri': HACKATHON_CREDENTIALS.cosmosDB.endpoint,
//         'azure-cosmos-db-endpoint': HACKATHON_CREDENTIALS.cosmosDB.endpoint,
//         'azure-cosmos-db-key': HACKATHON_CREDENTIALS.cosmosDB.key,
//         'azure-cosmos-db-database-name':
//           HACKATHON_CREDENTIALS.cosmosDB.database,
//         'azure-cosmos-db-connection-string':
//           HACKATHON_CREDENTIALS.cosmosDB.connectionString,

//         // Azure Entra ID (but keep as fallback, don't override MSAL)
//         'azure-backend-client-id': HACKATHON_CREDENTIALS.entraID.clientId,
//         'azure-frontend-client-id': HACKATHON_CREDENTIALS.entraID.clientId,

//         // JWT
//         'jwt-secret': HACKATHON_CREDENTIALS.jwt.secret,
//         'jwt-issuer': HACKATHON_CREDENTIALS.jwt.issuer,
//         'jwt-audience': HACKATHON_CREDENTIALS.jwt.audience,

//         // Legacy mappings
//         'speech-key': HACKATHON_CREDENTIALS.speechService.key,
//         'speech-region': HACKATHON_CREDENTIALS.speechService.region,
//       };

//       if (hardcodedValues[secretName]) {
//         context.info(
//           `🚨 HACKATHON: Secret '${secretName}' retrieved from hardcoded credentials`
//         );
//         return {
//           success: true,
//           value: hardcodedValues[secretName],
//           source: 'hackathon-hardcoded',
//         };
//       }
//     } catch (credError) {
//       context.warn(
//         `Failed to get hardcoded credentials: ${
//           credError instanceof Error ? credError.message : 'Unknown error'
//         }`
//       );
//     }

//     // Strategy 2: Check Environment Variables (for production/managed functions)
//     const envVarName =
//       ENV_VAR_MAPPING[secretName as keyof typeof ENV_VAR_MAPPING];
//     if (envVarName && typeof envVarName === 'string') {
//       const envValue = process.env[envVarName];
//       if (envValue && typeof envValue === 'string' && envValue.trim() !== '') {
//         context.info(
//           `Secret '${secretName}' retrieved from environment variable '${envVarName}'`
//         );
//         return {
//           success: true,
//           value: envValue.trim(),
//           source: 'environment',
//         };
//       } else {
//         context.info(
//           `Environment variable '${envVarName}' for secret '${secretName}' is empty or not set`
//         );
//       }
//     } else {
//       context.info(
//         `No environment variable mapping found for secret '${secretName}'`
//       );
//     }

//     // Strategy 3: Fallback to Key Vault (for BYOF or development)
//     if (secretClient && KEY_VAULT_URL) {
//       context.info(`Attempting Key Vault fallback for secret '${secretName}'`);

//       try {
//         const secret = await secretClient.getSecret(secretName);
//         if (secret.value) {
//           context.info(`Secret '${secretName}' retrieved from Key Vault`);
//           return {
//             success: true,
//             value: secret.value,
//             source: 'keyvault',
//           };
//         }
//       } catch (keyVaultError) {
//         const errorMessage =
//           keyVaultError instanceof Error
//             ? keyVaultError.message
//             : 'Unknown Key Vault error';
//         context.warn(
//           `Key Vault retrieval failed for '${secretName}': ${errorMessage}`
//         );

//         // Don't return error yet, try hardcoded defaults
//       }
//     } else {
//       context.info(
//         'Key Vault client not available (expected for Managed Functions)'
//       );
//     }

//     // Strategy 4: Hardcoded defaults for non-sensitive configuration
//     const defaultValues: Record<string, string> = {
//       'azure-speech-service-region': 'southeastasia',
//       'azure-cosmos-db-database-name': 'virpal-db',
//       'azure-openai-deployment-name': 'gpt-4o-mini',
//       'azure-openai-api-version': '2024-10-24',
//       'azure-tenant-name': 'virpalapp',
//       'azure-user-flow': 'virpal_signupsignin_v1',
//     };
//     if (Object.prototype.hasOwnProperty.call(defaultValues, secretName)) {
//       const defaultValue =
//         defaultValues[secretName as keyof typeof defaultValues];
//       if (defaultValue && typeof defaultValue === 'string') {
//         context.info(`Using default value for '${secretName}'`);
//         return {
//           success: true,
//           value: defaultValue,
//           source: 'default',
//         };
//       }
//     }

//     // All strategies failed
//     return {
//       success: false,
//       error: `Secret '${secretName}' not found in hardcoded credentials, environment variables, Key Vault, or defaults`,
//       source: 'none',
//     };
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : 'Unknown error';
//     context.error(`Error retrieving secret '${secretName}': ${errorMessage}`);
//     return {
//       success: false,
//       error: `Failed to retrieve secret: ${errorMessage}`,
//       source: 'error',
//     };
//   }
// }

// // Initialize Key Vault client with secure credential management
// function initializeKeyVaultClient(): SecretClient | null {
//   try {
//     if (!KEY_VAULT_URL) {
//       return null;
//     }

//     // Validate Key Vault URL format for security
//     if (
//       !KEY_VAULT_URL.startsWith('https://') ||
//       !KEY_VAULT_URL.includes('.vault.azure.net')
//     ) {
//       return null;
//     }

//     // Use DefaultAzureCredential following Azure best practices
//     // This automatically handles: Managed Identity, Azure CLI, Visual Studio, etc.
//     const credential = new DefaultAzureCredential();
//     return new SecretClient(KEY_VAULT_URL, credential);
//   } catch {
//     return null;
//   }
// }

// // Rate limiting helper with enhanced security
// function checkRateLimit(clientIp: string, context: InvocationContext): boolean {
//   // Basic IP validation
//   if (!clientIp || typeof clientIp !== 'string' || clientIp.length > 45) {
//     context.warn('Invalid IP address for rate limiting');
//     return false; // Deny invalid IPs
//   }

//   // Allow localhost in development
//   const isDevelopment = process.env['NODE_ENV'] === 'development';
//   if (
//     isDevelopment &&
//     (clientIp.includes('localhost') || clientIp.includes('127.0.0.1'))
//   ) {
//     return true;
//   }

//   const now = Date.now();
//   const tracker = requestTracker.get(clientIp);

//   if (!tracker || now - tracker.lastReset > RATE_LIMIT_WINDOW) {
//     requestTracker.set(clientIp, { count: 1, lastReset: now });
//     return true;
//   }

//   if (tracker.count >= RATE_LIMIT_MAX) {
//     context.warn(`Rate limit exceeded for IP: ${clientIp.substring(0, 8)}...`);
//     return false;
//   }

//   tracker.count++;
//   return true;
// }

// // Input validation and sanitization helper
// function validateAndSanitizeSecretName(
//   secretName: string,
//   context: InvocationContext
// ): { isValid: boolean; sanitized: string; errors: string[] } {
//   const errors: string[] = [];

//   // Basic validation
//   if (!secretName || typeof secretName !== 'string') {
//     errors.push('Secret name is required and must be a string');
//     return { isValid: false, sanitized: '', errors };
//   }

//   // Detect potentially unsafe characters for logging
//   const unsafeChars = secretName.match(SANITIZATION_PATTERNS.logUnsafeChars);
//   if (unsafeChars) {
//     context.warn(
//       `Potentially unsafe characters detected in secret name: ${unsafeChars.join(
//         ', '
//       )}`
//     );
//   }

//   // Sanitize the secret name
//   const sanitized = secretName
//     .toLowerCase()
//     .replace(SANITIZATION_PATTERNS.secretName, '');

//   // Check if sanitization changed the input (potential security issue)
//   if (sanitized !== secretName.toLowerCase()) {
//     context.warn(
//       `Secret name was sanitized: "${secretName}" -> "${sanitized}"`
//     );
//   }
//   // Validate against whitelist
//   const isAllowed = (ALLOWED_SECRETS as readonly string[]).includes(sanitized);
//   if (!isAllowed) {
//     errors.push(`Secret '${sanitized}' is not in the allowed secrets list`);
//     context.warn(`Attempted access to non-whitelisted secret: ${sanitized}`);
//   }

//   return {
//     isValid: errors.length === 0,
//     sanitized,
//     errors,
//   };
// }

// // Configuration validation - updated for Environment Variables first strategy
// function validateConfiguration(): { isValid: boolean; errors: string[] } {
//   const errors: string[] = [];
//   // For Managed Functions, environment variables are primary, Key Vault is optional
//   const envVarList = Object.values(ENV_VAR_MAPPING);
//   const hasEnvVars = envVarList.some((envVar: string) => {
//     if (typeof envVar === 'string') {
//       const value = process.env[envVar];
//       return value && typeof value === 'string' && value.trim() !== '';
//     }
//     return false;
//   });
//   const hasKeyVault = KEY_VAULT_URL && KEY_VAULT_URL.startsWith('https://');

//   if (!hasEnvVars && !hasKeyVault) {
//     errors.push(
//       'No configuration source available. Set environment variables or KEY_VAULT_URL'
//     );
//   }

//   if (KEY_VAULT_URL && !KEY_VAULT_URL.startsWith('https://')) {
//     errors.push('KEY_VAULT_URL must use HTTPS if provided');
//   }

//   // At least one secret source should be available
//   const availableSources = [];
//   if (hasEnvVars) availableSources.push('Environment Variables');
//   if (hasKeyVault) availableSources.push('Key Vault');

//   if (availableSources.length > 0) {
//     console.log(`Secret sources available: ${availableSources.join(', ')}`);
//   }

//   return { isValid: errors.length === 0, errors };
// }

// export async function getSecret(
//   request: HttpRequest,
//   context: InvocationContext
// ): Promise<HttpResponseInit> {
//   const requestId = context.invocationId;
//   const timestamp = new Date().toISOString();
//   const startTime = performance.now();

//   // Safety check for parameters
//   if (!request || !request.headers || !request.query) {
//     context.error('Invalid request object received:', typeof request);
//     return {
//       status: 500,
//       headers: {
//         'Content-Type': 'application/json',
//         'Access-Control-Allow-Origin': '*',
//         'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
//         'Access-Control-Allow-Headers': 'Content-Type, Authorization',
//       },
//       jsonBody: {
//         success: false,
//         error: 'Invalid request object',
//         timestamp,
//       },
//     };
//   }

//   // Minimal structured logging for production
//   context.info(`Key Vault secret request: ${request.method} ${requestId}`); // Security: Add comprehensive CORS headers with restricted origin support
//   const allowedOrigins = [
//     'http://localhost:5173',
//     'http://localhost:3000',
//     'http://127.0.0.1:5173',
//     'http://127.0.0.1:3000',
//     // Azure Static Web Apps domains
//     'https://ashy-coast-0aeebe10f.6.azurestaticapps.net',
//   ];

//   const origin = request.headers.get('origin');
//   let allowOrigin = 'https://ashy-coast-0aeebe10f.6.azurestaticapps.net'; // default fallback

//   if (origin) {
//     if (allowedOrigins.includes(origin)) {
//       allowOrigin = origin;
//     } else if (
//       origin.includes('azurestaticapps.net') &&
//       origin.startsWith('https://')
//     ) {
//       // Allow only HTTPS azurestaticapps.net subdomains for staging
//       allowOrigin = origin;
//     }
//   }

//   const headers = {
//     'Access-Control-Allow-Origin': allowOrigin,
//     'Access-Control-Allow-Methods': 'GET, OPTIONS',
//     'Access-Control-Allow-Headers':
//       'Content-Type, Accept, Authorization, X-Requested-With, X-Guest-Mode',
//     'Access-Control-Allow-Credentials': 'true',
//     'Access-Control-Max-Age': '3600',
//     'Content-Type': 'application/json',
//     'X-Request-ID': requestId,
//     'X-Content-Type-Options': 'nosniff',
//     'X-Frame-Options': 'DENY',
//     'X-XSS-Protection': '1; mode=block',
//     'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
//     'Referrer-Policy': 'strict-origin-when-cross-origin',
//   };

//   // Handle preflight OPTIONS request
//   if (request.method === 'OPTIONS') {
//     context.info(`CORS preflight handled for origin: ${origin}`);
//     return {
//       status: 200,
//       headers: headers,
//       body: '', // Empty body for OPTIONS
//     };
//   }
//   try {
//     // Skip authentication for development environment
//     const isDevelopment =
//       process.env['NODE_ENV'] === 'development' ||
//       process.env['AZURE_FUNCTIONS_ENVIRONMENT'] === 'Development' ||
//       request.headers.get('host')?.includes('localhost') ||
//       request.headers.get('host')?.includes('127.0.0.1') ||
//       process.env['FUNCTIONS_WORKER_RUNTIME'] === undefined;

//     if (!isDevelopment) {
//       // Production authentication validation
//       const authResult = await validateAuthentication(request, context);
//       if (!authResult.isAuthenticated) {
//         context.warn(`Authentication failed: ${authResult.error}`, {
//           requestId,
//         });
//         return {
//           status: 401,
//           headers: headers,
//           jsonBody: {
//             success: false,
//             error: authResult.error || 'Authentication required',
//             requestId,
//             timestamp,
//           } as KeyVaultResponse,
//         };
//       }
//     } // Rate limiting check
//     const clientIp =
//       request.headers.get('x-forwarded-for') ||
//       request.headers.get('x-real-ip') ||
//       'unknown';
//     if (!checkRateLimit(clientIp, context)) {
//       return {
//         status: 429,
//         headers: headers,
//         jsonBody: {
//           success: false,
//           error: 'Rate limit exceeded. Please try again later.',
//           requestId,
//           timestamp,
//         } as KeyVaultResponse,
//       };
//     }

//     // Configuration validation (cached)
//     const now = Date.now();
//     if (!configCache || now - configCache.timestamp > CONFIG_CACHE_DURATION) {
//       const configValidation = validateConfiguration();
//       configCache = { isValid: configValidation.isValid, timestamp: now };
//       if (!configValidation.isValid) {
//         context.error(
//           `Configuration error: ${configValidation.errors.join(', ')}`
//         );
//         return {
//           status: 500,
//           headers: headers,
//           jsonBody: {
//             success: false,
//             error: 'Service configuration error',
//             requestId,
//             timestamp,
//           } as KeyVaultResponse,
//         };
//       }
//     }

//     // Initialize client if needed (optional for hackathon - hardcoded credentials used first)
//     if (!secretClient) {
//       secretClient = initializeKeyVaultClient();
//       // For hackathon, Key Vault client is optional since we use hardcoded credentials
//       if (!secretClient) {
//         context.info(
//           'Key Vault client not available - using hardcoded credentials for hackathon'
//         );
//       }
//     }

//     // Input validation
//     const secretName = request.query.get('name');
//     if (!secretName) {
//       return {
//         status: 400,
//         headers: headers,
//         jsonBody: {
//           success: false,
//           error: 'Secret name is required',
//           requestId,
//           timestamp,
//         } as KeyVaultResponse,
//       };
//     }
//     // Enhanced validation and sanitization
//     const validation = validateAndSanitizeSecretName(secretName, context);
//     if (!validation.isValid) {
//       return {
//         status: 403,
//         headers: headers,
//         jsonBody: {
//           success: false,
//           error: validation.errors[0] || 'Access to this secret is not allowed',
//           requestId,
//           timestamp,
//         } as KeyVaultResponse,
//       };
//     }
//     const sanitizedSecretName = validation.sanitized; // Get secret using Environment Variables first, Key Vault fallback strategy
//     const secretResult = await getSecretValue(sanitizedSecretName, context);

//     if (!secretResult.success) {
//       return {
//         status: 404,
//         headers: headers,
//         jsonBody: {
//           success: false,
//           error:
//             secretResult.error || `Secret '${sanitizedSecretName}' not found`,
//           requestId,
//           timestamp,
//         } as KeyVaultResponse,
//       };
//     }

//     const endTime = performance.now();
//     const processingTime = Math.round(endTime - startTime);

//     // Log successful operations for monitoring
//     context.info(
//       `Secret retrieved successfully: ${sanitizedSecretName} (${processingTime}ms)`
//     );
//     return {
//       status: 200,
//       headers: headers,
//       jsonBody: {
//         success: true,
//         data: {
//           name: sanitizedSecretName,
//           value: secretResult.value,
//         },
//         source: secretResult.source, // Indicate whether from env vars, key vault, or defaults
//         requestId,
//         timestamp,
//       } as KeyVaultResponse,
//     };
//   } catch (error) {
//     const endTime = performance.now();
//     const processingTime = Math.round(endTime - startTime);

//     context.error(
//       `Secret retrieval failed (${processingTime}ms):`,
//       error instanceof Error ? error.message : 'Unknown error'
//     );

//     // Don't expose internal error details to client
//     let errorMessage = 'Internal server error occurred';
//     if (error instanceof Error) {
//       if (error.message.includes('not found')) {
//         errorMessage = 'Secret not found';
//       } else if (error.message.includes('access')) {
//         errorMessage = 'Access denied to Key Vault';
//       }
//     }

//     return {
//       status: 500,
//       headers: headers,
//       jsonBody: {
//         success: false,
//         error: errorMessage,
//         requestId,
//         timestamp,
//       } as KeyVaultResponse,
//     };
//   }
// }

// // Register the function
// app.http('get-secret', {
//   methods: ['GET', 'OPTIONS'],
//   authLevel: 'anonymous', // Anonymous access for Azure SWA compatibility
//   handler: getSecret,
// });
