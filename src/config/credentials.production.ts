/**
 * VirPal App - Production Credentials Configuration
 * Copyright (c) 2025 Achmad Reihan Alfaiz. All rights reserved.
 *
 * SAFE FOR COMMIT - Uses environment variables from GitHub Actions
 */

export interface AzureCredentials {
  // Azure OpenAI Configuration
  openAI: {
    endpoint: string;
    apiKey: string;
    deploymentName: string;
    apiVersion: string;
  };

  // Azure Cosmos DB Configuration
  cosmosDB: {
    endpoint: string;
    key: string;
    database: string;
    container: string;
  };

  // Azure Speech Service Configuration
  speechService: {
    key: string;
    region: string;
    endpoint: string;
  };

  // Azure Entra ID / MSAL Configuration
  entraID: {
    clientId: string;
    clientSecret: string;
    tenantId: string;
    authority: string;
  };

  // JWT Configuration
  jwt: {
    secret: string;
    issuer: string;
    audience: string;
  };
}

/**
 * PRODUCTION CREDENTIALS - SAFE FOR COMMIT
 * Uses environment variables from Azure App Settings or GitHub Secrets
 */
export const PRODUCTION_CREDENTIALS: AzureCredentials = {
  openAI: {
    endpoint: 'https://reiha-matmpsh6-eastus2.cognitiveservices.azure.com/',
    apiKey: process.env['AZURE_OPENAI_API_KEY'] || '',
    deploymentName: 'gpt-4o-mini',
    apiVersion: '2024-10-24',
  },

  cosmosDB: {
    endpoint:
      'https://project-ai-assistant-virpal-cosmos-db-nosql.documents.azure.com:443/',
    key: process.env['COSMOS_DB_KEY'] || '',
    database: 'virpal-db',
    container: 'conversations',
  },

  speechService: {
    key: process.env['SPEECH_SERVICE_KEY'] || '',
    region: 'southeastasia',
    endpoint: 'https://southeastasia.tts.speech.microsoft.com/',
  },

  entraID: {
    clientId: '9ae4699e-0823-453e-b0f7-b614491a80a2',
    clientSecret: process.env['AZURE_CLIENT_SECRET'] || '',
    tenantId: 'db0374b9-bb6f-4410-ad04-db7fe70f4d7b',
    authority:
      'https://db0374b9-bb6f-4410-ad04-db7fe70f4d7b.ciamlogin.com/db0374b9-bb6f-4410-ad04-db7fe70f4d7b/v2.0',
  },

  jwt: {
    secret: process.env['JWT_SECRET'] || '',
    issuer:
      'https://db0374b9-bb6f-4410-ad04-db7fe70f4d7b.ciamlogin.com/db0374b9-bb6f-4410-ad04-db7fe70f4d7b/v2.0',
    audience: '9ae4699e-0823-453e-b0f7-b614491a80a2',
  },
};

/**
 * Development credentials (local only)
 */
const DEV_CREDENTIALS: AzureCredentials = {
  openAI: {
    endpoint: 'https://reiha-matmpsh6-eastus2.cognitiveservices.azure.com/',
    apiKey: 'YOUR_LOCAL_DEV_KEY_HERE', // Replace with actual for local dev
    deploymentName: 'gpt-4o-mini',
    apiVersion: '2024-10-24',
  },

  cosmosDB: {
    endpoint:
      'https://project-ai-assistant-virpal-cosmos-db-nosql.documents.azure.com:443/',
    key: 'YOUR_LOCAL_COSMOS_KEY_HERE', // Replace with actual for local dev
    database: 'virpal-db',
    container: 'conversations',
  },

  speechService: {
    key: 'YOUR_LOCAL_SPEECH_KEY_HERE', // Replace with actual for local dev
    region: 'southeastasia',
    endpoint: 'https://southeastasia.tts.speech.microsoft.com/',
  },

  entraID: {
    clientId: '9ae4699e-0823-453e-b0f7-b614491a80a2',
    clientSecret: 'YOUR_LOCAL_CLIENT_SECRET_HERE', // Replace with actual for local dev
    tenantId: 'db0374b9-bb6f-4410-ad04-db7fe70f4d7b',
    authority:
      'https://db0374b9-bb6f-4410-ad04-db7fe70f4d7b.ciamlogin.com/db0374b9-bb6f-4410-ad04-db7fe70f4d7b/v2.0',
  },

  jwt: {
    secret: 'YOUR_LOCAL_JWT_SECRET_HERE', // Replace with actual for local dev
    issuer:
      'https://db0374b9-bb6f-4410-ad04-db7fe70f4d7b.ciamlogin.com/db0374b9-bb6f-4410-ad04-db7fe70f4d7b/v2.0',
    audience: '9ae4699e-0823-453e-b0f7-b614491a80a2',
  },
};

/**
 * Get credentials based on environment
 */
export const getCredentials = (): AzureCredentials => {
  const isProduction =
    typeof process !== 'undefined' && process.env['NODE_ENV'] === 'production';

  if (isProduction) {
    console.log('🚀 Production mode: Using environment variables');
    return PRODUCTION_CREDENTIALS;
  }

  console.warn('🔧 Development mode: Using local credentials');
  // For local development, you can switch back to your hardcoded credentials
  return DEV_CREDENTIALS;
};

export const validateCredentials = (credentials: AzureCredentials): boolean => {
  const required = [
    credentials.openAI.apiKey,
    credentials.cosmosDB.key,
    credentials.speechService.key,
    credentials.jwt.secret,
  ];

  return required.every((cred) => cred && cred.length > 10);
};

export const getEnvironmentCredentials = () => {
  const credentials = getCredentials();

  if (!validateCredentials(credentials)) {
    throw new Error('Invalid credentials configuration');
  }

  return credentials;
};
