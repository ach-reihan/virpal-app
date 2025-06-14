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
 * Date Utility Functions for VIRPAL App
 *
 * Centralized date formatting and manipulation utilities
 * following best practices for consistency and maintainability
 */

/**
 * Format date to string in YYYY-MM-DD format using local timezone
 *
 * @param date - The date to format
 * @returns Formatted date string in YYYY-MM-DD format
 *
 * @example
 * ```typescript
 * const today = new Date();
 * const dateString = formatDateToString(today); // "2025-06-10"
 * ```
 */
export const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * Parse date string in YYYY-MM-DD format to Date object
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object or null if invalid format
 *
 * @example
 * ```typescript
 * const date = parseStringToDate("2025-06-10");
 * ```
 */
export const parseStringToDate = (dateString: string): Date | null => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) {
    return null;
  }

  const date = new Date(dateString + 'T00:00:00');
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Get today's date as a formatted string
 *
 * @returns Today's date in YYYY-MM-DD format
 */
export const getTodayString = (): string => {
  return formatDateToString(new Date());
};

/**
 * Check if a date string represents today
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns True if the date string represents today
 */
export const isToday = (dateString: string): boolean => {
  return dateString === getTodayString();
};

/**
 * Get relative date description (Today, Yesterday, date)
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Human-readable date description
 *
 * @example
 * ```typescript
 * const description = getRelativeDateDescription("2025-06-10"); // "Hari ini"
 * ```
 */
export const getRelativeDateDescription = (dateString: string): string => {
  const today = getTodayString();
  const yesterday = formatDateToString(
    new Date(Date.now() - 24 * 60 * 60 * 1000)
  );

  if (dateString === today) {
    return 'Hari ini';
  } else if (dateString === yesterday) {
    return 'Kemarin';
  } else {
    const date = parseStringToDate(dateString);
    if (date) {
      return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    return dateString;
  }
};
