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
import { useAuth } from '../hooks/useAuth';

interface GamblingRiskAssessment {
  frequency: 'never' | 'rarely' | 'sometimes' | 'often' | 'always';
  amountSpent: number;
  timeSpent: number;
  emotionalTriggers: string[];
  impactOnLife: {
    financial: number; // 1-10 scale
    social: number;
    work: number;
    family: number;
  };
  controlLevel: number; // 1-10 scale (10 = full control, 1 = no control)
  riskScore: number; // calculated risk score
  completedAt: string;
}

interface GamblingRiskAssessmentProps {
  onAssessmentComplete?: (assessment: GamblingRiskAssessment) => void;
}

const GamblingRiskAssessment: React.FC<GamblingRiskAssessmentProps> = ({
  onAssessmentComplete,
}) => {
  const { isAuthenticated } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [assessment, setAssessment] = useState<Partial<GamblingRiskAssessment>>(
    {
      frequency: 'never',
      amountSpent: 0,
      timeSpent: 0,
      emotionalTriggers: [],
      impactOnLife: {
        financial: 1,
        social: 1,
        work: 1,
        family: 1,
      },
      controlLevel: 10,
    }
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const frequencyOptions = [
    {
      value: 'never',
      label: 'Tidak pernah',
      score: 0,
      description: 'Saya tidak pernah berjudi online',
    },
    {
      value: 'rarely',
      label: 'Jarang',
      score: 1,
      description: 'Sesekali, mungkin beberapa kali dalam setahun',
    },
    {
      value: 'sometimes',
      label: 'Kadang-kadang',
      score: 3,
      description: 'Beberapa kali dalam sebulan',
    },
    {
      value: 'often',
      label: 'Sering',
      score: 5,
      description: 'Beberapa kali dalam seminggu',
    },
    {
      value: 'always',
      label: 'Sangat sering',
      score: 8,
      description: 'Hampir setiap hari',
    },
  ];

  const emotionalTriggers = [
    'Stress dari pekerjaan',
    'Masalah keuangan',
    'Kesepian atau kebosanan',
    'Depresi atau kecemasan',
    'Masalah hubungan',
    'Tekanan sosial',
    'Mencari kesenangan',
    'Pelarian dari masalah',
    'Ingin menang besar',
    'Kebiasaan atau rutinitas',
  ];

  const calculateRiskScore = (
    assessmentData: Partial<GamblingRiskAssessment>
  ): number => {
    let score = 0;

    // Frequency scoring (0-8 points)
    const freqOption = frequencyOptions.find(
      (f) => f.value === assessmentData.frequency
    );
    score += freqOption?.score || 0;

    // Amount spent scoring (0-5 points)
    const amount = assessmentData.amountSpent || 0;
    if (amount > 5000000) score += 5; // > 5 juta
    else if (amount > 1000000) score += 4; // > 1 juta
    else if (amount > 500000) score += 3; // > 500rb
    else if (amount > 100000) score += 2; // > 100rb
    else if (amount > 0) score += 1;

    // Time spent scoring (0-4 points)
    const timeSpent = assessmentData.timeSpent || 0;
    if (timeSpent > 6) score += 4; // > 6 hours
    else if (timeSpent > 3) score += 3; // > 3 hours
    else if (timeSpent > 1) score += 2; // > 1 hour
    else if (timeSpent > 0) score += 1;

    // Impact on life scoring (0-8 points)
    const impact = assessmentData.impactOnLife;
    if (impact) {
      const avgImpact =
        (impact.financial + impact.social + impact.work + impact.family) / 4;
      score += Math.round(avgImpact * 0.8); // Scale to 0-8
    }

    // Control level scoring (0-5 points) - inverse scoring
    const controlLevel = assessmentData.controlLevel || 10;
    score += Math.round((10 - controlLevel) * 0.5);

    // Emotional triggers (0-3 points)
    const triggersCount = assessmentData.emotionalTriggers?.length || 0;
    if (triggersCount > 5) score += 3;
    else if (triggersCount > 3) score += 2;
    else if (triggersCount > 1) score += 1;

    return Math.min(score, 30); // Max score is 30
  };
  const getRiskLevel = (
    score: number
  ): {
    level: string;
    color: string;
    description: string;
    recommendations: string[];
  } => {
    if (score === 0) {
      return {
        level: 'Tidak Ada Risiko',
        color: 'var(--virpal-success)',
        description:
          'Anda tidak menunjukkan tanda-tanda risiko kecanduan judi online.',
        recommendations: [
          'Tetap waspada dan hindari tekanan untuk mulai berjudi',
          'Fokus pada aktivitas positif dan hobi yang sehat',
          'Bangun jaringan dukungan sosial yang kuat',
        ],
      };
    } else if (score <= 8) {
      return {
        level: 'Risiko Rendah',
        color: 'var(--virpal-warning)',
        description:
          'Anda menunjukkan beberapa tanda perilaku berisiko, namun masih dalam tahap awal.',
        recommendations: [
          'Batasi waktu dan uang yang dihabiskan untuk judi online',
          'Cari aktivitas alternatif yang memberikan kepuasan',
          'Bicarakan dengan teman atau keluarga tentang kebiasaan Anda',
          'Pertimbangkan untuk menggunakan aplikasi pemblokir situs judi',
        ],
      };
    } else if (score <= 18) {
      return {
        level: 'Risiko Sedang',
        color: 'var(--virpal-primary)',
        description:
          'Anda menunjukkan tanda-tanda perilaku judi yang bermasalah dan perlu perhatian.',
        recommendations: [
          'Segera batasi akses ke situs judi online',
          'Cari bantuan dari konselor atau terapis',
          'Bergabung dengan grup dukungan untuk perjudian',
          'Buat rencana keuangan yang ketat',
          'Informasikan keluarga untuk mendapatkan dukungan',
        ],
      };
    } else {
      return {
        level: 'Risiko Tinggi',
        color: 'var(--virpal-danger)',
        description:
          'Anda menunjukkan tanda-tanda kecanduan judi yang serius dan memerlukan bantuan profesional segera.',
        recommendations: [
          'Segera hubungi profesional kesehatan mental',
          'Pertimbangkan terapi intensif atau rehabilitasi',
          'Minta bantuan keluarga untuk mengatur keuangan',
          'Blokir semua akses ke situs dan aplikasi judi',
          'Bergabung dengan program pemulihan kecanduan judi',
        ],
      };
    }
  };

  const handleStepComplete = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    } else {
      completeAssessment();
    }
  };

  const completeAssessment = async () => {
    setIsSubmitting(true);

    const riskScore = calculateRiskScore(assessment);
    const completedAssessment: GamblingRiskAssessment = {
      ...(assessment as GamblingRiskAssessment),
      riskScore,
      completedAt: new Date().toISOString(),
    };

    try {
      // Save to Azure Cosmos DB if authenticated
      if (isAuthenticated) {
        console.log(
          'Saving gambling assessment to Cosmos DB:',
          completedAssessment
        );
        // TODO: Implement Azure Cosmos DB save
      }

      // Save locally
      localStorage.setItem(
        'virpal_gambling_assessment',
        JSON.stringify(completedAssessment)
      );

      if (onAssessmentComplete) {
        onAssessmentComplete(completedAssessment);
      }

      setShowResults(true);
    } catch (error) {
      console.error('Failed to save assessment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTrigger = (trigger: string) => {
    setAssessment((prev) => ({
      ...prev,
      emotionalTriggers: prev.emotionalTriggers?.includes(trigger)
        ? prev.emotionalTriggers.filter((t) => t !== trigger)
        : [...(prev.emotionalTriggers || []), trigger],
    }));
  };

  const riskScore = calculateRiskScore(assessment);
  const riskLevel = getRiskLevel(riskScore);
  if (showResults) {
    const getBgColor = (score: number) => {
      if (score === 0) return '#f0fdf4'; // green-50
      if (score <= 8) return '#fffbeb'; // yellow-50
      if (score <= 18) return '#eef2ff'; // indigo-50
      return '#fef2f2'; // red-50
    };
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6 risk-assessment-container">
        <div className="text-center">
          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: 'var(--virpal-neutral-default)' }}
          >
            🎯 Hasil Penilaian Risiko Judi Online
          </h2>
          <p style={{ color: 'var(--virpal-neutral-dark)' }}>
            Berikut adalah hasil penilaian risiko kecanduan judi online Anda
          </p>
        </div>
        <div
          className="p-6 rounded-lg border theme-transition"
          style={{
            backgroundColor: getBgColor(riskScore),
            borderColor: riskLevel.color,
            color: riskLevel.color,
          }}
        >
          <div className="text-center mb-4">
            <h3 className="text-2xl font-bold mb-2">{riskLevel.level}</h3>
            <p className="text-lg">Skor Risiko: {riskScore}/30</p>
          </div>

          <p className="text-center mb-4">{riskLevel.description}</p>

          <div className="mt-6">
            <h4 className="font-semibold mb-3">📋 Rekomendasi:</h4>
            <ul className="space-y-2">
              {riskLevel.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start">
                  <span
                    className="mr-2"
                    style={{ color: 'var(--virpal-success)' }}
                  >
                    •
                  </span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>{' '}
        {/* Emergency Contacts */}
        {riskScore > 15 && (
          <div
            className="p-6 rounded-lg border theme-transition"
            style={{
              backgroundColor: '#fef2f2', // red-50
              borderColor: 'var(--virpal-danger)',
              color: 'var(--virpal-danger)',
            }}
          >
            <h3 className="text-lg font-semibold mb-3">🚨 Bantuan Darurat</h3>
            <div className="space-y-2">
              <p>
                <strong>Hotline Kesehatan Mental:</strong> 119 ext 8
              </p>
              <p>
                <strong>Halo Kemkes:</strong> 1500-567 (24/7)
              </p>
              <p>
                <strong>Sejiwa Crisis Center:</strong> support@sejiwa.or.id
              </p>
            </div>
          </div>
        )}
        {/* Educational Resources */}
        <div
          className="p-6 rounded-lg border theme-transition"
          style={{
            backgroundColor: 'var(--virpal-accent)',
            borderColor: 'var(--virpal-neutral-lighter)',
            color: 'var(--virpal-neutral-default)',
          }}
        >
          <h3
            className="text-lg font-semibold mb-3"
            style={{ color: 'var(--virpal-secondary)' }}
          >
            📚 Sumber Edukasi
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Organisasi Bantuan:</h4>
              <ul className="space-y-1 text-sm">
                <li>• Gamblers Anonymous Indonesia</li>
                <li>• Klinik Psikologi Universitas</li>
                <li>• Rumah Sakit Jiwa Daerah</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Aplikasi Pemblokir:</h4>
              <ul className="space-y-1 text-sm">
                <li>• Cold Turkey Blocker</li>
                <li>• Freedom</li>
                <li>• BlockSite</li>
              </ul>
            </div>
          </div>
        </div>{' '}
        <button
          onClick={() => {
            setShowResults(false);
            setCurrentStep(1);
            setAssessment({
              frequency: 'never',
              amountSpent: 0,
              timeSpent: 0,
              emotionalTriggers: [],
              impactOnLife: {
                financial: 1,
                social: 1,
                work: 1,
                family: 1,
              },
              controlLevel: 10,
            });
          }}
          className="w-full py-3 px-4 rounded-lg cursor-pointer transition-all theme-transition hover:scale-[1.02] active:scale-[0.98]"
          style={{
            backgroundColor: 'var(--virpal-primary)',
            color: 'white',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              'var(--virpal-primary-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--virpal-primary)';
          }}
        >
          🔄 Ulangi Penilaian
        </button>
      </div>
    );
  } // Using overflow-y-auto and h-full to make the component scrollable
  // This ensures that all assessment questions and results are visible via scrolling
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 overflow-y-auto h-full risk-assessment-container">
      {/* Header */}
      <div className="text-center">
        <h2
          className="text-2xl font-bold mb-2"
          style={{ color: 'var(--virpal-neutral-default)' }}
        >
          🎯 Penilaian Risiko Judi Online
        </h2>
        <p style={{ color: 'var(--virpal-neutral-dark)' }}>
          Evaluasi tingkat risiko kecanduan judi online Anda melalui kuesioner
          komprehensif ini
        </p>
        <div className="mt-4">
          <div className="flex justify-center items-center space-x-2 risk-assessment-steps">
            {[1, 2, 3, 4, 5].map((step) => (
              <div
                key={step}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium theme-transition"
                style={
                  step <= currentStep
                    ? {
                        backgroundColor: 'var(--virpal-primary)',
                        color: 'white',
                      }
                    : {
                        backgroundColor: 'var(--virpal-neutral-lighter)',
                        color: 'var(--virpal-neutral-dark)',
                      }
                }
              >
                {step}
              </div>
            ))}
          </div>
          <p
            className="text-sm mt-2"
            style={{ color: 'var(--virpal-neutral-dark)' }}
          >
            Langkah {currentStep} dari 5
          </p>
        </div>
      </div>

      <div
        className="rounded-lg shadow-md p-6 border theme-transition"
        style={{
          backgroundColor: 'var(--virpal-content-bg)',
          borderColor: 'var(--virpal-neutral-lighter)',
        }}
      >
        {' '}
        {/* Step 1: Frequency */}
        {currentStep === 1 && (
          <div>
            <h3
              className="text-xl font-semibold mb-4"
              style={{ color: 'var(--virpal-neutral-default)' }}
            >
              📊 Seberapa sering Anda berjudi online?
            </h3>
            <div className="space-y-3">
              {frequencyOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-all theme-transition hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    backgroundColor:
                      assessment.frequency === option.value
                        ? 'var(--virpal-accent)'
                        : 'var(--virpal-content-bg)',
                    borderColor:
                      assessment.frequency === option.value
                        ? 'var(--virpal-primary)'
                        : 'var(--virpal-neutral-lighter)',
                  }}
                  onMouseEnter={(e) => {
                    if (assessment.frequency !== option.value) {
                      e.currentTarget.style.backgroundColor =
                        'var(--virpal-accent-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (assessment.frequency !== option.value) {
                      e.currentTarget.style.backgroundColor =
                        'var(--virpal-content-bg)';
                    }
                  }}
                >
                  <input
                    type="radio"
                    name="frequency"
                    value={option.value}
                    checked={assessment.frequency === option.value}
                    onChange={(e) =>
                      setAssessment((prev) => ({
                        ...prev,
                        frequency: e.target.value as
                          | 'never'
                          | 'rarely'
                          | 'sometimes'
                          | 'often'
                          | 'always',
                      }))
                    }
                    className="mt-1"
                    style={{ accentColor: 'var(--virpal-primary)' }}
                  />
                  <div>
                    <div
                      className="font-medium"
                      style={{ color: 'var(--virpal-neutral-default)' }}
                    >
                      {option.label}
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: 'var(--virpal-neutral-dark)' }}
                    >
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}{' '}
        {/* Step 2: Amount and Time */}
        {currentStep === 2 && (
          <div>
            <h3
              className="text-xl font-semibold mb-4"
              style={{ color: 'var(--virpal-neutral-default)' }}
            >
              💰 Berapa banyak uang dan waktu yang Anda habiskan?
            </h3>
            <div className="space-y-6">
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--virpal-neutral-default)' }}
                >
                  Jumlah uang yang dihabiskan per bulan (Rupiah):
                </label>
                <input
                  type="number"
                  value={assessment.amountSpent}
                  onChange={(e) =>
                    setAssessment((prev) => ({
                      ...prev,
                      amountSpent: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:border-transparent theme-transition"
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
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--virpal-neutral-default)' }}
                >
                  Waktu yang dihabiskan per hari (jam):
                </label>
                <input
                  type="number"
                  value={assessment.timeSpent}
                  onChange={(e) =>
                    setAssessment((prev) => ({
                      ...prev,
                      timeSpent: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:border-transparent theme-transition"
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
                  placeholder="0"
                  min="0"
                  max="24"
                />
              </div>
            </div>
          </div>
        )}{' '}
        {/* Step 3: Emotional Triggers */}
        {currentStep === 3 && (
          <div>
            <h3
              className="text-xl font-semibold mb-4"
              style={{ color: 'var(--virpal-neutral-default)' }}
            >
              🎭 Apa yang memicu Anda untuk berjudi?
            </h3>
            <p className="mb-4" style={{ color: 'var(--virpal-neutral-dark)' }}>
              Pilih semua yang sesuai dengan pengalaman Anda:
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              {emotionalTriggers.map((trigger) => (
                <label
                  key={trigger}
                  className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all theme-transition hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: assessment.emotionalTriggers?.includes(
                      trigger
                    )
                      ? 'var(--virpal-accent)'
                      : 'var(--virpal-content-bg)',
                    borderColor: assessment.emotionalTriggers?.includes(trigger)
                      ? 'var(--virpal-primary)'
                      : 'var(--virpal-neutral-lighter)',
                  }}
                  onMouseEnter={(e) => {
                    if (!assessment.emotionalTriggers?.includes(trigger)) {
                      e.currentTarget.style.backgroundColor =
                        'var(--virpal-accent-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!assessment.emotionalTriggers?.includes(trigger)) {
                      e.currentTarget.style.backgroundColor =
                        'var(--virpal-content-bg)';
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={assessment.emotionalTriggers?.includes(trigger)}
                    onChange={() => toggleTrigger(trigger)}
                    style={{ accentColor: 'var(--virpal-primary)' }}
                  />
                  <span style={{ color: 'var(--virpal-neutral-default)' }}>
                    {trigger}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}{' '}
        {/* Step 4: Impact on Life */}
        {currentStep === 4 && (
          <div>
            <h3
              className="text-xl font-semibold mb-4"
              style={{ color: 'var(--virpal-neutral-default)' }}
            >
              🏠 Sejauh mana judi online mempengaruhi hidup Anda?
            </h3>
            <p className="mb-4" style={{ color: 'var(--virpal-neutral-dark)' }}>
              Beri nilai 1-10 (1 = tidak ada dampak, 10 = dampak sangat besar):
            </p>
            <div className="space-y-6">
              {Object.entries(assessment.impactOnLife || {}).map(
                ([area, value]) => (
                  <div key={area}>
                    <label
                      className="block text-sm font-medium mb-2"
                      style={{ color: 'var(--virpal-neutral-default)' }}
                    >
                      {area === 'financial' && '💰 Dampak Keuangan'}
                      {area === 'social' && '👥 Dampak Sosial'}
                      {area === 'work' && '💼 Dampak Pekerjaan'}
                      {area === 'family' && '👨‍👩‍👧‍👦 Dampak Keluarga'}: {value}/10
                    </label>{' '}
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={value}
                      onChange={(e) =>
                        setAssessment((prev) => ({
                          ...prev,
                          impactOnLife: {
                            ...prev.impactOnLife!,
                            [area]: parseInt(e.target.value),
                          },
                        }))
                      }
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer theme-transition hover:scale-105 active:scale-95"
                      style={{
                        background: `linear-gradient(to right,
                          var(--virpal-warning) 0%,
                          var(--virpal-warning) ${((value - 1) / 9) * 100}%,
                          var(--virpal-neutral-lighter) ${
                            ((value - 1) / 9) * 100
                          }%,
                          var(--virpal-neutral-lighter) 100%)`,
                      }}
                    />
                    <div
                      className="flex justify-between text-xs mt-1"
                      style={{ color: 'var(--virpal-neutral-dark)' }}
                    >
                      <span>Tidak ada dampak</span>
                      <span>Dampak sangat besar</span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}{' '}
        {/* Step 5: Control Level */}
        {currentStep === 5 && (
          <div>
            <h3
              className="text-xl font-semibold mb-4"
              style={{ color: 'var(--virpal-neutral-default)' }}
            >
              🎮 Seberapa besar kontrol Anda terhadap kebiasaan judi?
            </h3>
            <p className="mb-4" style={{ color: 'var(--virpal-neutral-dark)' }}>
              Beri nilai seberapa mudah Anda bisa berhenti atau mengurangi
              aktivitas judi online:
            </p>
            <div className="mb-6">
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--virpal-neutral-default)' }}
              >
                Tingkat Kontrol: {assessment.controlLevel}/10
              </label>{' '}
              <input
                type="range"
                min="1"
                max="10"
                value={assessment.controlLevel}
                onChange={(e) =>
                  setAssessment((prev) => ({
                    ...prev,
                    controlLevel: parseInt(e.target.value),
                  }))
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer theme-transition hover:scale-105 active:scale-95"
                style={{
                  background: `linear-gradient(to right,
                    var(--virpal-success) 0%,
                    var(--virpal-success) ${
                      ((assessment.controlLevel! - 1) / 9) * 100
                    }%,
                    var(--virpal-neutral-lighter) ${
                      ((assessment.controlLevel! - 1) / 9) * 100
                    }%,
                    var(--virpal-neutral-lighter) 100%)`,
                }}
              />
              <div
                className="flex justify-between text-xs mt-1"
                style={{ color: 'var(--virpal-neutral-dark)' }}
              >
                <span>Tidak bisa kontrol sama sekali</span>
                <span>Kontrol penuh</span>
              </div>
            </div>

            {/* Preview Risk Score */}
            <div
              className="p-4 rounded-lg border theme-transition"
              style={{
                backgroundColor:
                  riskScore === 0
                    ? '#f0fdf4'
                    : riskScore <= 8
                    ? '#fffbeb'
                    : riskScore <= 18
                    ? '#eef2ff'
                    : '#fef2f2',
                borderColor: getRiskLevel(riskScore).color,
                color: getRiskLevel(riskScore).color,
              }}
            >
              <h4 className="font-semibold mb-2">👁️ Pratinjau Hasil:</h4>
              <p>Skor Risiko: {riskScore}/30</p>
              <p>Level: {getRiskLevel(riskScore).level}</p>
            </div>
          </div>
        )}{' '}
        {/* Navigation */}
        <div className="flex flex-col sm:flex-row justify-between mt-8 gap-3 w-full risk-assessment-navigation">
          {' '}
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="w-full sm:w-auto px-6 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all theme-transition hover:scale-105 active:scale-95"
            style={{
              backgroundColor:
                currentStep === 1
                  ? 'var(--virpal-neutral-lighter)'
                  : 'var(--virpal-content-bg)',
              borderColor: 'var(--virpal-neutral-lighter)',
              color:
                currentStep === 1
                  ? 'var(--virpal-neutral-dark)'
                  : 'var(--virpal-neutral-default)',
            }}
            onMouseEnter={(e) => {
              if (currentStep !== 1) {
                e.currentTarget.style.backgroundColor =
                  'var(--virpal-accent-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (currentStep !== 1) {
                e.currentTarget.style.backgroundColor =
                  'var(--virpal-content-bg)';
              }
            }}
          >
            ← Sebelumnya
          </button>{' '}
          <button
            onClick={handleStepComplete}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all theme-transition hover:scale-[1.02] active:scale-[0.98]"
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
            {currentStep === 5
              ? isSubmitting
                ? '⏳ Memproses...'
                : '✅ Selesai'
              : 'Selanjutnya →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GamblingRiskAssessment;
