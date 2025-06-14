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

import { getApiEndpoint } from '../config/environment';
import type { OpenAIChatMessage } from '../types';
import { logger } from '../utils/logger';
import { authService } from './authService';
import { guestLimitService } from './guestLimitService';

// Configuration for Azure Function endpoint
// Menggunakan environment config terpusat untuk endpoint
const AZURE_FUNCTION_ENDPOINT = getApiEndpoint('chat-completion');

// Request timeout configuration
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const BASE_DELAY = 300; // milliseconds

interface GetAzureOpenAICompletionOptions {
  systemPrompt?: string;
  messageHistory?: OpenAIChatMessage[]; // For conversation context
  temperature?: number;
  maxTokens?: number;
}

interface ChatCompletionRequest {
  userInput: string;
  systemPrompt: string | undefined;
  messageHistory: OpenAIChatMessage[] | undefined;
  temperature: number | undefined;
  maxTokens: number | undefined;
}

interface ChatCompletionResponse {
  response: string;
  error?: string;
  timestamp?: string;
  processingTime?: number;
}

// Utility function to create a fetch request with timeout
function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, timeout);

    fetch(url, options)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Get authentication headers for API requests
 * Returns Authorization header with Bearer token if user is authenticated
 * For guest users, returns headers without authorization
 */
async function getAuthHeaders(
  isGuestMode: boolean = false
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Skip authentication for guest mode
  if (isGuestMode) {
    headers['X-Guest-Mode'] = 'true';
    return headers;
  }

  try {
    // Check if user is safely authenticated
    if (authService.isSafelyAuthenticated()) {
      const accessToken = await authService.safeGetAccessToken();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
        logger.debug('Successfully obtained access token for API request');
      }
    }
  } catch (authError) {
    logger.warn('Failed to get access token for API request', {
      error: authError instanceof Error ? authError.message : 'Unknown error',
    });
    // Continue without auth header - let the backend handle unauthorized requests
  }

  return headers;
}

// Retry logic with exponential backoff
async function retryRequest<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelay: number = BASE_DELAY
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on client errors (4xx) or specific error types
      if (error instanceof Error) {
        if (error.message.includes('4') || error.message.includes('timeout')) {
          throw error;
        }
      }

      if (attempt === maxRetries) {
        break;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.warn(`Request retry attempt ${attempt}/${maxRetries}`, { delay });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Input validation
function validateInput(
  userInput: string,
  options: GetAzureOpenAICompletionOptions
): { isValid: boolean; error?: string } {
  if (!userInput || typeof userInput !== 'string') {
    return {
      isValid: false,
      error: 'Input text is required and must be a string',
    };
  }

  if (userInput.length > 4000) {
    return {
      isValid: false,
      error: 'Input text is too long (maximum 4000 characters)',
    };
  }

  if (options.messageHistory && options.messageHistory.length > 20) {
    return {
      isValid: false,
      error: 'Message history is too long (maximum 20 messages)',
    };
  }

  return { isValid: true };
}

/**
 * Sends a request to our Azure Function to get a chat completion.
 * This replaces direct calls to Azure OpenAI API for security.
 * Supports both authenticated users and guest users with limitations.
 * @param userInput Text input from the user.
 * @param options Additional options like system prompt, message history, etc.
 * @returns AI response text.
 */
export async function getAzureOpenAICompletion(
  userInput: string,
  options: GetAzureOpenAICompletionOptions = {}
): Promise<string> {
  // Check if user is authenticated
  const isAuthenticated = authService.isSafelyAuthenticated();
  const isGuestMode = !isAuthenticated;

  // For guest users, check limits before proceeding
  if (isGuestMode) {
    if (!guestLimitService.canSendMessage()) {
      throw new Error(guestLimitService.getLimitMessage());
    }
  }

  // Validate input
  const validation = validateInput(userInput, options);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid input');
  }

  // Limit message history for performance
  const limitedHistory =
    options.messageHistory && options.messageHistory.length > 10
      ? options.messageHistory.slice(-10)
      : options.messageHistory;

  const requestData: ChatCompletionRequest = {
    userInput: userInput.trim(), // Sanitize input
    systemPrompt: options.systemPrompt,
    messageHistory: limitedHistory,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  };

  try {
    const startTime = performance.now();

    // Enhanced logging for debugging
    logger.info('Initiating Azure Function request', {
      endpoint: AZURE_FUNCTION_ENDPOINT,
      isGuestMode,
      userInputLength: userInput.length,
      hasSystemPrompt: !!options.systemPrompt,
      messageHistoryLength: limitedHistory?.length || 0,
    });

    // Get authentication headers (with guest mode flag)
    const headers = await getAuthHeaders(isGuestMode);

    // Log headers for debugging (without sensitive data)
    logger.debug('Request headers prepared', {
      hasAuthorization: !!headers['Authorization'],
      isGuestMode: headers['X-Guest-Mode'] === 'true',
      contentType: headers['Content-Type'],
    });

    // Use retry logic for the request
    const response = await retryRequest(async () => {
      logger.debug('Making fetch request to Azure Function', {
        url: AZURE_FUNCTION_ENDPOINT,
        method: 'POST',
      });

      const fetchResponse = await fetchWithTimeout(
        AZURE_FUNCTION_ENDPOINT,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(requestData),
        },
        REQUEST_TIMEOUT
      );

      logger.debug('Received response from Azure Function', {
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        hasBody: !!fetchResponse.body,
      });

      return fetchResponse;
    });

    const endTime = performance.now();
    logger.debug(`Azure Function request completed`, {
      duration: `${endTime - startTime}ms`,
      isGuestMode,
      status: response.status,
    });
    if (!response.ok) {
      // Enhanced error handling for different status codes
      let errorData: { error?: string; details?: string };
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: 'Unknown error' };
      }

      logger.error('Azure Function API error', {
        status: response.status,
        statusText: response.statusText,
        errorData,
      });

      // For 401 errors in guest mode, try fallback approach
      if (response.status === 401 && isGuestMode) {
        logger.info('Authentication failed for guest, this is expected');
        // Still increment guest counter since we attempted to send a message
        guestLimitService.incrementMessageCount();
        throw new Error(
          'Untuk melanjutkan chat, silakan login terlebih dahulu.'
        );
      }

      // Handle other specific status codes
      if (response.status === 404) {
        throw new Error(
          'Layanan chat tidak tersedia saat ini. Coba lagi nanti.'
        );
      }

      if (response.status === 429) {
        throw new Error(
          'Terlalu banyak permintaan. Tunggu sebentar dan coba lagi.'
        );
      }

      if (response.status >= 500) {
        throw new Error(
          'Server sedang bermasalah. Coba lagi dalam beberapa menit.'
        );
      }

      throw new Error(
        `Azure Function API error: ${response.status} - ${
          errorData.error || 'Unknown error'
        }`
      );
    }

    const data: ChatCompletionResponse = await response.json();

    if (data.response) {
      // For guest users, increment message count after successful response
      if (isGuestMode) {
        guestLimitService.incrementMessageCount();
      }

      // Log performance metrics
      if (data.processingTime) {
        logger.debug(`Backend processing completed`, {
          processingTime: `${data.processingTime}ms`,
        });
      }
      return data.response;
    } else if (data.error) {
      throw new Error(data.error);
    } else {
      throw new Error('Invalid response structure from Azure Function.');
    }
  } catch (error) {
    logger.error('Failed to fetch completion from Azure Function', {
      isGuestMode,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Return user-friendly error messages based on error type
    if (error instanceof Error) {
      // Don't modify custom guest limit messages
      if (
        error.message.includes('pesan tersisa') ||
        error.message.includes('batas 5 pesan')
      ) {
        throw error;
      }

      if (error.message.includes('timeout')) {
        return 'Maaf, responsnya agak lama nih. Koneksi internet kamu stabil? Coba lagi ya.';
      }

      if (
        error.message.includes('fetch') ||
        error.message.includes('network')
      ) {
        return 'Maaf, aku tidak bisa terhubung ke server saat ini. Pastikan koneksi internetmu stabil dan coba lagi.';
      }

      if (error.message.includes('401') || error.message.includes('login')) {
        throw error; // Preserve auth-related errors
      }

      if (error.message.includes('4')) {
        return 'Ups, sepertinya ada masalah dengan permintaanmu. Coba kirim pesan yang berbeda ya.';
      }
    }

    return 'Ups, sepertinya ada sedikit gangguan di jaringanku. Bisa coba ulangi lagi?';
  }
}
