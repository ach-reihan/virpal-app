/**
 * VirPal App - Hardcoded Credentials Configuration
 * Copyright (c) 2025 Achmad Reihan Alfaiz. All rights reserved.
 *
 * HACKATHON TEMPORARY CONFIGURATION
 * WARNING: For hackathon purposes only - contains hardcoded credentials
 * TODO: Move to Azure Key Vault before production deployment
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
 * HACKATHON CREDENTIALS - REPLACE WITH YOUR ACTUAL VALUES
 *
 * SECURITY WARNING: These are hardcoded for hackathon demo only!
 * In production, use Azure Key Vault or environment variables
 */
export const HACKATHON_CREDENTIALS: AzureCredentials = {
  openAI: {
    endpoint: 'https://reiha-matmpsh6-eastus2.cognitiveservices.azure.com/',
    apiKey:
      '61g44dK4hEeZIBrk5EHiNVfNzxkRXu3Uhj0dKNQXGQFUYcPcEKD4JQQJ99BEACHYHv6XJ3w3AAAAACOGl55q',
    deploymentName: 'gpt-4o-mini',
    apiVersion: '2024-10-24',
  },

  cosmosDB: {
    endpoint:
      'https://project-ai-assistant-virpal-cosmos-db-nosql.documents.azure.com:443/',
    key: 'hIxpJsstOtRnPX57GaCizYmtbvxkhoAjFSQAyOebQbIuKWR2fVDITiUmHiHgPZn6nsTVyvGDEaxrACDbE8E8GQ==',
    database: 'virpal-db',
    container: 'conversations',
  },

  speechService: {
    key: 'CvyiT40aYjGzlXOETsRL7lcjE5DbLUGTaTxzCaFzUQfSQfBNU11LJQQJ99BFACqBBLyXJ3w3AAAYACOGLSeZ',
    region: 'southeastasia',
    endpoint: 'https://southeastasia.tts.speech.microsoft.com/',
  },

  entraID: {
    clientId: '9ae4699e-0823-453e-b0f7-b614491a80a2',
    clientSecret: '0212c17c-ec83-4107-8eda-e4588c11eb79',
    tenantId: 'db0374b9-bb6f-4410-ad04-db7fe70f4d7b',
    authority:
      'https://db0374b9-bb6f-4410-ad04-db7fe70f4d7b.ciamlogin.com/db0374b9-bb6f-4410-ad04-db7fe70f4d7b/v2.0',
  },

  jwt: {
    secret:
      'b2086164e136965e909c05a132b2bd97619ee3b25f201e856afff18cacbf1e966794288205372b5274ff09bc37c5d85968b8a3c12dc79157ba7e2215aece0680',
    issuer:
      'https://db0374b9-bb6f-4410-ad04-db7fe70f4d7b.ciamlogin.com/db0374b9-bb6f-4410-ad04-db7fe70f4d7b/v2.0',
    audience: '9ae4699e-0823-453e-b0f7-b614491a80a2',
  },
};

/**
 * Helper function to get credentials based on environment
 * For hackathon: Always use hardcoded credentials
 * For production: Would use Azure Key Vault
 */
export const getCredentials = (): AzureCredentials => {
  const isHackathonMode = true; // Set to false after hackathon

  if (isHackathonMode) {
    console.warn('🚨 HACKATHON MODE: Using hardcoded credentials');
    return HACKATHON_CREDENTIALS;
  }

  // In production, this would load from Key Vault
  throw new Error('Production mode requires Azure Key Vault configuration');
};

/**
 * Validate that all required credentials are provided
 */
export const validateCredentials = (credentials: AzureCredentials): boolean => {
  const required = [
    credentials.openAI.apiKey,
    credentials.cosmosDB.key,
    credentials.speechService.key,
    credentials.entraID.clientSecret,
    credentials.jwt.secret,
  ];

  return required.every(
    (cred) => cred && cred !== 'YOUR_*_HERE' && cred.length > 10
  );
};

/**
 * Get environment-specific configuration
 */
export const getEnvironmentCredentials = () => {
  const credentials = getCredentials();

  if (!validateCredentials(credentials)) {
    console.error(
      '❌ Invalid credentials detected. Please update credentials.ts with your actual Azure service keys.'
    );
    throw new Error('Invalid credentials configuration');
  }

  return credentials;
};
