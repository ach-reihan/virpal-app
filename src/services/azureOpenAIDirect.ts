/**
 * VirPal App - Direct Azure OpenAI Service
 * Copyright (c) 2025 Achmad Reihan Alfaiz. All rights reserved.
 *
 * Direct access to Azure OpenAI Service untuk hackathon
 * Menggantikan Azure Functions dengan akses langsung menggunakan hardcoded credentials
 */

import { getEnvironmentCredentials } from '../config/credentials';
import type { OpenAIChatMessage } from '../types';
import { logger } from '../utils/logger';

interface DirectOpenAIOptions {
  systemPrompt?: string;
  messageHistory?: OpenAIChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Direct Azure OpenAI API call tanpa melalui Azure Functions
 * Menggunakan hardcoded credentials untuk hackathon
 */
export async function getDirectOpenAICompletion(
  userInput: string,
  options: DirectOpenAIOptions = {}
): Promise<string> {
  try {
    // Get credentials dari environment
    const credentials = getEnvironmentCredentials();
    if (!credentials.openAI?.endpoint || !credentials.openAI?.apiKey) {
      logger.warn('Azure OpenAI credentials tidak tersedia');
      // Fallback response untuk demo
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return `Maaf, layanan AI sedang tidak tersedia. Kamu bilang: "${userInput}"`;
    }

    // Build messages array
    const messages: OpenAIChatMessage[] = [];

    // Add system prompt
    if (options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    // Add conversation history (limit untuk performance)
    if (options.messageHistory && options.messageHistory.length > 0) {
      const limitedHistory = options.messageHistory.slice(-8); // Keep last 8 messages
      messages.push(...limitedHistory);
    }

    // Add current user input
    messages.push({
      role: 'user',
      content: userInput.trim(),
    });

    // Build request URL
    const endpoint = credentials.openAI.endpoint;
    const deploymentName = credentials.openAI.deploymentName || 'gpt-4o-mini';
    const apiVersion = credentials.openAI.apiVersion || '2024-10-01-preview';

    const requestUrl = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

    logger.debug('Making direct OpenAI request', {
      endpoint: endpoint.substring(0, 50) + '...',
      deploymentName,
      messagesCount: messages.length,
    });

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': credentials.openAI.apiKey,
        'User-Agent': 'VirPal-Hackathon/1.0',
      },
      body: JSON.stringify({
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 500,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Azure OpenAI API error', {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 200),
      });

      // User-friendly error messages
      if (response.status === 401) {
        return 'Maaf, ada masalah dengan konfigurasi AI. Coba lagi nanti ya.';
      } else if (response.status === 429) {
        return 'Ups, terlalu banyak permintaan sekaligus. Tunggu sebentar dan coba lagi.';
      } else {
        return 'Maaf, layanan AI sedang bermasalah. Coba lagi dalam beberapa menit ya.';
      }
    }

    const data: OpenAIResponse = await response.json();
    if (
      data.choices &&
      data.choices.length > 0 &&
      data.choices[0]?.message?.content
    ) {
      const aiResponse = data.choices[0].message.content.trim();
      logger.debug('Direct OpenAI response received', {
        responseLength: aiResponse.length,
      });
      return aiResponse;
    } else {
      logger.error('Invalid response structure from Azure OpenAI');
      return 'Maaf, aku tidak bisa memberikan respons yang tepat saat ini. Coba kirim pesan lagi ya.';
    }
  } catch (error) {
    logger.error('Direct OpenAI request failed', error);

    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        return 'Maaf, aku tidak bisa terhubung ke server AI. Pastikan koneksi internetmu stabil ya.';
      } else if (error.message.includes('timeout')) {
        return 'Respons AI membutuhkan waktu lebih lama. Coba kirim pesan lagi ya.';
      }
    }

    return 'Ups, ada masalah kecil di sistemku. Coba kirim pesan lagi dalam beberapa detik ya.';
  }
}

/**
 * Mental Health Chat Completion untuk hackathon
 * Menggunakan system prompt khusus mental health
 */
export async function getDirectMentalHealthCompletion(
  userInput: string,
  mentalHealthContext?: {
    currentMood?: string;
    riskLevel?: string;
  }
): Promise<string> {
  const mentalHealthPrompt = `
Anda adalah VirPal, asisten AI untuk kesehatan mental yang dikembangkan untuk elevAIte with Dicoding Hackathon 2025.

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
    ? `- Tingkat risiko: ${mentalHealthContext.riskLevel}`
    : ''
}

KARAKTERISTIK ANDA:
- Empati tinggi dan kemampuan mendengarkan yang baik
- Memberikan dukungan tanpa menghakimi
- Fokus pada solusi praktis dan gaya hidup sehat
- Menggunakan bahasa Indonesia yang hangat dan mudah dipahami

BATASAN PENTING:
- Jangan berikan diagnosis medis
- Jangan menggantikan konsultasi dengan profesional kesehatan mental
- Selalu sarankan bantuan profesional untuk kasus serius
- Jangan memberikan saran yang berbahaya

Respons dalam Bahasa Indonesia yang hangat, empati, dan mendukung. Maksimal 3 paragraf.
`;

  return getDirectOpenAICompletion(userInput, {
    systemPrompt: mentalHealthPrompt,
    temperature: 0.7,
    maxTokens: 500,
  });
}
