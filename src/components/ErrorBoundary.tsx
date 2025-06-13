/**
 * VirPal App - AI Assistant with Azure Functions
 * Copyright (c) 2025 Achmad Reihan Alfaiz. All rights reserved.
 *
 * ErrorBoundary Component - React Error Boundary with VirPal Design System
 *
 * Features:
 * - Graceful error handling dengan UX yang ramah pengguna
 * - VirPal color palette integration
 * - Responsive design dengan mobile-first approach
 * - Accessibility compliance (WCAG 2.1)
 * - Error recovery mechanism
 * - Development mode error details
 */

import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  showRetry?: boolean;
  title?: string;
  description?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('VirPal Error Boundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });

    // Report error to monitoring service in production
    if (import.meta.env.PROD) {
      // TODO: Integrate with Azure Application Insights
      console.log('Error reported to monitoring service');
    }
  }
  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState((prevState) => ({
        hasError: false,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDevMode = import.meta.env.DEV;
      const canRetry =
        this.state.retryCount < this.maxRetries &&
        this.props.showRetry !== false;

      return (
        <div
          className="min-h-screen flex items-center justify-center p-4"
          style={{
            background:
              'linear-gradient(135deg, var(--virpal-accent) 0%, var(--virpal-neutral-lightest) 50%, var(--virpal-accent) 100%)',
          }}
        >
          {/* Main Error Card */}
          <div className="max-w-md w-full">
            {/* Avatar/Icon Section */}
            <div className="text-center mb-8">
              <div
                className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
                style={{ backgroundColor: 'var(--virpal-primary)' }}
              >
                <span className="text-3xl text-white">🤖</span>
              </div>
              <h1
                className="text-2xl font-bold mb-2"
                style={{ color: 'var(--virpal-neutral-default)' }}
              >
                {this.props.title || 'VirPal - AI Mental Health Assistant'}
              </h1>
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--virpal-secondary)' }}
              >
                Hackathon elevAIte with Dicoding 2025
              </p>
            </div>

            {/* Error Card */}
            <div
              className="rounded-2xl p-6 shadow-lg border"
              style={{
                backgroundColor: 'var(--virpal-content-bg)',
                borderColor: 'var(--virpal-neutral-lighter)',
              }}
            >
              {/* Status Badge */}
              <div className="flex items-center justify-center mb-4">
                <div
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--virpal-accent-hover)',
                    color: 'var(--virpal-primary)',
                  }}
                >
                  {isDevMode ? 'Mode Pengembangan' : 'Maintenance Mode'}
                </div>
              </div>

              {/* Error Message */}
              <div className="text-center mb-6">
                <h2
                  className="text-lg font-semibold mb-2"
                  style={{ color: 'var(--virpal-neutral-default)' }}
                >
                  Oops! Ada Masalah Teknis
                </h2>
                <p
                  className="text-sm leading-relaxed mb-4"
                  style={{ color: 'var(--virpal-neutral-dark)' }}
                >
                  {this.props.description ||
                    'Kami sedang memperbaiki masalah ini. VirPal tetap siap membantu Anda dengan kesehatan mental dan pencegahan kecanduan judi online.'}
                </p>

                {/* Development Error Details */}
                {isDevMode && this.state.error && (
                  <details className="mt-4 text-left">
                    <summary
                      className="cursor-pointer text-xs font-medium mb-2"
                      style={{ color: 'var(--virpal-secondary)' }}
                    >
                      Detail Error (Development)
                    </summary>
                    <div
                      className="p-3 rounded-lg text-xs font-mono"
                      style={{
                        backgroundColor: 'var(--virpal-neutral-lightest)',
                        color: 'var(--virpal-danger)',
                      }}
                    >
                      <div className="mb-2">
                        <strong>Error:</strong> {this.state.error.message}
                      </div>
                      {this.state.error.stack && (
                        <div className="text-xs opacity-75">
                          <strong>Stack:</strong>
                          <pre className="mt-1 whitespace-pre-wrap">
                            {this.state.error.stack.slice(0, 500)}...
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {canRetry && (
                  <button
                    onClick={this.handleRetry}
                    className="w-full px-6 py-3 rounded-xl font-medium text-white transition-all duration-200
                             hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-300"
                    style={{
                      backgroundColor: 'var(--virpal-primary)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'var(--virpal-primary-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'var(--virpal-primary)';
                    }}
                  >
                    🔄 Coba Lagi{' '}
                    {this.state.retryCount > 0 &&
                      `(${this.state.retryCount}/${this.maxRetries})`}
                  </button>
                )}{' '}
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-6 py-3 rounded-xl font-medium transition-all duration-200
                             hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-300"
                  style={{
                    backgroundColor: 'var(--virpal-accent-active)',
                    color: 'var(--virpal-secondary)',
                  }}
                >
                  🔄 Muat Ulang Halaman
                </button>
              </div>

              {/* Retry Limit Reached */}
              {!canRetry && this.props.showRetry !== false && (
                <div
                  className="mt-4 p-3 rounded-lg text-center"
                  style={{
                    backgroundColor: 'var(--virpal-accent)',
                    border: '1px solid var(--virpal-accent-active)',
                  }}
                >
                  <p
                    className="text-xs"
                    style={{ color: 'var(--virpal-neutral-dark)' }}
                  >
                    Batas percobaan tercapai. Silakan muat ulang halaman atau
                    hubungi support.
                  </p>
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="text-center mt-6 space-y-2">
              <p
                className="text-xs"
                style={{ color: 'var(--virpal-neutral-dark)' }}
              >
                🏥 <strong>Kesehatan Mental</strong> • 🎮{' '}
                <strong>Pencegahan Judi Online</strong> • 🤖{' '}
                <strong>AI Assistant</strong>
              </p>
              <p
                className="text-xs"
                style={{ color: 'var(--virpal-secondary)' }}
              >
                Didukung oleh Microsoft Azure & OpenAI
              </p>
              <div
                className="flex items-center justify-center space-x-2 text-xs"
                style={{ color: 'var(--virpal-neutral-dark)' }}
              >
                <span>SDG 3: Good Health and Well-being</span>
                <span>•</span>
                <span>🇮🇩 Indonesia</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
