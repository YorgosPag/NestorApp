/**
 * =============================================================================
 * ΤΜΗΜΑ ΠΑΡΑΔΟΣΗΣ ΕΙΔΟΠΟΙΗΣΕΩΝ — «πού, πόσο συχνά, σε ποια ώρα;»
 * =============================================================================
 *
 * Εξήχθη από το `NotificationSettings.tsx` όταν η προσθήκη του επιλογέα ζώνης ώρας
 * (ADR-777 §8.28) το ανέβασε στις **503** γραμμές — πάνω από το όριο των 500 (N.7.1).
 *
 * 🔑 **Η εξαγωγή είναι κατά ΕΥΘΥΝΗ, όχι κατά γραμμές.** Το τμήμα απαντά ένα
 * αυτοτελές ερώτημα — «*με ποιον τρόπο και πότε φτάνει σ' εμένα μια ειδοποίηση;*» —
 * ενώ ο γονέας απαντά «*για ποια πράγματα θέλω ειδοποίηση;*». Ένα κόψιμο στη
 * γραμμή 500 θα ήταν συμμόρφωση με τον κανόνα· αυτό είναι ο λόγος του κανόνα.
 *
 * @module components/account/NotificationDeliverySection
 * @see ADR-777 §8.28
 */

'use client';

import { Mail, Smartphone } from 'lucide-react';
import React from 'react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listSupportedTimeZones } from '@/lib/datetime/supported-timezones';
import { cn } from '@/lib/utils';
import type {
  EmailFrequency,
  UserNotificationSettings,
} from '@/services/user-notification-settings/user-notification-settings.types';

/**
 * Οι ζώνες ώρας του επιλογέα — **από τον runtime**, όχι από χειρόγραφη λίστα.
 *
 * Υπολογίζεται **μία φορά** σε επίπεδο module: το σύνολο δεν αλλάζει μέσα στη ζωή
 * της σελίδας, και είναι ~400 τιμές που δεν έχει νόημα να ξαναταξινομούνται σε κάθε
 * απόδοση.
 */
const TIME_ZONES = listSupportedTimeZones();

export interface NotificationDeliverySectionProps {
  readonly settings: UserNotificationSettings;
  readonly isSaving: boolean;
  readonly onInAppToggle: (enabled: boolean) => void;
  readonly onEmailToggle: (enabled: boolean) => void;
  readonly onEmailFrequencyChange: (frequency: EmailFrequency) => void;
  readonly onTimezoneChange: (timezone: string) => void;
}

export function NotificationDeliverySection({
  settings,
  isSaving,
  onInAppToggle,
  onEmailToggle,
  onEmailFrequencyChange,
  onTimezoneChange,
}: NotificationDeliverySectionProps): React.JSX.Element {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  return (
    <>
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
        onCheckedChange={onInAppToggle}
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
        onCheckedChange={onEmailToggle}
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
          onValueChange={(value) => onEmailFrequencyChange(value as EmailFrequency)}
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

    {/* Time zone — ADR-777 §8.28 */}
    {settings.emailEnabled && settings.globalEnabled && (
      <div className={cn(layout.flexCenterBetween, 'py-2', 'pl-8')}>
        <div>
          <Label htmlFor="notification-timezone" className={cn(typography.body.sm, colors.text.secondary)}>
            {t('account.notificationSettings.timezone')}
          </Label>
          <p className={cn(typography.body.xs, colors.text.muted)}>
            {t('account.notificationSettings.timezoneDescription')}
          </p>
        </div>
        <Select
          value={settings.timezone}
          onValueChange={onTimezoneChange}
          disabled={isSaving}
        >
          <SelectTrigger id="notification-timezone" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_ZONES.map((zone) => (
              // ⚠️ Τα ονόματα ζωνών είναι **αναγνωριστικά IANA**, όχι κείμενο
              // προς μετάφραση: το «Europe/Athens» είναι η ίδια η τιμή που
              // αποθηκεύεται και που δέχεται το `Intl`. Μετάφρασή τους θα
              // έσπαγε την αντιστοίχιση οθόνης ↔ αποθηκευμένης ρύθμισης.
              <SelectItem key={zone} value={zone}>
                {zone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )}
  </section>
    </>
  );
}
