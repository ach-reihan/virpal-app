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

import React, { useState } from 'react';
import { unlockAudioContext } from '../services/azureSpeechService';
import { guestLimitService } from '../services/guestLimitService';

interface UserInputProps {
  onSendMessage: (messageText: string) => void;
  isSending?: boolean;
  onButtonClick?: (buttonType: 'todo' | 'help') => void;
  isAuthenticated?: boolean;
  onLoginClick?: () => void;
}

const UserInput: React.FC<UserInputProps> = ({
  onSendMessage,
  isSending = false,
  onButtonClick,
  isAuthenticated = false,
  onLoginClick,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedMode, setSelectedMode] = useState<'default' | 'todo' | 'help'>(
    'default'
  );

  // Guest limitations
  const canSendMessage = isAuthenticated || guestLimitService.canSendMessage();
  const remainingMessages = isAuthenticated
    ? null
    : guestLimitService.getRemainingMessages();
  const warningMessage = isAuthenticated
    ? null
    : guestLimitService.getWarningMessage();
  const getPlaceholder = () => {
    if (!canSendMessage) {
      return 'Anda telah mencapai batas 5 pesan. Login untuk melanjutkan...';
    }

    switch (selectedMode) {
      case 'todo':
        return 'Ceritakan aktivitas atau tugas yang ingin kamu buat to-do list...';
      case 'help':
        return 'Ceritakan pekerjaan atau masalah yang membutuhkan bantuan...';
      default:
        return 'Ketik pesanmu di sini...';
    }
  };
  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    // Unlock audio context on user interaction to enable TTS playback
    unlockAudioContext();

    // Check guest limitations
    if (!canSendMessage) {
      if (onLoginClick) {
        onLoginClick();
      }
      return;
    }

    onSendMessage(inputText.trim());
    setInputText('');
    setSelectedMode('default'); // Reset to default after sending
  };
  const handleButtonClick = (buttonType: 'todo' | 'help') => {
    // Toggle mode: if same button clicked, deselect it
    if (selectedMode === buttonType) {
      setSelectedMode('default');
    } else {
      setSelectedMode(buttonType);
    }

    if (onButtonClick) {
      onButtonClick(buttonType);
    }
  };
  return (
    <div>
      {/* Guest notification bar */}
      {!isAuthenticated && (
        <div
          className="mb-2 p-3 rounded-lg border"
          style={{
            backgroundColor:
              remainingMessages === 0
                ? 'var(--virpal-error-bg)'
                : 'var(--virpal-warning-bg)',
            borderColor:
              remainingMessages === 0
                ? 'var(--virpal-error)'
                : 'var(--virpal-warning)',
            color:
              remainingMessages === 0
                ? 'var(--virpal-error)'
                : 'var(--virpal-warning-text)',
          }}
        >
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {remainingMessages === 0 ? '🚫' : '⚠️'}
              </span>
              <span>
                {remainingMessages === 0
                  ? 'Batas 5 pesan tercapai! Login untuk melanjutkan chat.'
                  : `${remainingMessages} pesan tersisa hari ini.`}
              </span>
            </div>
            <button
              onClick={onLoginClick}
              className="px-3 py-1 text-xs font-medium rounded border transition-colors"
              style={{
                backgroundColor: 'var(--virpal-primary)',
                color: 'white',
                borderColor: 'var(--virpal-primary)',
              }}
            >
              Login
            </button>
          </div>
          {warningMessage && (
            <div className="mt-1 text-xs opacity-80">{warningMessage}</div>
          )}
        </div>
      )}

      <div
        className="relative rounded-2xl shadow-xl border border-[var(--virpal-primary_opacity_30,rgba(121,80,242,0.3))] theme-transition"
        style={{ backgroundColor: 'var(--virpal-content-bg)' }}
      >
        {/* Input area with all buttons inside */}
        <form onSubmit={handleSubmit} className="relative p-3 theme-transition">
          {' '}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={getPlaceholder()}
            disabled={isSending}
            rows={3}
            className="w-full resize-none border-0 focus:outline-none focus:ring-0 bg-transparent text-sm pb-10 theme-transition"
            style={{ color: 'var(--virpal-neutral-default)' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === 'Escape') {
                setSelectedMode('default');
              }
            }}
            onFocus={() => {
              // Keep the selected mode when focusing
            }}
          />
          {/* Buttons container inside textarea - positioned at bottom */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between theme-transition">
            {' '}
            {/* Left side buttons */}
            <div className="flex gap-2 theme-transition">
              {' '}
              <button
                type="button"
                onClick={() => handleButtonClick('todo')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium shadow-sm transition-all duration-200 cursor-pointer theme-transition ${
                  selectedMode === 'todo'
                    ? 'text-white border'
                    : 'bg-white border border-gray-200'
                }`}
                style={{
                  backgroundColor:
                    selectedMode === 'todo'
                      ? 'var(--virpal-primary)'
                      : 'var(--virpal-content-bg)',
                  borderColor:
                    selectedMode === 'todo'
                      ? 'var(--virpal-primary)'
                      : 'var(--virpal-neutral-lighter)',
                  color:
                    selectedMode === 'todo'
                      ? 'white'
                      : 'var(--virpal-neutral-default)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.cursor = 'pointer';
                  if (selectedMode !== 'todo') {
                    e.currentTarget.style.backgroundColor =
                      'var(--virpal-accent-hover)';
                    e.currentTarget.style.color =
                      'var(--virpal-neutral-default)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedMode !== 'todo') {
                    e.currentTarget.style.backgroundColor =
                      'var(--virpal-content-bg)';
                    e.currentTarget.style.color =
                      'var(--virpal-neutral-default)';
                  }
                }}
                onMouseDown={(e) => {
                  if (selectedMode !== 'todo') {
                    e.currentTarget.style.backgroundColor =
                      'var(--virpal-accent-active)';
                  }
                }}
                onMouseUp={(e) => {
                  if (selectedMode !== 'todo') {
                    e.currentTarget.style.backgroundColor =
                      'var(--virpal-accent-hover)';
                  }
                }}
              >
                Buat To Do
              </button>{' '}
              <button
                type="button"
                onClick={() => handleButtonClick('help')}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium shadow-sm transition-all duration-200 cursor-pointer theme-transition ${
                  selectedMode === 'help'
                    ? 'text-white border'
                    : 'bg-white border border-gray-200'
                }`}
                style={{
                  backgroundColor:
                    selectedMode === 'help'
                      ? 'var(--virpal-primary)'
                      : 'var(--virpal-content-bg)',
                  borderColor:
                    selectedMode === 'help'
                      ? 'var(--virpal-primary)'
                      : 'var(--virpal-neutral-lighter)',
                  color:
                    selectedMode === 'help'
                      ? 'white'
                      : 'var(--virpal-neutral-default)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.cursor = 'pointer';
                  if (selectedMode !== 'help') {
                    e.currentTarget.style.backgroundColor =
                      'var(--virpal-accent-hover)';
                    e.currentTarget.style.color =
                      'var(--virpal-neutral-default)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedMode !== 'help') {
                    e.currentTarget.style.backgroundColor =
                      'var(--virpal-content-bg)';
                    e.currentTarget.style.color =
                      'var(--virpal-neutral-default)';
                  }
                }}
                onMouseDown={(e) => {
                  if (selectedMode !== 'help') {
                    e.currentTarget.style.backgroundColor =
                      'var(--virpal-accent-active)';
                  }
                }}
                onMouseUp={(e) => {
                  if (selectedMode !== 'help') {
                    e.currentTarget.style.backgroundColor =
                      'var(--virpal-accent-hover)';
                  }
                }}
              >
                Bantu Pekerjaan
              </button>
            </div>
            {/* Right side send button */}{' '}
            <button
              type="submit"
              disabled={isSending || !inputText.trim() || !canSendMessage}
              className="w-8 h-8 rounded-full text-white flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 theme-transition"
              style={{
                backgroundColor: 'var(--virpal-primary)',
                cursor:
                  isSending || !inputText.trim() || !canSendMessage
                    ? 'not-allowed'
                    : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor =
                    'var(--virpal-primary-hover)';
                  e.currentTarget.style.cursor = 'pointer';
                } else {
                  e.currentTarget.style.cursor = 'not-allowed';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor =
                    'var(--virpal-primary)';
                }
              }}
              onMouseDown={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor =
                    'var(--virpal-primary-active)';
                }
              }}
              onMouseUp={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor =
                    'var(--virpal-primary-hover)';
                }
              }}
              title={
                !canSendMessage
                  ? 'Login untuk melanjutkan chat'
                  : isSending
                  ? 'Mengirim...'
                  : 'Kirim pesan'
              }
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
            </button>{' '}
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserInput;
