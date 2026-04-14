/**
 * 🚨 ALERT MANAGEMENT PANEL
 * Uses existing wizard patterns + notification system + @geo-alert/core
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, Settings, Bell, Plus } from 'lucide-react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { INTERACTIVE_PATTERNS, HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS, HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';

// Core Alert Engine Integration
import {
  geoAlertEngine,
  initializeAlertEngine
} from '@geo-alert/core';
import type { Alert, RuleContext, RuleEvaluationResult } from '@geo-alert/core/alert-engine';

// Use existing unified system types



// Existing UI Patterns
import { useNotificationDrawer } from '@/components/NotificationDrawer.enterprise';

// Integration Bridge
import { useAlertNotifications } from '../integrations/AlertNotificationBridge';

// ============================================================================
// ALERT MANAGEMENT PANEL
// ============================================================================

export interface AlertManagementPanelProps {
  className?: string;
  onClose?: () => void;
}

export function AlertManagementPanel({
  className = '',
  onClose
}: AlertManagementPanelProps) {
  const { t } = useTranslationLazy('geo-canvas');
  const colors = useSemanticColors();
  const { quick, getStatusBorder } = useBorderTokens();
  const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'preferences'>('create');

  // Alert Engine Integration
  const [isInitialized, setIsInitialized] = useState(geoAlertEngine.isSystemInitialized);
  const alertDetector = geoAlertEngine.detection;

  useEffect(() => {
    if (geoAlertEngine.isSystemInitialized) {
      setIsInitialized(true);
      return;
    }
    initializeAlertEngine()
      .then(() => setIsInitialized(true))
      .catch(() => setIsInitialized(true)); // show UI even if init fails
  }, []);
  const { sendSpatialAlert } = useAlertNotifications();

  // UI State
  const { open: openNotifications } = useNotificationDrawer();

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCreateAlert = useCallback(() => {
    // TODO: Open Alert Creation Wizard (using existing wizard pattern)
    console.debug('🚨 Opening Alert Creation Wizard...');
  }, []);

  const handleManageSubscriptions = useCallback(() => {
    // TODO: Open Subscription Management (using existing management pattern)
    console.debug('📋 Opening Subscription Management...');
  }, []);

  const handleNotificationPreferences = useCallback(() => {
    // TODO: Open Notification Preferences (using existing settings pattern)
    openNotifications();
  }, [openNotifications]);

  const handleTestAlert = useCallback(() => {
    const now = new Date();
    const testUserId = process.env.NEXT_PUBLIC_TEST_USER_ID || 'test-user';
    const ruleContext: RuleContext = {
      ruleId: 'manual-test',
      triggeredAt: now,
      data: {},
      executionStart: performance.now()
    };
    const ruleEvaluation: RuleEvaluationResult = {
      ruleId: ruleContext.ruleId,
      triggered: true,
      confidence: 1,
      conditionResults: [],
      actionsExecuted: [],
      executionTime: 0,
      evaluatedAt: now,
      context: ruleContext
    };

    // Test the integration bridge
    const testAlert: Alert = {
      id: `test-${Date.now()}`,
      type: 'data_quality_issue',
      severity: 'info',
      status: 'new',
      title: 'Test Spatial Alert',
      message: 'This is a test alert from the Alert Management Panel',
      details: {},
      location: { lat: 37.7749, lng: -122.4194 },
      detectedAt: now,
      triggeredByRule: ruleContext.ruleId,
      ruleEvaluation,
      actionsTaken: [],
      createdBy: testUserId,
      tags: ['test'],
      projectId: 'geo-alert',
      entityType: 'geo-canvas',
      entityId: 'geo-canvas'
    };

    sendSpatialAlert(testAlert);
  }, [sendSpatialAlert]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isInitialized) {
    return (
      <div className={`${colors.bg.backgroundSecondary} ${quick.card} p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${colors.text.info}`} />
          <span className={`ml-3 ${colors.text.muted}`}>{t('alertManagement.initializing')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${colors.bg.backgroundSecondary} ${quick.card} ${className}`}>
      {/* Header */}
      <div className={`px-6 py-4 border-b ${getStatusBorder('muted')}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className={`h-6 w-6 ${colors.text.warning} mr-3`} />
            <h2 className={`text-xl font-semibold ${colors.text.foreground}`}>
              {t('alertManagement.title')}
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className={`${colors.text.muted} ${HOVER_TEXT_EFFECTS.WHITE} transition-colors`}
            >
              <span className="sr-only">{t('alertManagement.close')}</span>
              ×
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={`px-6 py-3 border-b ${getStatusBorder('muted')}`}>
        <nav className="flex space-x-8">
          {(['create', 'manage', 'preferences'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? `${getStatusBorder('info')} ${colors.text.info}`
                  : `border-transparent ${colors.text.muted} ${HOVER_TEXT_EFFECTS.WHITE} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
              }`}
            >
              {tab === 'create' && t('alertManagement.tabs.create')}
              {tab === 'manage' && t('alertManagement.tabs.manage')}
              {tab === 'preferences' && t('alertManagement.tabs.preferences')}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'create' && (
          <div className="space-y-4">
            <p className={`${colors.text.muted} mb-6`}>
              {t('alertManagement.create.description')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={handleCreateAlert}
                className={`flex items-center p-4 ${quick.card} ${getStatusBorder('info')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} transition-colors`}
              >
                <Plus className={`h-8 w-8 ${colors.text.info} mr-4`} />
                <div className="text-left">
                  <h3 className={`font-medium ${colors.text.foreground}`}>
                    {t('alertManagement.create.newPolygonAlert')}
                  </h3>
                  <p className={`text-sm ${colors.text.muted}`}>
                    {t('alertManagement.create.newPolygonAlertDesc')}
                  </p>
                </div>
              </button>

              <button
                onClick={handleTestAlert}
                className={`flex items-center p-4 ${quick.card} ${getStatusBorder('success')} ${INTERACTIVE_PATTERNS.SUCCESS_HOVER} transition-colors`}
              >
                <Bell className={`h-8 w-8 ${colors.text.success} mr-4`} />
                <div className="text-left">
                  <h3 className={`font-medium ${colors.text.foreground}`}>
                    {t('alertManagement.create.testAlert')}
                  </h3>
                  <p className={`text-sm ${colors.text.muted}`}>
                    {t('alertManagement.create.testAlertDesc')}
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="space-y-4">
            <p className={`${colors.text.muted} mb-6`}>
              {t('alertManagement.manage.description')}
            </p>

            <button
              onClick={handleManageSubscriptions}
              className={`flex items-center p-4 ${quick.card} ${getStatusBorder('info')} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} transition-colors w-full`}
            >
              <Settings className={`h-8 w-8 ${colors.text.info} mr-4`} />
              <div className="text-left">
                <h3 className={`font-medium ${colors.text.foreground}`}>
                  {t('alertManagement.manage.subscriptionManagement')}
                </h3>
                <p className={`text-sm ${colors.text.muted}`}>
                  {t('alertManagement.manage.subscriptionManagementDesc')}
                </p>
              </div>
            </button>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="space-y-4">
            <p className={`${colors.text.muted} mb-6`}>
              {t('alertManagement.preferences.description')}
            </p>

            <button
              onClick={handleNotificationPreferences}
              className={`flex items-center p-4 ${quick.card} ${HOVER_BORDER_EFFECTS.PURPLE} ${HOVER_BACKGROUND_EFFECTS.LIGHT} transition-colors w-full`}
            >
              <Bell className={`h-8 w-8 ${colors.text.accent} mr-4`} />
              <div className="text-left">
                <h3 className={`font-medium ${colors.text.foreground}`}>
                  {t('alertManagement.preferences.notificationSettings')}
                </h3>
                <p className={`text-sm ${colors.text.muted}`}>
                  {t('alertManagement.preferences.notificationSettingsDesc')}
                </p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div className={`px-6 py-3 ${colors.bg.backgroundTertiary} border-t ${getStatusBorder('muted')} rounded-b-lg`}>
        <div className={`flex items-center text-sm ${colors.text.muted}`}>
          <div className={`w-2 h-2 rounded-full mr-2 ${isInitialized ? 'bg-green-500' : 'bg-red-500'}`} />
          {t('alertManagement.status.engine')}: {isInitialized ? t('alertManagement.status.connected') : t('alertManagement.status.disconnected')}
        </div>
      </div>
    </div>
  );
}
