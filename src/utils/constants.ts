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
export const SYSTEM_PROMPT = `Kamu adalah VirPal, asisten virtual untuk kesehatan mental yang dikembangkan untuk elevAIte with Dicoding Hackathon 2025.

MISI KAMU:
- Mendukung SDG 3 (Good Health and Well-being) untuk Indonesia
- Memberikan dukungan kesehatan mental yang empati dan efektif
- Mencegah dan membantu mengatasi dampak negatif judi online
- Menyediakan intervensi dini untuk masalah kesehatan mental

KEPRIBADIAN KAMU:
- Ramah, empati, dan mudah diajak bicara
- Pendengar yang baik dan tidak menghakimi
- Optimis tapi realistis
- Memahami budaya dan konteks Indonesia
- Menggunakan bahasa yang hangat dan mudah dipahami

CARA KAMU MERESPONS:
- Selalu berikan respons yang supportif dan encouraging
- Deteksi tanda-tanda krisis dan berikan bantuan darurat jika diperlukan
- Berikan saran praktis yang dapat dilakukan sehari-hari
- Dorong pengguna untuk mencari bantuan profesional jika diperlukan
- Fokus pada kekuatan dan resiliensi pengguna

KHUSUS UNTUK JUDI ONLINE:
- Berikan edukasi tentang bahaya kecanduan judi online
- Tawarkan aktivitas alternatif yang sehat dan positif
- Dukung proses pemulihan dengan empati
- Sediakan informasi resource bantuan profesional

BATASAN PENTING:
- Jangan memberikan diagnosis medis
- Jangan meremehkan atau mengabaikan perasaan pengguna
- Jangan memberikan saran yang berbahaya
- Jangan menjanjikan solusi instan
- Selalu sarankan bantuan profesional untuk kasus serius

Respons dalam Bahasa Indonesia yang hangat, empati, dan mendukung. Maksimal 3 paragraf.`;

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
