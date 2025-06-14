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
 * Guest Limit Service
 *
 * Mengelola batasan untuk pengguna yang belum login (guest users)
 * - Maksimal 5 pesan chat
 * - Tidak ada akses TTS
 */

import { logger } from '../utils/logger';

interface GuestLimits {
  maxChatMessages: number;
  currentChatCount: number;
  firstChatTimestamp: number | null;
  canUseTTS: boolean;
}

class GuestLimitService {
  private readonly STORAGE_KEY = 'virpal_guest_limits';
  private readonly MAX_CHAT_MESSAGES = 5;
  private readonly RESET_PERIOD = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  /**
   * Mendapatkan status limits guest saat ini
   */
  getGuestLimits(): GuestLimits {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return this.createDefaultLimits();
      }

      const limits: GuestLimits = JSON.parse(stored);

      // Reset jika sudah lebih dari 24 jam
      if (
        limits.firstChatTimestamp &&
        Date.now() - limits.firstChatTimestamp > this.RESET_PERIOD
      ) {
        logger.info('Guest limits reset after 24 hours');
        return this.createDefaultLimits();
      }

      return limits;
    } catch (error) {
      logger.error('Error reading guest limits from storage', error);
      return this.createDefaultLimits();
    }
  }

  /**
   * Membuat default limits untuk guest
   */
  private createDefaultLimits(): GuestLimits {
    const limits: GuestLimits = {
      maxChatMessages: this.MAX_CHAT_MESSAGES,
      currentChatCount: 0,
      firstChatTimestamp: null,
      canUseTTS: false,
    };

    this.saveLimits(limits);
    return limits;
  }

  /**
   * Menyimpan limits ke localStorage
   */
  private saveLimits(limits: GuestLimits): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(limits));
    } catch (error) {
      logger.error('Error saving guest limits to storage', error);
    }
  }

  /**
   * Cek apakah guest masih bisa mengirim chat
   */
  canSendMessage(): boolean {
    const limits = this.getGuestLimits();
    return limits.currentChatCount < limits.maxChatMessages;
  }

  /**
   * Increment jumlah pesan yang sudah dikirim guest
   */
  incrementMessageCount(): void {
    const limits = this.getGuestLimits();

    // Set timestamp pertama kali chat jika belum ada
    if (limits.firstChatTimestamp === null) {
      limits.firstChatTimestamp = Date.now();
    }

    limits.currentChatCount++;
    this.saveLimits(limits);

    logger.info(
      `Guest message count incremented to ${limits.currentChatCount}/${limits.maxChatMessages}`
    );
  }

  /**
   * Mendapatkan sisa pesan yang bisa dikirim
   */
  getRemainingMessages(): number {
    const limits = this.getGuestLimits();
    return Math.max(0, limits.maxChatMessages - limits.currentChatCount);
  }

  /**
   * Cek apakah guest bisa menggunakan TTS (selalu false)
   */
  canUseTTS(): boolean {
    return false;
  }

  /**
   * Reset limits (untuk testing atau admin purposes)
   */
  resetLimits(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    logger.info('Guest limits reset');
  }

  /**
   * Mendapatkan pesan informasi untuk guest tentang batasan
   */
  getLimitMessage(): string {
    const remaining = this.getRemainingMessages();

    if (remaining > 0) {
      return `Anda memiliki ${remaining} pesan tersisa. Login untuk chat tanpa batas dan menggunakan fitur Text-to-Speech.`;
    } else {
      return 'Anda telah mencapai batas 5 pesan untuk hari ini. Silakan login untuk melanjutkan chat dan menggunakan semua fitur.';
    }
  }

  /**
   * Mendapatkan pesan warning ketika mendekati limit
   */
  getWarningMessage(): string | null {
    const remaining = this.getRemainingMessages();

    if (remaining === 2) {
      return 'Anda memiliki 2 pesan tersisa. Pertimbangkan untuk login agar bisa chat tanpa batas.';
    } else if (remaining === 1) {
      return 'Ini adalah pesan terakhir Anda hari ini. Login untuk melanjutkan chat.';
    }

    return null;
  }
}

// Export singleton instance
export const guestLimitService = new GuestLimitService();
export default guestLimitService;
