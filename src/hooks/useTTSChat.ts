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
 * Custom hook untuk mengelola TTS (Text-to-Speech) dalam chat
 * Mengintegrasikan Azure Speech Service dengan chat interface
 */

import { useCallback, useEffect, useState } from 'react';
import { authService } from '../services/authService';
import {
  initializeTTSService,
  isAzureSpeechServiceAvailable,
  playAzureTTS,
  retryTTSInitialization,
  stopAzureTTS,
  unlockAudioContext,
} from '../services/azureSpeechService';
import { frontendKeyVaultService } from '../services/frontendKeyVaultService';
import { logger } from '../utils/logger';

interface UseTTSChatOptions {
  autoInitialize?: boolean; // Otomatis initialize saat hook dimount
  enableByDefault?: boolean; // TTS enabled secara default
}

interface UseTTSChatReturn {
  // State
  isInitialized: boolean;
  isEnabled: boolean;
  isSpeaking: boolean;
  initializationError: string | null;

  // Actions
  initializeTTS: () => Promise<boolean>;
  enableTTS: () => void;
  disableTTS: () => void;
  toggleTTS: () => void;
  speakMessage: (message: string) => Promise<void>;
  stopSpeaking: () => void;
  handleFirstUserInteraction: () => void;

  // Utilities
  canSpeak: boolean;
}

export function useTTSChat(options: UseTTSChatOptions = {}): UseTTSChatReturn {
  const { autoInitialize = false, enableByDefault = false } = options;

  // State management
  const [isInitialized, setIsInitialized] = useState(false);
  const [isEnabled, setIsEnabled] = useState(enableByDefault);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(
    null
  );
  const [audioContextUnlocked, setAudioContextUnlocked] = useState(false);

  // Initialize TTS service
  const initializeTTS = useCallback(async (): Promise<boolean> => {
    try {
      setInitializationError(null);
      logger.debug('Initializing TTS service');

      const success = await initializeTTSService();
      setIsInitialized(success);

      if (success) {
        logger.debug('TTS service initialized successfully');
      } else {
        logger.warn('TTS service initialization failed - will use fallback');
      }

      return success;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setInitializationError(errorMessage);
      logger.error('TTS initialization error');
      return false;
    }
  }, []);

  // Enhanced auto-initialization dengan better error handling
  useEffect(() => {
    if (autoInitialize && !isInitialized) {
      let initTimeout: NodeJS.Timeout;
      let retryCount = 0;
      const maxRetries = 3;

      const attemptInitialization = async () => {
        try {
          logger.debug(
            `TTS initialization attempt ${retryCount + 1}/${maxRetries}`
          );
          const success = await initializeTTS();

          if (!success && retryCount < maxRetries - 1) {
            retryCount++;
            const delay = 2000 * Math.pow(2, retryCount); // Exponential backoff
            logger.debug(`TTS init failed, retrying in ${delay}ms`);

            initTimeout = setTimeout(attemptInitialization, delay);
          } else if (!success) {
            logger.warn('TTS initialization failed after all retries');
            setInitializationError(
              'Failed to initialize TTS after multiple attempts'
            );
          }
        } catch (error) {
          logger.error('TTS initialization attempt failed:', error);
          if (retryCount < maxRetries - 1) {
            retryCount++;
            const delay = 2000 * Math.pow(2, retryCount);
            initTimeout = setTimeout(attemptInitialization, delay);
          }
        }
      };

      // Initial delay untuk memastikan MSAL sudah diinisialisasi
      initTimeout = setTimeout(attemptInitialization, 2000);

      return () => {
        if (initTimeout) {
          clearTimeout(initTimeout);
        }
      };
    }
    return undefined;
  }, [autoInitialize, isInitialized, initializeTTS]);

  // Enhanced authentication monitoring dengan debouncing
  useEffect(() => {
    if (!isInitialized) {
      const checkAuthentication = () => {
        if (authService.isSafelyAuthenticated()) {
          logger.debug('Authentication detected, attempting TTS retry');

          // Clear cache for fresh credentials
          frontendKeyVaultService.clearSecretsCache([
            'azure-speech-service-key',
            'azure-speech-service-region',
            'azure-speech-service-endpoint',
          ]);

          // Retry initialization
          retryTTSInitialization()
            .then((success) => {
              setIsInitialized(success);
              if (success) {
                logger.info(
                  '✅ TTS successfully initialized after authentication'
                );
                setInitializationError(null);
              } else {
                logger.warn('⚠️ TTS retry failed even after authentication');
              }
              return success;
            })
            .catch((error) => {
              logger.error('❌ TTS retry failed after authentication:', error);
              setInitializationError(
                'Authentication successful but TTS initialization failed'
              );
              return false;
            });
        }
      };

      // Debounced auth check
      const authTimeout = setTimeout(checkAuthentication, 1000);

      return () => {
        clearTimeout(authTimeout);
      };
    }
    return undefined;
  }, [isInitialized]);

  // Enhanced periodic health check
  useEffect(() => {
    if (isInitialized) {
      const healthCheckInterval = setInterval(() => {
        if (
          !isAzureSpeechServiceAvailable() &&
          authService.isSafelyAuthenticated()
        ) {
          logger.debug(
            '🔍 Periodic TTS health check - service unavailable, attempting recovery'
          );

          // Clear cache and retry
          frontendKeyVaultService.clearSecretsCache([
            'azure-speech-service-key',
            'azure-speech-service-region',
            'azure-speech-service-endpoint',
          ]);

          retryTTSInitialization()
            .then((success) => {
              if (success) {
                logger.info('🔄 TTS service recovered during health check');
              } else {
                logger.warn(
                  '⚠️ TTS service still unavailable after health check retry'
                );
              }
              return success;
            })
            .catch(() => {
              logger.error('❌ TTS health check recovery failed');
              return false;
            });
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(healthCheckInterval);
    }
    return undefined;
  }, [isInitialized]);

  // Handle first user interaction untuk unlock AudioContext
  const handleFirstUserInteraction = useCallback(() => {
    if (!audioContextUnlocked) {
      try {
        unlockAudioContext();
        setAudioContextUnlocked(true);
        logger.debug('Audio context unlocked');
      } catch {
        logger.warn('Failed to unlock audio context');
      }
    }
  }, [audioContextUnlocked]);

  // Enable/disable TTS
  const enableTTS = useCallback(() => {
    setIsEnabled(true);
    logger.debug('TTS enabled');
  }, []);

  // Stop current speech
  const stopSpeaking = useCallback(() => {
    if (isSpeaking) {
      try {
        stopAzureTTS();
        setIsSpeaking(false);
        logger.debug('TTS playback stopped');
      } catch {
        logger.error('Failed to stop TTS playback');
      }
    }
  }, [isSpeaking]);

  // Disable TTS and stop speaking if active
  const disableTTSWithStop = useCallback(() => {
    setIsEnabled(false);
    if (isSpeaking) {
      stopSpeaking();
    }
    logger.debug('TTS disabled');
  }, [isSpeaking, stopSpeaking]);

  const toggleTTS = useCallback(() => {
    if (isEnabled) {
      disableTTSWithStop();
    } else {
      enableTTS();
    }
  }, [isEnabled, enableTTS, disableTTSWithStop]);

  // Speak a message
  const speakMessage = useCallback(
    async (message: string): Promise<void> => {
      if (!isEnabled || !isInitialized) {
        throw new Error('TTS is not enabled or not initialized');
      }

      if (isSpeaking) {
        stopSpeaking();
      }

      try {
        setIsSpeaking(true);
        logger.debug('Starting TTS playback');

        await playAzureTTS(message);

        logger.debug('TTS playback completed');
      } catch (error) {
        logger.error('TTS playback failed');
        throw error;
      } finally {
        setIsSpeaking(false);
      }
    },
    [isEnabled, isInitialized, isSpeaking]
  );

  // Computed properties
  const canSpeak = isInitialized && isEnabled && !isSpeaking;

  return {
    // State
    isInitialized,
    isEnabled,
    isSpeaking,
    initializationError,

    // Actions
    initializeTTS,
    enableTTS,
    disableTTS: disableTTSWithStop,
    toggleTTS,
    speakMessage,
    stopSpeaking,
    handleFirstUserInteraction,

    // Utilities
    canSpeak,
  };
}

export default useTTSChat;
