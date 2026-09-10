/**
 * =============================================================================
 * ΟΙ ΕΓΓΡΑΦΕΣ ΤΗΣ ΟΘΟΝΗΣ ΡΥΘΜΙΣΕΩΝ ΕΙΔΟΠΟΙΗΣΕΩΝ — ΕΝΑ ΣΗΜΕΙΟ (ADR-849 Α3)
 * =============================================================================
 *
 * Πριν την Α3 η οθόνη είχε **έξι** σχεδόν ίδιους handlers με ένα κοινό `isSaving`, που
 * **απενεργοποιούσε κάθε διακόπτη** σε κάθε αποθήκευση: το δεύτερο γρήγορο κλικ χανόταν, και η
 * αποτυχία γραφόταν μόνο στο log. Εδώ:
 *
 * - **Κανένα πάγωμα.** Η τιμή που βλέπει ο άνθρωπος έρχεται από τη συνδρομή στο έγγραφο: η εγγραφή
 *   φαίνεται αμέσως (latency compensation) και, αν απορριφθεί, το SDK εκπέμπει snapshot με την
 *   **επαναφερμένη** τιμή (`syncEngineRejectFailedWrite`, firebase-js-sdk). Δεν υπάρχει τοπικό
 *   αντίγραφο που θα μπορούσε να αποκλίνει — άρα ούτε λόγος να κλειδώνει η οθόνη.
 * - **Ορατή αποτυχία** (`useNotifications().error`) — η επαναφορά χωρίς εξήγηση θα έμοιαζε με
 *   διακόπτη που «γύρισε μόνος του».
 * - **Κατάσταση αποθήκευσης** τύπου Google Docs («Αποθήκευση…» / «Όλες οι αλλαγές αποθηκεύτηκαν»).
 *   Μετά από αποτυχία **δεν** λέει «αποθηκεύτηκαν».
 *
 * @module components/account/useNotificationSettingsWrites
 * @see ADR-849
 */

import { useCallback, useMemo, useState } from 'react';

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import { useNotifications } from '@/providers/NotificationProvider';
import {
  userNotificationSettingsService,
  type EmailFrequency,
  type EmailTypeMode,
} from '@/services/user-notification-settings';
import type { NotificationSettingRef } from '@/services/user-notification-settings/notification-preference-policy';

const logger = createModuleLogger('NotificationSettingsWrites');

/** Τι λέει η κεφαλίδα: τίποτα ακόμη · εκκρεμεί εγγραφή · όλες έφτασαν. */
export type SaveState = 'idle' | 'saving' | 'saved';

export interface NotificationSettingsWrites {
  readonly saveState: SaveState;
  readonly setGlobal: (enabled: boolean) => void;
  readonly setInApp: (enabled: boolean) => void;
  readonly setEmail: (enabled: boolean) => void;
  readonly setEmailFrequency: (frequency: EmailFrequency) => void;
  readonly setTimezone: (timezone: string) => void;
  readonly setTypeEnabled: (ref: NotificationSettingRef, enabled: boolean) => void;
  readonly setTypeEmail: (ref: NotificationSettingRef, mode: EmailTypeMode) => void;
}

type Outcome = 'none' | 'saved' | 'failed';
type RunWrite = (write: string, perform: () => Promise<void>) => void;

function saveStateOf(pending: number, outcome: Outcome): SaveState {
  if (pending > 0) return 'saving';
  return outcome === 'saved' ? 'saved' : 'idle';
}

function writesFor(userId: string, run: RunWrite, saveState: SaveState): NotificationSettingsWrites {
  const service = userNotificationSettingsService;
  return {
    saveState,
    setGlobal: (enabled) => run('global', () => service.toggleGlobal(userId, enabled)),
    setInApp: (enabled) => run('inApp', () => service.toggleInApp(userId, enabled)),
    setEmail: (enabled) => run('email', () => service.toggleEmail(userId, enabled)),
    setEmailFrequency: (frequency) => run('emailFrequency', () => service.setEmailFrequency(userId, frequency)),
    setTimezone: (timezone) => run('timezone', () => service.setTimezone(userId, timezone)),
    setTypeEnabled: (ref, enabled) =>
      run('typeEnabled', () =>
        service.toggleCategorySetting(userId, { category: ref.category, setting: ref.settingKey, enabled }),
      ),
    setTypeEmail: (ref, mode) => run('typeEmail', () => service.setEmailTypeMode(userId, ref, mode)),
  };
}

export function useNotificationSettingsWrites(userId: string): NotificationSettingsWrites {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const { error: notifyError } = useNotifications();
  const [pending, setPending] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>('none');

  const run = useCallback<RunWrite>(
    (write, perform) => {
      setPending((count) => count + 1);
      perform()
        .then(() => setOutcome('saved'))
        .catch((error: unknown) => {
          logger.error('Notification setting write failed', { write, error });
          setOutcome('failed');
          notifyError(t('common-account:account.notificationSettings.writeFailed'));
        })
        .finally(() => setPending((count) => count - 1));
    },
    [notifyError, t],
  );

  return useMemo(() => writesFor(userId, run, saveStateOf(pending, outcome)), [userId, run, pending, outcome]);
}
