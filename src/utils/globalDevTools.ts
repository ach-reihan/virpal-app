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
 * Global Development Tools
 *
 * Ekspor utilitas ke global window untuk memudahkan debugging dan testing
 * Hanya tersedia dalam development mode atau ketika EXPOSE_DEV_TOOLS=true
 */

import { authService } from '../services/authService';
import { frontendKeyVaultService } from '../services/frontendKeyVaultService';

// Extend Window interface for TypeScript
declare global {
  interface Window {
    virpalDev?: VirpalDevTools;
  }
}

// Development utilities interface
interface VirpalDevTools {
  authService: typeof authService;
  keyVaultService: typeof frontendKeyVaultService;

  // Helper functions for easy testing
  getAccessToken: () => Promise<string | null>;
  testApiEndpoints: () => Promise<void>;
  loginAndGetToken: () => Promise<string | null>;
  copyTokenToClipboard: () => Promise<void>;
}

/**
 * Initialize development tools and expose to global window
 */
function initializeDevTools(): void {
  // Only expose in development or when explicitly enabled
  const isDev = import.meta.env.DEV;
  const forceExpose = import.meta.env['VITE_EXPOSE_DEV_TOOLS'] === 'true';

  if (!isDev && !forceExpose) {
    return;
  }

  const devTools: VirpalDevTools = {
    authService,
    keyVaultService: frontendKeyVaultService,

    // Helper: Get current access token
    async getAccessToken(): Promise<string | null> {
      try {
        await authService.waitForInitialization();
        const token = await authService.getAccessToken();
        console.log(
          '🔑 Access Token:',
          token ? 'Retrieved successfully' : 'No token available'
        );
        return token;
      } catch (error) {
        console.error('❌ Error getting access token:', error);
        return null;
      }
    },
    // Helper: Login and get token in one step
    async loginAndGetToken(): Promise<string | null> {
      try {
        console.log('🔐 Attempting to login...');
        await authService.waitForInitialization();

        // Check if already logged in
        const currentUser = authService.getUserProfile();
        if (!currentUser) {
          console.log('📝 No user logged in, initiating login...');
          await authService.loginWithPopup();
        }

        // Get token
        const token = await authService.getAccessToken();
        console.log(
          '✅ Login successful! Token:',
          token ? 'Retrieved' : 'Failed to get token'
        );
        return token;
      } catch (error) {
        console.error('❌ Login error:', error);
        return null;
      }
    },

    // Helper: Copy token to clipboard
    async copyTokenToClipboard(): Promise<void> {
      try {
        const token = await this.getAccessToken();
        if (token) {
          await navigator.clipboard.writeText(token);
          console.log('📋 Token copied to clipboard!');
        } else {
          console.log('❌ No token to copy');
        }
      } catch (error) {
        console.error('❌ Error copying token:', error);
      }
    },
    // Helper: Test API endpoints
    async testApiEndpoints(): Promise<void> {
      const baseUrl = window.location.origin;
      const endpoints = [
        { path: '/api/health', method: 'GET' },
        { path: '/api/get-secret', method: 'GET' },
        { path: '/api/chat-completion', method: 'POST' },
      ];

      console.log('🧪 Testing API endpoints...');

      for (const endpoint of endpoints) {
        try {
          const requestInit: RequestInit = {
            method: endpoint.method,
            headers: {
              'Content-Type': 'application/json',
            },
          };

          if (
            endpoint.method === 'POST' &&
            endpoint.path === '/api/chat-completion'
          ) {
            requestInit.body = JSON.stringify({
              messages: [{ role: 'user', content: 'Hello' }],
            });
          }

          const response = await fetch(
            `${baseUrl}${endpoint.path}`,
            requestInit
          );

          console.log(
            `${endpoint.path}: ${response.status} ${response.statusText}`
          );
        } catch (error) {
          console.error(`${endpoint.path}: Error -`, error);
        }
      }
    },
  };
  // Expose to global window
  window.virpalDev = devTools;

  console.log('🛠️ VirPal Development Tools Available!');
  console.log('Usage examples:');
  console.log(
    '  await window.virpalDev.getAccessToken()           // Get current token'
  );
  console.log(
    '  await window.virpalDev.loginAndGetToken()         // Login and get token'
  );
  console.log(
    '  await window.virpalDev.copyTokenToClipboard()     // Copy token to clipboard'
  );
  console.log(
    '  await window.virpalDev.testApiEndpoints()         // Test all API endpoints'
  );
  console.log(
    '  window.virpalDev.authService.getCurrentUser()     // Get current user info'
  );
}

// Auto-initialize when module is imported
initializeDevTools();

export default initializeDevTools;
