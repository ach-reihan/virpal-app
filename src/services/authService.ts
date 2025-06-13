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
 * Azure Entra External ID Authentication Service
 *
 * Service untuk mengelola authentication menggunakan MSAL dengan Azure Entra External ID
 *
 * Features:
 * - Login/Logout dengan popup atau redirect
 * - Silent token acquisition dengan automatic refresh
 * - Token validation dan error handling
 * - User profile management
 * - Token caching dan optimization
 *
 * Best Practices Applied:
 * - Comprehensive error handling
 * - Token refresh automation
 * - Security validation
 * - Performance optimization
 * - Type safety
 */

import {
  AuthError,
  BrowserAuthError,
  InteractionRequiredAuthError,
  PublicClientApplication,
} from '@azure/msal-browser';

import type {
  AccountInfo,
  AuthenticationResult,
  EndSessionRequest,
  RedirectRequest,
  SilentRequest,
} from '@azure/msal-browser';

import {
  apiScopes,
  loginRequest,
  logoutRequest,
  msalConfig,
  silentRequest,
  validateMsalConfig,
} from '../config/msalConfig';

import { logger } from '../utils/logger';

/**
 * User Profile Interface
 */
export interface UserProfile {
  id: string;
  displayName?: string;
  email?: string;
  tenantId?: string;
  username?: string;
}

/**
 * Authentication State Interface
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Token Information Interface
 */
export interface TokenInfo {
  accessToken: string;
  expiresOn: Date;
  scopes: string[];
  account: AccountInfo;
}

/**
 * Authentication Result with additional metadata
 */
export interface ExtendedAuthResult extends AuthenticationResult {
  tokenType: 'popup' | 'silent' | 'redirect';
  acquisitionTime: Date;
}

class AuthenticationService {
  private msalInstance: PublicClientApplication | null;
  private currentAccount: AccountInfo | null = null;
  private tokenCache = new Map<string, { token: string; expiry: number }>();
  private lastAuthState: boolean | null = null; // Track last authentication state to reduce logging

  // Performance metrics
  private metrics = {
    loginAttempts: 0,
    successfulLogins: 0,
    tokenRefreshCount: 0,
    silentTokenSuccess: 0,
    silentTokenFailures: 0,
  };
  private isInitialized = false;
  private initializationPromise: Promise<void>;
  private redirectHandled = false; // Flag to ensure handleRedirectResponse is called only once

  constructor() {
    // Validasi konfigurasi sebelum inisialisasi
    if (!validateMsalConfig()) {
      logger.warn(
        'MSAL configuration not valid - authentication will be disabled'
      );
      this.msalInstance = null;
      this.initializationPromise = Promise.resolve();
      return;
    }

    // Inisialisasi MSAL
    this.msalInstance = new PublicClientApplication(msalConfig); // Inisialisasi konfigurasi tanpa blocking
    this.initializationPromise = this.initializeMsal().catch(() => {
      logger.error('Failed to initialize MSAL instance');
      // Don't throw here - let the app continue loading
      return Promise.resolve();
    });
  }
  private async initializeMsal(): Promise<void> {
    // Prevent multiple initialization attempts
    if (this.isInitialized) {
      return;
    }
    try {
      // Check if msalInstance is available
      if (!this.msalInstance) {
        throw new Error('MSAL instance not available');
      }

      // Initialize MSAL first
      await this.msalInstance.initialize();

      // Set initialization status AFTER successful MSAL init
      this.isInitialized = true;

      // Initialize account after successful MSAL init
      await this.initializeAccount();
    } catch (err) {
      this.isInitialized = false;
      logger.error('MSAL initialization failed:', err);
      throw err;
    }
  }
  /**
   * Inisialisasi akun yang sudah login sebelumnya
   */
  private async initializeAccount(): Promise<void> {
    try {
      // msalInstance sudah diinisialisasi di constructor
      const msalInstance = this.getMsalInstanceSafe();
      const accounts = msalInstance.getAllAccounts();

      if (accounts.length > 0) {
        // Pastikan account[0] tidak undefined sebelum menggunakannya
        const firstAccount = accounts[0];
        if (firstAccount) {
          this.currentAccount = firstAccount;
          msalInstance.setActiveAccount(firstAccount);
          // Skip token validation during initialization to avoid CORS errors
          // Token validation will happen when user explicitly requests a token
        }
      }
    } catch (err) {
      logger.error('Failed to initialize account:', err);
      this.clearAuthState();
    }
  }
  /**
   * Login dengan popup
   */
  async loginWithPopup(): Promise<ExtendedAuthResult> {
    try {
      // Tunggu inisialisasi selesai
      if (!this.isInitialized) {
        await this.initializationPromise;
      }
      this.metrics.loginAttempts++;

      logger.debug('Starting authentication popup');

      // Use the base login request without modifying prompt
      // The prompt is already configured in the loginRequest
      const msalInstance = this.getMsalInstanceSafe();
      const response = await msalInstance.loginPopup(loginRequest);

      logger.debug('Authentication popup completed successfully');

      if (response.account) {
        this.currentAccount = response.account;
        msalInstance.setActiveAccount(response.account);
        this.updateTokenCache(response);
        this.metrics.successfulLogins++;

        logger.info('User authentication successful');

        return {
          ...response,
          tokenType: 'popup',
          acquisitionTime: new Date(),
        };
      }

      throw new Error('Login failed: No account information received');
    } catch (error) {
      // Special handling for popup window errors
      if (error instanceof Error) {
        // Don't log "user_cancelled" errors as they are often false positives
        if (
          error.message.includes('user_cancelled') ||
          error.message.includes('PopupHandler.monitorPopupForHash')
        ) {
          logger.debug(
            'Popup interaction detected, checking authentication state'
          );

          // Give MSAL time to process any pending authentication
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Check if authentication actually succeeded despite the popup error
          const msalInstance = this.getMsalInstanceSafe();
          const accounts = msalInstance.getAllAccounts();

          if (accounts.length > 0 && accounts[0]) {
            this.currentAccount = accounts[0];
            msalInstance.setActiveAccount(accounts[0]);
            this.metrics.successfulLogins++;

            logger.info(
              'Authentication recovered successfully after popup interaction'
            );
            // Create a success response
            return {
              accessToken: '', // Will be fetched separately
              account: accounts[0],
              authority: msalConfig.auth.authority || '',
              uniqueId: accounts[0].homeAccountId,
              tenantId: accounts[0].tenantId || '',
              scopes: [],
              idToken: '',
              idTokenClaims: {},
              fromCache: false,
              expiresOn: new Date(Date.now() + 3600000), // 1 hour from now
              correlationId: '',
              extExpiresOn: new Date(Date.now() + 7200000), // 2 hours from now
              familyId: '',
              tokenType: 'popup',
              acquisitionTime: new Date(),
            } as ExtendedAuthResult;
          }
        }

        // Only log actual errors
        if (!error.message.includes('user_cancelled')) {
          this.handleAuthError(error);
        }
      }

      throw error;
    }
  }
  /**
   * Login dengan redirect
   */
  async loginWithRedirect(): Promise<void> {
    try {
      // Tunggu inisialisasi selesai
      if (!this.isInitialized) {
        await this.initializationPromise;
      }

      this.metrics.loginAttempts++;

      const redirectRequest: RedirectRequest = {
        ...loginRequest,
        redirectUri: window.location.origin,
      };

      const msalInstance = this.getMsalInstanceSafe();
      await msalInstance.loginRedirect(redirectRequest);
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }
  /**
   * Handle redirect result setelah login
   */ async handleRedirectResponse(): Promise<AuthenticationResult | null> {
    // Only handle redirect once per app session
    if (this.redirectHandled) {
      return null;
    }

    try {
      // Check jika MSAL sudah initialized, jika belum tunggu dengan timeout
      if (!this.isInitialized) {
        try {
          await Promise.race([
            this.initializationPromise,
            // Timeout after 2 seconds untuk avoid infinite loading
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('MSAL initialization timeout')),
                2000
              )
            ),
          ]);
        } catch (err) {
          logger.warn(
            'MSAL initialization timeout, skipping redirect handling:',
            err
          );
          // Mark as handled to prevent retry loops
          this.redirectHandled = true;
          return null;
        }
      }

      // Mark as handled before processing to prevent multiple calls
      this.redirectHandled = true;
      // Handle redirect dengan timeout
      const msalInstance = this.getMsalInstanceSafe();
      const response = await Promise.race([
        msalInstance.handleRedirectPromise(),
        // Timeout untuk handleRedirectPromise
        new Promise<null>((resolve) =>
          setTimeout(() => {
            resolve(null);
          }, 5000)
        ),
      ]);

      if (response && response.account) {
        this.currentAccount = response.account;
        msalInstance.setActiveAccount(response.account);
        this.updateTokenCache(response);
        this.metrics.successfulLogins++;
      }
      return response;
    } catch (error) {
      logger.error('Redirect response handling failed:', error);
      // Don't throw error to prevent infinite loading - just log and return null
      this.handleAuthError(error);
      return null;
    }
  }

  /**
   * Mendapatkan access token (dengan automatic refresh)
   */ async getAccessToken(forceRefresh: boolean = false): Promise<string> {
    if (!this.currentAccount) {
      logger.error('No active account found for token acquisition');
      throw new Error('No active account. Please login first.');
    }
    logger.debug('Attempting to get access token', {
      forceRefresh,
      accountId: '[ACCOUNT_ID]',
      username: '[EMAIL]',
    });

    // Check cache terlebih dahulu (jika tidak force refresh)
    if (!forceRefresh) {
      const cachedToken = this.getCachedToken();
      if (cachedToken) {
        logger.debug('Using cached access token');
        return cachedToken;
      }
    }
    try {
      const silentTokenRequest: SilentRequest = {
        ...silentRequest,
        account: this.currentAccount,
        forceRefresh,
      };
      logger.debug('Attempting silent token acquisition');
      const msalInstance = this.getMsalInstanceSafe();
      const response = await msalInstance.acquireTokenSilent(
        silentTokenRequest
      );

      if (response.accessToken) {
        this.updateTokenCache(response);
        this.metrics.silentTokenSuccess++;
        this.metrics.tokenRefreshCount++;

        logger.debug('Successfully acquired access token silently');
        return response.accessToken;
      }

      logger.error('Silent token acquisition returned no access token');
      throw new Error('Failed to acquire access token');
    } catch (error) {
      this.metrics.silentTokenFailures++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const errorCode =
        error && typeof error === 'object' && 'errorCode' in error
          ? (error as { errorCode: string }).errorCode
          : undefined;
      const errorName = error instanceof Error ? error.name : 'Unknown';

      logger.error('Silent token acquisition failed', {
        error: errorMsg,
        errorCode,
        errorName,
      });

      if (error instanceof InteractionRequiredAuthError) {
        // Coba dengan popup untuk mendapatkan token baru
        try {
          logger.debug(
            'Attempting popup token acquisition due to interaction required'
          );
          const msalInstance = this.getMsalInstanceSafe();
          const popupResponse = await msalInstance.acquireTokenPopup({
            ...loginRequest,
            account: this.currentAccount,
          });

          this.updateTokenCache(popupResponse);
          logger.debug('Successfully acquired access token via popup');
          return popupResponse.accessToken;
        } catch (popupError) {
          logger.error('Popup token acquisition failed', popupError);
          throw new Error('Failed to acquire token. Please login again.');
        }
      }

      throw error;
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      if (!this.currentAccount) {
        return;
      }

      const logoutRequestWithAccount: EndSessionRequest = {
        ...logoutRequest,
        account: this.currentAccount,
      }; // Clear local state
      this.clearAuthState(); // Perform logout
      const msalInstance = this.getMsalInstanceSafe();
      await msalInstance.logoutPopup(logoutRequestWithAccount);
    } catch (error) {
      // Clear local state even if logout fails
      this.clearAuthState();
      throw error;
    }
  }
  /**
   * Get current user profile
   *
   * User flow identity providers: email with password
   * User attributes: display name dan email address
   */ getUserProfile(): UserProfile | null {
    if (!this.currentAccount) {
      logger.debug('No current account available for profile retrieval');
      return null;
    }

    // Clean user ID for Cosmos DB compatibility
    // Use email as ID since it's unique and Cosmos DB friendly
    const cleanUserId =
      this.currentAccount.username || this.currentAccount.homeAccountId;

    // Sesuaikan dengan user attributes yang digunakan dalam Entra External ID user flow
    const profile: UserProfile = {
      id: cleanUserId, // Use email instead of homeAccountId for better Cosmos DB compatibility
      email: this.currentAccount.username,
      username: this.currentAccount.username,
    };

    // Tambahkan atribut opsional jika tersedia
    if (this.currentAccount.name) {
      profile.displayName = this.currentAccount.name;
    }

    if (this.currentAccount.tenantId) {
      profile.tenantId = this.currentAccount.tenantId;
    }

    // Only log once per session to avoid spam
    logger.once('debug', 'User profile retrieved successfully');

    return profile;
  }
  /**
   * Check apakah user sudah authenticated
   */
  isAuthenticated(): boolean {
    // First check if we have current account set
    if (!this.currentAccount) {
      // If no current account, check MSAL accounts and set active account
      try {
        const msalInstance = this.getMsalInstanceSafe();
        const msalAccounts = msalInstance.getAllAccounts();
        if (msalAccounts.length > 0 && msalAccounts[0]) {
          this.currentAccount = msalAccounts[0];
          msalInstance.setActiveAccount(msalAccounts[0]);
          logger.debug('Active account set from available MSAL accounts');
        }
      } catch (error) {
        logger.debug('Failed to get MSAL accounts:', error);
        return false;
      }
    }

    const hasCurrentAccount = !!this.currentAccount;
    let hasMsalAccounts = false;

    try {
      const msalInstance = this.getMsalInstanceSafe();
      const msalAccounts = msalInstance.getAllAccounts();
      hasMsalAccounts = msalAccounts.length > 0;
    } catch (error) {
      logger.debug('Failed to check MSAL accounts:', error);
    }

    const isAuthenticated = hasCurrentAccount && hasMsalAccounts;

    // Only log authentication status changes to reduce noise
    if (this.lastAuthState !== isAuthenticated) {
      logger.debug(
        `Authentication status changed: ${
          isAuthenticated ? 'authenticated' : 'not authenticated'
        }`
      );
      this.lastAuthState = isAuthenticated;
    }

    return isAuthenticated;
  }

  /**
   * Safe authentication check that doesn't call MSAL APIs before initialization
   * This method should be used by services to check auth status without causing MSAL errors
   */
  isSafelyAuthenticated(): boolean {
    // If MSAL is not initialized yet, always return false
    if (!this.isInitialized) {
      logger.debug(
        'MSAL not initialized, returning false for authentication check'
      );
      return false;
    }

    // If MSAL is initialized, use the normal authentication check
    return this.isAuthenticated();
  }

  /**
   * Safely get access token only if MSAL is initialized and user is authenticated
   * Returns null if MSAL is not ready or user is not authenticated
   */
  async safeGetAccessToken(): Promise<string | null> {
    try {
      // Check if MSAL is initialized
      if (!this.isInitialized) {
        logger.debug('MSAL not initialized, cannot get access token');
        return null;
      }

      // Check if user is authenticated
      if (!this.isAuthenticated()) {
        logger.debug('User not authenticated, cannot get access token');
        return null;
      }

      // Get access token normally
      return await this.getAccessToken();
    } catch (error) {
      logger.warn('Failed to get access token safely:', error);
      return null;
    }
  }

  /**
   * Get current account
   */
  getCurrentAccount(): AccountInfo | null {
    return this.currentAccount;
  }

  /**
   * Get token information
   */
  async getTokenInfo(): Promise<TokenInfo | null> {
    if (!this.currentAccount) return null;
    try {
      const token = await this.getAccessToken();
      const msalInstance = this.getMsalInstanceSafe();
      const tokenResponse = await msalInstance.acquireTokenSilent({
        ...silentRequest,
        account: this.currentAccount,
      });

      return {
        accessToken: token,
        expiresOn: tokenResponse.expiresOn || new Date(),
        scopes: tokenResponse.scopes || [],
        account: this.currentAccount,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get authentication metrics
   */
  getMetrics() {
    const successRate =
      this.metrics.loginAttempts > 0
        ? (this.metrics.successfulLogins / this.metrics.loginAttempts) * 100
        : 0;

    const silentTokenSuccessRate =
      this.metrics.silentTokenSuccess + this.metrics.silentTokenFailures > 0
        ? (this.metrics.silentTokenSuccess /
            (this.metrics.silentTokenSuccess +
              this.metrics.silentTokenFailures)) *
          100
        : 0;

    return {
      ...this.metrics,
      successRate: Math.round(successRate * 100) / 100,
      silentTokenSuccessRate: Math.round(silentTokenSuccessRate * 100) / 100,
      cacheSize: this.tokenCache.size,
    };
  }
  /**
   * Clear authentication state
   */ private clearAuthState(): void {
    this.currentAccount = null;
    this.tokenCache.clear();
    this.redirectHandled = false; // Reset redirect handling for fresh session

    // Clear MSAL cache - setActiveAccount to null sebagai pengganti removeAccount
    try {
      const msalInstance = this.getMsalInstanceSafe();
      msalInstance.setActiveAccount(null);
    } catch (error) {
      logger.debug('Failed to clear MSAL active account:', error);
    }
  }

  /**
   * Update token cache
   */
  private updateTokenCache(response: AuthenticationResult): void {
    if (response.accessToken && response.expiresOn) {
      const cacheKey = `token_${response.scopes?.join('_') || 'default'}`;
      this.tokenCache.set(cacheKey, {
        token: response.accessToken,
        expiry: response.expiresOn.getTime(),
      });
    }
  }

  /**
   * Get cached token if still valid
   */
  private getCachedToken(): string | null {
    const cacheKey = `token_${apiScopes.join('_')}`;
    const cached = this.tokenCache.get(cacheKey);

    if (cached && cached.expiry > Date.now() + 60000) {
      // 1 minute buffer
      return cached.token;
    }

    // Remove expired token
    if (cached) {
      this.tokenCache.delete(cacheKey);
    }

    return null;
  }
  /**
   * Handle authentication errors
   */ private handleAuthError(error: unknown): void {
    // Only log critical authentication errors, avoid exposing sensitive details
    if (
      error instanceof BrowserAuthError &&
      error.errorCode === 'user_cancelled'
    ) {
      // User cancelled login - don't log this as an error
      return;
    }

    if (error instanceof BrowserAuthError) {
      logger.error(`Authentication browser error: ${error.errorCode}`);
    } else if (error instanceof AuthError) {
      logger.error(`Authentication error: ${error.errorCode}`);
    } else {
      logger.error('Unknown authentication error occurred');
    }
  }
  /**
   * Wait for MSAL to be fully initialized
   */
  async waitForInitialization(): Promise<void> {
    await this.initializationPromise;
  }

  /**
   * Check if MSAL is initialized
   */
  getInitializationStatus(): boolean {
    return this.isInitialized;
  }
  /**
   * Get the MSAL instance untuk penggunaan dengan MsalProvider
   */
  getMsalInstance(): PublicClientApplication {
    if (!this.msalInstance) {
      throw new Error('MSAL is not available - authentication is disabled');
    }
    return this.msalInstance;
  } // Get MSAL instance with null check
  private getMsalInstanceSafe(): PublicClientApplication {
    if (!this.msalInstance) {
      throw new Error('MSAL is not available - authentication is disabled');
    }
    return this.msalInstance;
  }
}

// Export singleton instance
export const authService = new AuthenticationService();
export default authService;
