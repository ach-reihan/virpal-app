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

import { getDirectOpenAICompletion } from '../services/azureOpenAIDirect';
import { playSmartTTS } from '../services/azureSpeechService';
import type { AvatarExpression, ChatMessage } from '../types';
import { SYSTEM_PROMPT } from './constants';
import {
  createErrorMessage,
  createUserMessage,
  createVirpalMessage,
  determineExpressionFromResponse,
} from './helpers';
import { logger } from './logger';

// Interface untuk callback functions
interface MessageHandlerCallbacks {
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setIsVirpalTyping: React.Dispatch<React.SetStateAction<boolean>>;
  setVirpalExpression: React.Dispatch<React.SetStateAction<AvatarExpression>>;
  enableTTS?: boolean; // Optional TTS support
}

// Handler untuk menangani pengiriman pesan user
export const handleUserSendMessage = async (
  messageText: string,
  messages: ChatMessage[],
  callbacks: MessageHandlerCallbacks
) => {
  const {
    setMessages,
    setIsVirpalTyping,
    setVirpalExpression,
    enableTTS = false,
  } = callbacks;

  const newUserMessage = createUserMessage(messageText);

  setMessages((prev) => [...prev, newUserMessage]);

  setIsVirpalTyping(true);
  setVirpalExpression('thinking');

  try {
    const aiResponseText = await getDirectOpenAICompletion(messageText, {
      systemPrompt: SYSTEM_PROMPT,
      messageHistory: messages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
    });
    const virpalResponseMessage = createVirpalMessage(aiResponseText);

    setMessages((prev) => [...prev, virpalResponseMessage]);
    setVirpalExpression(determineExpressionFromResponse(aiResponseText));

    // Enhanced logging for TTS debugging
    logger.info('🎤 TTS Status Check', {
      enableTTS,
      responseLength: aiResponseText.length,
      firstWords: aiResponseText.substring(0, 50),
    });

    // Play TTS if enabled with smart voice adaptation
    if (enableTTS) {
      try {
        logger.info('🎵 Starting Smart TTS playback...');
        await playSmartTTS(aiResponseText);
        logger.info('✅ Smart TTS completed successfully');
      } catch (ttsError) {
        // TTS failure shouldn't break the chat experience
        logger.error('❌ Smart TTS failed', ttsError);
      }
    } else {
      logger.info('🔇 TTS disabled - not playing audio');
    }
  } catch (error) {
    const errorMessage = createErrorMessage();
    setMessages((prev) => [...prev, errorMessage]);
    setVirpalExpression('sad');
    logger.error('Error in handleUserSendMessage', error);
  } finally {
    setIsVirpalTyping(false);
  }
};
