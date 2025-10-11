/**
 * 🚨 ALERT MANAGEMENT PANEL
 * Uses existing wizard patterns + notification system + @geo-alert/core
 */

'use client';

import React, { useState, useCallback } from 'react';
import { AlertTriangle, Settings, Bell, Plus, Map } from 'lucide-react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';

// Core Alert Engine Integration
import {
  useAlertEngine,
  type AlertRule,
  type AlertSubscription
} from '@geo-alert/core/alert-engine';

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
  const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'preferences'>('create');

  // Alert Engine Integration
  const { alertDetector, isInitialized } = useAlertEngine();
  const { sendSpatialAlert } = useAlertNotifications();

  // UI State
  const { open: openNotifications } = useNotificationDrawer();

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCreateAlert = useCallback(() => {
    // TODO: Open Alert Creation Wizard (using existing wizard pattern)
    console.log('🚨 Opening Alert Creation Wizard...');
  }, []);

  const handleManageSubscriptions = useCallback(() => {
    // TODO: Open Subscription Management (using existing management pattern)
    console.log('📋 Opening Subscription Management...');
  }, []);

  const handleNotificationPreferences = useCallback(() => {
    // TODO: Open Notification Preferences (using existing settings pattern)
    openNotifications();
  }, [openNotifications]);

  const handleTestAlert = useCallback(() => {
    // Test the integration bridge
    const testAlert = {
      id: `test-${Date.now()}`,
      type: 'spatial-intersection',
      severity: 'info',
      title: 'Test Spatial Alert',
      message: 'This is a test alert from the Alert Management Panel',
      timestamp: new Date(),
      coordinates: { lat: 37.7749, lng: -122.4194 },
      polygon: null,
      tenantId: 'geo-alert',
      userId: 'test-user',
      actions: [
        {
          id: 'view-map',
          label: 'View on Map',
          url: '/geo/canvas'
        }
      ]
    };

    sendSpatialAlert(testAlert);
  }, [sendSpatialAlert]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isInitialized) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Initializing Alert Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-orange-500 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">
              {t('alert-management', 'Alert Management')}
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="sr-only">Close</span>
              ×
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-3 border-b border-gray-200">
        <nav className="flex space-x-8">
          {(['create', 'manage', 'preferences'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'create' && t('create-alerts', 'Create Alerts')}
              {tab === 'manage' && t('manage-subscriptions', 'Manage Subscriptions')}
              {tab === 'preferences' && t('notification-preferences', 'Notification Preferences')}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'create' && (
          <div className="space-y-4">
            <p className="text-gray-600 mb-6">
              {t('create-alert-description', 'Create spatial alerts based on polygon intersections and geographic events.')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={handleCreateAlert}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <Plus className="h-8 w-8 text-blue-600 mr-4" />
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">
                    {t('new-polygon-alert', 'New Polygon Alert')}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {t('polygon-alert-description', 'Create alerts based on polygon intersections')}
                  </p>
                </div>
              </button>

              <button
                onClick={handleTestAlert}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors"
              >
                <Bell className="h-8 w-8 text-green-600 mr-4" />
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">
                    {t('test-alert', 'Test Alert')}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {t('test-alert-description', 'Send a test notification')}
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="space-y-4">
            <p className="text-gray-600 mb-6">
              {t('manage-subscriptions-description', 'Manage your active alert subscriptions and rules.')}
            </p>

            <button
              onClick={handleManageSubscriptions}
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors w-full"
            >
              <Settings className="h-8 w-8 text-blue-600 mr-4" />
              <div className="text-left">
                <h3 className="font-medium text-gray-900">
                  {t('subscription-management', 'Subscription Management')}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('subscription-management-description', 'View and edit your alert subscriptions')}
                </p>
              </div>
            </button>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="space-y-4">
            <p className="text-gray-600 mb-6">
              {t('notification-preferences-description', 'Configure how and when you receive notifications.')}
            </p>

            <button
              onClick={handleNotificationPreferences}
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors w-full"
            >
              <Bell className="h-8 w-8 text-purple-600 mr-4" />
              <div className="text-left">
                <h3 className="font-medium text-gray-900">
                  {t('notification-settings', 'Notification Settings')}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('notification-settings-description', 'Customize your notification preferences')}
                </p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex items-center text-sm text-gray-600">
          <div className={`w-2 h-2 rounded-full mr-2 ${isInitialized ? 'bg-green-500' : 'bg-red-500'}`}></div>
          Alert Engine: {isInitialized ? 'Connected' : 'Disconnected'}
        </div>
      </div>
    </div>
  );
}