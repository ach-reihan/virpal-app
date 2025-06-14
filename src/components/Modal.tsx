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

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      {/* Blur backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
        }}
      ></div>

      <div
        className="relative w-[95vw] h-[95vh] rounded-lg shadow-xl overflow-hidden theme-transition"
        style={{ backgroundColor: 'var(--virpal-content-bg)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b theme-transition"
          style={{ borderBottomColor: 'var(--virpal-neutral-lighter)' }}
        >
          <h2
            className="text-xl font-bold theme-transition"
            style={{ color: 'var(--virpal-primary)' }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors theme-transition text-xl font-bold"
            style={{ color: 'var(--virpal-neutral-dark)' }}
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
            ✕
          </button>
        </div>{' '}
        {/* Content */}
        <div className="p-6 overflow-y-auto h-[calc(95vh-80px)] theme-transition">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
