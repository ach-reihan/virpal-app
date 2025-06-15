/**
 * VirPal App - Azure Functions Credential Helper
 * Copyright (c) 2025 Achmad Reihan Alfaiz. All rights reserved.
 *
 * HACKATHON TEMPORARY CONFIGURATION
 * Helper functions untuk menggunakan hardcoded credentials di Azure Functions
 */

import { HACKATHON_CREDENTIALS } from '../config/credentials';

/**
 * Get Azure OpenAI configuration for Functions
 */
export const getOpenAIConfig = () => {
  // For hackathon: use hardcoded credentials
  // For production: would use process.env from Key Vault
  const isHackathonMode =
    process.env['NODE_ENV'] !== 'production' ||
    process.env['HACKATHON_MODE'] === 'true';

  if (isHackathonMode) {
    return {
      endpoint: HACKATHON_CREDENTIALS.openAI.endpoint,
      apiKey: HACKATHON_CREDENTIALS.openAI.apiKey,
      deploymentName: HACKATHON_CREDENTIALS.openAI.deploymentName,
      apiVersion: HACKATHON_CREDENTIALS.openAI.apiVersion,
    };
  }

  // Production would use environment variables from Azure App Settings
  return {
    endpoint: process.env['AZURE_OPENAI_ENDPOINT'] || '',
    apiKey: process.env['AZURE_OPENAI_API_KEY'] || '',
    deploymentName:
      process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] || 'gpt-4o-mini',
    apiVersion: process.env['AZURE_OPENAI_API_VERSION'] || '2024-10-01-preview',
  };
};

/**
 * Get Cosmos DB configuration for Functions
 */
export const getCosmosDBConfig = () => {
  const isHackathonMode =
    process.env['NODE_ENV'] !== 'production' ||
    process.env['HACKATHON_MODE'] === 'true';

  if (isHackathonMode) {
    return {
      endpoint: HACKATHON_CREDENTIALS.cosmosDB.endpoint,
      key: HACKATHON_CREDENTIALS.cosmosDB.key,
      database: HACKATHON_CREDENTIALS.cosmosDB.database,
      container: HACKATHON_CREDENTIALS.cosmosDB.container,
    };
  }

  return {
    endpoint: process.env['COSMOS_DB_ENDPOINT'] || '',
    key: process.env['COSMOS_DB_KEY'] || '',
    database: process.env['COSMOS_DB_DATABASE'] || 'virpal-db',
    container: process.env['COSMOS_DB_CONTAINER'] || 'conversations',
  };
};

/**
 * Get Speech Service configuration for Functions
 */
export const getSpeechServiceConfig = () => {
  const isHackathonMode =
    process.env['NODE_ENV'] !== 'production' ||
    process.env['HACKATHON_MODE'] === 'true';

  if (isHackathonMode) {
    return {
      key: HACKATHON_CREDENTIALS.speechService.key,
      region: HACKATHON_CREDENTIALS.speechService.region,
      endpoint: HACKATHON_CREDENTIALS.speechService.endpoint,
    };
  }

  return {
    key: process.env['AZURE_SPEECH_SERVICE_KEY'] || '',
    region: process.env['AZURE_SPEECH_SERVICE_REGION'] || 'southeastasia',
    endpoint: process.env['AZURE_SPEECH_SERVICE_ENDPOINT'] || '',
  };
};

/**
 * Get JWT configuration for Functions
 */
export const getJWTConfig = () => {
  const isHackathonMode =
    process.env['NODE_ENV'] !== 'production' ||
    process.env['HACKATHON_MODE'] === 'true';

  if (isHackathonMode) {
    return {
      secret: HACKATHON_CREDENTIALS.jwt.secret,
      issuer: HACKATHON_CREDENTIALS.jwt.issuer,
      audience: HACKATHON_CREDENTIALS.jwt.audience,
    };
  }

  return {
    secret: process.env['JWT_SECRET'] || '',
    issuer: process.env['JWT_ISSUER'] || '',
    audience: process.env['JWT_AUDIENCE'] || '',
  };
};

/**
 * Get Entra ID configuration for Functions
 */
export const getEntraIDConfig = () => {
  const isHackathonMode =
    process.env['NODE_ENV'] !== 'production' ||
    process.env['HACKATHON_MODE'] === 'true';

  if (isHackathonMode) {
    return {
      clientId: HACKATHON_CREDENTIALS.entraID.clientId,
      clientSecret: HACKATHON_CREDENTIALS.entraID.clientSecret,
      tenantId: HACKATHON_CREDENTIALS.entraID.tenantId,
      authority: HACKATHON_CREDENTIALS.entraID.authority,
    };
  }

  return {
    clientId: process.env['AZURE_CLIENT_ID'] || '',
    clientSecret: process.env['AZURE_CLIENT_SECRET'] || '',
    tenantId: process.env['AZURE_TENANT_ID'] || '',
    authority: `https://${process.env['AZURE_TENANT_ID']}.ciamlogin.com/${process.env['AZURE_TENANT_ID']}/v2.0`,
  };
};

/**
 * Validate that all required credentials are available
 */
export const validateFunctionCredentials = () => {
  const openAI = getOpenAIConfig();
  const cosmosDB = getCosmosDBConfig();
  const speech = getSpeechServiceConfig();
  const jwt = getJWTConfig();

  const errors: string[] = [];

  if (!openAI.apiKey || openAI.apiKey.includes('YOUR_')) {
    errors.push('Azure OpenAI API Key is missing or invalid');
  }

  if (!cosmosDB.key || cosmosDB.key.includes('YOUR_')) {
    errors.push('Cosmos DB Key is missing or invalid');
  }

  if (!speech.key || speech.key.includes('YOUR_')) {
    errors.push('Speech Service Key is missing or invalid');
  }

  if (!jwt.secret || jwt.secret.includes('YOUR_')) {
    errors.push('JWT Secret is missing or invalid');
  }

  if (errors.length > 0) {
    console.error('❌ Credential validation failed:', errors);
    throw new Error(`Missing credentials: ${errors.join(', ')}`);
  }

  console.log('✅ All credentials validated successfully');
  return true;
};

/**
 * Get hardcoded secret by name for hackathon mode
 */
export const getHardcodedSecret = (secretName: string): string | null => {
  const secrets: Record<string, string> = {
    // Azure Speech Service
    'azure-speech-service-key': HACKATHON_CREDENTIALS.speechService.key,
    'azure-speech-service-region': HACKATHON_CREDENTIALS.speechService.region,
    'azure-speech-service-endpoint':
      HACKATHON_CREDENTIALS.speechService.endpoint,

    // Azure OpenAI
    'azure-openai-api-key': HACKATHON_CREDENTIALS.openAI.apiKey,
    'azure-openai-endpoint': HACKATHON_CREDENTIALS.openAI.endpoint,
    'azure-openai-deployment-name': HACKATHON_CREDENTIALS.openAI.deploymentName,
    'azure-openai-api-version': HACKATHON_CREDENTIALS.openAI.apiVersion,

    // Cosmos DB
    'cosmos-db-endpoint': HACKATHON_CREDENTIALS.cosmosDB.endpoint,
    'cosmos-db-key': HACKATHON_CREDENTIALS.cosmosDB.key,
    'cosmos-db-database': HACKATHON_CREDENTIALS.cosmosDB.database,
    'cosmos-db-container': HACKATHON_CREDENTIALS.cosmosDB.container,

    // JWT
    'jwt-secret': HACKATHON_CREDENTIALS.jwt.secret,
    'jwt-issuer': HACKATHON_CREDENTIALS.jwt.issuer,
    'jwt-audience': HACKATHON_CREDENTIALS.jwt.audience,

    // Entra ID
    'azure-client-id': HACKATHON_CREDENTIALS.entraID.clientId,
    'azure-client-secret': HACKATHON_CREDENTIALS.entraID.clientSecret,
    'azure-tenant-id': HACKATHON_CREDENTIALS.entraID.tenantId,
  };

  return secrets[secretName] || null;
};
