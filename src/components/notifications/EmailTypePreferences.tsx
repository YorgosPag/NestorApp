'use client';

/**
 * @fileoverview **EMAIL ΑΝΑ ΤΥΠΟ, ΧΩΡΙΣ ΣΥΝΔΕΣΗ** — «όχι email για ταιριάσματα, ναι για εντολές».
 * @related ADR-849 Α2 · components/notifications/EmailPreferencesPanel.tsx
 * @module components/notifications/EmailTypePreferences
 *
 * Χωριστό από το πάνελ **κατά ευθύνη** (N.7.1): το πάνελ απαντά «φτάνουν τα email;» και
 * «πόσο συχνά;»· αυτό απαντά «**ποια** email;».
 *
 * 🏆 **Ό,τι κάνουν οι μεγάλοι, και ο ένας σταθμός που προσθέτουμε**
 * - Διακόπτης **ανά τύπο** (LinkedIn · GitHub · Knock: κατηγορία × κανάλι).
 * - **Οι τύποι του email που σε έφερε, μπροστά** — από την εμβέλεια του token (ADR-849):
 *   ο άνθρωπος που πάτησε «Να μη λαμβάνω τέτοια email» βλέπει **αυτόν** τον διακόπτη πρώτο.
 * - Υποχρεωτικά = «Πάντα», **χωρίς** διακόπτη (Figma: δεν έχουν «κλειστό») — ένας διακόπτης
 *   που δεν κάνει τίποτα θα ήταν ψέμα.
 * - Email καθολικά κλειστά ⇒ οι διακόπτες **απενεργοποιημένοι, με τις τιμές τους ορατές**:
 *   οι επιλογές ανά τύπο διατηρούνται για όταν ξανανοίξουν (ADR-849 Δ5).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  NOTIFICATION_PREFERENCE_GROUPS,
  type NotificationPreferenceGroup,
} from '@/config/notification-preference-rows';
import {
  isMandatorySetting,
  settingPathOf,
  type NotificationSettingRef,
} from '@/services/user-notification-settings/notification-preference-policy';
import type { EmailTypeMode } from '@/services/user-notification-settings/user-notification-settings.email-types';

const NAMESPACES = ['auth', 'common-account'];

/** Μία γραμμή του μητρώου, με τη διαδρομή του διακόπτη της. */
export interface EmailTypeRow {
  readonly path: string;
  readonly labelKey: string;
  readonly mandatory: boolean;
}

function rowsOf(group: NotificationPreferenceGroup): readonly EmailTypeRow[] {
  return group.settings.map((row) => {
    // Η διαδρομή χτίζεται από το **ίδιο** `settingPathOf` με τον διακομιστή — μία μορφή.
    const ref = { category: group.category, settingKey: row.key } as NotificationSettingRef;
    return { path: settingPathOf(ref), labelKey: row.labelKey, mandatory: isMandatorySetting(ref) };
  });
}

/** Όλες οι γραμμές, ανά ομάδα — υπολογισμένες **μία** φορά. */
const GROUP_ROWS: ReadonlyArray<{ readonly group: NotificationPreferenceGroup; readonly rows: readonly EmailTypeRow[] }> =
  NOTIFICATION_PREFERENCE_GROUPS.map((group) => ({ group, rows: rowsOf(group) }));

const ROW_BY_PATH: ReadonlyMap<string, EmailTypeRow> = new Map(
  GROUP_ROWS.flatMap(({ rows }) => rows.map((row) => [row.path, row] as const)),
);

/**
 * Η γραμμή ενός διακόπτη — για το μήνυμα «Δεν θα λαμβάνετε πλέον email για: …».
 *
 * ⚠️ Επιστρέφει τη **γραμμή**, όχι σκέτο κλειδί: ο καλών γράφει `t(row.labelKey)`, μορφή που
 * ο γεννήτορας του route slice λύνει από τα literals του μητρώου· ένα `t(labelKey)` από
 * τοπική μεταβλητή θα ήταν ανεπίλυτη δυναμική κλήση (ADR-744).
 */
export function emailTypeRow(path: string): EmailTypeRow | null {
  return ROW_BY_PATH.get(path) ?? null;
}

export interface EmailTypePreferencesProps {
  readonly mutedTypes: readonly string[];
  /** Οι τύποι του email που έφερε τον άνθρωπο εδώ (εμβέλεια του token) — μπαίνουν μπροστά. */
  readonly focus: readonly string[];
  readonly emailsOn: boolean;
  readonly busy: boolean;
  readonly onToggle: (path: string, mode: EmailTypeMode) => void;
}

interface TypeRowProps {
  readonly row: EmailTypeRow;
  readonly idPrefix: string;
  readonly muted: boolean;
  readonly disabled: boolean;
  readonly onToggle: (path: string, mode: EmailTypeMode) => void;
}

function TypeRow({ row, idPrefix, muted, disabled, onToggle }: TypeRowProps) {
  const { t } = useTranslation(NAMESPACES);
  const id = `${idPrefix}-${row.path}`;

  if (row.mandatory) {
    return (
      <li className="flex items-center justify-between gap-3">
        <span className="text-sm text-card-foreground">{t(row.labelKey)}</span>
        <span className="text-xs text-muted-foreground">{t('auth:emailPreferences.types.always')}</span>
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-sm text-card-foreground">{t(row.labelKey)}</Label>
      <Switch
        id={id}
        checked={!muted}
        disabled={disabled}
        onCheckedChange={(checked) => onToggle(row.path, checked ? 'on' : 'off')}
      />
    </li>
  );
}

export function EmailTypePreferences(props: EmailTypePreferencesProps): React.ReactElement {
  const { t } = useTranslation(NAMESPACES);
  const muted = new Set(props.mutedTypes);
  const focus = new Set(props.focus);
  const focusRows = props.focus.flatMap((path) => ROW_BY_PATH.get(path) ?? []);
  const disabled = props.busy || !props.emailsOn;
  const rowProps = (row: EmailTypeRow, idPrefix: string): TypeRowProps => ({
    row,
    idPrefix,
    muted: muted.has(row.path),
    disabled,
    onToggle: props.onToggle,
  });

  return (
    <section className="flex flex-col gap-3" aria-labelledby="email-types-title">
      <h2 id="email-types-title" className="text-sm font-semibold text-card-foreground">
        {t('auth:emailPreferences.types.title')}
      </h2>
      {!props.emailsOn && <p className="text-xs text-muted-foreground">{t('auth:emailPreferences.types.emailsOffNote')}</p>}
      {focusRows.length > 0 && (
        <section className="flex flex-col gap-2 rounded-md border border-border p-3" aria-labelledby="email-types-focus">
          <h3 id="email-types-focus" className="text-xs font-medium text-muted-foreground">
            {t('auth:emailPreferences.types.focusTitle')}
          </h3>
          <ul className="flex flex-col gap-2">
            {focusRows.map((row) => <TypeRow key={row.path} {...rowProps(row, 'focus')} />)}
          </ul>
        </section>
      )}
      <h3 className="text-xs font-medium text-muted-foreground">{t('auth:emailPreferences.types.allTitle')}</h3>
      {GROUP_ROWS.map(({ group, rows }) => (
        <details key={group.category} open={rows.some((row) => focus.has(row.path))} className="rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-card-foreground">{t(group.titleKey)}</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {rows.map((row) => <TypeRow key={row.path} {...rowProps(row, 'all')} />)}
          </ul>
        </details>
      ))}
    </section>
  );
}
