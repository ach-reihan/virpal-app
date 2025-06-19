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
 * useAuth Hook - React Hook untuk Azure Entra External ID Authentication
 *
 * Custom React hook yang menyediakan authentication state dan methods
 * untuk mengelola login, logout, dan token management
 *
 * Features:
 * - Authentication state management
 * - Automatic token refresh
 * - Loading states
 * - Error handling
 * - User profile management
 * - Performance metrics
 *
 * Best Practices Applied:
 * - React best practices untuk custom hooks
 * - Error boundary integration
 * - Memory leak prevention
 * - Performance optimization
 * - Type safety
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AuthState,
  ExtendedAuthResult,
  TokenInfo,
  UserProfile,
} from '../services/authService';
import { authService } from '../services/authService';
import { logger } from '../utils/logger';

/**
 * Get user-friendly error message from technical error
 */
const getErrorMessage = (errorMessage: string): string => {
  if (
    errorMessage.includes('user_cancelled') ||
    errorMessage.includes('PopupHandler.monitorPopupForHash')
  ) {
    return 'Kamu membatalkan login atau terjadi kesalahan saat login';
  }

  if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return 'Koneksi internet bermasalah. Silakan coba lagi';
  }

  if (errorMessage.includes('popup_window_error')) {
    return 'Pop-up login diblokir browser. Silakan izinkan pop-up dan coba lagi';
  }

  if (errorMessage.includes('consent_required')) {
    return 'Persetujuan diperlukan. Silakan login ulang';
  }

  if (errorMessage.includes('invalid_request')) {
    return 'Permintaan tidak valid. Silakan refresh halaman dan coba lagi';
  }

  // Fallback untuk error lainnya
  return 'Terjadi kesalahan saat login. Silakan coba lagi';
};

/**
 * Authentication Context Type
 */
export interface UseAuthReturn {
  // State
  isAuthenticated: boolean;
  user: UserProfile | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;

  // Methods
  login: () => Promise<ExtendedAuthResult>;
  loginWithRedirect: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: (forceRefresh?: boolean) => Promise<string>;
  clearError: () => void;
  refreshToken: () => Promise<string>;

  // Additional info
  tokenInfo: TokenInfo | null;
  metrics: any;
}

/**
 * Hook Options
 */
export interface UseAuthOptions {
  onAuthStateChange?: (
    isAuthenticated: boolean,
    user: UserProfile | null
  ) => void;
  autoLogin?: boolean;
  silentTokenRenewal?: boolean;
  tokenRefreshThreshold?: number; // milliseconds before expiry to refresh
}

/**
 * useAuth Custom Hook
 */
export function useAuth(options: UseAuthOptions = {}): UseAuthReturn {
  const {
    onAuthStateChange,
    autoLogin = false,
    silentTokenRenewal = true,
    tokenRefreshThreshold = 5 * 60 * 1000, // 5 minutes
  } = options;

  // State management
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    isLoading: true,
    error: null,
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const mountedRef = useRef(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to safely update state only if component is still mounted
  const safeSetAuthState = useCallback((newState: Partial<AuthState>) => {
    if (mountedRef.current) {
      setAuthState((prev) => {
        const updated = { ...prev, ...newState };
        // Authentication state updated
        return updated;
      });
    }
  }, []);

  // Helper to update auth state safely
  const updateAuthState = useCallback(
    (newState: Partial<AuthState>) => {
      safeSetAuthState(newState);
    },
    [safeSetAuthState]
  ); // Error handling function
  const handleError = useCallback(
    (error: Error | string) => {
      const errorMessage = error instanceof Error ? error.message : error;
      logger.error('Authentication error occurred');

      // Use user-friendly error message
      const friendlyMessage = getErrorMessage(errorMessage);

      safeSetAuthState({
        error: friendlyMessage,
        isLoading: false,
      });
    },
    [safeSetAuthState]
  );

  // Clear error function
  const clearError = useCallback(() => {
    safeSetAuthState({ error: null });
  }, [safeSetAuthState]);

  /**
   * Setup automatic token refresh
   */
  const setupTokenRefresh = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    if (!silentTokenRenewal || !tokenRefreshThreshold) return;

    refreshIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current || !authService.isAuthenticated()) {
        return;
      }

      try {
        const token = await authService.getAccessToken(false); // Silent refresh
        const info = await authService.getTokenInfo();

        if (mountedRef.current) {
          updateAuthState({ accessToken: token });
          setTokenInfo(info);
        }
      } catch (error) {
        // Tidak langsung logout, biarkan user mencoba manual
      }
    }, tokenRefreshThreshold);
  }, [silentTokenRenewal, tokenRefreshThreshold, updateAuthState]);

  /**
   * Initialize authentication state
   */
  const initializeAuth = useCallback(async () => {
    try {
      safeSetAuthState({ isLoading: true, error: null });

      // First, ensure MSAL is properly initialized
      try {
        await authService.waitForInitialization();
      } catch (initError) {
        safeSetAuthState({
          isLoading: false,
          error: 'Authentication service failed to initialize',
          isAuthenticated: false,
          user: null,
          accessToken: null,
        });
        return;
      }

      // Now handle redirect response with timeout
      try {
        const redirectResult = await Promise.race([
          authService.handleRedirectResponse(),
          // Timeout setelah 3 detik untuk avoid infinite loading
          new Promise<null>((resolve) =>
            setTimeout(() => {
              resolve(null);
            }, 3000)
          ),
        ]);

        if (redirectResult) {
          // Redirect handled successfully
        }
      } catch (redirectError) {
        // Continue initialization despite redirect error
      } // Check current authentication state
      let isAuthenticated = false;
      let user = null;
      try {
        isAuthenticated = authService.isAuthenticated();
        user = authService.getUserProfile();
      } catch (authCheckError) {
        logger.warn('Authentication state check failed during initialization');
        // Continue with default values
      }
      const accessToken: string | null = null;
      const tokenInfo: TokenInfo | null = null;
      // Skip token operations during initialization to prevent CORS errors
      // Tokens will be fetched when user explicitly logs in or requests them
      if (isAuthenticated && user) {
        logger.debug('User authenticated, tokens will be fetched on demand');
        // Don't fetch tokens during initialization to avoid CORS/404 errors
        // Tokens will be acquired when explicitly requested by user actions
      }

      safeSetAuthState({
        isAuthenticated,
        user,
        accessToken,
        isLoading: false,
        error: null,
      });

      setTokenInfo(tokenInfo);
      setIsInitialized(true);
      // Setup auto refresh jika authenticated dan enabled
      if (isAuthenticated && silentTokenRenewal && tokenRefreshThreshold) {
        setupTokenRefresh();
      }

      // Auto-login functionality if enabled and not authenticated      // Auto-login functionality if enabled and not authenticated
      if (autoLogin && !isAuthenticated) {
        // TODO: Implement auto-login logic here
        // This could include silent authentication attempts
      }
    } catch (error) {
      // Fallback: Initialize as unauthenticated but ready
      safeSetAuthState({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        isLoading: false,
        error: 'Authentication service unavailable',
      });
      setIsInitialized(true);
    }
  }, [
    safeSetAuthState,
    silentTokenRenewal,
    tokenRefreshThreshold,
    setupTokenRefresh,
  ]);
  /**
   * Login dengan popup
   */
  const login = useCallback(async (): Promise<ExtendedAuthResult> => {
    try {
      safeSetAuthState({ isLoading: true, error: null });
      const result = await authService.loginWithPopup();

      // Give MSAL more time to process the authentication and set accounts
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // Force re-check authentication state after login
      const isAuthenticated = authService.isAuthenticated();
      const user = authService.getUserProfile();

      // Try to get access token to validate authentication
      let accessToken = result.accessToken;
      let tokenInfo: TokenInfo | null = null;

      if (isAuthenticated) {
        try {
          if (!accessToken) {
            accessToken = await authService.getAccessToken();
          }
          tokenInfo = await authService.getTokenInfo();
        } catch (tokenError) {
          // Don't fail the login just because token fetch failed
        }
      }

      safeSetAuthState({
        isAuthenticated,
        user,
        accessToken,
        isLoading: false,
        error: null,
      });

      setTokenInfo(tokenInfo);

      // Setup auto refresh setelah login
      if (isAuthenticated && silentTokenRenewal && tokenRefreshThreshold) {
        setupTokenRefresh();
      } // Call onAuthStateChange callback if provided
      if (onAuthStateChange) {
        onAuthStateChange(isAuthenticated, user);
      }

      // Dispatch auth state change event for service reinitialization
      window.dispatchEvent(
        new CustomEvent('virpal:authStateChanged', {
          detail: { isAuthenticated, user },
        })
      );

      return result;
    } catch (error) {
      // Handle MSAL popup errors more intelligently
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // If error is "user_cancelled" but we might still be authenticated, check auth state
      if (
        errorMessage.includes('user_cancelled') ||
        errorMessage.includes('PopupHandler.monitorPopupForHash')
      ) {
        // Give MSAL a moment to process the authentication result
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check if authentication actually succeeded despite the popup error
        const isAuthenticated = authService.isAuthenticated();
        const user = authService.getUserProfile();

        if (isAuthenticated && user) {
          // Authentication was successful despite popup error
          try {
            const accessToken = await authService.getAccessToken();
            const tokenInfo = await authService.getTokenInfo();

            safeSetAuthState({
              isAuthenticated: true,
              user,
              accessToken,
              isLoading: false,
              error: null,
            });

            setTokenInfo(tokenInfo);

            // Setup auto refresh setelah login
            if (silentTokenRenewal && tokenRefreshThreshold) {
              setupTokenRefresh();
            } // Call onAuthStateChange callback if provided
            if (onAuthStateChange) {
              onAuthStateChange(true, user);
            }

            // Dispatch auth state change event for service reinitialization
            window.dispatchEvent(
              new CustomEvent('virpal:authStateChanged', {
                detail: { isAuthenticated: true, user },
              })
            );

            // Return a mock result since we have successful authentication
            const currentAccount = authService.getCurrentAccount();
            return {
              accessToken,
              account: currentAccount,
              authority: '',
              uniqueId: user.id,
              tenantId: user.tenantId || '',
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
          } catch (tokenError) {
            // If we can't get tokens, fall through to normal error handling
          }
        }
      }

      // Normal error handling for actual failures
      safeSetAuthState({ isLoading: false });
      handleError(error instanceof Error ? error : 'Login failed');
      throw error;
    }
  }, [
    safeSetAuthState,
    handleError,
    silentTokenRenewal,
    tokenRefreshThreshold,
    setupTokenRefresh,
    onAuthStateChange,
  ]);

  /**
   * Login dengan redirect
   */
  const loginWithRedirect = useCallback(async (): Promise<void> => {
    try {
      safeSetAuthState({ isLoading: true, error: null });
      await authService.loginWithRedirect();
    } catch (error) {
      handleError(error instanceof Error ? error : 'Redirect login failed');
      throw error;
    }
  }, [safeSetAuthState, handleError]);

  /**
   * Logout
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      safeSetAuthState({ isLoading: true, error: null });

      // Clear refresh interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }

      await authService.logout();

      safeSetAuthState({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        isLoading: false,
        error: null,
      });
      setTokenInfo(null);

      // Call onAuthStateChange callback if provided
      if (onAuthStateChange) {
        onAuthStateChange(false, null);
      }

      // Dispatch auth state change event for service cleanup
      window.dispatchEvent(
        new CustomEvent('virpal:authStateChanged', {
          detail: { isAuthenticated: false, user: null },
        })
      );
    } catch (error) {
      handleError(error instanceof Error ? error : 'Logout failed');
      throw error;
    }
  }, [safeSetAuthState, handleError, onAuthStateChange]);

  /**
   * Get access token dengan optional force refresh
   */
  const getAccessToken = useCallback(
    async (forceRefresh: boolean = false): Promise<string> => {
      try {
        const token = await authService.getAccessToken(forceRefresh);

        if (mountedRef.current) {
          updateAuthState({ accessToken: token });

          // Update token info jika force refresh
          if (forceRefresh) {
            const info = await authService.getTokenInfo();
            setTokenInfo(info);
          }
        }

        return token;
      } catch (error) {
        handleError(
          error instanceof Error ? error : 'Failed to get access token'
        );
        throw error;
      }
    },
    [updateAuthState, handleError]
  );

  /**
   * Refresh token manually
   */
  const refreshToken = useCallback(async (): Promise<string> => {
    return getAccessToken(true);
  }, [getAccessToken]);

  /**
   * Get performance metrics
   */
  const metrics = authService.getMetrics();

  // Initialize auth saat component mount dengan timeout safety
  useEffect(() => {
    // Timeout safety untuk avoid infinite loading
    const initTimeout = setTimeout(() => {
      if (!isInitialized) {
        setIsInitialized(true);
        updateAuthState({
          isLoading: false,
          error: 'Authentication initialization timed out',
        });
      }
    }, 10000); // 10 second timeout

    initializeAuth().finally(() => {
      clearTimeout(initTimeout);
    });

    // Cleanup function
    return () => {
      clearTimeout(initTimeout);
      mountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []); // Empty dependency array to run only once on mount

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []);
  const returnValue = {
    // State
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    accessToken: authState.accessToken,
    isLoading: authState.isLoading,
    error: authState.error,
    isInitialized,

    // Methods
    login,
    loginWithRedirect,
    logout,
    getAccessToken,
    clearError,
    refreshToken,

    // Additional info
    tokenInfo,
    metrics,
  };
  return returnValue;
}

// Default export for compatibility
export default useAuth;
