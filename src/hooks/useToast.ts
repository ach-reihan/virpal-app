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
 * useToast Hook - Custom hook untuk mengelola toast notifications
 *
 * Hook untuk mengelola state dan lifecycle dari toast notifications
 * Menyediakan API yang mudah digunakan untuk menampilkan berbagai jenis pesan
 *
 * Features:
 * - Multiple toast types (info, success, warning, error)
 * - Auto-dismiss dengan timeout konfigurabel
 * - Manual dismiss
 * - Queue management untuk multiple toasts
 * - Memory leak prevention
 *
 * Best Practices Applied:
 * - React hooks best practices
 * - Memory management
 * - Type safety
 * - Error boundary integration
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastType } from '../components/Toast';

interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  dismissible?: boolean;
}

interface UseToastOptions {
  /** Maksimum jumlah toast yang dapat ditampilkan bersamaan */
  maxToasts?: number;
  /** Default duration untuk auto-dismiss */
  defaultDuration?: number;
  /** Default dismissible setting */
  defaultDismissible?: boolean;
}

interface UseToastReturn {
  /** Array dari semua toast yang aktif */
  toasts: ToastData[];
  /** Menampilkan toast dengan pesan dan tipe tertentu */
  showToast: (
    message: string,
    type: ToastType,
    options?: Partial<Pick<ToastData, 'duration' | 'dismissible'>>
  ) => string;
  /** Menampilkan toast info */
  showInfo: (
    message: string,
    options?: Partial<Pick<ToastData, 'duration' | 'dismissible'>>
  ) => string;
  /** Menampilkan toast success */
  showSuccess: (
    message: string,
    options?: Partial<Pick<ToastData, 'duration' | 'dismissible'>>
  ) => string;
  /** Menampilkan toast warning */
  showWarning: (
    message: string,
    options?: Partial<Pick<ToastData, 'duration' | 'dismissible'>>
  ) => string;
  /** Menampilkan toast error */
  showError: (
    message: string,
    options?: Partial<Pick<ToastData, 'duration' | 'dismissible'>>
  ) => string;
  /** Menghapus toast berdasarkan ID */
  removeToast: (id: string) => void;
  /** Menghapus semua toast */
  clearToasts: () => void;
}

/**
 * Generate unique ID untuk toast
 */
const generateToastId = (): string => {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * useToast Hook
 */
export const useToast = (options: UseToastOptions = {}): UseToastReturn => {
  const {
    maxToasts = 5,
    defaultDuration = 5000,
    defaultDismissible = true,
  } = options;

  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toastCounterRef = useRef(0);

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      setToasts([]);
    };
  }, []);
  /**
   * Menambahkan toast baru
   */
  const addToast = useCallback(
    (toastData: Omit<ToastData, 'id'>): string => {
      const id = generateToastId();
      const newToast: ToastData = {
        id,
        duration: defaultDuration,
        dismissible: defaultDismissible,
        ...toastData,
      };

      setToasts((prevToasts) => {
        // Jika sudah mencapai maksimum, hapus toast yang paling lama
        const updatedToasts =
          prevToasts.length >= maxToasts ? prevToasts.slice(1) : prevToasts;

        return [...updatedToasts, newToast];
      });

      toastCounterRef.current += 1;
      return id;
    },
    [maxToasts, defaultDuration, defaultDismissible]
  );

  /**
   * Menghapus toast berdasarkan ID
   */
  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Menghapus semua toast
   */
  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);
  /**
   * Menampilkan toast generic
   */
  const showToast = useCallback(
    (
      message: string,
      type: ToastType,
      options?: Partial<Pick<ToastData, 'duration' | 'dismissible'>>
    ): string => {
      return addToast({
        message,
        type,
        ...options,
      });
    },
    [addToast]
  );

  /**
   * Menampilkan toast info
   */
  const showInfo = useCallback(
    (
      message: string,
      options?: Partial<Pick<ToastData, 'duration' | 'dismissible'>>
    ): string => {
      return showToast(message, 'info', options);
    },
    [showToast]
  );

  /**
   * Menampilkan toast success
   */
  const showSuccess = useCallback(
    (
      message: string,
      options?: Partial<Pick<ToastData, 'duration' | 'dismissible'>>
    ): string => {
      return showToast(message, 'success', options);
    },
    [showToast]
  );

  /**
   * Menampilkan toast warning
   */
  const showWarning = useCallback(
    (
      message: string,
      options?: Partial<Pick<ToastData, 'duration' | 'dismissible'>>
    ): string => {
      return showToast(message, 'warning', options);
    },
    [showToast]
  );
  /**
   * Menampilkan toast error
   */
  const showError = useCallback(
    (
      message: string,
      options?: Partial<Pick<ToastData, 'duration' | 'dismissible'>>
    ): string => {
      return showToast(message, 'error', options);
    },
    [showToast]
  );

  return {
    toasts,
    showToast,
    showInfo,
    showSuccess,
    showWarning,
    showError,
    removeToast,
    clearToasts,
  };
};

export default useToast;
