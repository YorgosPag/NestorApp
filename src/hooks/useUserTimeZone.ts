'use client';

/**
 * @fileoverview **Η ζώνη ώρας του ανθρώπου, στον πελάτη** — ζωντανή, από το ΕΝΑ SSoT.
 * @related ADR-777 §8.28 (η ρύθμιση) · ADR-817 (ο πολίτης χωρίς οργανισμό)
 * @module hooks/useUserTimeZone
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΤΟ ΣΥΡΤΑΡΙ ΔΙΑΒΑΖΕ ΑΠΟ ΑΠΟΘΗΚΗ-ΦΑΝΤΑΣΜΑ (2026-09-21)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `NotificationDrawer` ζητούσε ζώνη από το `/api/notifications/preferences`, που
 * διάβαζε `users/{uid}.notificationPreferences` — πεδίο που **κανείς δεν γράφει** (το
 * δηλώνει ρητά το `user-notification-settings.types.ts`). Και επειδή η διαδρομή ήταν
 * `withAuth`, κάθε **πολίτης** έπαιρνε `401` σε κάθε φόρτωση σελίδας — **δύο** φορές,
 * λόγω της επανάληψης του client σε 401 — και ένα `[ERROR]` στην κονσόλα.
 *
 * 🔑 Η **αληθινή** ζώνη ζει στο `user_notification_settings/{uid}` (`mode: 'userId'`):
 * ανήκει στον **άνθρωπο**, όχι στην εταιρεία — άρα υπάρχει και για τον πολίτη. Είναι η
 * **ίδια** τιμή που ερμηνεύει τις ώρες ησυχίας και τα παράθυρα email, οπότε η ώρα που
 * δείχνει το συρτάρι και η ώρα που αποφασίζει ο cron **δεν μπορούν** να διαφωνήσουν.
 *
 * 🏆 **Ζωντανή συνδρομή, όχι ανάγνωση μιας φοράς** — πρότυπο Slack/GitHub: αλλάζεις ζώνη
 * στις ρυθμίσεις και οι ώρες του συρταριού αλλάζουν **χωρίς ανανέωση**.
 *
 * ⚠️ **`undefined` = «ζώνη της συσκευής», και είναι σωστή απάντηση, όχι σφάλμα**:
 * πριν φτάσει η ρύθμιση, χωρίς συνδεδεμένο χρήστη, ή όταν η ανάγνωση αποτύχει. Το
 * `Intl.DateTimeFormat` με `timeZone: undefined` χρησιμοποιεί τη ζώνη του browser —
 * ό,τι έδειχνε πάντα η εφαρμογή.
 *
 * 🔶 **Δηλωμένο όριο**: όταν το έγγραφο ρυθμίσεων **δεν υπάρχει**, η υπηρεσία δίνει τις
 * προεπιλογές της, άρα ζώνη `DEFAULT_NOTIFICATION_TIMEZONE`. Είναι σκόπιμο: η **ίδια**
 * προεπιλογή ισχύει και για τον cron, οπότε συρτάρι και email μένουν σύμφωνα. Η
 * εναλλακτική («συσκευή αν λείπει έγγραφο») θα έκανε το συρτάρι να λέει άλλη ώρα από
 * αυτή με την οποία ο διακομιστής κρίνει τις ώρες ησυχίας του ίδιου ανθρώπου.
 */

import { useEffect, useState } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { db } from '@/lib/firebase';
import { resolveTimeZone } from '@/lib/datetime/supported-timezones';
import { createModuleLogger } from '@/lib/telemetry';
import { userNotificationSettingsService } from '@/services/user-notification-settings';

const logger = createModuleLogger('useUserTimeZone');

/**
 * Η δηλωμένη ζώνη του συνδεδεμένου ανθρώπου (IANA), ή `undefined` για τη ζώνη της συσκευής.
 *
 * 🔒 Η τιμή περνά **πάντα** από το `resolveTimeZone` — άκυρο identifier στο έγγραφο θα
 *    έκανε το `Intl.DateTimeFormat` να πετάξει `RangeError` και να ρίξει τον καταναλωτή.
 */
export function useUserTimeZone(): string | undefined {
  const { user, loading } = useAuth();
  const uid = user?.uid ?? null;
  const [timeZone, setTimeZone] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (loading || !uid) {
      setTimeZone(undefined);
      return;
    }

    userNotificationSettingsService.initialize(db);
    return userNotificationSettingsService.subscribeToSettings(
      uid,
      (settings) => setTimeZone(resolveTimeZone(settings.timezone)),
      // Μη μοιραίο: το συρτάρι συνεχίζει με τη ζώνη της συσκευής.
      (error) => logger.warn('Η ζώνη ώρας του χρήστη δεν διαβάστηκε', { error }),
    );
  }, [loading, uid]);

  return timeZone;
}
