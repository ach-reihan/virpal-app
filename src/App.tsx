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

import { useEffect, useRef, useState } from 'react';
import AboutUs from './components/AboutUs';
import AuthButton from './components/AuthButton';
import Avatar from './components/Avatar';
import Calendar from './components/Calendar';
import ChatBubble from './components/ChatBubble';
import CloudSyncIndicator from './components/CloudSyncIndicator';
import GamblingRiskAssessment from './components/GamblingRiskAssessment';
import HackathonInfo from './components/HackathonInfo';
import HistoryDetailMultiSession from './components/HistoryDetailMultiSession';
import Modal from './components/Modal';
import MoodTracker from './components/MoodTracker';
import Sidebar from './components/Sidebar';
import Subscription from './components/Subscription';
import { ToastContainer } from './components/Toast';
import TTSControls from './components/TTSControls';
import UserInput from './components/UserInput';
import { useAuth } from './hooks/useAuth';
import { useToast } from './hooks/useToast';
import { useTTSChat } from './hooks/useTTSChat';
import { authService } from './services/authService';
import { azureCosmosDbService } from './services/azureCosmosDbService';
import { guestLimitService } from './services/guestLimitService';
import { hybridChatStorageService } from './services/hybridChatStorageService';
import type {
  AvatarExpression,
  ChatHistory,
  ChatMessage,
  ChatSession,
} from './types';
import { FOOTER_TEXT_STYLES, WELCOME_MESSAGE } from './utils/constants';
import { formatDateToString } from './utils/dateUtils';
import { getAvatarImageUrl } from './utils/helpers';
import { logger } from './utils/logger';
import { handleUserSendMessage } from './utils/messageHandlers';

// Main App Component with Authentication
function AppContent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isVirpalTyping, setIsVirpalTyping] = useState(false);
  const [virpalExpression, setVirpalExpression] =
    useState<AvatarExpression>('neutral');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [datesWithHistory, setDatesWithHistory] = useState<string[]>([]);
  const [currentChatSessions, setCurrentChatSessions] = useState<ChatSession[]>(
    []
  );
  const [currentChatHistory, setCurrentChatHistory] =
    useState<ChatHistory | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showHackathonModal, setShowHackathonModal] = useState(false);
  const [chatCount, setChatCount] = useState(0);
  const [showUserModal, setShowUserModal] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(
    null
  );
  const [isStorageInitialized, setIsStorageInitialized] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'checking' | 'available' | 'unavailable' | 'local-only'
  >('checking');

  // Mental Health Features State - Hackathon 2025
  const [currentView, setCurrentView] = useState<
    'chat' | 'mood' | 'assessment'
  >('chat');

  const chatEndRef = useRef<null | HTMLDivElement>(null);

  // Authentication state
  const {
    isAuthenticated,
    error: authError,
    isInitialized,
    user,
    login,
    logout,
    clearError,
  } = useAuth({
    onAuthStateChange: async (isAuth, userProfile) => {
      if (isAuth && userProfile) {
        // Update cloud sync status for authenticated users
        setCloudSyncStatus('checking');

        logger.info('🔄 User authenticated, initializing Azure services');

        // Reinitialize Azure services after authentication
        try {
          // Reinitialize Cosmos DB Service (TTS is handled by useTTSChat hook)
          await azureCosmosDbService.initialize();
          logger.info('✅ Azure Cosmos DB Service reinitialized after login');

          setCloudSyncStatus('available');
          logger.info('✅ Cloud sync enabled for authenticated user');
        } catch (error) {
          logger.warn('❌ Failed to initialize Cosmos DB after login', error);
          setCloudSyncStatus('unavailable');
        }

        // Optionally add a welcome message without personal information
        setMessages((prev) => [
          ...prev.slice(0, 1), // Keep welcome message
          {
            id: Date.now().toString(),
            text: `Halo! 👋 Senang bisa membantu kamu hari ini. Azure AI Speech dan cloud sync sedang diaktifkan...`,
            sender: 'virpal',
            timestamp: new Date(),
          },
        ]);
      } else {
        // User logged out - switch to local-only mode
        setCloudSyncStatus('local-only');
        logger.info('User logged out - switched to local-only mode');

        // Reset to welcome message only when logged out
        setMessages([WELCOME_MESSAGE]);
      }
    },
  });

  // Toast system for user-friendly notifications
  const { toasts, showError, removeToast } = useToast();

  // Handle authentication errors with user-friendly toast messages
  useEffect(() => {
    if (authError && isInitialized) {
      // Convert technical error to user-friendly message
      const friendlyMessage =
        authError.includes('user_cancelled') ||
        authError.includes('PopupHandler.monitorPopupForHash')
          ? 'Kamu membatalkan login atau terjadi kesalahan saat login'
          : authError.includes('interaction_required')
          ? 'Perlu login ulang untuk melanjutkan'
          : authError.includes('network') ||
            authError.includes('fetch') ||
            authError.includes('timeout')
          ? 'Koneksi internet bermasalah, coba lagi'
          : authError.includes('popup_window_error')
          ? 'Pop-up login diblokir browser. Silakan izinkan pop-up dan coba lagi'
          : authError.includes('consent_required')
          ? 'Persetujuan diperlukan. Silakan login ulang'
          : authError.includes('invalid_request')
          ? 'Permintaan tidak valid. Silakan refresh halaman dan coba lagi'
          : 'Terjadi kesalahan saat login, silakan coba lagi';

      showError(friendlyMessage);

      // Auto-clear the auth error after showing toast
      const clearTimer = setTimeout(() => {
        clearError();
      }, 500); // Clear shortly after toast is shown

      return () => clearTimeout(clearTimer);
    }

    // Return cleanup function even when condition is false
    return () => {};
  }, [authError, isInitialized, showError, clearError]);

  // Define limit based on authentication status
  const limit = isAuthenticated ? Infinity : 5;

  // Wrapper functions for AuthButton
  const handleLogin = async () => {
    await login();
  };

  const handleLogout = async () => {
    await logout();
  };

  // Initialize TTS functionality
  const tts = useTTSChat();

  // Wrapper for TTS initialization to match expected signature
  const handleTTSInitialize = async () => {
    await tts.initializeTTS();
  };

  // Event listener for menu actions from sidebar
  useEffect(() => {
    const handleSetView = (e: CustomEvent) => {
      const view = e.detail;
      setCurrentView(view);
    };

    // Add event listener
    window.addEventListener('virpal:setView', handleSetView as EventListener);

    // Clean up
    return () => {
      window.removeEventListener(
        'virpal:setView',
        handleSetView as EventListener
      );
    };
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Wait for MSAL initialization before proceeding
        await authService.waitForInitialization();

        // Initialize basic services first (TTS is handled by useTTSChat hook)
        await azureCosmosDbService.initialize();

        // Initialize hybrid storage service
        await hybridChatStorageService.initialize();

        // Check cloud sync status using safe authentication check
        const isAuthenticated = authService.isSafelyAuthenticated();
        if (!isAuthenticated) {
          setCloudSyncStatus('local-only');
          logger.info(
            'Running in local-only mode - sign in to enable cloud sync'
          );
        } else {
          // For authenticated users, check if cloud sync is available
          const healthStatus = await hybridChatStorageService.getHealthStatus();
          if (healthStatus.cosmosDbWorking) {
            setCloudSyncStatus('available');
            logger.once('info', 'Cloud sync is available');
          } else {
            setCloudSyncStatus('unavailable');
            logger.once(
              'info',
              'Authenticated but cloud sync unavailable - using local storage'
            );
          }
        }

        // Migrate from legacy format if needed
        hybridChatStorageService.migrateFromLegacyFormat();

        // Load current session if exists
        const session = hybridChatStorageService.getCurrentSession();
        if (session && session.messages.length > 0) {
          setCurrentSession(session);
          setMessages(session.messages);
        } else {
          setMessages([WELCOME_MESSAGE]);
        }

        setVirpalExpression('listening');
        loadDatesWithHistory();
        setIsStorageInitialized(true);
      } catch (error) {
        logger.warn(
          'Failed to initialize hybrid storage, falling back to basic mode',
          error
        );
        setCloudSyncStatus('local-only');
        setMessages([WELCOME_MESSAGE]);
        setIsStorageInitialized(true);
      }
    };

    initializeApp();

    // Initialize TTS after first user interaction (required by browsers)
    const handleFirstInteraction = () => {
      tts.handleFirstUserInteraction();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency to run only once - tts reference should not cause re-runs

  // Monitor authentication state changes for service initialization
  useEffect(() => {
    // This useEffect is now simplified and only monitors authentication state
    // Service initialization is handled directly in the onAuthStateChange callback
  }, [isAuthenticated]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-save current chat when messages change
  useEffect(() => {
    const saveMessages = async () => {
      if (messages.length > 1 && isStorageInitialized) {
        try {
          // Lebih dari welcome message
          // Start new session if none exists or if current session ended
          if (!currentSession) {
            const newSession = hybridChatStorageService.startNewSession();
            setCurrentSession(newSession);
          }

          // Add messages to current session (only new messages)
          if (currentSession && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage) {
              const sessionHasMessage = currentSession.messages.some(
                (m) => m.id === lastMessage.id
              );

              if (!sessionHasMessage) {
                await hybridChatStorageService.addMessageToCurrentSession(
                  lastMessage
                );
                // Update local session state
                const updatedSession =
                  hybridChatStorageService.getCurrentSession();
                if (updatedSession) {
                  setCurrentSession(updatedSession);
                }
              }
            }
          }

          loadDatesWithHistory();
        } catch (error) {
          console.warn('Error saving messages to storage:', error);
          // Don't throw the error to prevent app crash
          // The app can continue functioning without persistent storage
        }
      }
    };

    saveMessages();
  }, [messages, currentSession, isStorageInitialized]);

  const loadDatesWithHistory = () => {
    const dates = hybridChatStorageService.getDatesWithHistory();
    setDatesWithHistory(dates);
  };

  const onSendMessage = async (messageText: string) => {
    // Check guest limitations for unauthenticated users
    if (!isAuthenticated) {
      if (!guestLimitService.canSendMessage()) {
        // Show friendly message instead of alert
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            text: `Maaf, Anda telah mencapai batas 5 pesan untuk hari ini. Silakan login untuk melanjutkan chat dan menggunakan semua fitur! 😊`,
            sender: 'virpal',
            timestamp: new Date(),
          },
        ]);
        return;
      }
    }

    // Legacy limit check for authenticated users (if still needed)
    if (chatCount >= limit) {
      alert(
        `Limit chat tercapai (${limit}). Silakan login untuk menambah limit.`
      );
      return;
    }

    // Increment guest message count if not authenticated
    if (!isAuthenticated) {
      guestLimitService.incrementMessageCount();
    }

    // Enhanced logging for TTS debugging
    logger.info('📤 Sending message with TTS status', {
      isAuthenticated,
      ttsIsEnabled: tts.isEnabled,
      ttsIsInitialized: tts.isInitialized,
      ttsError: tts.initializationError,
      finalEnableTTS: tts.isEnabled && isAuthenticated,
    });

    await handleUserSendMessage(messageText, messages, {
      setMessages,
      setIsVirpalTyping,
      setVirpalExpression,
      enableTTS: tts.isEnabled && isAuthenticated,
    });
    setChatCount((prev) => prev + 1);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    const dateString = formatDateToString(date);
    const sessions =
      hybridChatStorageService.getChatSessionsForDate(dateString);
    setCurrentChatSessions(sessions);

    // For backward compatibility, create a ChatHistory object from the first session
    if (sessions.length > 0 && sessions[0]) {
      const firstSession = sessions[0];
      const chatHistory: ChatHistory = {
        date: dateString,
        messages: firstSession.messages,
        summary: firstSession.summary || 'Tidak ada ringkasan',
      };
      setCurrentChatHistory(chatHistory);
    } else {
      setCurrentChatHistory(null);
    }
  };

  const handleLoadHistory = (history: ChatHistory) => {
    setMessages(history.messages);
    setShowHistory(false);
    setVirpalExpression('neutral');
  };

  const handleDeleteHistory = async (date: string) => {
    try {
      await hybridChatStorageService.deleteDayHistory(date);
      loadDatesWithHistory();
      setCurrentChatHistory(null);
      setCurrentChatSessions([]);
    } catch (error) {
      console.warn('Error deleting history:', error);
      // Could show a toast notification here if needed
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await hybridChatStorageService.deleteChatSession(sessionId);
      // Refresh the current date's sessions
      const dateString = formatDateToString(selectedDate);
      const sessions =
        hybridChatStorageService.getChatSessionsForDate(dateString);
      setCurrentChatSessions(sessions);

      // Update chat history for backward compatibility
      if (sessions.length > 0 && sessions[0]) {
        const firstSession = sessions[0];
        const chatHistory: ChatHistory = {
          date: dateString,
          messages: firstSession.messages,
          summary: firstSession.summary || 'Tidak ada ringkasan',
        };
        setCurrentChatHistory(chatHistory);
      } else {
        setCurrentChatHistory(null);
      }

      loadDatesWithHistory();
    } catch (error) {
      console.warn('Error deleting session:', error);
      // Could show a toast notification here if needed
    }
  };

  const handleLoadSession = (session: ChatSession) => {
    // Convert session to ChatHistory for compatibility with existing load function
    const historyFromSession: ChatHistory = {
      date: session.date,
      messages: session.messages,
      summary: session.summary || 'Tidak ada ringkasan',
    };
    handleLoadHistory(historyFromSession);
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
    if (!showHistory) {
      const dateString = formatDateToString(selectedDate);
      const sessions =
        hybridChatStorageService.getChatSessionsForDate(dateString);
      setCurrentChatSessions(sessions);

      // For backward compatibility
      if (sessions.length > 0 && sessions[0]) {
        const firstSession = sessions[0];
        const chatHistory: ChatHistory = {
          date: dateString,
          messages: firstSession.messages,
          summary: firstSession.summary || 'Tidak ada ringkasan',
        };
        setCurrentChatHistory(chatHistory);
      } else {
        setCurrentChatHistory(null);
      }
    }
  };

  const startNewChat = async () => {
    // Start new session (hybrid storage service will handle any existing session cleanup)
    const newSession = hybridChatStorageService.startNewSession();
    setCurrentSession(newSession);
    setMessages([WELCOME_MESSAGE]);
    setVirpalExpression('listening');
    setShowHistory(false);
    setChatCount(0); // Reset chat count for new session
    loadDatesWithHistory(); // Refresh dates with history
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleShowAbout = () => {
    setShowAboutModal(true);
  };

  const handleShowSubscription = () => {
    setShowSubscriptionModal(true);
  };

  const handleShowHackathon = () => {
    setShowHackathonModal(true);
  };

  const handleCloseAbout = () => {
    setShowAboutModal(false);
  };

  const handleCloseSubscription = () => {
    setShowSubscriptionModal(false);
  };

  const handleCloseHackathon = () => {
    setShowHackathonModal(false);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[var(--virpal-neutral-lighter)] p-1 overflow-hidden theme-transition">
      {/* Authentication Loading State - small indicator, not blocking */}
      {!isInitialized && (
        <div className="fixed top-4 left-4 bg-white bg-opacity-95 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg z-50 border">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--virpal-primary)]"></div>
          <p className="text-sm text-[var(--virpal-primary)]">
            Memuat autentikasi...
          </p>
        </div>
      )}

      {/* Authentication Error State - Now handled by Toast system */}

      {/* Note: main chat UI always available; login improves features but not required to view UI */}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      {/* Main App Content */}
      <>
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
          onNewChat={startNewChat}
          onToggleHistory={toggleHistory}
          isHistoryOpen={showHistory}
          onShowAbout={handleShowAbout}
          onShowSubscription={handleShowSubscription}
          onShowHackathon={handleShowHackathon}
        />

        {/* Overlay untuk sidebar (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
            }}
            onClick={toggleSidebar}
          />
        )}

        {/* Overlay untuk history (mobile) */}
        {showHistory && (
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
            }}
            onClick={toggleHistory}
          />
        )}

        {/* === HISTORY SLIDE-IN START === */}
        <div
          className="history-panel fixed top-0 right-0 h-full w-full max-w-[90%] sm:max-w-[350px] md:max-w-[320px] lg:max-w-[350px] shadow-2xl z-50 border-l"
          style={{
            backgroundColor: 'var(--virpal-content-bg)',
            borderLeftColor: 'var(--virpal-neutral-lighter)',
            transform: showHistory ? 'translateX(0)' : 'translateX(100%)',
          }}
          data-section="history-slidein"
        >
          <div className="h-full flex flex-col p-3 overflow-hidden">
            <div className="flex-shrink-0">
              <Calendar
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                datesWithHistory={datesWithHistory}
              />
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 my-2">
              <HistoryDetailMultiSession
                selectedDate={selectedDate}
                chatSessions={currentChatSessions}
                chatHistory={currentChatHistory}
                onLoadHistory={handleLoadHistory}
                onLoadSession={handleLoadSession}
                onDeleteHistory={handleDeleteHistory}
                onDeleteSession={handleDeleteSession}
              />
            </div>
            <div className="flex-shrink-0 pt-2">
              <button
                onClick={toggleHistory}
                className="w-full px-3 py-2 rounded-lg border transition-colors"
                style={{
                  color: 'var(--virpal-primary)',
                  borderColor: 'var(--virpal-primary)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'var(--virpal-accent-hover)';
                  e.currentTarget.style.cursor = 'pointer';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'var(--virpal-accent-active)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'var(--virpal-accent-hover)';
                }}
              >
                Tutup History
              </button>
            </div>
          </div>
        </div>
        {/* === HISTORY SLIDE-IN END === */}

        {/* Main Content */}
        {/* === MAIN CONTENT WRAPPER START === */}
        <main
          className={`main-content flex flex-col flex-1 m-1 rounded-md min-h-0 ${
            sidebarOpen ? 'md:ml-65' : 'md:ml-1'
          } ${showHistory ? 'md:mr-88' : ''}`}
          style={{
            backgroundColor: 'var(--virpal-main-bg)',
            height: 'calc(100vh - 2px)', // Full height minus padding
          }}
        >
          {/* === HEADER START === */}
          <header
            className="flex flex-col sm:flex-row items-center sm:items-center sm:justify-between px-4 sm:px-6 py-2 sm:py-3 sticky top-1 z-30 rounded-t-md flex-shrink-0 theme-transition gap-3 sm:gap-0"
            data-section="header"
            style={{ backgroundColor: 'var(--virpal-header-bg)' }}
          >
            {/* Title Section - Shows first on mobile (≤512px), inline on desktop */}
            <div className="w-full sm:w-auto order-1 sm:order-none flex justify-center sm:justify-start">
              <div className="flex items-center gap-3 sm:gap-3 relative min-h-[40px]">
                {/* === SIDEBAR OPEN BUTTON (IN HEADER) START === */}
                {!sidebarOpen && (
                  <button
                    onClick={toggleSidebar}
                    className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg flex items-center justify-center shadow-lg text-white text-lg sm:text-xl transition-all duration-300 ease-in"
                    style={{
                      backgroundColor: 'var(--virpal-secondary)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'var(--virpal-secondary-hover)';
                      e.currentTarget.style.cursor = 'pointer';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'var(--virpal-secondary)';
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'var(--virpal-secondary-active)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'var(--virpal-secondary-hover)';
                    }}
                    title="Buka Sidebar"
                    data-section="sidebar-open-btn"
                  >
                    <span>→</span>
                  </button>
                )}
                {/* === SIDEBAR OPEN BUTTON (IN HEADER) END === */}
                <div className="flex flex-col transition-all duration-300 ease-in">
                  <span className="font-bold text-sm sm:text-lg md:text-xl text-[var(--virpal-primary)] leading-tight">
                    VirPal - AI Mental Health Assistant
                  </span>
                  {/* Tagline dengan ukuran yang lebih kecil */}
                  <span
                    className="text-xs sm:text-sm transition-all duration-300 ease-in"
                    style={{ color: 'var(--virpal-neutral-dark)' }}
                  >
                    Judi Online Prevention &amp; Mental Wellness
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* TTS Controls - always show but restrict for guests */}
              <TTSControls
                isInitialized={tts.isInitialized}
                isEnabled={tts.isEnabled}
                isSpeaking={tts.isSpeaking}
                initializationError={tts.initializationError}
                onToggleTTS={tts.toggleTTS}
                onStopSpeaking={tts.stopSpeaking}
                onInitialize={handleTTSInitialize}
                isAuthenticated={isAuthenticated}
                onLoginClick={handleLogin}
              />

              {/* Cloud Sync Status Indicator */}
              <CloudSyncIndicator
                status={cloudSyncStatus}
                isAuthenticated={isAuthenticated}
              />

              {/* Authentication Button */}
              <AuthButton
                isAuthenticated={isAuthenticated}
                user={user}
                error={authError}
                isInitialized={isInitialized}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onClearError={clearError}
                showProfile={true}
                onShowUserDetails={() => setShowUserModal(true)}
              />
            </div>
          </header>
          {/* === HEADER END === */}

          {/* === MAIN CONTENT AREA START === */}
          <section
            className={`flex flex-1 w-full max-w-5xl mx-auto px-4 md:px-6 py-4 transition-all duration-300 min-h-0 overflow-hidden`}
            data-section="main-content-area"
            style={{ height: 'calc(100% - 152px)' }} // Subtracting adjusted header and footer height
          >
            {/* Conditional rendering based on current view */}
            {currentView === 'chat' && (
              <>
                {/* Avatar & Info di kiri */}
                <div
                  className="hidden md:flex flex-col items-center mr-6 w-32 min-w-[80px] flex-shrink-0"
                  data-section="avatar-info"
                >
                  <Avatar
                    expression={virpalExpression}
                    imageUrl={getAvatarImageUrl(virpalExpression)}
                  />
                  <div className="mt-2 text-center">
                    <div className="font-bold text-[var(--virpal-primary)]">
                      VIRPAL
                    </div>
                    <div className="text-xs flex items-center justify-center gap-1 text-green-600">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                      Online
                    </div>
                  </div>
                </div>
                {/* Chat Bubble Area */}
                <div
                  className="flex-1 flex flex-col rounded-2xl shadow-xl border border-[var(--virpal-primary_opacity_30,rgba(121,80,242,0.3))] min-h-0 theme-transition"
                  data-section="chat-bubble-area"
                  style={{ backgroundColor: 'var(--virpal-content-bg)' }}
                >
                  <div className="flex flex-col gap-2 p-4 overflow-y-auto flex-1">
                    {messages.map((msg) => (
                      <div key={msg.id}>
                        {/* Container untuk pesan VIRPAL dengan avatar di mobile */}
                        {msg.sender === 'virpal' ? (
                          <div className="flex items-start gap-3">
                            {/* Avatar di kiri untuk pesan dari virpal (mobile) */}
                            <div className="md:hidden flex-shrink-0">
                              <Avatar
                                expression={virpalExpression}
                                imageUrl={getAvatarImageUrl(virpalExpression)}
                              />
                            </div>
                            <ChatBubble message={msg} />
                          </div>
                        ) : (
                          /* Container untuk pesan user tanpa pembatasan */
                          <ChatBubble message={msg} />
                        )}
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                </div>
              </>
            )}

            {/* Mood Tracker View */}
            {currentView === 'mood' && <MoodTracker />}

            {/* Risk Assessment View */}
            {currentView === 'assessment' && <GamblingRiskAssessment />}
          </section>
          {/* === MAIN CONTENT AREA END === */}

          {/* === INPUT & MENU SECTION START === */}
          {currentView === 'chat' && (
            <section
              className="flex justify-center z-30 px-4 md:px-6 py-4 flex-shrink-0 theme-transition"
              data-section="input-menu"
              style={{ backgroundColor: 'var(--virpal-main-bg)' }}
            >
              <div className="w-full max-w-5xl mx-auto flex">
                {/* Spacer to match avatar section width */}
                <div className="hidden md:block w-32 min-w-[80px] mr-6"></div>
                {/* Input area matching chat bubble width */}
                <div className="flex-1">
                  <UserInput
                    onSendMessage={onSendMessage}
                    isSending={isVirpalTyping}
                    isAuthenticated={isAuthenticated}
                    onLoginClick={handleLogin}
                  />
                </div>
              </div>
            </section>
          )}
          {/* === INPUT & MENU SECTION END === */}

          {/* Footer */}
          <footer
            className="text-center py-3 flex-shrink-0 rounded-b-md theme-transition"
            style={{ backgroundColor: 'var(--virpal-main-bg)' }}
          >
            <p className="text-xs" style={FOOTER_TEXT_STYLES}>
              elevAIte with Dicoding Hackathon 2025 | SDG 3: Kesehatan Mental
            </p>
            <p className="text-xs mt-1 opacity-60" style={FOOTER_TEXT_STYLES}>
              © 2025 VirPal Development Team - All rights reserved
            </p>
          </footer>
        </main>
        {/* === MAIN CONTENT WRAPPER END === */}

        {/* About Modal */}
        <Modal
          isOpen={showAboutModal}
          onClose={handleCloseAbout}
          title="Tentang Kami"
        >
          <AboutUs />
        </Modal>

        {/* Hackathon Info Modal */}
        <Modal
          isOpen={showHackathonModal}
          onClose={handleCloseHackathon}
          title="Info Hackathon - elevAIte 2025"
        >
          <HackathonInfo />
        </Modal>

        {/* Subscription Modal */}
        <Modal
          isOpen={showSubscriptionModal}
          onClose={handleCloseSubscription}
          title="Langganan"
        >
          <Subscription />
        </Modal>

        {/* User Info Modal */}
        <Modal
          isOpen={showUserModal}
          onClose={() => setShowUserModal(false)}
          title="Informasi User"
        >
          <div className="space-y-2">
            <p>
              <strong>Nama:</strong> {user?.displayName}
            </p>
            <p>
              <strong>Email:</strong> {user?.email}
            </p>
            <p>
              <strong>Limit Chat:</strong>{' '}
              {limit === Infinity ? 'Tak terbatas' : limit}
            </p>
            <button
              onClick={() => setShowUserModal(false)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500"
            >
              Tutup
            </button>
          </div>
        </Modal>
      </>
    </div>
  );
}

// Main App component
function App() {
  return <AppContent />;
}

export default App;
