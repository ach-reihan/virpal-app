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

import type { ChatMessage } from '../types';

// Welcome message untuk VIRPAL
export const WELCOME_MESSAGE: ChatMessage = {
  id: `virpal-welcome-${Date.now()}`,
  sender: 'virpal',
  text: 'Halo! Aku VIRPAL, teman virtual yang siap mendengarkan. Apa yang ada di pikiranmu hari ini?',
  timestamp: new Date(),
};

// System prompt untuk Azure OpenAI
export const SYSTEM_PROMPT =
  'Kamu adalah asisten virtual yang ramah dan membantu.';

// Error message ketika ada gangguan
export const ERROR_MESSAGE =
  'Ups, sepertinya ada sedikit gangguan di jaringanku. Bisa coba ulangi lagi?';

// Styles untuk komponen
export const APP_STYLES = {
  backgroundColor: 'var(--virpal-neutral-lightest)',
  color: 'var(--virpal-neutral-default)',
};

export const HEADER_STYLES = {
  backgroundColor: 'var(--virpal-accent)',
  borderBottomColor: 'var(--virpal-neutral-lighter)',
};

export const VIRPAL_NAME_STYLES = {
  color: 'var(--virpal-primary)',
};

export const ONLINE_STATUS_STYLES = {
  color: 'green',
};

export const CHAT_AREA_STYLES = {
  backgroundColor: 'var(--virpal-neutral-lightest)',
};

export const FOOTER_TEXT_STYLES = {
  color: 'var(--virpal-neutral-dark)',
};

export const CONTAINER_BORDER_STYLES = {
  borderColor: 'var(--virpal-primary_opacity_30, rgba(121, 80, 242, 0.3))',
};
