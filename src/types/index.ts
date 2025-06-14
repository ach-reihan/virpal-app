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
 * Mendefinisikan pengirim pesan dalam chat.
 * Bisa jadi 'user' (pengguna aplikasi) atau 'virpal' (asisten AI).
 */
export type MessageSender = 'user' | 'virpal';

/**
 * Interface untuk objek pesan dalam chat.
 * Setiap pesan akan memiliki struktur ini.
 */
export interface ChatMessage {
  id: string; // ID unik untuk setiap pesan, berguna untuk React key.
  sender: MessageSender; // Siapa pengirim pesan.
  text: string; // Isi teks dari pesan.
  timestamp: Date; // Waktu kapan pesan dikirim atau diterima.
  audioUrl?: string; // Opsional: URL ke file audio TTS untuk pesan dari Virpal.
  isLoading?: boolean; // Opsional: Menandakan apakah pesan ini (dari Virpal) masih dalam proses loading/generating.
}

/**
 * Mendefinisikan kemungkinan ekspresi wajah untuk avatar Virpal.
 * Ini bisa digunakan untuk mengubah tampilan visual avatar.
 */
export type AvatarExpression =
  | 'neutral' // Ekspresi netral atau default.
  | 'happy' // Ekspresi senang atau positif.
  | 'thinking' // Ekspresi sedang berpikir atau memproses.
  | 'sad' // Ekspresi sedih atau prihatin.
  | 'listening' // Ekspresi sedang mendengarkan atau memperhatikan.
  | 'surprised' // Ekspresi kaget atau terkejut (opsional).
  | 'confused'; // Ekspresi bingung (opsional).

/**
 * Opsional: Jika kamu ingin menyimpan state mood pengguna secara eksplisit.
 */
export type UserMood =
  | 'happy'
  | 'sad'
  | 'stressed'
  | 'bored'
  | 'calm'
  | 'neutral'
  | 'other';

/**
 * Opsional: Struktur data untuk histori chat jika kamu ingin mengirimkannya
 * sebagai konteks ke API OpenAI.
 */
export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Opsional: Tipe untuk konfigurasi kepribadian Virpal.
 */
export interface VirpalPersonality {
  id: string;
  name: string; // Nama kepribadian (misal: "Ceria dan Suportif", "Kalem dan Analitis")
  prompt: string; // Prompt sistem untuk OpenAI yang mendefinisikan kepribadian ini.
  avatarExpressions?: {
    // Kustomisasi path gambar avatar untuk kepribadian ini (jika berbeda)
    neutral?: string;
    happy?: string;
    // ... ekspresi lainnya
  };
}

/**
 * Interface untuk menyimpan history chat berdasarkan tanggal
 */
export interface ChatHistory {
  date: string; // Format: YYYY-MM-DD
  messages: ChatMessage[];
  summary?: string; // Ringkasan singkat percakapan
  title?: string;
  userId?: string;
  // For backward compatibility with multi-session support
  sessions?: ChatSession[];
}

/**
 * Interface untuk chat session individual dengan timestamp
 */
export interface ChatSession {
  id: string; // Unique session ID
  date: string; // Format: YYYY-MM-DD
  startTime: string; // ISO timestamp when session started
  endTime?: string; // ISO timestamp when session ended
  messages: ChatMessage[];
  summary?: string; // AI-generated summary
  title?: string; // Session title (auto-generated from first user message)
  userId?: string; // Associated user ID (if authenticated)
}

/**
 * Interface untuk multiple chat sessions dalam satu hari
 */
export interface DayChatHistory {
  date: string; // Format: YYYY-MM-DD
  sessions: ChatSession[];
  totalSessions: number;
}

/**
 * Interface untuk data kalender
 */
export interface CalendarDay {
  date: Date;
  hasHistory: boolean;
  isSelected: boolean;
  isToday: boolean;
}

/**
 * Interface for hybrid storage service health status
 */
export interface StorageHealthStatus {
  localStorageWorking: boolean;
  cosmosDbWorking: boolean;
  lastSyncTime?: string | undefined;
  totalLocalSessions: number;
}

// Kamu bisa menambahkan lebih banyak tipe atau interface di sini
// seiring berkembangnya fitur aplikasi VIRPAL.
// Contoh:
// export interface UserProfile {
//   id: string;
//   name: string;
//   preferredVirpalPersonalityId?: string;
//   // ... preferensi lainnya
// }

// export type SubscriptionTier = 'free' | 'plus' | 'pro';
