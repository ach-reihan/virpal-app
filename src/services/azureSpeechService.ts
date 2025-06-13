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
 * Azure Speech Service Integration
 *
 * This module provides Text-to-Speech (TTS) functionality using Azure Cognitive Services Speech SDK
 * with secure credential management via Azure Key Vault and Managed Identity.
 *
 * Features:
 * - High-quality Neural TTS with en-US-Brian:DragonHDLatestNeural voice
 * - Secure credential management through Azure Key Vault and Managed Identity
 * - Automatic retry with exponential backoff for transient errors
 * - Performance metrics and logging
 * - AudioContext management for browser autoplay policy
 * - Fallback to Web Speech API when Azure credentials are not available
 *
 * Configuration:
 * - Credentials are securely stored in Azure Key Vault:
 *   azure-speech-service-key: Your Azure Speech Service key
 *   azure-speech-service-region: Your Azure region (e.g., southeastasia)
 *   azure-speech-service-endpoint: (Optional) Custom endpoint URL
 * - Authentication via Managed Identity (no hardcoded credentials)
 * * Usage:
 * ```typescript
 * import {
 *   playAzureTTS,
 *   playAzureTTSWithOptions,
 *   playCalm,
 *   playEncouraging,
 *   stopAzureTTS,
 *   unlockAudioContext,
 *   initializeTTSService,
 *   VOICE_PRESETS,
 *   createVoiceOptions
 * } from './services/azureSpeechService';
 *
 * // Initialize TTS service (loads credentials from Key Vault)
 * await initializeTTSService();
 *
 * // Initialize audio context on user interaction (e.g., button click)
 * unlockAudioContext();
 *
 * // Basic usage
 * await playAzureTTS("Hello, how are you today?");
 *
 * // Custom voice options
 * await playAzureTTSWithOptions("Take a deep breath and relax", {
 *   rate: 0.8,      // Slower speech
 *   pitch: "-5%",   // Lower pitch
 *   volume: 50,     // Moderate volume
 *   style: 'friendly'
 * });
 *
 * // Using presets for different emotional contexts
 * await playCalm("Everything will be okay. You're safe now.");
 * await playEncouraging("You've got this! Keep moving forward.");
 * await playEmpathetic("I understand this is difficult for you.");
 * await playProfessional("Here are some coping strategies you can try.");
 *
 * // Create custom validated options
 * const customOptions = createVoiceOptions({
 *   rate: 1.2,
 *   pitch: "+10%",
 *   style: 'cheerful'
 * });
 * await playAzureTTSWithOptions("Great job!", customOptions);
 *
 * // Stop ongoing speech
 * stopAzureTTS();
 * ```
 *
 * Voice Parameters for Brian:DragonHDLatestNeural:
 * - Rate: 0.5 - 2.0 (speech speed)
 * - Pitch: -50% to +50% (voice pitch)
 * - Volume: 0 - 100 (audio volume)
 * - Style: 'cheerful', 'sad', 'friendly', 'hopeful'
 * - StyleDegree: 0.01 - 2.0 (intensity of emotional style)
 *
 * @see https://learn.microsoft.com/azure/cognitive-services/speech-service/
 */

import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { authService } from './authService';
import { frontendKeyVaultService } from './frontendKeyVaultService';

/**
 * Voice configuration options for Brian:DragonHDLatestNeural
 * Supports pitch, speed, volume, and emotional style customization
 */
export interface VoiceOptions {
  /** Speech rate/speed (0.5 - 2.0, default: 1.0) */
  rate?: number;
  /** Voice pitch (-50% to +50%, default: "+0%") */
  pitch?: string;
  /** Voice volume (0 - 100, default: 50) */
  volume?: number;
  /** Voice style for emotional expression (Brian supports limited styles) */
  style?: 'cheerful' | 'sad' | 'friendly' | 'hopeful';
  /** Style degree/intensity (0.01 - 2.0, default: 1.0) */
  styleDegree?: number;
}

/**
 * Default voice configuration optimized for mental health assistance
 * Uses calming and supportive parameters
 */
export const DEFAULT_VOICE_OPTIONS: VoiceOptions = {
  rate: 0.9, // Slightly slower for better comprehension
  pitch: '+0%', // Natural pitch
  volume: 60, // Comfortable volume level
  style: 'friendly', // Warm and approachable tone
  styleDegree: 1.0, // Natural intensity
};

/**
 * Preset voice configurations for different conversation contexts
 */
export const VOICE_PRESETS = {
  /** Calm and supportive for anxiety/stress relief */
  calm: {
    rate: 0.8,
    pitch: '-5%',
    volume: 55,
    style: 'friendly',
    styleDegree: 0.8,
  } as VoiceOptions,

  /** Encouraging and uplifting for motivation */
  encouraging: {
    rate: 1.0,
    pitch: '+5%',
    volume: 65,
    style: 'cheerful',
    styleDegree: 1.2,
  } as VoiceOptions,

  /** Empathetic for difficult conversations */
  empathetic: {
    rate: 0.85,
    pitch: '-2%',
    volume: 50,
    style: 'sad',
    styleDegree: 0.6,
  } as VoiceOptions,

  /** Professional for informational content */
  professional: {
    rate: 1.0,
    pitch: '+0%',
    volume: 60,
    style: 'friendly',
    styleDegree: 0.9,
  } as VoiceOptions,
};

// KONFIGURASI - Kredensial diambil secara aman dari Azure Key Vault via Azure Functions
// Menggunakan frontend service yang memanggil Azure Functions sebagai proxy
let AZURE_SPEECH_KEY: string | null = null;
let AZURE_SPEECH_REGION: string | null = null;
let AZURE_SPEECH_ENDPOINT: string | null = null;

// Cache flag to prevent repeated credential loading
let credentialsLoaded = false;
let credentialsLoadPromise: Promise<boolean> | null = null;

// Voice configuration - menggunakan voice neural berkualitas tinggi
const VOICE_NAME = 'en-US-Brian:DragonHDLatestNeural'; // High-quality multilingual neural voice
const VOICE_LANGUAGE = 'id-ID'; // Bahasa Indonesia - Brian Dragon HD Latest supports multilingual

let synthesizer: SpeechSDK.SpeechSynthesizer | null = null;
let audioContext: AudioContext | null = null; // Untuk mengelola AudioContext

/**
 * Import centralized logger utility for secure and consistent logging
 */
import { logger } from '../utils/logger';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

/**
 * Gets or creates an AudioContext instance
 * Handles cross-browser compatibility and autoplay policy restrictions
 */
function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === 'closed') {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();
    logger.debug('Created new AudioContext');
  }

  // Resume context if suspended (due to browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext
      .resume()
      .catch(() => logger.error('Error resuming AudioContext'));
  }

  return audioContext;
}

/**
 * Load Azure Speech Service credentials secara aman dari Azure Key Vault
 * Menggunakan Managed Identity untuk autentikasi
 * Uses caching to prevent repeated credential loading with improved retry logic
 */
async function loadAzureSpeechCredentials(): Promise<boolean> {
  logger.debug(
    `loadAzureSpeechCredentials called - credentialsLoaded: ${credentialsLoaded}, promiseExists: ${!!credentialsLoadPromise}`
  );

  // Return cached result if already loaded
  if (credentialsLoaded) {
    logger.debug('Using cached Azure Speech Service credentials');
    return true;
  }

  // If loading is already in progress, wait for it
  if (credentialsLoadPromise) {
    logger.debug('Waiting for ongoing credential loading');
    return await credentialsLoadPromise;
  }
  // Start credential loading process with enhanced error handling
  credentialsLoadPromise = (async () => {
    try {
      logger.debug('Loading Azure Speech Service credentials from Key Vault');

      // Enhanced authentication check with retry logic
      let authRetries = 0;
      const maxAuthRetries = 3;
      const authRetryDelay = 1000; // 1 second

      while (
        authRetries < maxAuthRetries &&
        !authService.isSafelyAuthenticated()
      ) {
        logger.debug(
          `Authentication not ready (attempt ${
            authRetries + 1
          }/${maxAuthRetries}) - waiting for initialization`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, authRetryDelay * (authRetries + 1))
        );
        authRetries++;
      }

      if (!authService.isSafelyAuthenticated()) {
        logger.warn(
          'Authentication not ready after retries - proceeding with fallback mode'
        );
        // Still try to load credentials for local testing/fallback
      }

      // Load semua credentials secara paralel untuk performa yang lebih baik
      // Use refreshSecret to bypass any cached null values
      const [speechKey, speechRegion, speechEndpoint] = await Promise.all([
        frontendKeyVaultService.refreshSecret('azure-speech-service-key'),
        frontendKeyVaultService.refreshSecret('azure-speech-service-region'),
        frontendKeyVaultService.refreshSecret('azure-speech-service-endpoint'),
      ]);

      // Enhanced validation with more detailed checks
      const validKey =
        speechKey &&
        speechKey.trim() !== '' &&
        speechKey.length > 10 && // Basic length check for Azure keys
        !speechKey.includes('your-speech-service-key-here') &&
        !speechKey.includes('placeholder') &&
        !speechKey.includes('xxx');

      const validRegion =
        speechRegion &&
        speechRegion.trim() !== '' &&
        speechRegion.length > 2 && // Basic length check
        /^[a-z0-9]+$/.test(speechRegion); // Region format validation

      if (!validKey || !validRegion) {
        logger.warn('Invalid or missing Azure Speech Service credentials', {
          hasKey: !!speechKey,
          hasRegion: !!speechRegion,
          keyValid: validKey,
          regionValid: validRegion,
          keyLength: speechKey?.length || 0,
          regionLength: speechRegion?.length || 0,
        });
        credentialsLoadPromise = null; // Allow retry on next call
        return false;
      }

      AZURE_SPEECH_KEY = speechKey;
      AZURE_SPEECH_REGION = speechRegion;
      AZURE_SPEECH_ENDPOINT = speechEndpoint; // Optional, bisa null

      credentialsLoaded = true;
      logger.info(
        'Azure Speech Service credentials loaded and validated successfully',
        {
          region: speechRegion,
          hasEndpoint: !!speechEndpoint,
          keyLength: speechKey.length,
        }
      );

      return true;
    } catch (error: unknown) {
      logger.error('Failed to load Azure Speech Service credentials', error);
      credentialsLoadPromise = null; // Allow retry on next call
      return false;
    }
  })();

  return await credentialsLoadPromise;
}

async function initializeSynthesizer(): Promise<SpeechSDK.SpeechSynthesizer | null> {
  // Load credentials dari Key Vault terlebih dahulu (with caching)
  const credentialsSuccess = await loadAzureSpeechCredentials();

  // Enhanced validation to prevent initialization with placeholder/invalid keys
  const hasValidKey =
    AZURE_SPEECH_KEY &&
    AZURE_SPEECH_KEY.trim() !== '' &&
    !AZURE_SPEECH_KEY.includes('your-speech-service-key-here') &&
    !AZURE_SPEECH_KEY.includes('placeholder');
  const hasValidRegion =
    AZURE_SPEECH_REGION && AZURE_SPEECH_REGION.trim() !== '';

  if (!credentialsSuccess || !hasValidKey || !hasValidRegion) {
    logger.debug(
      'Azure Speech configuration not available or invalid, will use fallback',
      {
        credentialsSuccess,
        hasValidKey,
        hasValidRegion,
      }
    );
    // Clear any existing synthesizer since credentials are invalid
    if (synthesizer) {
      synthesizer.close();
      synthesizer = null;
    }
    return null;
  }
  try {
    // Enhanced validation to prevent initialization with placeholder/invalid keys
    const hasValidKey =
      AZURE_SPEECH_KEY &&
      AZURE_SPEECH_KEY.trim() !== '' &&
      AZURE_SPEECH_KEY.length > 10 &&
      !AZURE_SPEECH_KEY.includes('your-speech-service-key-here') &&
      !AZURE_SPEECH_KEY.includes('placeholder') &&
      !AZURE_SPEECH_KEY.includes('xxx');

    const hasValidRegion =
      AZURE_SPEECH_REGION &&
      AZURE_SPEECH_REGION.trim() !== '' &&
      AZURE_SPEECH_REGION.length > 2 &&
      /^[a-z0-9]+$/.test(AZURE_SPEECH_REGION);

    if (!credentialsSuccess || !hasValidKey || !hasValidRegion) {
      logger.warn(
        'Azure Speech configuration not available or invalid, will use fallback',
        {
          credentialsSuccess,
          hasValidKey,
          hasValidRegion,
          keyLength: AZURE_SPEECH_KEY?.length || 0,
          region: AZURE_SPEECH_REGION?.substring(0, 3) + '***' || 'null',
        }
      );
      // Clear any existing synthesizer since credentials are invalid
      if (synthesizer) {
        try {
          synthesizer.close();
        } catch {
          // Silent cleanup
        }
        synthesizer = null;
      }
      return null;
    }

    // Log initialization without sensitive details
    logger.info(
      'Initializing Azure Speech Synthesizer with validated credentials',
      {
        voiceName: VOICE_NAME,
        language: VOICE_LANGUAGE,
        region: AZURE_SPEECH_REGION,
        hasEndpoint: !!AZURE_SPEECH_ENDPOINT,
      }
    );

    // Create speech config dengan Key Vault credentials
    const speechConfig = AZURE_SPEECH_ENDPOINT
      ? SpeechSDK.SpeechConfig.fromEndpoint(
          new URL(AZURE_SPEECH_ENDPOINT),
          AZURE_SPEECH_KEY!
        )
      : SpeechSDK.SpeechConfig.fromSubscription(
          AZURE_SPEECH_KEY!,
          AZURE_SPEECH_REGION!
        );

    // Configure untuk kualitas audio terbaik dan kompatibilitas browser
    speechConfig.speechSynthesisOutputFormat =
      SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;

    // Set voice yang dikonfigurasi
    speechConfig.speechSynthesisVoiceName = VOICE_NAME;
    speechConfig.speechSynthesisLanguage = VOICE_LANGUAGE;

    // Add connection resilience settings - menggunakan property yang tersedia
    speechConfig.setProperty('SpeechServiceConnection_SendTimeoutMs', '15000');
    speechConfig.setProperty('SpeechServiceConnection_ReadTimeoutMs', '15000');

    // Add retry settings
    speechConfig.setProperty('SpeechServiceConnection_MaxRetryCount', '3');
    speechConfig.setProperty(
      'SpeechServiceConnection_ReconnectTimeoutMs',
      '5000'
    );

    // Menggunakan konfigurasi audio yang lebih kompatibel dengan browser
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();

    logger.debug('Speech configuration created', {
      voiceName: VOICE_NAME,
      language: VOICE_LANGUAGE,
      outputFormat: 'Audio24Khz48KBitRateMonoMp3',
      isMultilingualVoice: VOICE_NAME.includes('DragonHDLatest'),
      hasCustomEndpoint: !!AZURE_SPEECH_ENDPOINT,
    });

    // Close existing synthesizer sebelum membuat yang baru
    if (synthesizer) {
      try {
        synthesizer.close();
      } catch {
        // Silent cleanup - non-critical error
        logger.warn('Error closing previous synthesizer instance');
      }
    }

    synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);
    logger.info('✅ Azure Speech Synthesizer initialized successfully');
    return synthesizer;
  } catch (error: unknown) {
    logger.error('❌ Failed to initialize Azure Speech Synthesizer', error);

    // Clean up on error
    if (synthesizer) {
      try {
        synthesizer.close();
      } catch {
        // Silent cleanup
      }
      synthesizer = null;
    }

    return null;
  }
}

/**
 * Implements retry logic with exponential backoff for transient errors
 * @param operation Function to retry
 * @param maxRetries Maximum number of retry attempts
 * @param initialDelay Initial delay in milliseconds
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 300
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this is a transient error that can be retried
      const isTransient =
        lastError.message.includes('network') ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('429') || // Rate limiting
        lastError.message.includes('503'); // Service unavailable

      if (!isTransient || attempt >= maxRetries - 1) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 100;
      logger.debug(`Retrying operation (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Unknown error during retry operation');
}

/**
 * Logs minimal metrics about speech synthesis for monitoring and performance analysis
 * Records only non-sensitive performance data to help diagnose issues
 */
function logSpeechMetrics(
  text: string,
  duration: number,
  success: boolean,
  errorInfo?: string
) {
  // Only log essential information, never log actual speech text content
  const characterCount = text.length;

  if (success) {
    logger.debug('Speech synthesis completed', {
      characterCount,
      durationMs: duration,
    });
  } else {
    logger.warn('Speech synthesis failed', {
      characterCount,
      durationMs: duration,
      errorCategory: errorInfo ? 'API error' : 'Unknown error',
    });
  }

  // For production, these metrics should be sent to Azure Application Insights
  // with additional context like browser/OS but never with actual text content
}

/**
 * Memainkan teks sebagai suara menggunakan Azure Text-to-Speech dengan retry logic.
 * @param textToSpeak Teks yang akan diucapkan.
 */
export async function playAzureTTS(textToSpeak: string): Promise<void> {
  // Validate input text
  const trimmedText = textToSpeak?.trim();
  if (!trimmedText || trimmedText.length < 2) {
    logger.warn('TTS skipped: Text too short or empty', {
      originalLength: textToSpeak?.length || 0,
      trimmedLength: trimmedText?.length || 0,
      text: JSON.stringify(textToSpeak), // Safe to log short/empty text
    });
    return;
  }
  // Log the TTS request without exposing text content - only log character count for performance metrics
  logger.debug('Starting speech synthesis', {
    characterCount: trimmedText.length,
  });

  // Always check if we should use Azure or fallback - don't reuse invalid synthesizer
  const currentSynthesizer = await initializeSynthesizer();
  if (!currentSynthesizer) {
    logger.warn(
      'Azure Speech Synthesizer not available. Falling back to Web Speech API.'
    );
    // Fallback ke Web Speech API jika Azure tidak terkonfigurasi
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(trimmedText);
      utterance.lang = VOICE_LANGUAGE;

      // Tunggu voices siap jika belum
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        await new Promise(
          (resolve) => (window.speechSynthesis.onvoiceschanged = resolve)
        );
      }

      // Cari voice yang cocok
      const compatibleVoice = window.speechSynthesis
        .getVoices()
        .find(
          (voice) =>
            voice.lang.startsWith('id-ID') || voice.lang === VOICE_LANGUAGE
        );
      if (compatibleVoice) {
        utterance.voice = compatibleVoice;
      }

      const startTime = Date.now();
      window.speechSynthesis.speak(utterance);

      return new Promise<void>((resolve, reject) => {
        utterance.onend = () => {
          const duration = Date.now() - startTime;
          logSpeechMetrics(textToSpeak, duration, true);
          resolve();
        };
        utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
          const duration = Date.now() - startTime;
          const errorType = event.error || 'unknown';
          logger.error(`Web Speech API error: ${errorType}`);
          logSpeechMetrics(
            textToSpeak,
            duration,
            false,
            'Web Speech API error'
          );
          reject(new Error(`Speech synthesis failed: ${errorType}`));
        };
      });
    } else {
      logger.error(
        'Speech synthesis not available - neither Azure nor Web Speech API is supported'
      );
      return Promise.reject(new Error('TTS not available.'));
    }
  }
  // Pastikan AudioContext di-resume sebelum speak
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext
      .resume()
      .catch(() =>
        logger.error('Error resuming AudioContext before speech playback')
      );
  }

  const startTime = Date.now();

  // Implement retry logic untuk Azure speech synthesis
  return retryOperation(() => {
    return new Promise((resolve, reject) => {
      currentSynthesizer.speakTextAsync(
        trimmedText,
        (result: SpeechSDK.SpeechSynthesisResult) => {
          const duration = Date.now() - startTime;
          if (
            result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted
          ) {
            logSpeechMetrics(trimmedText, duration, true);
            resolve();
          } else {
            const reasonCode =
              SpeechSDK.ResultReason[result.reason] || 'Unknown';
            logger.error(
              `TTS Error: Synthesis failed with reason ${reasonCode}`
            );
            logSpeechMetrics(
              trimmedText,
              duration,
              false,
              `Reason: ${reasonCode}`
            );
            reject(new Error('Speech synthesis failed'));
          }
        },
        (errorMessage: string) => {
          const duration = Date.now() - startTime;
          logger.error('TTS General Error', errorMessage);
          logSpeechMetrics(trimmedText, duration, false, 'Azure SDK error');
          reject(new Error('Speech synthesis failed'));
        }
      );
    });
  });
}

/**
 * Generate SSML (Speech Synthesis Markup Language) for Brian:DragonHDLatestNeural
 * with customizable pitch, speed, volume, and emotional style
 */
function generateSSML(
  text: string,
  options: VoiceOptions = DEFAULT_VOICE_OPTIONS
): string {
  const {
    rate = DEFAULT_VOICE_OPTIONS.rate,
    pitch = DEFAULT_VOICE_OPTIONS.pitch,
    volume = DEFAULT_VOICE_OPTIONS.volume,
    style,
    styleDegree = 1.0,
  } = options;

  // Escape special XML characters in text
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  // Build SSML with correct namespace declarations for mstts
  let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="id-ID">`;

  // Voice element with name
  ssml += `<voice name="${VOICE_NAME}">`;

  // Add style if specified (Brian supports limited emotional styles)
  if (style) {
    ssml += `<mstts:express-as style="${style}" styledegree="${styleDegree}">`;
  }

  // Prosody for pitch, rate, and volume control
  ssml += `<prosody pitch="${pitch}" rate="${rate}" volume="${volume}">`;
  ssml += escapedText;
  ssml += `</prosody>`;

  // Close style tag if used
  if (style) {
    ssml += `</mstts:express-as>`;
  }
  ssml += `</voice>`;
  ssml += `</speak>`;
  logger.debug('Generated SSML with mstts namespace', {
    hasStyle: !!style,
    ssmlLength: ssml.length,
    voiceName: VOICE_NAME,
    isMultilingualVoice: VOICE_NAME.includes('DragonHDLatest'),
    targetLanguage: 'id-ID',
    preview: ssml.substring(0, 150) + '...',
  });

  return ssml;
}

/**
 * Play text as speech using Azure Text-to-Speech with customizable voice options
 * Supports pitch, speed, volume, and emotional style control for Brian:DragonHDLatestNeural
 */
export async function playAzureTTSWithOptions(
  textToSpeak: string,
  options: VoiceOptions = DEFAULT_VOICE_OPTIONS
): Promise<void> {
  // Validate input text
  const trimmedText = textToSpeak?.trim();
  if (!trimmedText || trimmedText.length < 2) {
    logger.warn('TTS skipped: Text too short or empty', {
      originalLength: textToSpeak?.length || 0,
      trimmedLength: trimmedText?.length || 0,
    });
    return;
  }

  // Log the TTS request with voice options
  logger.debug('Starting speech synthesis with custom options', {
    characterCount: trimmedText.length,
    voiceOptions: options,
  });

  const currentSynthesizer = await initializeSynthesizer();
  if (!currentSynthesizer) {
    logger.warn(
      'Azure Speech Synthesizer not available. Falling back to Web Speech API.'
    );
    return playWebSpeechFallback(trimmedText, options);
  }

  // Unlock audio context jika diperlukan
  unlockAudioContext();

  try {
    // Generate SSML with voice customization
    const ssmlText = generateSSML(trimmedText, options);

    logger.debug('Generated SSML for TTS', {
      ssmlLength: ssmlText.length,
      hasStyle: !!options.style,
      voiceParams: {
        rate: options.rate,
        pitch: options.pitch,
        volume: options.volume,
      },
    });
    return new Promise<void>((resolve, reject) => {
      const startTime = Date.now();

      currentSynthesizer.speakSsmlAsync(
        ssmlText,
        (result) => {
          const duration = Date.now() - startTime;
          const reasonName = SpeechSDK.ResultReason[result.reason];
          const audioDataLength = result.audioData?.byteLength || 0;

          logger.info('🔊 Azure TTS Result', {
            duration,
            resultReason: result.reason,
            reasonName,
            audioDataLength,
            errorDetails: result.errorDetails || 'none',
            voiceName: VOICE_NAME,
            language: VOICE_LANGUAGE,
          });

          // Check if synthesis was successful
          if (
            result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted
          ) {
            if (audioDataLength > 0) {
              logger.info('✅ TTS audio data generated successfully');
            } else {
              logger.warn('⚠️ TTS completed but no audio data generated');
            }
            resolve();
          } else {
            logger.error('❌ TTS synthesis failed', {
              reason: reasonName,
              errorDetails: result.errorDetails,
            });
            reject(new Error(`TTS synthesis failed: ${reasonName}`));
          }
        },
        (error) => {
          const duration = Date.now() - startTime;
          logger.error('❌ Azure TTS error callback', {
            duration,
            error: error.toString(),
            voiceName: VOICE_NAME,
            language: VOICE_LANGUAGE,
          });
          reject(new Error(`Azure TTS failed: ${error}`));
        }
      );
    });
  } catch (error) {
    logger.error('Error in Azure TTS synthesis with options');
    throw error;
  }
}

/**
 * Fallback to Web Speech API with basic rate control
 */
function playWebSpeechFallback(
  text: string,
  options: VoiceOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Web Speech API not supported'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = VOICE_LANGUAGE;
    // Apply basic options supported by Web Speech API
    if (options.rate) {
      utterance.rate = Math.max(0.1, Math.min(10, options.rate));
    }
    if (options.pitch && typeof options.pitch === 'string') {
      // Convert percentage to numeric value for Web Speech API
      const pitchMatch = options.pitch.match(/([+-]?\d+)%/);
      if (pitchMatch && pitchMatch[1]) {
        const pitchPercent = parseInt(pitchMatch[1], 10);
        utterance.pitch = Math.max(0, Math.min(2, 1 + pitchPercent / 100));
      }
    }
    if (options.volume) {
      utterance.volume = Math.max(0, Math.min(1, options.volume / 100));
    }

    utterance.onend = () => resolve();
    utterance.onerror = (event) =>
      reject(new Error(`Web Speech API error: ${event.error}`));

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Menghentikan sintesis suara yang sedang berjalan.
 */
export function stopAzureTTS(): void {
  logger.debug('Stopping speech synthesis');

  if (synthesizer) {
    try {
      // Azure Speech SDK doesn't have a direct method to stop speaking in progress
      // We need to close the current synthesizer and create a new one next time
      synthesizer.close();
      synthesizer = null; // Will be re-initialized on next call
      logger.debug('Speech synthesis stopped');
    } catch (error: unknown) {
      logger.warn('Error stopping speech synthesis', error);
    }
  }

  // Fallback for Web Speech API
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      logger.debug('Web Speech API synthesis stopped');
    } catch (error: unknown) {
      logger.warn('Error stopping Web Speech API synthesis', error);
    }
  }
}

/**
 * Test function untuk debugging TTS di browser console
 * Call this from browser console: await testTTSBasic()
 */
export async function testTTSBasic(): Promise<void> {
  try {
    logger.info('🧪 Starting basic TTS test...');

    // Check audio context
    const audioCtx = getAudioContext();
    logger.info('AudioContext state:', audioCtx.state);

    // Test simple text
    const testText = 'Halo, ini adalah tes suara untuk VirPal';
    logger.info('Testing with text:', testText);

    // Test Azure TTS with default options
    await playAzureTTSWithOptions(testText, DEFAULT_VOICE_OPTIONS);

    logger.info('✅ Basic TTS test completed successfully');
  } catch (error) {
    logger.error('❌ Basic TTS test failed:', error);
    throw error;
  }
}

/**
 * Test function untuk credential loading
 * Call this from browser console: await testTTSCredentials()
 */
export async function testTTSCredentials(): Promise<boolean> {
  try {
    logger.info('🔑 Testing TTS credentials...');

    // Reset credentials for fresh test
    credentialsLoaded = false;
    credentialsLoadPromise = null;

    const result = await loadAzureSpeechCredentials();

    logger.info('Credentials test result:', {
      success: result,
      hasKey: !!AZURE_SPEECH_KEY,
      hasRegion: !!AZURE_SPEECH_REGION,
      hasEndpoint: !!AZURE_SPEECH_ENDPOINT,
      keyLength: AZURE_SPEECH_KEY?.length || 0,
      region: AZURE_SPEECH_REGION || 'null',
    });

    return result;
  } catch (error) {
    logger.error('❌ Credentials test failed:', error);
    return false;
  }
}

/**
 * Test different voice presets
 * Call this from browser console: await testTTSVoicePresets()
 */
export async function testTTSVoicePresets(): Promise<void> {
  try {
    logger.info('🎵 Testing TTS voice presets...');

    const testTexts = [
      {
        text: 'Tenang dan santai',
        preset: 'calm' as keyof typeof VOICE_PRESETS,
      },
      {
        text: 'Semangat dan optimis',
        preset: 'encouraging' as keyof typeof VOICE_PRESETS,
      },
      {
        text: 'Saya memahami perasaan Anda',
        preset: 'empathetic' as keyof typeof VOICE_PRESETS,
      },
      {
        text: 'Berikut adalah informasi yang akurat',
        preset: 'professional' as keyof typeof VOICE_PRESETS,
      },
    ];
    for (const { text, preset } of testTexts) {
      logger.info(`Testing ${preset} preset: "${text}"`);

      let voiceOptions: VoiceOptions;
      switch (preset) {
        case 'calm':
          voiceOptions = VOICE_PRESETS.calm;
          break;
        case 'encouraging':
          voiceOptions = VOICE_PRESETS.encouraging;
          break;
        case 'empathetic':
          voiceOptions = VOICE_PRESETS.empathetic;
          break;
        case 'professional':
          voiceOptions = VOICE_PRESETS.professional;
          break;
        default:
          voiceOptions = DEFAULT_VOICE_OPTIONS;
      }

      await playAzureTTSWithOptions(text, voiceOptions);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait between tests
    }

    logger.info('✅ Voice presets test completed');
  } catch (error) {
    logger.error('❌ Voice presets test failed:', error);
    throw error;
  }
}

// Make test functions available globally for console access
if (typeof window !== 'undefined') {
  interface WindowWithTTSTests extends Window {
    testTTSBasic?: () => Promise<void>;
    testTTSCredentials?: () => Promise<boolean>;
    testTTSVoicePresets?: () => Promise<void>;
  }

  const windowWithTests = window as WindowWithTTSTests;
  windowWithTests.testTTSBasic = testTTSBasic;
  windowWithTests.testTTSCredentials = testTTSCredentials;
  windowWithTests.testTTSVoicePresets = testTTSVoicePresets;
}

/**
 * Initialize TTS service - loads credentials and prepares synthesizer
 * Call this once during application startup
 * Includes enhanced retry logic and better error handling
 */
export async function initializeTTSService(): Promise<boolean> {
  try {
    logger.info('🎤 Initializing TTS Service with enhanced error handling');

    // Check basic browser support first
    if (!('speechSynthesis' in window) && typeof SpeechSDK === 'undefined') {
      logger.error('❌ Neither Azure Speech SDK nor Web Speech API available');
      return false;
    }

    // Retry logic untuk mengatasi timing issue dengan MSAL initialization
    let success = false;
    let retryCount = 0;
    const maxRetries = 5; // Increased retries
    const baseRetryDelay = 1000; // 1 second base delay

    while (!success && retryCount < maxRetries) {
      if (retryCount > 0) {
        const delay = baseRetryDelay * Math.pow(2, retryCount - 1); // Exponential backoff
        logger.debug(
          `🔄 Retrying TTS initialization (attempt ${
            retryCount + 1
          }/${maxRetries}) after ${delay}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        success = await loadAzureSpeechCredentials();
        retryCount++;

        if (!success && retryCount < maxRetries) {
          logger.debug('💤 TTS credential loading failed, will retry...');

          // Clear cache before retry to ensure fresh attempt
          credentialsLoaded = false;
          credentialsLoadPromise = null;
        }
      } catch (error) {
        logger.warn(
          `❌ TTS initialization attempt ${retryCount + 1} failed:`,
          error
        );
        retryCount++;

        // Clear cache before retry
        credentialsLoaded = false;
        credentialsLoadPromise = null;
      }
    }

    if (success) {
      // Pre-initialize synthesizer untuk performa yang lebih baik
      synthesizer = await initializeSynthesizer();
      if (synthesizer) {
        logger.info('✅ Azure Speech Service initialized successfully');
        console.log('🎵 Azure Speech Service ready with Brian Neural Voice');
      } else {
        logger.warn(
          '⚠️ Azure Speech credentials loaded but synthesizer initialization failed'
        );
        success = false;
      }
    }

    if (!success) {
      logger.info(
        'ℹ️ TTS Service initialized in fallback mode (Web Speech API)'
      );
      console.log('🔄 TTS Service running with Web Speech API fallback');
    }

    return success;
  } catch (error) {
    logger.error('❌ Critical error during TTS Service initialization:', error);
    console.error('💥 TTS Service initialization failed:', error);
    return false;
  }
}

/**
 * Retry TTS initialization when authentication becomes available
 * Call this after user authentication is complete to enable Azure Speech Service
 */
export async function retryTTSInitialization(): Promise<boolean> {
  logger.debug('Retrying TTS initialization after authentication');

  // Reset credentials cache to force reload
  credentialsLoaded = false;
  credentialsLoadPromise = null;

  // Re-initialize TTS service
  return await initializeTTSService();
}

/**
 * Check if Azure Speech Service is available and properly configured
 */
export function isAzureSpeechServiceAvailable(): boolean {
  return (
    credentialsLoaded &&
    synthesizer !== null &&
    AZURE_SPEECH_KEY !== null &&
    AZURE_SPEECH_REGION !== null
  );
}

/**
 * Unlocks AudioContext in response to user interaction
 * This should be called after a user interaction event (click, touch)
 * to bypass browser autoplay policy restrictions
 */
export function unlockAudioContext() {
  const ac = getAudioContext();
  if (ac.state === 'suspended') {
    ac.resume()
      .then(() => logger.debug('AudioContext unlocked successfully'))
      .catch(() => logger.error('Failed to unlock AudioContext'));
  } else {
    logger.debug('AudioContext already active');
  }
}

/**
 * Convenient preset functions for common mental health conversation scenarios
 * Uses predefined voice configurations optimized for each context
 */

/**
 * Play text with calm, soothing voice parameters - ideal for anxiety relief
 */
export async function playCalm(text: string): Promise<void> {
  return playAzureTTSWithOptions(text, VOICE_PRESETS.calm);
}

/**
 * Play text with encouraging, uplifting voice parameters - ideal for motivation
 */
export async function playEncouraging(text: string): Promise<void> {
  return playAzureTTSWithOptions(text, VOICE_PRESETS.encouraging);
}

/**
 * Play text with empathetic voice parameters - ideal for difficult conversations
 */
export async function playEmpathetic(text: string): Promise<void> {
  return playAzureTTSWithOptions(text, VOICE_PRESETS.empathetic);
}

/**
 * Play text with professional voice parameters - ideal for informational content
 */
export async function playProfessional(text: string): Promise<void> {
  return playAzureTTSWithOptions(text, VOICE_PRESETS.professional);
}

/**
 * Create custom voice configuration with validation
 */
export function createVoiceOptions(
  options: Partial<VoiceOptions>
): VoiceOptions {
  const validated: VoiceOptions = { ...DEFAULT_VOICE_OPTIONS };

  // Validate and apply rate
  if (options.rate !== undefined) {
    validated.rate = Math.max(0.5, Math.min(2.0, options.rate));
  }
  // Validate and apply pitch
  if (options.pitch !== undefined) {
    const pitchMatch = options.pitch.match(/^([+-]?\d{1,2})%$/);
    if (pitchMatch && pitchMatch[1]) {
      const pitchValue = parseInt(pitchMatch[1], 10);
      if (pitchValue >= -50 && pitchValue <= 50) {
        validated.pitch = options.pitch;
      }
    }
  }

  // Validate and apply volume
  if (options.volume !== undefined) {
    validated.volume = Math.max(0, Math.min(100, options.volume));
  }

  // Apply style and styleDegree if valid
  if (options.style) {
    const validStyles = ['cheerful', 'sad', 'friendly', 'hopeful'];
    if (validStyles.includes(options.style)) {
      validated.style = options.style;
    }
  }

  if (options.styleDegree !== undefined) {
    validated.styleDegree = Math.max(0.01, Math.min(2.0, options.styleDegree));
  }

  return validated;
}

/**
 * Smart Voice Adaptation System
 * Automatically selects appropriate voice parameters based on chat completion content
 */

/**
 * Analyze response content and determine appropriate voice preset
 */
export function analyzeResponseForVoice(
  responseText: string
): keyof typeof VOICE_PRESETS {
  const text = responseText.toLowerCase();

  // Keywords for different emotional contexts
  const calmKeywords = [
    'tenang',
    'rileks',
    'napas',
    'pelan',
    'santai',
    'damai',
    'tenangkan',
  ];
  const encouragingKeywords = [
    'semangat',
    'bisa',
    'kuat',
    'hebat',
    'bagus',
    'luar biasa',
    'bangga',
    'berhasil',
  ];
  const empatheticKeywords = [
    'mengerti',
    'pahami',
    'sulit',
    'berat',
    'sedih',
    'wajar',
    'normal',
    'feelings',
  ];
  const professionalKeywords = [
    'strategi',
    'teknik',
    'cara',
    'langkah',
    'metode',
    'saran',
    'rekomendasi',
  ];

  // Count matches for each category
  const calmScore = calmKeywords.filter((keyword) =>
    text.includes(keyword)
  ).length;
  const encouragingScore = encouragingKeywords.filter((keyword) =>
    text.includes(keyword)
  ).length;
  const empatheticScore = empatheticKeywords.filter((keyword) =>
    text.includes(keyword)
  ).length;
  const professionalScore = professionalKeywords.filter((keyword) =>
    text.includes(keyword)
  ).length;

  // Determine best match
  const scores = {
    calm: calmScore,
    encouraging: encouragingScore,
    empathetic: empatheticScore,
    professional: professionalScore,
  };

  const maxScore = Math.max(...Object.values(scores));

  // If no clear match, use professional as default
  if (maxScore === 0) {
    return 'professional';
  }

  // Return the preset with highest score
  return Object.keys(scores).find(
    (key) => scores[key as keyof typeof scores] === maxScore
  ) as keyof typeof VOICE_PRESETS;
}

/**
 * Smart TTS function that adapts voice based on content
 * This is the main function to use for chat responses
 */
export async function playSmartTTS(responseText: string): Promise<void> {
  try {
    logger.info('🎤 Starting playSmartTTS', {
      textLength: responseText.length,
      firstWords: responseText.substring(0, 50),
    });

    // Ensure audio context is ready
    const audioCtx = getAudioContext();
    logger.debug('AudioContext state:', audioCtx.state);

    // Analyze content to determine best voice preset
    const voicePreset = analyzeResponseForVoice(responseText);

    logger.info('🎵 Smart TTS selected preset', {
      preset: voicePreset,
      textLength: responseText.length,
      audioContextState: audioCtx.state,
    });

    // Use the appropriate preset function
    switch (voicePreset) {
      case 'calm':
        return await playCalm(responseText);
      case 'encouraging':
        return await playEncouraging(responseText);
      case 'empathetic':
        return await playEmpathetic(responseText);
      case 'professional':
      default:
        return await playProfessional(responseText);
    }
  } catch (error: unknown) {
    // Fallback to standard TTS if smart adaptation fails
    logger.warn('Smart TTS failed, falling back to standard TTS', error);
    return await playAzureTTS(responseText);
  }
}

/**
 * Advanced smart TTS with crisis detection and adaptive response
 */
export async function playAdaptiveMentalHealthTTS(
  responseText: string,
  mentalHealthContext?: {
    userEmotion?: 'anxious' | 'sad' | 'angry' | 'hopeful' | 'neutral';
    crisisLevel?: 'low' | 'medium' | 'high';
    sessionType?: 'first' | 'ongoing' | 'crisis';
  }
): Promise<void> {
  try {
    let voiceOptions: VoiceOptions;

    // Crisis-specific voice adaptation
    if (mentalHealthContext?.crisisLevel === 'high') {
      voiceOptions = {
        ...VOICE_PRESETS.calm,
        rate: 0.7, // Very slow for crisis situations
        pitch: '-8%', // Lower pitch for calming effect
        volume: 45, // Softer volume
        style: 'friendly',
        styleDegree: 0.7,
      };
    } else if (mentalHealthContext?.userEmotion === 'anxious') {
      voiceOptions = VOICE_PRESETS.calm;
    } else if (mentalHealthContext?.userEmotion === 'sad') {
      voiceOptions = VOICE_PRESETS.empathetic;
    } else {
      // Use content-based analysis as fallback
      const preset = analyzeResponseForVoice(responseText);
      switch (preset) {
        case 'calm':
          voiceOptions = VOICE_PRESETS.calm;
          break;
        case 'encouraging':
          voiceOptions = VOICE_PRESETS.encouraging;
          break;
        case 'empathetic':
          voiceOptions = VOICE_PRESETS.empathetic;
          break;
        case 'professional':
        default:
          voiceOptions = VOICE_PRESETS.professional;
          break;
      }
    }

    logger.debug('Adaptive mental health TTS', {
      userEmotion: mentalHealthContext?.userEmotion,
      crisisLevel: mentalHealthContext?.crisisLevel,
      voiceOptions,
    });

    return await playAzureTTSWithOptions(responseText, voiceOptions);
  } catch (error: unknown) {
    logger.warn('Adaptive mental health TTS failed, using fallback', error);
    return await playSmartTTS(responseText);
  }
}

/**
 * Test function to verify TTS functionality with comprehensive logging
 */
export async function testTTS(): Promise<void> {
  try {
    logger.info('🧪 Starting TTS test...');

    // Check audio context
    const audioCtx = getAudioContext();
    logger.info('AudioContext state:', audioCtx.state);

    // Test simple text
    const testText = 'Halo, ini adalah tes suara untuk VirPal';
    logger.info('Testing with text:', testText);

    // Test Azure TTS with default options
    await playAzureTTSWithOptions(testText, DEFAULT_VOICE_OPTIONS);

    logger.info('✅ TTS test completed successfully');
  } catch (error) {
    logger.error('❌ TTS test failed:', error);
    throw error;
  }
}

/**
 * Smart TTS functions are already exported above in their individual declarations
 * All functions are available for import
 */
