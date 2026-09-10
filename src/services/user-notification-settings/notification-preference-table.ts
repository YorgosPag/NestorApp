/**
 * =============================================================================
 * Ο ΠΙΝΑΚΑΣ ΤΩΝ ΠΡΟΤΙΜΗΣΕΩΝ — το μητρώο γραμμών, έτοιμο για επιφάνεια (ADR-849 Α3)
 * =============================================================================
 *
 * Το μητρώο (`config/notification-preference-rows.ts`) λέει **ποιοι** διακόπτες φαίνονται και
 * με **ποια** ετικέτα. Κάθε επιφάνεια χρειάζεται επιπλέον δύο απαντήσεις ανά γραμμή: *ποια είναι
 * η διαδρομή του διακόπτη;* και *είναι υποχρεωτικός;*. Τις ρωτούν **δύο** επιφάνειες — η οθόνη
 * ρυθμίσεων (`components/account/NotificationPreferenceMatrix`) και η σελίδα email με token
 * (`components/notifications/EmailTypePreferences`). Ζούσε μέσα στη δεύτερη· αντίγραφο στην
 * πρώτη θα ήταν δεύτερη αλήθεια για το «υποχρεωτικό» — ακριβώς το ψέμα που διορθώνει η Α3.
 *
 * 🔑 Η διαδρομή περνά από το `parseSettingPath` (έλεγχος έναντι των **προεπιλογών** του μοντέλου):
 * γραμμή του μητρώου που δεν αντιστοιχεί σε διακόπτη **δεν** γίνεται ποτέ πεδίο εγγραφής. Η άγκυρα
 * Μ1 (`email-type-preferences.test.tsx`) εγγυάται ότι καμία δεν παραλείπεται.
 *
 * @module services/user-notification-settings/notification-preference-table
 * @see ADR-849
 */

import {
  NOTIFICATION_PREFERENCE_GROUPS,
  type NotificationPreferenceGroup,
} from '@/config/notification-preference-rows';

import {
  isMandatorySetting,
  parseSettingPath,
  settingPathOf,
  type NotificationSettingRef,
} from './notification-preference-policy';

/** Μία γραμμή, έτοιμη για επιφάνεια: διακόπτης, διαδρομή, ετικέτα, «υποχρεωτικός;». */
export interface PreferenceRow {
  readonly path: string;
  readonly ref: NotificationSettingRef;
  readonly labelKey: string;
  readonly mandatory: boolean;
}

/** Μία ομάδα του μητρώου με τις γραμμές της. */
export interface PreferenceGroupRows {
  readonly group: NotificationPreferenceGroup;
  readonly rows: readonly PreferenceRow[];
  /** Έχει η ομάδα υποχρεωτικούς τύπους; — τότε η επιφάνεια το εξηγεί **ορατά**. */
  readonly hasMandatory: boolean;
}

function rowsOf(group: NotificationPreferenceGroup): readonly PreferenceRow[] {
  return group.settings.flatMap((row) => {
    const ref = parseSettingPath(`${group.category}.${row.key}`);
    if (ref === null) return [];
    // Η διαδρομή χτίζεται από το **ίδιο** `settingPathOf` με τον διακομιστή — μία μορφή.
    return [{ path: settingPathOf(ref), ref, labelKey: row.labelKey, mandatory: isMandatorySetting(ref) }];
  });
}

/** Όλες οι ομάδες με τις γραμμές τους — υπολογισμένες **μία** φορά. */
export const PREFERENCE_TABLE: readonly PreferenceGroupRows[] = NOTIFICATION_PREFERENCE_GROUPS.map((group) => {
  const rows = rowsOf(group);
  return { group, rows, hasMandatory: rows.some((row) => row.mandatory) };
});

const ROW_BY_PATH: ReadonlyMap<string, PreferenceRow> = new Map(
  PREFERENCE_TABLE.flatMap(({ rows }) => rows.map((row) => [row.path, row] as const)),
);

/**
 * Η γραμμή ενός διακόπτη — ή `null` αν δεν υπάρχει.
 *
 * ⚠️ Επιστρέφει τη **γραμμή**, όχι σκέτο κλειδί: ο καλών γράφει `t(row.labelKey)`, μορφή που
 * ο γεννήτορας του route slice λύνει από τα literals του μητρώου· ένα `t(labelKey)` από
 * τοπική μεταβλητή θα ήταν ανεπίλυτη δυναμική κλήση (ADR-744).
 */
export function preferenceRowOf(path: string): PreferenceRow | null {
  return ROW_BY_PATH.get(path) ?? null;
}
