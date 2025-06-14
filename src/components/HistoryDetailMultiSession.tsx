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
import type { ChatHistory, ChatSession } from '../types';
import ChatBubble from './ChatBubble';

interface HistoryDetailMultiSessionProps {
  selectedDate: Date;
  chatSessions: ChatSession[];
  chatHistory: ChatHistory | null; // For backward compatibility
  onLoadHistory: (history: ChatHistory) => void;
  onLoadSession?: (session: ChatSession) => void; // Made optional since we handle it internally
  onDeleteHistory: (date: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

const HistoryDetailMultiSession: React.FC<HistoryDetailMultiSessionProps> = ({
  selectedDate,
  chatSessions,
  onLoadHistory,
  onDeleteHistory,
  onDeleteSession,
}) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatSessionDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60)
    ); // minutes

    if (duration < 1) return '< 1 menit';
    if (duration < 60) return `${duration} menit`;

    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    return `${hours}j ${minutes}m`;
  };

  const handleLoadSession = (session: ChatSession) => {
    // Convert session to ChatHistory for compatibility
    const historyFromSession: ChatHistory = {
      date: session.date,
      messages: session.messages,
      summary: session.summary || 'Tidak ada ringkasan',
    };
    onLoadHistory(historyFromSession);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (window.confirm('Hapus session chat ini?')) {
      onDeleteSession(sessionId);
    }
  };

  const handleDeleteAllSessions = () => {
    if (
      window.confirm(
        `Hapus semua session chat untuk tanggal ini (${chatSessions.length} session)?`
      )
    ) {
      onDeleteHistory(chatSessions[0]?.date || '');
    }
  };

  const totalMessages = chatSessions.reduce(
    (sum, session) => sum + session.messages.length,
    0
  );
  const hasAnySessions = chatSessions.length > 0;

  return (
    <div
      className="rounded-lg p-3 shadow-sm border h-full overflow-auto theme-transition"
      style={{ backgroundColor: 'var(--virpal-content-bg)' }}
    >
      <div className="mb-3 theme-transition">
        <h3
          className="font-semibold text-base mb-1 theme-transition"
          style={{ color: 'var(--virpal-neutral-default)' }}
        >
          Detail History
        </h3>
        <p
          className="text-xs theme-transition"
          style={{ color: 'var(--virpal-neutral-dark)' }}
        >
          {formatDate(selectedDate)}
        </p>
        {hasAnySessions && (
          <p
            className="text-xs mt-1 theme-transition"
            style={{ color: 'var(--virpal-primary)' }}
          >
            {chatSessions.length} session • {totalMessages} total pesan
          </p>
        )}
      </div>

      {hasAnySessions ? (
        <div className="theme-transition">
          {/* Sessions List */}
          <div className="space-y-3 mb-4">
            {chatSessions.map((session, index) => (
              <div
                key={session.id}
                className="border rounded-lg p-3 theme-transition hover:shadow-sm"
                style={{
                  backgroundColor: 'var(--virpal-accent)',
                  borderColor: 'var(--virpal-neutral-lighter)',
                }}
              >
                {/* Session Header */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs font-medium theme-transition"
                        style={{ color: 'var(--virpal-primary)' }}
                      >
                        Session {index + 1}
                      </span>
                      <span
                        className="text-xs theme-transition"
                        style={{ color: 'var(--virpal-neutral-dark)' }}
                      >
                        {formatTime(session.startTime)}
                        {session.endTime && (
                          <>
                            {' - '}
                            {formatTime(session.endTime)}
                          </>
                        )}
                      </span>
                    </div>

                    {session.title && (
                      <h4
                        className="text-sm font-medium mb-1 theme-transition"
                        style={{ color: 'var(--virpal-neutral-default)' }}
                      >
                        {session.title}
                      </h4>
                    )}

                    <div
                      className="flex items-center gap-3 text-xs theme-transition"
                      style={{ color: 'var(--virpal-neutral-dark)' }}
                    >
                      <span>{session.messages.length} pesan</span>
                      <span>
                        {formatSessionDuration(
                          session.startTime,
                          session.endTime
                        )}
                      </span>
                      {!session.endTime && (
                        <span className="text-green-600 font-medium">
                          ● Aktif
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Session Actions */}
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => handleLoadSession(session)}
                      className="px-2 py-1 text-xs rounded transition-colors"
                      style={{
                        backgroundColor: 'var(--virpal-primary)',
                        color: 'white',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          'var(--virpal-primary-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          'var(--virpal-primary)';
                      }}
                      title="Muat session ini"
                    >
                      Muat
                    </button>
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      className="px-2 py-1 text-xs rounded border transition-colors"
                      style={{
                        borderColor: 'var(--virpal-danger)',
                        color: 'var(--virpal-danger)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          'rgba(239, 68, 68, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Hapus session ini"
                    >
                      Hapus
                    </button>
                  </div>
                </div>

                {/* Session Summary */}
                {session.summary && (
                  <div className="mb-2">
                    <p
                      className="text-xs theme-transition"
                      style={{ color: 'var(--virpal-neutral-dark)' }}
                    >
                      {session.summary}
                    </p>
                  </div>
                )}

                {/* Preview Messages (first 2) */}
                {session.messages.length > 0 && (
                  <div
                    className="border-t pt-2"
                    style={{ borderColor: 'var(--virpal-neutral-lighter)' }}
                  >
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {session.messages.slice(0, 2).map((message) => (
                        <div key={message.id} className="scale-90 origin-left">
                          <ChatBubble message={message} />
                        </div>
                      ))}
                      {session.messages.length > 2 && (
                        <p
                          className="text-xs text-center py-1 theme-transition"
                          style={{ color: 'var(--virpal-neutral-dark)' }}
                        >
                          +{session.messages.length - 2} pesan lainnya
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Delete All Sessions Button */}
          <div
            className="border-t pt-3"
            style={{ borderColor: 'var(--virpal-neutral-lighter)' }}
          >
            <button
              onClick={handleDeleteAllSessions}
              className="w-full px-3 py-2 text-xs rounded-lg border transition-colors"
              style={{
                borderColor: 'var(--virpal-danger)',
                color: 'var(--virpal-danger)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  'rgba(239, 68, 68, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Hapus Semua Session Hari Ini
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 theme-transition">
          <div
            className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center theme-transition"
            style={{ backgroundColor: 'var(--virpal-accent)' }}
          >
            <span className="text-lg">📅</span>
          </div>
          <p
            className="text-xs theme-transition"
            style={{ color: 'var(--virpal-neutral-dark)' }}
          >
            Tidak ada history chat untuk tanggal ini
          </p>
        </div>
      )}
    </div>
  );
};

export default HistoryDetailMultiSession;
