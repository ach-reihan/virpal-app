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

  // Auto-initialize pada mount jika diminta, tapi tunggu autentikasi selesai
  useEffect(() => {
    if (autoInitialize && !isInitialized) {
      // Delay initialization untuk memastikan MSAL sudah diinisialisasi
      const delayedInit = setTimeout(() => {
        initializeTTS();
      }, 2000); // 2 detik delay untuk MSAL initialization

      return () => clearTimeout(delayedInit);
    }
    // Return undefined for cases where the effect doesn't need cleanup
    return undefined;
  }, [autoInitialize, isInitialized, initializeTTS]);

  // Monitor authentication status untuk retry TTS initialization
  useEffect(() => {
    if (!isInitialized && authService.isSafelyAuthenticated()) {
      logger.debug(
        'Authentication detected, clearing cache and retrying TTS initialization'
      );

      // Clear cache for speech service secrets to force fresh fetch
      frontendKeyVaultService.clearSecretsCache([
        'azure-speech-service-key',
        'azure-speech-service-region',
        'azure-speech-service-endpoint',
      ]);

      retryTTSInitialization()
        .then((success) => {
          setIsInitialized(success);
          if (success) {
            logger.debug('TTS successfully initialized after authentication');
          }
          return success;
        })
        .catch((error) => {
          logger.error('Failed to retry TTS initialization after auth', error);
          return false;
        });
    }
    // Return undefined for cases where the effect doesn't need cleanup
    return undefined;
  }, [isInitialized]);

  // Periodic check untuk Azure Speech Service availability
  useEffect(() => {
    if (isInitialized && !isAzureSpeechServiceAvailable()) {
      logger.debug('Azure Speech Service not available, checking again...');
      // Set timeout untuk recheck
      const recheckTimer = setTimeout(() => {
        if (authService.isSafelyAuthenticated()) {
          // Clear cache before retrying
          frontendKeyVaultService.clearSecretsCache([
            'azure-speech-service-key',
            'azure-speech-service-region',
            'azure-speech-service-endpoint',
          ]);

          retryTTSInitialization()
            .then((success) => {
              if (success) {
                logger.debug('Azure Speech Service now available');
                setIsInitialized(true); // Update state
              }
              return success;
            })
            .catch((error) => {
              logger.error('Failed to retry TTS after periodic check', error);
              return false;
            });
        }
      }, 5000);

      return () => clearTimeout(recheckTimer);
    }
    // Return undefined for cases where the effect doesn't need cleanup
    return undefined;
  }, [isInitialized]);

  // Handle first user interaction untuk unlock AudioContext
  const handleFirstUserInteraction = useCallback(() => {
    if (!audioContextUnlocked) {
      try {
        unlockAudioContext();
        setAudioContextUnlocked(true);
        logger.debug('Audio context unlocked');
      } catch (error) {
        logger.warn('Failed to unlock audio context');
      }
    }
  }, [audioContextUnlocked]);

  // Enable/disable TTS
  const enableTTS = useCallback(() => {
    setIsEnabled(true);
    logger.debug('TTS enabled');
  }, []);

  const disableTTS = useCallback(() => {
    setIsEnabled(false);
    if (isSpeaking) {
      stopSpeaking();
    }
    logger.debug('TTS disabled');
  }, [isSpeaking]);

  const toggleTTS = useCallback(() => {
    if (isEnabled) {
      disableTTS();
    } else {
      enableTTS();
    }
  }, [isEnabled, enableTTS, disableTTS]);

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

  // Stop current speech
  const stopSpeaking = useCallback(() => {
    if (isSpeaking) {
      try {
        stopAzureTTS();
        setIsSpeaking(false);
        logger.debug('TTS playback stopped');
      } catch (error) {
        logger.error('Failed to stop TTS playback');
      }
    }
  }, [isSpeaking]);

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
    disableTTS,
    toggleTTS,
    speakMessage,
    stopSpeaking,
    handleFirstUserInteraction,

    // Utilities
    canSpeak,
  };
}

export default useTTSChat;
