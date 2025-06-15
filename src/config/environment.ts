/**
 * VirPal App - Environment Configuration
 * Copyright (c) 2025 Achmad Reihan Alfaiz. All rights reserved.
 *
 * Centralized environment detection dan endpoint configuration
 * untuk mengatasi CORS issues di Azure Static Web Apps
 * Updated for hackathon with hardcoded credentials support
 */

import {
  getEnvironmentCredentials,
  type AzureCredentials,
} from './credentials';

export interface EnvironmentConfig {
  isProduction: boolean;
  isAzureStaticWebApp: boolean;
  isDevelopment: boolean;
  isHackathonMode: boolean;
  functionBaseUrl: string;
  apiEndpoint: string;
  credentials: AzureCredentials;
}

/**
 * Deteksi environment dan konfigurasi endpoint yang sesuai
 */
export const getEnvironmentConfig = (): EnvironmentConfig => {
  const isProduction = import.meta.env.PROD;
  const isDevelopment = import.meta.env.DEV;
  const isHackathonMode = true; // Set to false after hackathon

  // Deteksi Azure Static Web Apps
  let isAzureStaticWebApp = false;
  let hostname = '';

  if (typeof window !== 'undefined') {
    hostname = window.location.hostname;
    isAzureStaticWebApp = hostname.includes('azurestaticapps.net');
  }

  // Konfigurasi endpoint berdasarkan environment
  let functionBaseUrl: string;
  let apiEndpoint: string;

  if (isProduction && isAzureStaticWebApp) {
    // Azure Static Web Apps Production
    functionBaseUrl = ''; // Same origin
    apiEndpoint = '/api';
  } else if (isProduction) {
    // Production di platform lain
    functionBaseUrl = import.meta.env.VITE_AZURE_FUNCTION_ENDPOINT || '';
    apiEndpoint = import.meta.env.VITE_AZURE_FUNCTION_ENDPOINT || '/api';
  } else {
    // Development environment
    functionBaseUrl = 'http://localhost:7071';
    apiEndpoint = 'http://localhost:7071/api';
  }
  // Load credentials for hackathon mode
  const credentials = getEnvironmentCredentials();

  return {
    isProduction,
    isDevelopment,
    isAzureStaticWebApp,
    isHackathonMode,
    functionBaseUrl,
    apiEndpoint,
    credentials,
  };
};

/**
 * Get full API endpoint URL untuk specific function
 */
export const getApiEndpoint = (functionName: string): string => {
  const config = getEnvironmentConfig();

  // Enhanced debug logging
  console.debug('Environment configuration:', {
    isProduction: config.isProduction,
    isAzureStaticWebApp: config.isAzureStaticWebApp,
    isDevelopment: config.isDevelopment,
    functionBaseUrl: config.functionBaseUrl,
    apiEndpoint: config.apiEndpoint,
    hostname:
      typeof window !== 'undefined' ? window.location.hostname : 'server',
  });

  let endpoint: string;

  if (config.isAzureStaticWebApp && config.isProduction) {
    // Azure Static Web Apps - gunakan relative path
    endpoint = `/api/${functionName}`;
  } else if (config.isProduction) {
    // Production di platform lain - fallback ke relative jika tidak ada env var
    const baseUrl = config.functionBaseUrl || '';
    endpoint = baseUrl
      ? `${baseUrl}/api/${functionName}`
      : `/api/${functionName}`;
  } else {
    // Development - gunakan localhost
    endpoint = `${config.apiEndpoint}/${functionName}`;
  }

  console.debug(`API endpoint for ${functionName}:`, endpoint);
  return endpoint;
};

/**
 * Check apakah Azure Functions tersedia
 */
export const checkFunctionAvailability = async (): Promise<boolean> => {
  try {
    const healthEndpoint = getApiEndpoint('health');
    const response = await fetch(healthEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch {
    return false;
  }
};

// Export singleton config untuk digunakan aplikasi
export const ENV_CONFIG = getEnvironmentConfig();
