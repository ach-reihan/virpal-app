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
    recentAssessment?: any;
    riskLevel?: string;
    previousCrises?: number;
  }
): Promise<string> {
  // Enhanced system prompt untuk mental health
  const mentalHealthPrompt = `
Anda adalah VirPal, asisten AI khusus untuk kesehatan mental yang dikembangkan untuk elevAIte with Dicoding Hackathon 2025.

MISI ANDA:
- Mendukung SDG 3 (Good Health and Well-being) untuk Indonesia
- Memberikan dukungan kesehatan mental yang empati dan efektif
- Mencegah dan membantu mengatasi dampak negatif judi online
- Menyediakan intervensi dini untuk masalah kesehatan mental

KONTEKS PENGGUNA:
${
  mentalHealthContext?.currentMood
    ? `- Mood saat ini: ${mentalHealthContext.currentMood}`
    : ''
}
${
  mentalHealthContext?.riskLevel
    ? `- Tingkat risiko judi: ${mentalHealthContext.riskLevel}`
    : ''
}
${
  mentalHealthContext?.previousCrises
    ? `- Riwayat krisis: ${mentalHealthContext.previousCrises} kali`
    : ''
}

KARAKTERISTIK ANDA:
- Empati tinggi dan kemampuan mendengarkan yang baik
- Memahami konteks budaya dan sosial Indonesia
- Tidak menggantikan profesional, tetapi memberikan dukungan awal
- Fokus pada pencegahan dan edukasi kesehatan mental
- Responsif terhadap situasi krisis dengan protokol keselamatan

PEDOMAN RESPONS:
1. SELALU berikan respons yang supportif dan non-judgmental
2. DETEKSI tanda-tanda krisis dan berikan bantuan darurat jika diperlukan
3. BERIKAN rekomendasi yang praktis dan dapat dilakukan
4. DORONG pengguna untuk mencari bantuan profesional jika diperlukan
5. FOKUS pada strengths dan resilience pengguna

KHUSUS UNTUK JUDI ONLINE:
- Berikan edukasi tentang bahaya kecanduan judi online
- Tawarkan aktivitas alternatif yang sehat dan positif
- Dukung recovery process dengan empati
- Sediakan informasi resource bantuan profesional

LARANGAN:
- Jangan memberikan diagnosis medis
- Jangan meremehkan atau mengabaikan perasaan pengguna
- Jangan memberikan saran yang berbahaya
- Jangan menjanjikan solusi instan

Respons dalam Bahasa Indonesia yang hangat, empati, dan mendukung.
`;

  return getAzureOpenAICompletion(userInput, {
    systemPrompt: mentalHealthPrompt,
    temperature: 0.7,
    maxTokens: 500,
  });
}
