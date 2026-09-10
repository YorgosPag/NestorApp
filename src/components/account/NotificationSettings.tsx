'use client';

/**
 * =============================================================================
 * ΡΥΘΜΙΣΕΙΣ ΕΙΔΟΠΟΙΗΣΕΩΝ — η οθόνη του λογαριασμού
 * =============================================================================
 *
 * «Για ποια πράγματα θέλω ειδοποίηση — και ποια από αυτά και με email;» (ADR-849 Α3).
 *
 * 🔑 **Καμία τοπική αλήθεια.** Οι τιμές έρχονται **μόνο** από τη συνδρομή στο έγγραφο. Μια εγγραφή
 * φαίνεται αμέσως (latency compensation της Firestore) και, αν απορριφθεί, το SDK εκπέμπει snapshot με
 * την **επαναφερμένη** τιμή — άρα η οθόνη δεν κρατά αντίγραφο που θα μπορούσε να αποκλίνει. Οι
 * εγγραφές περνούν από **ένα** σημείο (`useNotificationSettingsWrites`)· κανένας έλεγχος δεν «παγώνει»
 * όσο αποθηκεύεται άλλος.
 *
 * @module components/account/NotificationSettings
 * @see ADR-849 — το μοντέλο προτιμήσεων (το «ADR-025» που έγραφε εδώ ήταν φάντασμα)
 */

import { AlertCircle, Bell, Moon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { NotificationDeliverySection } from '@/components/account/NotificationDeliverySection';
import { NotificationPreferenceMatrix } from '@/components/account/NotificationPreferenceMatrix';
import {
  useNotificationSettingsWrites,
  type NotificationSettingsWrites,
  type SaveState,
} from '@/components/account/useNotificationSettingsWrites';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { db } from '@/lib/firebase';
import { createStaleCache } from '@/lib/stale-cache';
import { createModuleLogger } from '@/lib/telemetry';
import { cn } from '@/lib/utils';
import {
  userNotificationSettingsService,
  type UserNotificationSettings,
} from '@/services/user-notification-settings';
import '@/lib/design-system';

import type { NotificationSettingsProps } from './notification-settings-config';
import { useNotificationSettingsUi } from './useNotificationSettingsUi';

const logger = createModuleLogger('NotificationSettings');

const notificationSettingsCache = createStaleCache<UserNotificationSettings | null>('account-notification-settings');

export type { NotificationSettingsProps };

interface SettingsSubscription {
  readonly settings: UserNotificationSettings | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

interface SettingsSyncHandlers {
  readonly onSettings: (settings: UserNotificationSettings) => void;
  readonly onLoadError: () => void;
}

/**
 * Αρχική ανάγνωση + ζωντανή συνδρομή· επιστρέφει το «σταμάτα».
 *
 * ⚠️ **Η αρχική ανάγνωση ΔΕΝ πατά πάνω σε snapshot.** Το `getSettings` (που δημιουργεί και το
 * έγγραφο με τις προεπιλογές αν λείπει) μπορεί να επιστρέψει **μετά** από ένα snapshot που φέρνει
 * ήδη νεότερη τιμή — π.χ. ένα γρήγορο κλικ. Αν την εφάρμοζε, η οθόνη θα έδειχνε την παλιά.
 */
function startSettingsSync(userId: string, handlers: SettingsSyncHandlers): () => void {
  let active = true;
  let snapshotSeen = false;
  const deliver = (next: UserNotificationSettings): void => {
    if (active) handlers.onSettings(next);
  };
  userNotificationSettingsService
    .getSettings(userId)
    .then((initial) => { if (!snapshotSeen) deliver(initial); })
    .catch((err: unknown) => {
      logger.error('Failed to load notification settings', { error: err });
      if (active) handlers.onLoadError();
    });
  const unsubscribe = userNotificationSettingsService.subscribeToSettings(
    userId,
    (next) => { snapshotSeen = true; deliver(next); },
    (err) => logger.error('Subscription error', { error: err }),
  );
  return () => { active = false; unsubscribe(); };
}

/**
 * Οι ρυθμίσεις της οθόνης — από τη συνδρομή, με την κρυφή μνήμη για άμεση επανεμφάνιση.
 * ⚠️ Ο `onSettingsChange` διαβάζεται από ref: ένα inline callback του γονέα θα ξανάνοιγε τη
 * συνδρομή σε κάθε απόδοσή του.
 */
function useSettingsSubscription(
  userId: string,
  onSettingsChange: NotificationSettingsProps['onSettingsChange'],
): SettingsSubscription {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const [settings, setSettings] = useState(notificationSettingsCache.get(userId) ?? null);
  const [isLoading, setIsLoading] = useState(!notificationSettingsCache.hasLoaded(userId));
  const [error, setError] = useState<string | null>(null);
  const onChangeRef = useRef(onSettingsChange);

  useEffect(() => {
    onChangeRef.current = onSettingsChange;
  }, [onSettingsChange]);

  useEffect(() => {
    const failLoad = (): void => { setError(t('account.notificationSettings.loadError')); setIsLoading(false); };
    if (!db) { failLoad(); return undefined; }
    userNotificationSettingsService.initialize(db);
    setError(null);
    return startSettingsSync(userId, {
      onSettings: (next) => {
        notificationSettingsCache.set(next, userId);
        setSettings(next);
        setIsLoading(false);
        onChangeRef.current?.(next);
      },
      onLoadError: failLoad,
    });
  }, [userId, t]);

  return { settings, isLoading, error };
}

function StatusCard({ message, failed }: { message: string; failed: boolean }) {
  const { colors, borders, layout, iconSizes, typography } = useNotificationSettingsUi();
  return (
    <Card className={borders.getElementBorder('card', 'default')}>
      <CardContent className={cn(layout.flexColGap4, layout.centerContent, layout.paddingY12)}>
        {failed ? <AlertCircle className={cn(iconSizes.lg, colors.text.error)} aria-hidden="true" /> : <Spinner size="large" />}
        <p role={failed ? 'alert' : 'status'} className={cn(typography.body.sm, failed ? colors.text.error : colors.text.muted)}>
          {message}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * «Αποθήκευση…» / «Όλες οι αλλαγές αποθηκεύτηκαν» — πρότυπο Google Docs.
 * ⚠️ Το `role="status"` υπάρχει **πάντα** στο DOM: ζωντανή περιοχή που εμφανίζεται μαζί με το
 * κείμενό της δεν ανακοινώνεται από τους αναγνώστες οθόνης.
 */
function SaveStatus({ state }: { state: SaveState }) {
  const { t, colors, typography } = useNotificationSettingsUi();
  return (
    <p role="status" className={cn(typography.body.xs, colors.text.muted)}>
      {state === 'saving' && t('common-account:account.notificationSettings.saveState.saving')}
      {state === 'saved' && t('common-account:account.notificationSettings.saveState.saved')}
    </p>
  );
}

function GlobalToggle({ enabled, onToggle }: { enabled: boolean; onToggle: (enabled: boolean) => void }) {
  const { t, colors, borders, layout, iconSizes, typography } = useNotificationSettingsUi();
  return (
    <section className={cn(layout.flexCenterBetween, layout.padding4, borders.radiusClass.md, colors.bg.muted)}>
      <div className={layout.flexCenterGap2}>
        <Bell className={cn(iconSizes.md, colors.text.primary)} aria-hidden="true" />
        <div>
          <p id="global-notifications-label" className={cn(typography.label.sm, colors.text.primary)}>
            {t('account.notificationSettings.globalToggle')}
          </p>
          <p id="global-notifications-description" className={cn(typography.body.sm, colors.text.muted)}>
            {t('account.notificationSettings.globalToggleDescription')}
          </p>
        </div>
      </div>
      <Switch
        id="global-notifications"
        aria-labelledby="global-notifications-label"
        aria-describedby="global-notifications-description"
        checked={enabled}
        onCheckedChange={onToggle}
        variant="status"
      />
    </section>
  );
}

function DisabledMessage() {
  const { t, colors, layout, iconSizes, typography } = useNotificationSettingsUi();
  return (
    <figure role="status" className={cn(layout.flexColGap2, layout.centerContent, 'py-8', layout.textCenter)}>
      <Moon className={cn(iconSizes.xl, colors.text.muted)} aria-hidden="true" />
      <figcaption>
        <p className={cn(typography.body.sm, colors.text.muted)}>
          {t('account.notificationSettings.disabledMessage')}
        </p>
      </figcaption>
    </figure>
  );
}

function SettingsCard({ settings, writes }: { settings: UserNotificationSettings; writes: NotificationSettingsWrites }) {
  const { t, borders, layout, iconSizes } = useNotificationSettingsUi();
  return (
    <Card className={borders.getElementBorder('card', 'default')}>
      <CardHeader>
        <CardTitle className={layout.flexCenterGap2}>
          <Bell className={iconSizes.md} aria-hidden="true" />
          {t('account.notificationSettings.title')}
        </CardTitle>
        <CardDescription>{t('account.notificationSettings.description')}</CardDescription>
        <SaveStatus state={writes.saveState} />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <GlobalToggle enabled={settings.globalEnabled} onToggle={writes.setGlobal} />
        <NotificationDeliverySection
          settings={settings}
          onInAppToggle={writes.setInApp}
          onEmailToggle={writes.setEmail}
          onEmailFrequencyChange={writes.setEmailFrequency}
          onTimezoneChange={writes.setTimezone}
        />
        {settings.globalEnabled ? (
          <NotificationPreferenceMatrix
            settings={settings}
            onTypeEnabled={writes.setTypeEnabled}
            onTypeEmail={writes.setTypeEmail}
          />
        ) : (
          <DisabledMessage />
        )}
      </CardContent>
    </Card>
  );
}

export function NotificationSettings({ userId, onSettingsChange }: NotificationSettingsProps) {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const { settings, isLoading, error } = useSettingsSubscription(userId, onSettingsChange);
  const writes = useNotificationSettingsWrites(userId);

  if (isLoading) return <StatusCard message={t('account.notificationSettings.loading')} failed={false} />;
  if (error) return <StatusCard message={error} failed />;
  if (!settings) return null;
  return <SettingsCard settings={settings} writes={writes} />;
}

export default NotificationSettings;
