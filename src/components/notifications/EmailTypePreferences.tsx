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
 *
 * 🔗 ADR-849 Α3: οι γραμμές (διαδρομή, «υποχρεωτικός;») και το λεξιλόγιο («Πάντα», «τα email
 * είναι κλειστά») είναι **κοινά** με την οθόνη ρυθμίσεων — `notification-preference-table` και
 * `common-account:…preferences.*`.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  PREFERENCE_TABLE,
  preferenceRowOf,
  type PreferenceRow,
} from '@/services/user-notification-settings/notification-preference-table';
import type { EmailTypeMode } from '@/services/user-notification-settings/user-notification-settings.email-types';

const NAMESPACES = ['auth', 'common-account'];

export interface EmailTypePreferencesProps {
  readonly mutedTypes: readonly string[];
  /** Οι τύποι του email που έφερε τον άνθρωπο εδώ (εμβέλεια του token) — μπαίνουν μπροστά. */
  readonly focus: readonly string[];
  readonly emailsOn: boolean;
  readonly busy: boolean;
  readonly onToggle: (path: string, mode: EmailTypeMode) => void;
}

interface TypeRowProps {
  readonly row: PreferenceRow;
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
        <span className="text-xs text-muted-foreground">
          {t('common-account:account.notificationSettings.preferences.always')}
        </span>
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-sm text-card-foreground">{t(row.labelKey)}</Label>
      <Switch
        id={id}
        // ADR-849 Α3: `default` = αόρατο «ανοιχτό» στο σκούρο θέμα (`--primary` ≡ `--card`, CHECK 3.38).
        variant="success"
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
  const focusRows = props.focus.flatMap((path) => preferenceRowOf(path) ?? []);
  const disabled = props.busy || !props.emailsOn;
  const rowProps = (row: PreferenceRow, idPrefix: string): TypeRowProps => ({
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
      {!props.emailsOn && (
        <p className="text-xs text-muted-foreground">
          {t('common-account:account.notificationSettings.preferences.emailsOffNote')}
        </p>
      )}
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
      {PREFERENCE_TABLE.map(({ group, rows }) => (
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
