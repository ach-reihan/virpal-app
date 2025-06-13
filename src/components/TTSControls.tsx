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

import React from 'react';
import { unlockAudioContext } from '../services/azureSpeechService';
import { logger } from '../utils/logger';

interface TTSControlsProps {
  isInitialized: boolean;
  isEnabled: boolean;
  isSpeaking: boolean;
  initializationError: string | null;
  onToggleTTS: () => void;
  onStopSpeaking: () => void;
  onInitialize?: () => Promise<void>;
  className?: string;
  isAuthenticated?: boolean;
  onLoginClick?: () => void;
}

const TTSControls: React.FC<TTSControlsProps> = ({
  isInitialized,
  isEnabled,
  isSpeaking,
  initializationError,
  onToggleTTS,
  onStopSpeaking,
  onInitialize,
  className = '',
  isAuthenticated = false,
  onLoginClick,
}) => {
  // Icons using emoji for simplicity (can be replaced with icon library)
  const getSpeakerIcon = () => {
    if (isSpeaking) return '🔊';
    if (isEnabled) return '🔉';
    return '🔇';
  };
  const getStatusColor = () => {
    if (initializationError) return 'text-red-500';
    if (isSpeaking) return 'text-blue-500 animate-pulse';
    if (isEnabled && isInitialized) return 'text-green-500';
    if (!isAuthenticated) return 'text-yellow-500';
    return 'text-gray-400';
  };

  const getStatusText = () => {
    if (!isAuthenticated) return 'Login required';
    if (initializationError) return 'Error';
    if (!isInitialized) return 'Initializing...';
    if (isSpeaking) return 'Speaking';
    if (isEnabled) return 'Ready';
    return 'Disabled';
  };
  const getTooltipText = () => {
    if (!isAuthenticated)
      return 'TTS hanya tersedia untuk pengguna yang sudah login';
    if (initializationError) return `TTS Error: ${initializationError}`;
    if (!isInitialized) return 'TTS not initialized';
    if (isSpeaking) return 'Currently speaking - click to stop';
    if (isEnabled) return 'TTS enabled - click to disable';
    return 'TTS disabled - click to enable';
  };
  const handleClick = () => {
    // Unlock audio context on user interaction to handle browser autoplay policies
    unlockAudioContext();

    if (!isAuthenticated) {
      if (onLoginClick) {
        onLoginClick();
      }
      return;
    }

    if (isSpeaking) {
      onStopSpeaking();
    } else {
      onToggleTTS();
    }
  };
  const handleRetryInit = async () => {
    // Unlock audio context on user interaction
    unlockAudioContext();

    if (onInitialize) {
      try {
        await onInitialize();
      } catch (error) {
        logger.error('Manual TTS initialization failed', error);
      }
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Main TTS Control Button */}{' '}
      <button
        onClick={handleClick}
        disabled={(!isInitialized && !initializationError) || !isAuthenticated}
        className={`
          flex items-center justify-center
          w-10 h-10 rounded-full
          transition-all duration-200
          ${getStatusColor()}
          ${
            (isInitialized || initializationError) && isAuthenticated
              ? 'hover:bg-gray-100 active:scale-95 cursor-pointer'
              : 'cursor-not-allowed opacity-50'
          }
          ${isSpeaking ? 'animate-pulse' : ''}
          ${!isAuthenticated ? 'border-2 border-orange-300' : ''}
        `}
        title={getTooltipText()}
        aria-label={getTooltipText()}
      >
        <span className="text-xl">{getSpeakerIcon()}</span>
      </button>{' '}
      {/* Status Indicator */}
      <div className="flex flex-col">
        {' '}
        <span className={`text-xs font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
        {/* Voice info when speaking */}
        {isSpeaking && (
          <span className="text-xs text-gray-500">Brian Neural</span>
        )}
      </div>
      {/* Retry button for initialization errors */}
      {initializationError && onInitialize && (
        <button
          onClick={handleRetryInit}
          className="
            flex items-center justify-center
            w-8 h-8 rounded-full
            bg-gray-100 hover:bg-gray-200
            text-gray-600 hover:text-gray-800
            transition-colors duration-200
            text-sm
          "
          title="Retry TTS initialization"
          aria-label="Retry TTS initialization"
        >
          🔄
        </button>
      )}{' '}
      {/* Azure Speech indicator - only show when authenticated */}
      {isAuthenticated && isInitialized && !initializationError && (
        <div className="flex items-center">
          <span className="text-xs text-blue-600 font-medium">Azure</span>
        </div>
      )}
    </div>
  );
};

export default TTSControls;
