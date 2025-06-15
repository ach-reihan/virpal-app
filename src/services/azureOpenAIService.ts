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
import { getDirectMentalHealthCompletion } from './azureOpenAIDirect';

// KONFIGURASI - SEKARANG MENGGUNAKAN AZURE FUNCTION SEBAGAI PROXY
// Frontend tidak lagi langsung berkomunikasi dengan Azure OpenAI
// Menggunakan environment config terpusat untuk endpoint
const AZURE_FUNCTION_ENDPOINT = getApiEndpoint('chat-completion');

interface GetAzureOpenAICompletionOptions {
  systemPrompt?: string;
  messageHistory?: OpenAIChatMessage[]; // Untuk konteks percakapan
  temperature?: number;
  maxTokens?: number;
}

/**
 * Mengirim permintaan ke Azure Function yang akan meneruskan ke Azure OpenAI Service.
 * Frontend tidak lagi memiliki akses langsung ke API key - semua melalui backend yang aman.
 * @param userInput Teks input dari pengguna.
 * @param options Opsi tambahan seperti system prompt, histori pesan, dll.
 * @returns Teks respons dari AI.
 */
export async function getAzureOpenAICompletion(
  userInput: string,
  options: GetAzureOpenAICompletionOptions = {}
): Promise<string> {
  if (!AZURE_FUNCTION_ENDPOINT) {
    logger.warn('Azure Function endpoint is not configured');
    await new Promise((resolve) => setTimeout(resolve, 700));
    return `Konfigurasi Azure Function belum lengkap. Kamu bilang: "${userInput}"`;
  }
  const payload = {
    userInput,
    systemPrompt: options.systemPrompt,
    messageHistory: options.messageHistory,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 200,
  };

  try {
    // Kirim request ke Azure Function yang akan meneruskan ke Azure OpenAI
    const response = await fetch(AZURE_FUNCTION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Azure Function API Error', { status: response.status });
      throw new Error(
        `Azure Function API error: ${response.status} - ${errorBody}`
      );
    }

    const data = await response.json();
    if (data.response) {
      return data.response.trim();
    } else {
      logger.error('Invalid response structure from Azure Function');
      throw new Error('Invalid response structure from Azure Function.');
    }
  } catch (error) {
    logger.error('Failed to fetch AI completion via Azure Function');
    // Mengembalikan pesan error yang lebih ramah pengguna atau fallback
    return 'Maaf, aku sedang mengalami sedikit kesulitan untuk merespons saat ini. Coba lagi nanti ya.';
  }
}

/**
 * Mental Health Chat Completion dengan konteks kesehatan mental
 * Khusus untuk elevAIte with Dicoding Hackathon 2025
 */
export async function getMentalHealthChatCompletion(
  userInput: string,
  mentalHealthContext?: {
    currentMood?: string;
    recentAssessment?: unknown;
    riskLevel?: string;
    previousCrises?: number;
  }
): Promise<string> {
  // Gunakan direct service untuk mental health chat
  const context = {
    ...(mentalHealthContext?.currentMood && {
      currentMood: mentalHealthContext.currentMood,
    }),
    ...(mentalHealthContext?.riskLevel && {
      riskLevel: mentalHealthContext.riskLevel,
    }),
  };

  return getDirectMentalHealthCompletion(userInput, context);
}
