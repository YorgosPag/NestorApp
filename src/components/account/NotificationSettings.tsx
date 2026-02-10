'use client';

/**
 * =============================================================================
 * NOTIFICATION SETTINGS COMPONENT
 * =============================================================================
 *
 * Enterprise Pattern: User notification preferences management
 * Features: Category toggles, email frequency, global controls
 *
 * @module components/account/NotificationSettings
 * @enterprise ADR-025 - Notification Settings Centralization
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Mail,
  Smartphone,
  Building2,
  Users,
  CheckSquare,
  Shield,
  Moon,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { db } from '@/lib/firebase';
import {
  userNotificationSettingsService,
  UserNotificationSettings,
  NotificationCategory,
  EmailFrequency,
} from '@/services/user-notification-settings';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('NotificationSettings');

// ============================================================================
// TYPES
// ============================================================================

interface NotificationSettingsProps {
  userId: string;
  onSettingsChange?: (settings: UserNotificationSettings) => void;
}

interface CategoryConfig {
  id: NotificationCategory;
  icon: React.ElementType;
  titleKey: string;
  descriptionKey: string;
  settings: Array<{
    key: string;
    labelKey: string;
  }>;
}

// ============================================================================
// CATEGORY CONFIGURATION
// ============================================================================

const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    id: 'crm',
    icon: Users,
    titleKey: 'account.notificationSettings.categories.crm.title',
    descriptionKey: 'account.notificationSettings.categories.crm.description',
    settings: [
      { key: 'newLead', labelKey: 'account.notificationSettings.categories.crm.newLead' },
      { key: 'leadStatusChange', labelKey: 'account.notificationSettings.categories.crm.leadStatusChange' },
      { key: 'taskAssigned', labelKey: 'account.notificationSettings.categories.crm.taskAssigned' },
      { key: 'newCommunication', labelKey: 'account.notificationSettings.categories.crm.newCommunication' },
    ],
  },
  {
    id: 'properties',
    icon: Building2,
    titleKey: 'account.notificationSettings.categories.properties.title',
    descriptionKey: 'account.notificationSettings.categories.properties.description',
    settings: [
      { key: 'statusChange', labelKey: 'account.notificationSettings.categories.properties.statusChange' },
      { key: 'newProperty', labelKey: 'account.notificationSettings.categories.properties.newProperty' },
      { key: 'priceChange', labelKey: 'account.notificationSettings.categories.properties.priceChange' },
      { key: 'viewingScheduled', labelKey: 'account.notificationSettings.categories.properties.viewingScheduled' },
    ],
  },
  {
    id: 'tasks',
    icon: CheckSquare,
    titleKey: 'account.notificationSettings.categories.tasks.title',
    descriptionKey: 'account.notificationSettings.categories.tasks.description',
    settings: [
      { key: 'dueToday', labelKey: 'account.notificationSettings.categories.tasks.dueToday' },
      { key: 'overdue', labelKey: 'account.notificationSettings.categories.tasks.overdue' },
      { key: 'assigned', labelKey: 'account.notificationSettings.categories.tasks.assigned' },
      { key: 'completed', labelKey: 'account.notificationSettings.categories.tasks.completed' },
    ],
  },
  {
    id: 'security',
    icon: Shield,
    titleKey: 'account.notificationSettings.categories.security.title',
    descriptionKey: 'account.notificationSettings.categories.security.description',
    settings: [
      { key: 'newDeviceLogin', labelKey: 'account.notificationSettings.categories.security.newDeviceLogin' },
      { key: 'passwordChange', labelKey: 'account.notificationSettings.categories.security.passwordChange' },
      { key: 'twoFactorChange', labelKey: 'account.notificationSettings.categories.security.twoFactorChange' },
      { key: 'suspiciousActivity', labelKey: 'account.notificationSettings.categories.security.suspiciousActivity' },
    ],
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function NotificationSettings({ userId, onSettingsChange }: NotificationSettingsProps) {
  const { t } = useTranslation('common');
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  // State
  const [settings, setSettings] = useState<UserNotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize service and load settings
  useEffect(() => {
    if (!db) {
      setError('Firebase not initialized');
      setIsLoading(false);
      return;
    }

    userNotificationSettingsService.initialize(db);

    const loadSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const userSettings = await userNotificationSettingsService.getSettings(userId);
        setSettings(userSettings);
        onSettingsChange?.(userSettings);
      } catch (err) {
        logger.error('Failed to load notification settings', { error: err });
        setError(t('account.notificationSettings.loadError'));
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();

    // Subscribe to real-time updates
    const unsubscribe = userNotificationSettingsService.subscribeToSettings(
      userId,
      (updatedSettings) => {
        setSettings(updatedSettings);
        onSettingsChange?.(updatedSettings);
      },
      (err) => {
        logger.error('Subscription error', { error: err });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId, onSettingsChange, t]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleGlobalToggle = useCallback(
    async (enabled: boolean) => {
      if (!settings) return;
      setIsSaving(true);
      try {
        await userNotificationSettingsService.toggleGlobal(userId, enabled);
      } catch (err) {
        logger.error('Failed to toggle global', { error: err });
      } finally {
        setIsSaving(false);
      }
    },
    [userId, settings]
  );

  const handleInAppToggle = useCallback(
    async (enabled: boolean) => {
      setIsSaving(true);
      try {
        await userNotificationSettingsService.toggleInApp(userId, enabled);
      } catch (err) {
        logger.error('Failed to toggle in-app', { error: err });
      } finally {
        setIsSaving(false);
      }
    },
    [userId]
  );

  const handleEmailToggle = useCallback(
    async (enabled: boolean) => {
      setIsSaving(true);
      try {
        await userNotificationSettingsService.toggleEmail(userId, enabled);
      } catch (err) {
        logger.error('Failed to toggle email', { error: err });
      } finally {
        setIsSaving(false);
      }
    },
    [userId]
  );

  const handleEmailFrequencyChange = useCallback(
    async (frequency: EmailFrequency) => {
      setIsSaving(true);
      try {
        await userNotificationSettingsService.setEmailFrequency(userId, frequency);
      } catch (err) {
        logger.error('Failed to set email frequency', { error: err });
      } finally {
        setIsSaving(false);
      }
    },
    [userId]
  );

  const handleCategorySettingToggle = useCallback(
    async (category: NotificationCategory, setting: string, enabled: boolean) => {
      setIsSaving(true);
      try {
        await userNotificationSettingsService.toggleCategorySetting(userId, {
          category,
          setting,
          enabled,
        });
      } catch (err) {
        logger.error('Failed to toggle category setting', { error: err });
      } finally {
        setIsSaving(false);
      }
    },
    [userId]
  );

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const renderCategorySection = (config: CategoryConfig) => {
    if (!settings) return null;

    const CategoryIcon = config.icon;
    const categorySettings = settings.categories[config.id];

    return (
      <section
        key={config.id}
        className={cn(layout.flexColGap4, 'py-4 border-t border-border')}
      >
        <header className={layout.flexCenterGap2}>
          <CategoryIcon className={cn(iconSizes.md, colors.text.primary)} aria-hidden="true" />
          <div>
            <h3 className={cn(typography.label.sm, colors.text.primary)}>
              {t(config.titleKey)}
            </h3>
            <p className={cn(typography.body.sm, colors.text.muted)}>
              {t(config.descriptionKey)}
            </p>
          </div>
        </header>

        <div className={cn(layout.flexColGap2, 'pl-8')}>
          {config.settings.map((setting) => {
            const isEnabled = categorySettings[setting.key as keyof typeof categorySettings];
            return (
              <div
                key={setting.key}
                className={cn(layout.flexCenterBetween, 'py-2')}
              >
                <Label
                  htmlFor={`${config.id}-${setting.key}`}
                  className={cn(typography.body.sm, colors.text.secondary, 'cursor-pointer')}
                >
                  {t(setting.labelKey)}
                </Label>
                <Switch
                  id={`${config.id}-${setting.key}`}
                  checked={isEnabled}
                  onCheckedChange={(checked) =>
                    handleCategorySettingToggle(config.id, setting.key, checked)
                  }
                  disabled={!settings.globalEnabled || isSaving}
                  variant="status"
                />
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  // ==========================================================================
  // LOADING STATE
  // ==========================================================================

  if (isLoading) {
    return (
      <Card className={borders.getElementBorder('card', 'default')}>
        <CardContent className={cn(layout.flexColGap4, layout.centerContent, layout.paddingY12)}>
          <Loader2 className={cn(iconSizes.lg, colors.text.muted, 'animate-spin')} />
          <p className={cn(typography.body.sm, colors.text.muted)}>
            {t('account.notificationSettings.loading')}
          </p>
        </CardContent>
      </Card>
    );
  }

  // ==========================================================================
  // ERROR STATE
  // ==========================================================================

  if (error) {
    return (
      <Card className={borders.getElementBorder('card', 'default')}>
        <CardContent className={cn(layout.flexColGap4, layout.centerContent, layout.paddingY12)}>
          <AlertCircle className={cn(iconSizes.lg, colors.text.error)} />
          <p className={cn(typography.body.sm, colors.text.error)}>{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!settings) return null;

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================

  return (
    <Card className={borders.getElementBorder('card', 'default')}>
      <CardHeader>
        <CardTitle className={layout.flexCenterGap2}>
          <Bell className={iconSizes.md} aria-hidden="true" />
          {t('account.notificationSettings.title')}
          {isSaving && (
            <Loader2 className={cn(iconSizes.sm, colors.text.muted, 'animate-spin ml-2')} />
          )}
        </CardTitle>
        <CardDescription>{t('account.notificationSettings.description')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* Global Toggle */}
        <section className={cn(layout.flexCenterBetween, layout.padding4, borders.radiusClass.md, colors.bg.muted)}>
          <div className={layout.flexCenterGap2}>
            <Bell className={cn(iconSizes.md, colors.text.primary)} aria-hidden="true" />
            <div>
              <p className={cn(typography.label.sm, colors.text.primary)}>
                {t('account.notificationSettings.globalToggle')}
              </p>
              <p className={cn(typography.body.sm, colors.text.muted)}>
                {t('account.notificationSettings.globalToggleDescription')}
              </p>
            </div>
          </div>
          <Switch
            id="global-notifications"
            checked={settings.globalEnabled}
            onCheckedChange={handleGlobalToggle}
            disabled={isSaving}
            variant="status"
          />
        </section>

        {/* Delivery Methods */}
        <section className={layout.flexColGap4}>
          <h3 className={cn(typography.label.sm, colors.text.primary)}>
            {t('account.notificationSettings.deliveryMethods')}
          </h3>

          {/* In-App */}
          <div className={cn(layout.flexCenterBetween, 'py-2')}>
            <div className={layout.flexCenterGap2}>
              <Smartphone className={cn(iconSizes.sm, colors.text.muted)} aria-hidden="true" />
              <Label htmlFor="in-app" className={cn(typography.body.sm, colors.text.secondary)}>
                {t('account.notificationSettings.inApp')}
              </Label>
            </div>
            <Switch
              id="in-app"
              checked={settings.inAppEnabled}
              onCheckedChange={handleInAppToggle}
              disabled={!settings.globalEnabled || isSaving}
              variant="status"
            />
          </div>

          {/* Email */}
          <div className={cn(layout.flexCenterBetween, 'py-2')}>
            <div className={layout.flexCenterGap2}>
              <Mail className={cn(iconSizes.sm, colors.text.muted)} aria-hidden="true" />
              <Label htmlFor="email" className={cn(typography.body.sm, colors.text.secondary)}>
                {t('account.notificationSettings.email')}
              </Label>
            </div>
            <Switch
              id="email"
              checked={settings.emailEnabled}
              onCheckedChange={handleEmailToggle}
              disabled={!settings.globalEnabled || isSaving}
              variant="status"
            />
          </div>

          {/* Email Frequency */}
          {settings.emailEnabled && settings.globalEnabled && (
            <div className={cn(layout.flexCenterBetween, 'py-2', 'pl-8')}>
              <Label htmlFor="email-frequency" className={cn(typography.body.sm, colors.text.secondary)}>
                {t('account.notificationSettings.emailFrequency')}
              </Label>
              <Select
                value={settings.emailFrequency}
                onValueChange={(value) => handleEmailFrequencyChange(value as EmailFrequency)}
                disabled={isSaving}
              >
                <SelectTrigger id="email-frequency" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">
                    {t('account.notificationSettings.frequency.realtime')}
                  </SelectItem>
                  <SelectItem value="daily">
                    {t('account.notificationSettings.frequency.daily')}
                  </SelectItem>
                  <SelectItem value="weekly">
                    {t('account.notificationSettings.frequency.weekly')}
                  </SelectItem>
                  <SelectItem value="disabled">
                    {t('account.notificationSettings.frequency.disabled')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </section>

        {/* Category Sections */}
        {settings.globalEnabled && CATEGORY_CONFIGS.map(renderCategorySection)}

        {/* Disabled State Message */}
        {!settings.globalEnabled && (
          <figure
            role="status"
            className={cn(
              layout.flexColGap2,
              layout.centerContent,
              'py-8',
              layout.textCenter
            )}
          >
            <Moon className={cn(iconSizes.xl, colors.text.muted)} aria-hidden="true" />
            <figcaption>
              <p className={cn(typography.body.sm, colors.text.muted)}>
                {t('account.notificationSettings.disabledMessage')}
              </p>
            </figcaption>
          </figure>
        )}
      </CardContent>
    </Card>
  );
}

export default NotificationSettings;
