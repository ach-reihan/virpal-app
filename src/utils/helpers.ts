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

import type { AvatarExpression, ChatMessage } from '../types';
import { ERROR_MESSAGE } from './constants';

// Helper function untuk mendapatkan URL avatar berdasarkan expression
export const getAvatarImageUrl = (expression: AvatarExpression): string => {
  const imageMap = new Map<AvatarExpression, string>([
    ['happy', '/images/avatar-happy.png'],
    ['thinking', '/images/avatar-thinking.png'],
    ['sad', '/images/avatar-sad.png'],
    ['listening', '/images/avatar-listening.png'],
    ['neutral', '/images/avatar-neutral.png'],
    ['surprised', '/images/avatar-surprised.png'],
    ['confused', '/images/avatar-confused.png'],
  ]);

  return (
    imageMap.get(expression) ||
    imageMap.get('neutral') ||
    '/images/avatar-neutral.png'
  );
};

// Helper function untuk menentukan ekspresi berdasarkan respons AI
export const determineExpressionFromResponse = (
  responseText: string
): AvatarExpression => {
  if (responseText.includes('prihatin') || responseText.includes('sedih')) {
    return 'sad';
  } else if (
    responseText.includes('bantu') ||
    responseText.includes('mendengar')
  ) {
    return 'listening';
  }
  return 'neutral';
};

// Factory function untuk membuat user message
export const createUserMessage = (messageText: string): ChatMessage => ({
  id: `user-${Date.now()}`,
  sender: 'user',
  text: messageText,
  timestamp: new Date(),
});

// Factory function untuk membuat virpal message
export const createVirpalMessage = (text: string): ChatMessage => ({
  id: `virpal-${Date.now()}`,
  sender: 'virpal',
  text,
  timestamp: new Date(),
});

// Factory function untuk membuat error message
export const createErrorMessage = (): ChatMessage => ({
  id: `error-${Date.now()}`,
  sender: 'virpal',
  text: ERROR_MESSAGE,
  timestamp: new Date(),
});
