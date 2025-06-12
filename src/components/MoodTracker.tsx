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

import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface MoodEntry {
  date: string;
  mood: 'very_happy' | 'happy' | 'neutral' | 'sad' | 'very_sad';
  energy: number; // 1-10 scale
  anxiety: number; // 1-10 scale
  stress: number; // 1-10 scale
  notes?: string;
  triggers?: string[];
  activities?: string[];
}

interface MoodTrackerProps {
  onMoodUpdate?: (mood: MoodEntry) => void;
}

const MoodTracker: React.FC<MoodTrackerProps> = ({ onMoodUpdate }) => {
  const { isAuthenticated } = useAuth();
  const [currentMood, setCurrentMood] = useState<MoodEntry>({
    date:
      new Date().toISOString().split('T')[0] || new Date().toLocaleDateString(),
    mood: 'neutral',
    energy: 5,
    anxiety: 5,
    stress: 5,
    notes: '',
    triggers: [],
    activities: [],
  });

  const [moodHistory, setMoodHistory] = useState<MoodEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const moodOptions = [
    {
      value: 'very_happy',
      label: 'Sangat Bahagia',
      emoji: '😊',
      color: 'var(--virpal-success)',
      borderColor: 'var(--virpal-success)',
      textColor: 'var(--virpal-success)',
      bgSelected: '#dcfce7', // green-100
      bgHover: '#f0fdf4', // green-50
    },
    {
      value: 'happy',
      label: 'Senang',
      emoji: '🙂',
      color: 'var(--virpal-secondary)',
      borderColor: 'var(--virpal-secondary)',
      textColor: 'var(--virpal-secondary)',
      bgSelected: '#cffafe', // cyan-100
      bgHover: '#ecfeff', // cyan-50
    },
    {
      value: 'neutral',
      label: 'Netral',
      emoji: '😐',
      color: 'var(--virpal-warning)',
      borderColor: 'var(--virpal-warning)',
      textColor: 'var(--virpal-warning)',
      bgSelected: '#fef3c7', // yellow-100
      bgHover: '#fffbeb', // yellow-50
    },
    {
      value: 'sad',
      label: 'Sedih',
      emoji: '🙁',
      color: 'var(--virpal-primary)',
      borderColor: 'var(--virpal-primary)',
      textColor: 'var(--virpal-primary)',
      bgSelected: '#e0e7ff', // indigo-100
      bgHover: '#eef2ff', // indigo-50
    },
    {
      value: 'very_sad',
      label: 'Sangat Sedih',
      emoji: '😢',
      color: 'var(--virpal-danger)',
      borderColor: 'var(--virpal-danger)',
      textColor: 'var(--virpal-danger)',
      bgSelected: '#fee2e2', // red-100
      bgHover: '#fef2f2', // red-50
    },
  ];

  const commonTriggers = [
    'Pekerjaan',
    'Keuangan',
    'Hubungan',
    'Kesehatan',
    'Keluarga',
    'Judi Online',
    'Media Sosial',
    'Kurang Tidur',
    'Deadline',
    'Konflik',
  ];

  const positiveActivities = [
    'Olahraga',
    'Meditasi',
    'Membaca',
    'Musik',
    'Bersosialisasi',
    'Jalan-jalan',
    'Hobi Kreatif',
    'Menonton Film',
    'Masak',
    'Belajar Baru',
  ];
  useEffect(() => {
    loadMoodHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const loadMoodHistory = async () => {
    if (!isAuthenticated) return;

    try {
      // Load from Azure Cosmos DB or local storage
      const stored = localStorage.getItem('virpal_mood_history');
      if (stored) {
        const history = JSON.parse(stored);
        setMoodHistory(history);
      }
    } catch (error) {
      console.error('Failed to load mood history:', error);
    }
  };

  const saveMoodEntry = async () => {
    setIsSubmitting(true);

    try {
      const newEntry = {
        ...currentMood,
        timestamp: new Date().toISOString(),
      };

      // Save to Azure Cosmos DB if authenticated
      if (isAuthenticated) {
        // TODO: Implement Azure Cosmos DB save
        console.log('Saving to Cosmos DB:', newEntry);
      }

      // Also save locally for offline support
      const updatedHistory = [newEntry, ...moodHistory].slice(0, 30); // Keep last 30 entries
      setMoodHistory(updatedHistory);
      localStorage.setItem(
        'virpal_mood_history',
        JSON.stringify(updatedHistory)
      );

      if (onMoodUpdate) {
        onMoodUpdate(newEntry);
      } // Reset form
      setCurrentMood({
        date:
          new Date().toISOString().split('T')[0] ||
          new Date().toLocaleDateString(),
        mood: 'neutral',
        energy: 5,
        anxiety: 5,
        stress: 5,
        notes: '',
        triggers: [],
        activities: [],
      });
    } catch (error) {
      console.error('Failed to save mood entry:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMoodTrend = () => {
    if (moodHistory.length < 2) return 'insufficient_data';

    const recent = moodHistory.slice(0, 7); // Last 7 days
    const moodValues = recent.map((entry) => {
      const moodValue = {
        very_sad: 1,
        sad: 2,
        neutral: 3,
        happy: 4,
        very_happy: 5,
      };
      return moodValue[entry.mood];
    });

    const average = moodValues.reduce((a, b) => a + b, 0) / moodValues.length;

    if (average >= 4) return 'improving';
    if (average >= 3) return 'stable';
    return 'concerning';
  };

  const toggleTrigger = (trigger: string) => {
    setCurrentMood((prev) => ({
      ...prev,
      triggers: prev.triggers?.includes(trigger)
        ? prev.triggers.filter((t) => t !== trigger)
        : [...(prev.triggers || []), trigger],
    }));
  };

  const toggleActivity = (activity: string) => {
    setCurrentMood((prev) => ({
      ...prev,
      activities: prev.activities?.includes(activity)
        ? prev.activities.filter((a) => a !== activity)
        : [...(prev.activities || []), activity],
    }));
  };
  const trend = getMoodTrend();

  const getTrendColor = (trendType: string): string => {
    switch (trendType) {
      case 'improving':
        return 'var(--virpal-success)';
      case 'stable':
        return 'var(--virpal-warning)';
      case 'concerning':
        return 'var(--virpal-danger)';
      default:
        return 'var(--virpal-neutral-dark)';
    }
  };

  const getTrendBgColor = (trendType: string): string => {
    switch (trendType) {
      case 'improving':
        return '#f0fdf4'; // green-50
      case 'stable':
        return '#fffbeb'; // yellow-50
      case 'concerning':
        return '#fef2f2'; // red-50
      default:
        return '#f8fafc'; // gray-50
    }
  }; // Using overflow-y-auto and h-full to make the component scrollable
  // This ensures that content doesn't get cut off when it exceeds viewport
  return (
    <>
      {/* Custom CSS untuk range sliders */}
      <style>
        {`
          /* Custom styles untuk range sliders yang lebih interactive */
          .mood-tracker-container input[type="range"]::-webkit-slider-thumb {
            appearance: none;
            height: 20px;
            width: 20px;
            border-radius: 50%;
            background: var(--virpal-primary);
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            transition: all 0.2s ease;
          }

          .mood-tracker-container input[type="range"]::-webkit-slider-thumb:hover {
            transform: scale(1.2);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          }

          .mood-tracker-container input[type="range"]::-webkit-slider-thumb:active {
            transform: scale(1.1);
          }

          .mood-tracker-container input[type="range"]::-moz-range-thumb {
            height: 20px;
            width: 20px;
            border-radius: 50%;
            background: var(--virpal-primary);
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            transition: all 0.2s ease;
            border: none;
          }

          .mood-tracker-container input[type="range"]::-moz-range-thumb:hover {
            transform: scale(1.2);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          }
        `}
      </style>
      <div className="max-w-4xl mx-auto p-6 space-y-6 overflow-y-auto h-full mood-tracker-container">
        {/* Header */}
        <div className="text-center">
          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: 'var(--virpal-neutral-default)' }}
          >
            📊 Mood Tracker - Monitor Kesehatan Mental
          </h2>
          <p style={{ color: 'var(--virpal-neutral-dark)' }}>
            Catat mood dan perasaan Anda setiap hari untuk membantu VirPal
            memberikan dukungan yang lebih personal
          </p>
        </div>{' '}
        {/* Mood Trend Overview */}
        {moodHistory.length > 0 && (
          <div
            className="p-4 rounded-lg border theme-transition"
            style={{
              backgroundColor: getTrendBgColor(trend),
              borderColor: getTrendColor(trend),
              color: getTrendColor(trend),
            }}
          >
            <h3 className="font-semibold mb-2">📈 Tren Mood 7 Hari Terakhir</h3>
            <p>
              {trend === 'improving' &&
                '✨ Mood Anda menunjukkan tren positif!'}
              {trend === 'stable' && '📊 Mood Anda relatif stabil.'}
              {trend === 'concerning' &&
                '⚠️ Mood Anda perlu perhatian. Pertimbangkan untuk berbicara dengan profesional.'}
              {trend === 'insufficient_data' &&
                '📝 Catat mood lebih sering untuk analisis yang lebih akurat.'}
            </p>
          </div>
        )}
        {/* Today's Mood Entry */}
        <div
          className="rounded-lg shadow-md p-6 border theme-transition"
          style={{
            backgroundColor: 'var(--virpal-content-bg)',
            borderColor: 'var(--virpal-neutral-lighter)',
          }}
        >
          <h3
            className="text-xl font-semibold mb-4"
            style={{ color: 'var(--virpal-neutral-default)' }}
          >
            🗓️ Bagaimana perasaan Anda hari ini?
          </h3>{' '}
          {/* Mood Selection */}
          <div className="mb-6">
            <label
              className="block text-sm font-medium mb-3"
              style={{ color: 'var(--virpal-neutral-default)' }}
            >
              Pilih mood Anda saat ini:
            </label>
            <div className="grid grid-cols-5 gap-2">
              {' '}
              {moodOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setCurrentMood((prev) => ({
                      ...prev,
                      mood: option.value as
                        | 'very_happy'
                        | 'happy'
                        | 'neutral'
                        | 'sad'
                        | 'very_sad',
                    }))
                  }
                  className="p-3 rounded-lg border-2 transition-all theme-transition cursor-pointer hover:scale-105 active:scale-95"
                  style={
                    currentMood.mood === option.value
                      ? {
                          backgroundColor: option.bgSelected,
                          borderColor: option.borderColor,
                          color: option.textColor,
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        }
                      : {
                          backgroundColor: 'var(--virpal-content-bg)',
                          borderColor: 'var(--virpal-neutral-lighter)',
                          color: 'var(--virpal-neutral-default)',
                        }
                  }
                  onMouseEnter={(e) => {
                    if (currentMood.mood !== option.value) {
                      e.currentTarget.style.backgroundColor = option.bgHover;
                      e.currentTarget.style.borderColor = option.borderColor;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentMood.mood !== option.value) {
                      e.currentTarget.style.backgroundColor =
                        'var(--virpal-content-bg)';
                      e.currentTarget.style.borderColor =
                        'var(--virpal-neutral-lighter)';
                    }
                  }}
                >
                  <div className="text-2xl mb-1">{option.emoji}</div>
                  <div className="text-xs font-medium">{option.label}</div>
                </button>
              ))}
            </div>
          </div>{' '}
          {/* Scales */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {/* Energy Level */}
            <div>
              {' '}
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--virpal-neutral-default)' }}
              >
                ⚡ Tingkat Energi: {currentMood.energy}/10
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={currentMood.energy}
                onChange={(e) =>
                  setCurrentMood((prev) => ({
                    ...prev,
                    energy: parseInt(e.target.value),
                  }))
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer theme-transition hover:scale-105 active:scale-95"
                style={{
                  background: `linear-gradient(to right, var(--virpal-secondary) 0%, var(--virpal-secondary) ${
                    (currentMood.energy - 1) * 11.11
                  }%, var(--virpal-neutral-lighter) ${
                    (currentMood.energy - 1) * 11.11
                  }%, var(--virpal-neutral-lighter) 100%)`,
                }}
              />
              <div
                className="flex justify-between text-xs mt-1"
                style={{ color: 'var(--virpal-neutral-dark)' }}
              >
                <span>Sangat Lelah</span>
                <span>Sangat Berenergi</span>
              </div>
            </div>

            {/* Anxiety Level */}
            <div>
              {' '}
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--virpal-neutral-default)' }}
              >
                😰 Tingkat Kecemasan: {currentMood.anxiety}/10
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={currentMood.anxiety}
                onChange={(e) =>
                  setCurrentMood((prev) => ({
                    ...prev,
                    anxiety: parseInt(e.target.value),
                  }))
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer theme-transition hover:scale-105 active:scale-95"
                style={{
                  background: `linear-gradient(to right, var(--virpal-warning) 0%, var(--virpal-warning) ${
                    (currentMood.anxiety - 1) * 11.11
                  }%, var(--virpal-neutral-lighter) ${
                    (currentMood.anxiety - 1) * 11.11
                  }%, var(--virpal-neutral-lighter) 100%)`,
                }}
              />
              <div
                className="flex justify-between text-xs mt-1"
                style={{ color: 'var(--virpal-neutral-dark)' }}
              >
                <span>Sangat Tenang</span>
                <span>Sangat Cemas</span>
              </div>
            </div>

            {/* Stress Level */}
            <div>
              {' '}
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--virpal-neutral-default)' }}
              >
                😤 Tingkat Stress: {currentMood.stress}/10
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={currentMood.stress}
                onChange={(e) =>
                  setCurrentMood((prev) => ({
                    ...prev,
                    stress: parseInt(e.target.value),
                  }))
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer theme-transition hover:scale-105 active:scale-95"
                style={{
                  background: `linear-gradient(to right, var(--virpal-danger) 0%, var(--virpal-danger) ${
                    (currentMood.stress - 1) * 11.11
                  }%, var(--virpal-neutral-lighter) ${
                    (currentMood.stress - 1) * 11.11
                  }%, var(--virpal-neutral-lighter) 100%)`,
                }}
              />
              <div
                className="flex justify-between text-xs mt-1"
                style={{ color: 'var(--virpal-neutral-dark)' }}
              >
                <span>Sangat Rileks</span>
                <span>Sangat Stress</span>
              </div>
            </div>
          </div>{' '}
          {/* Triggers */}
          <div className="mb-6">
            <label
              className="block text-sm font-medium mb-3"
              style={{ color: 'var(--virpal-neutral-default)' }}
            >
              🎯 Apa yang mempengaruhi mood Anda hari ini? (Pilih yang sesuai)
            </label>
            <div className="flex flex-wrap gap-2">
              {' '}
              {commonTriggers.map((trigger) => (
                <button
                  key={trigger}
                  onClick={() => toggleTrigger(trigger)}
                  className="px-3 py-1 rounded-full text-sm transition-all theme-transition cursor-pointer hover:scale-105 active:scale-95"
                  style={
                    currentMood.triggers?.includes(trigger)
                      ? {
                          backgroundColor: '#fee2e2', // red-100
                          color: 'var(--virpal-danger)',
                          borderColor: 'var(--virpal-danger)',
                          border: '1px solid',
                        }
                      : {
                          backgroundColor: 'var(--virpal-accent)',
                          color: 'var(--virpal-neutral-default)',
                          borderColor: 'var(--virpal-neutral-lighter)',
                          border: '1px solid',
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!currentMood.triggers?.includes(trigger)) {
                      e.currentTarget.style.backgroundColor =
                        'var(--virpal-accent-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!currentMood.triggers?.includes(trigger)) {
                      e.currentTarget.style.backgroundColor =
                        'var(--virpal-accent)';
                    }
                  }}
                >
                  {trigger}
                </button>
              ))}
            </div>
          </div>{' '}
          {/* Positive Activities */}
          <div className="mb-6">
            <label
              className="block text-sm font-medium mb-3"
              style={{ color: 'var(--virpal-neutral-default)' }}
            >
              ✨ Aktivitas positif apa yang Anda lakukan hari ini?
            </label>
            <div className="flex flex-wrap gap-2">
              {' '}
              {positiveActivities.map((activity) => (
                <button
                  key={activity}
                  onClick={() => toggleActivity(activity)}
                  className="px-3 py-1 rounded-full text-sm transition-all theme-transition cursor-pointer hover:scale-105 active:scale-95"
                  style={
                    currentMood.activities?.includes(activity)
                      ? {
                          backgroundColor: '#dcfce7', // green-100
                          color: 'var(--virpal-success)',
                          borderColor: 'var(--virpal-success)',
                          border: '1px solid',
                        }
                      : {
                          backgroundColor: 'var(--virpal-accent)',
                          color: 'var(--virpal-neutral-default)',
                          borderColor: 'var(--virpal-neutral-lighter)',
                          border: '1px solid',
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!currentMood.activities?.includes(activity)) {
                      e.currentTarget.style.backgroundColor =
                        'var(--virpal-accent-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!currentMood.activities?.includes(activity)) {
                      e.currentTarget.style.backgroundColor =
                        'var(--virpal-accent)';
                    }
                  }}
                >
                  {activity}
                </button>
              ))}
            </div>
          </div>{' '}
          {/* Notes */}
          <div className="mb-6">
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--virpal-neutral-default)' }}
            >
              📝 Catatan tambahan (opsional):
            </label>{' '}
            <textarea
              value={currentMood.notes}
              onChange={(e) =>
                setCurrentMood((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Ceritakan lebih detail tentang perasaan Anda hari ini..."
              className="w-full p-3 border rounded-lg focus:ring-2 focus:border-transparent theme-transition resize-none hover:border-opacity-80 cursor-text"
              style={{
                backgroundColor: 'var(--virpal-content-bg)',
                borderColor: 'var(--virpal-neutral-lighter)',
                color: 'var(--virpal-neutral-default)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--virpal-primary)';
                e.currentTarget.style.boxShadow = `0 0 0 2px rgba(121, 80, 242, 0.1)`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor =
                  'var(--virpal-neutral-lighter)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              rows={3}
            />
          </div>
          {/* Submit Button */}{' '}
          <button
            onClick={saveMoodEntry}
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:scale-[1.02] active:scale-[0.98] theme-transition"
            style={{
              backgroundColor: isSubmitting
                ? 'var(--virpal-neutral-lighter)'
                : 'var(--virpal-primary)',
              color: isSubmitting ? 'var(--virpal-neutral-dark)' : 'white',
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor =
                  'var(--virpal-primary-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = 'var(--virpal-primary)';
              }
            }}
          >
            {isSubmitting ? '💾 Menyimpan...' : '💾 Simpan Mood Hari Ini'}
          </button>
        </div>{' '}
        {/* Recent Mood History */}
        {moodHistory.length > 0 && (
          <div
            className="rounded-lg shadow-md p-6 border theme-transition"
            style={{
              backgroundColor: 'var(--virpal-content-bg)',
              borderColor: 'var(--virpal-neutral-lighter)',
            }}
          >
            <h3
              className="text-xl font-semibold mb-4"
              style={{ color: 'var(--virpal-neutral-default)' }}
            >
              📅 Riwayat Mood Terakhir
            </h3>
            <div className="space-y-3">
              {moodHistory.slice(0, 5).map((entry, index) => {
                const moodOption = moodOptions.find(
                  (m) => m.value === entry.mood
                );
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg theme-transition"
                    style={{ backgroundColor: 'var(--virpal-accent)' }}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{moodOption?.emoji}</span>
                      <div>
                        <div
                          className="font-medium"
                          style={{ color: 'var(--virpal-neutral-default)' }}
                        >
                          {moodOption?.label}
                        </div>
                        <div
                          className="text-sm"
                          style={{ color: 'var(--virpal-neutral-dark)' }}
                        >
                          {new Date(entry.date).toLocaleDateString('id-ID')}
                        </div>
                      </div>
                    </div>
                    <div
                      className="text-right text-sm"
                      style={{ color: 'var(--virpal-neutral-dark)' }}
                    >
                      <div>Energi: {entry.energy}/10</div>
                      <div>Cemas: {entry.anxiety}/10</div>
                      <div>Stress: {entry.stress}/10</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}{' '}
        {/* Mental Health Tips */}
        <div
          className="rounded-lg p-6 border theme-transition"
          style={{
            background: `linear-gradient(135deg, var(--virpal-accent) 0%, var(--virpal-neutral-lighter) 100%)`,
            borderColor: 'var(--virpal-neutral-lightest)',
          }}
        >
          <h3
            className="text-lg font-semibold mb-3"
            style={{ color: 'var(--virpal-neutral-default)' }}
          >
            💡 Tips untuk Kesehatan Mental
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm theme-transition">
            <div>
              <h4
                className="font-medium mb-2"
                style={{ color: 'var(--virpal-success)' }}
              >
                ✅ Aktivitas Yang Disarankan:
              </h4>
              <ul
                className="space-y-1"
                style={{ color: 'var(--virpal-neutral-dark)' }}
              >
                <li>• Olahraga ringan 30 menit/hari</li>
                <li>• Meditasi atau mindfulness</li>
                <li>• Tidur 7-8 jam per malam</li>
                <li>• Bersosialisasi dengan orang positif</li>
              </ul>
            </div>
            <div>
              <h4
                className="font-medium mb-2"
                style={{ color: 'var(--virpal-danger)' }}
              >
                ⚠️ Yang Sebaiknya Dihindari:
              </h4>
              <ul
                className="space-y-1"
                style={{ color: 'var(--virpal-neutral-dark)' }}
              >
                <li>• Judi online atau aktivitas adiktif</li>
                <li>• Konsumsi alkohol berlebihan</li>
                <li>• Isolasi sosial yang berlebihan</li>
                <li>• Begadang atau kurang tidur</li>
              </ul>
            </div>{' '}
          </div>
        </div>
      </div>
    </>
  );
};

export default MoodTracker;
