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
 * 🔗 **ADR-849 Α3**: κανένας έλεγχος δεν «παγώνει» όσο αποθηκεύεται άλλος (το `isSaving` έφυγε —
 * οι εγγραφές περνούν από το `useNotificationSettingsWrites`)· οι ετικέτες συχνότητας και τα ids
 * των ελέγχων ζουν **μία** φορά στο `notification-settings-config` (τα διαβάζει και η μήτρα).
 *
 * @module components/account/NotificationDeliverySection
 * @see ADR-777 §8.28 · ADR-849
 */

'use client';

import { Mail, Smartphone, type LucideIcon } from 'lucide-react';
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
import { listSupportedTimeZones } from '@/lib/datetime/supported-timezones';
import { cn } from '@/lib/utils';
import {
  isEmailFrequency,
  type EmailFrequency,
  type UserNotificationSettings,
} from '@/services/user-notification-settings/user-notification-settings.types';

import { DELIVERY_CONTROL_IDS, EMAIL_FREQUENCY_OPTIONS, FREQUENCY_LABEL_KEYS } from './notification-settings-config';
import { useNotificationSettingsUi } from './useNotificationSettingsUi';

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
  readonly onInAppToggle: (enabled: boolean) => void;
  readonly onEmailToggle: (enabled: boolean) => void;
  readonly onEmailFrequencyChange: (frequency: EmailFrequency) => void;
  readonly onTimezoneChange: (timezone: string) => void;
}

interface ChannelRowProps {
  readonly id: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onToggle: (enabled: boolean) => void;
}

function ChannelRow({ id, icon: Icon, label, checked, disabled, onToggle }: ChannelRowProps) {
  const { colors, layout, iconSizes, typography } = useNotificationSettingsUi();
  return (
    <div className={cn(layout.flexCenterBetween, 'py-2')}>
      <div className={layout.flexCenterGap2}>
        <Icon className={cn(iconSizes.sm, colors.text.muted)} aria-hidden="true" />
        <Label htmlFor={id} className={cn(typography.body.sm, colors.text.secondary)}>{label}</Label>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onToggle} disabled={disabled} variant="status" />
    </div>
  );
}

interface EmailSubSettingProps {
  readonly controlId: string;
  readonly label: string;
  readonly description?: string;
  readonly children: React.ReactNode;
}

/** Δευτερεύουσα ρύθμιση του email (με εσοχή κάτω από τον διακόπτη): ετικέτα αριστερά, έλεγχος δεξιά. */
function EmailSubSetting({ controlId, label, description, children }: EmailSubSettingProps) {
  const { colors, layout, typography } = useNotificationSettingsUi();
  return (
    <div className={cn(layout.flexCenterBetween, 'py-2', 'pl-8')}>
      <div>
        <Label htmlFor={controlId} className={cn(typography.body.sm, colors.text.secondary)}>{label}</Label>
        {description !== undefined && <p className={cn(typography.body.xs, colors.text.muted)}>{description}</p>}
      </div>
      {children}
    </div>
  );
}

function FrequencyPicker({ value, onChange }: { value: EmailFrequency; onChange: (frequency: EmailFrequency) => void }) {
  const { t } = useNotificationSettingsUi();
  return (
    <EmailSubSetting controlId={DELIVERY_CONTROL_IDS.emailFrequency} label={t('account.notificationSettings.emailFrequency')}>
      <Select value={value} onValueChange={(next) => { if (isEmailFrequency(next)) onChange(next); }}>
        <SelectTrigger id={DELIVERY_CONTROL_IDS.emailFrequency} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EMAIL_FREQUENCY_OPTIONS.map((frequency) => (
            <SelectItem key={frequency} value={frequency}>
              {t(FREQUENCY_LABEL_KEYS[frequency])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </EmailSubSetting>
  );
}

function TimezonePicker({ value, onChange }: { value: string; onChange: (timezone: string) => void }) {
  const { t } = useNotificationSettingsUi();
  return (
    <EmailSubSetting
      controlId={DELIVERY_CONTROL_IDS.timezone}
      label={t('account.notificationSettings.timezone')}
      description={t('account.notificationSettings.timezoneDescription')}
    >
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={DELIVERY_CONTROL_IDS.timezone} className="w-56">
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
    </EmailSubSetting>
  );
}

export function NotificationDeliverySection({
  settings,
  onInAppToggle,
  onEmailToggle,
  onEmailFrequencyChange,
  onTimezoneChange,
}: NotificationDeliverySectionProps): React.JSX.Element {
  const { t, colors, layout, typography } = useNotificationSettingsUi();
  const emailOptionsVisible = settings.emailEnabled && settings.globalEnabled;

  return (
    <section className={layout.flexColGap4}>
      <h3 className={cn(typography.label.sm, colors.text.primary)}>
        {t('account.notificationSettings.deliveryMethods')}
      </h3>
      <ChannelRow
        id={DELIVERY_CONTROL_IDS.inApp}
        icon={Smartphone}
        label={t('account.notificationSettings.inApp')}
        checked={settings.inAppEnabled}
        disabled={!settings.globalEnabled}
        onToggle={onInAppToggle}
      />
      <ChannelRow
        id={DELIVERY_CONTROL_IDS.email}
        icon={Mail}
        label={t('account.notificationSettings.email')}
        checked={settings.emailEnabled}
        disabled={!settings.globalEnabled}
        onToggle={onEmailToggle}
      />
      {emailOptionsVisible && <FrequencyPicker value={settings.emailFrequency} onChange={onEmailFrequencyChange} />}
      {emailOptionsVisible && <TimezonePicker value={settings.timezone} onChange={onTimezoneChange} />}
    </section>
  );
}
