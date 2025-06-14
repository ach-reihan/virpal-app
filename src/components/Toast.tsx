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

import React, { useEffect, useState } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastProps {
  /** Pesan yang akan ditampilkan */
  message: string;
  /** Tipe toast yang menentukan warna dan icon */
  type: ToastType;
  /** Durasi dalam milliseconds sebelum auto-dismiss */
  duration?: number;
  /** Callback saat toast ditutup */
  onClose: () => void;
  /** Apakah toast dapat ditutup manual */
  dismissible?: boolean;
  /** ID unik untuk toast */
  id?: string;
  /** Position dari toast */
  position?:
    | 'top-right'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'bottom-center';
}

/**
 * Konfigurasi warna dan icon untuk setiap tipe toast
 */
const toastConfig = {
  info: {
    backgroundColor: 'var(--virpal-accent)',
    borderColor: 'var(--virpal-primary)',
    textColor: 'var(--virpal-primary)',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  success: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'var(--virpal-success)',
    textColor: 'var(--virpal-success)',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  warning: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'var(--virpal-warning)',
    textColor: 'var(--virpal-warning)',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  error: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'var(--virpal-danger)',
    textColor: 'var(--virpal-danger)',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
};

/**
 * Posisi styling untuk toast
 */
const positionClasses = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2',
};

/**
 * Toast Component
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  type,
  duration = 5000,
  onClose,
  dismissible = true,
  id,
  position = 'top-center',
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  const config = toastConfig[type];
  // Auto-dismiss functionality
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }

    // Return empty cleanup function when duration <= 0
    return () => {};
  }, [duration]);

  // Handle close dengan animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300); // Duration untuk exit animation
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`
        fixed z-[9999] max-w-sm w-full pointer-events-auto
        ${positionClasses[position]}
        ${isClosing ? 'animate-toast-exit' : 'animate-toast-enter'}
      `}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      id={id}
    >
      <div
        className="rounded-lg p-4 border shadow-lg backdrop-blur-sm theme-transition"
        style={{
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          color: config.textColor,
        }}
      >
        <div className="flex items-start">
          {/* Icon */}
          <div className="flex-shrink-0" style={{ color: config.textColor }}>
            {config.icon}
          </div>

          {/* Message */}
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium leading-5">{message}</p>
          </div>

          {/* Close button */}
          {dismissible && (
            <div className="ml-4 flex-shrink-0">
              <button
                onClick={handleClose}
                className="inline-flex rounded-md focus:outline-none focus:ring-2 transition-colors theme-transition"
                style={{
                  color: config.textColor,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.7';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                aria-label="Tutup notification"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Toast container untuk menampung multiple toasts
 */
interface ToastContainerProps {
  toasts: Array<{
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    dismissible?: boolean;
  }>;
  onRemoveToast: (id: string) => void;
  position?:
    | 'top-right'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'bottom-center';
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onRemoveToast,
  position = 'top-center',
}) => {
  return (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration || 5000}
          dismissible={toast.dismissible ?? true}
          onClose={() => onRemoveToast(toast.id)}
          position={position}
        />
      ))}
    </>
  );
};

export default Toast;
