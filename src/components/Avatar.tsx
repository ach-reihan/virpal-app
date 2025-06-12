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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AvatarExpression } from '../types';

interface AvatarProps {
  /** Ekspresi wajah avatar yang akan menentukan gambar yang ditampilkan */
  expression?: AvatarExpression;
  /** URL gambar custom yang akan mengganti gambar default */
  imageUrl?: string;
  /** Teks alternatif untuk accessibility */
  altText?: string;
  /** Ukuran avatar */
  size?: 'small' | 'medium' | 'large';
  /** Custom className untuk styling tambahan */
  className?: string;
}

// Konstanta untuk konfigurasi avatar - menghindari object injection
const AVATAR_SIZES = {
  small: 'w-16 h-16',
  medium: 'w-20 h-20 md:w-24 md:h-24',
  large: 'w-28 h-28 md:w-32 md:h-32',
} as const;

const EXPRESSION_IMAGE_MAP: Record<AvatarExpression, string> = {
  happy: '/images/avatar-happy.png',
  thinking: '/images/avatar-thinking.png',
  sad: '/images/avatar-sad.png',
  listening: '/images/avatar-listening.png',
  surprised: '/images/avatar-neutral.png', // Fallback ke neutral
  confused: '/images/avatar-thinking.png', // Fallback ke thinking
  neutral: '/images/avatar-neutral.png',
};

const FALLBACK_IMAGE = '/images/avatar-neutral.png';

/**
 * Avatar component untuk menampilkan gambar avatar dengan berbagai ekspresi.
 * Menggunakan fallback system yang robust untuk error handling.
 *
 * Features:
 * - Type-safe size configuration
 * - Graceful error handling dengan multiple fallbacks
 * - Optimized performance dengan React.memo
 * - Accessibility compliant
 * - Responsive design
 */
const Avatar: React.FC<AvatarProps> = ({
  expression = 'neutral',
  imageUrl,
  altText = 'Virpal Avatar',
  size = 'medium',
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);
  const [showTextFallback, setShowTextFallback] = useState(false);

  // Safe size class selection dengan explicit type checking
  const sizeClasses = useMemo(() => {
    const validSize = size in AVATAR_SIZES ? size : 'medium';
    return AVATAR_SIZES[validSize as keyof typeof AVATAR_SIZES];
  }, [size]);
  // Safe expression mapping dengan fallback
  const getImageUrl = useCallback((expr: AvatarExpression): string => {
    // Type-safe access dengan explicit checking
    if (expr in EXPRESSION_IMAGE_MAP) {
      return EXPRESSION_IMAGE_MAP[expr as keyof typeof EXPRESSION_IMAGE_MAP];
    }
    return FALLBACK_IMAGE;
  }, []);

  // Mendapatkan URL gambar yang akan digunakan
  const currentImageUrl = useMemo(() => {
    // Validasi custom imageUrl
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
      return imageUrl.trim();
    }

    // Jika ada error, gunakan fallback
    if (hasError) {
      return FALLBACK_IMAGE;
    }

    // Gunakan gambar berdasarkan expression
    return getImageUrl(expression);
  }, [imageUrl, expression, hasError, getImageUrl]);

  // Error handler dengan progressive fallback
  const handleImageError = useCallback(() => {
    if (!hasError) {
      // Pertama kali error, coba gambar fallback
      setHasError(true);
    } else {
      // Jika fallback juga gagal, tampilkan text fallback
      setShowTextFallback(true);
    }
  }, [hasError]);

  // Reset state ketika props berubah
  useEffect(() => {
    setHasError(false);
    setShowTextFallback(false);
  }, [expression, imageUrl]);
  // Optimized container classes
  const containerClasses = useMemo(() => {
    const baseClasses = `${sizeClasses} rounded-full border-4 shadow-lg flex items-center justify-center`;
    return className ? `${baseClasses} ${className}` : baseClasses;
  }, [sizeClasses, className]);

  // CSS custom properties dengan VirPal theme-aware colors
  const borderStyle = useMemo(
    () => ({
      borderColor: 'var(--virpal-primary)',
    }),
    []
  );

  // Background style untuk fallback text yang theme-aware
  const fallbackBgStyle = useMemo(
    () => ({
      backgroundColor: 'var(--virpal-accent)',
      color: 'var(--virpal-primary)',
    }),
    []
  );

  // Container background style yang theme-aware
  const containerBgStyle = useMemo(
    () => ({
      backgroundColor: 'var(--virpal-content-bg)',
    }),
    []
  );

  // Text fallback ketika semua gambar gagal
  if (showTextFallback) {
    return (
      <div
        className={`${containerClasses} theme-transition`}
        style={{
          ...borderStyle,
          ...fallbackBgStyle,
        }}
        role="img"
        aria-label={altText}
        title="Avatar tidak dapat dimuat"
      >
        <span className="text-xs font-bold uppercase select-none theme-transition">
          {expression.slice(0, 3)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`${containerClasses} overflow-hidden theme-transition`}
      style={{ ...borderStyle, ...containerBgStyle }}
      title={altText}
    >
      <img
        src={currentImageUrl}
        alt={altText}
        className="w-full h-full object-cover transition-opacity duration-300 hover:opacity-90"
        onError={handleImageError}
        onLoad={() => {
          // Reset error state ketika gambar berhasil dimuat
          if (hasError) {
            setHasError(false);
          }
        }}
        loading="lazy"
        draggable={false}
        role="img"
        // Performance optimization
        decoding="async"
      />
    </div>
  );
};

// Memoize component untuk optimisasi performance
export default React.memo(Avatar);
