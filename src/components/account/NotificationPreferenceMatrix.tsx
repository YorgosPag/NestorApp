'use client';

/**
 * =============================================================================
 * Η ΜΗΤΡΑ ΠΡΟΤΙΜΗΣΕΩΝ — «θέλω αυτόν τον τύπο; …και με email;» (ADR-849 Α3)
 * =============================================================================
 *
 * 🏆 **Ό,τι κάνουν οι μεγάλοι** (Jira · GitHub · Figma · Airbnb): τύπος × κανάλι.
 *
 * 🔑 **Και ό,τι κάνουμε καλύτερα**: η μήτρα καναλιών των μεγάλων έχει **ανεξάρτητες** στήλες
 * («In-app» | «Email»). Στο μοντέλο μας δεν είναι έτσι — ο κύριος διακόπτης (`categories`) κλείνει
 * **και** κουδούνι **και** email, και το `emailCategories` μόνο **στενεύει** (ADR-849 Δ1). Μια στήλη
 * «Στην εφαρμογή» θα ήταν ψέμα. Άρα οι στήλες λένε **«Ειδοποίηση» · «Και με email»**, και το email
 * μιας γραμμής γίνεται ανενεργό όταν ο κύριος είναι κλειστός — με την τιμή του **ορατή**.
 *
 * - **Υποχρεωτικά** (ασφάλεια): **κανένας** διακόπτης — κλειδαριά + «Πάντα» και στις δύο στήλες,
 *   με **ορατή** εξήγηση κάτω από την ομάδα (όχι tooltip: σε `disabled` δεν εμφανίζεται, και δεν
 *   υπάρχει σε αφή). Η πολιτική τα στέλνει πάντα, ακόμη και με τα email καθολικά κλειστά.
 * - **Email καθολικά κλειστά**: στήλη ανενεργή, τιμές ορατές και **διατηρημένες** (Δ5), και ένα κουμπί
 *   που **μεταφέρει εστίαση** στη ρύθμιση email — **δεν γράφει** τίποτα (καμία μαντεψιά συχνότητας).
 * - **Υπότιτλος στήλης = η συχνότητα** («Ημερήσια σύνοψη»): ο άνθρωπος ξέρει τι σημαίνει «ναι».
 * - Προσβασιμότητα: `<th scope>` + `aria-labelledby` (γραμμή + στήλη) ⇒ «Νέο lead, Και με email».
 *
 * @module components/account/NotificationPreferenceMatrix
 * @see ADR-849
 */

import { Lock } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { emailsAreOn } from '@/lib/notifications/email-subscription-contract';
import { cn } from '@/lib/utils';
import type { EmailFrequency, EmailTypeMode, UserNotificationSettings } from '@/services/user-notification-settings';
import {
  categorySettingEnabled,
  emailModeFor,
  type NotificationSettingRef,
} from '@/services/user-notification-settings/notification-preference-policy';
import {
  PREFERENCE_TABLE,
  type PreferenceGroupRows,
  type PreferenceRow,
} from '@/services/user-notification-settings/notification-preference-table';

import { CATEGORY_ICONS, DELIVERY_CONTROL_IDS, FREQUENCY_LABEL_KEYS } from './notification-settings-config';
import { useNotificationSettingsUi } from './useNotificationSettingsUi';

export interface NotificationPreferenceMatrixProps {
  readonly settings: UserNotificationSettings;
  readonly onTypeEnabled: (ref: NotificationSettingRef, enabled: boolean) => void;
  readonly onTypeEmail: (ref: NotificationSettingRef, mode: EmailTypeMode) => void;
}

/** Ό,τι μοιράζονται όλες οι γραμμές. */
interface MatrixContext extends NotificationPreferenceMatrixProps {
  readonly emailsOn: boolean;
}

/** Τα ids των κεφαλίδων στήλης μιας ομάδας — το δεύτερο μισό του ονόματος κάθε διακόπτη. */
interface ColumnIds {
  readonly notify: string;
  readonly email: string;
}

function columnIdsOf(category: string): ColumnIds {
  return { notify: `notification-col-${category}-notify`, email: `notification-col-${category}-email` };
}

/** Το id της κεφαλίδας γραμμής — και, με κατάληξη, των διακοπτών της. */
export function preferenceRowId(path: string): string {
  return `notification-row-${path}`;
}

/** Μεταφέρει τον άνθρωπο στον έλεγχο — **δεν** γράφει τίποτα (ADR-849 Δ8). */
function focusControl(id: string): void {
  const control = document.getElementById(id);
  if (control === null) return;
  control.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  control.focus({ preventScroll: true });
}

function LockedCell() {
  const { t, colors, iconSizes } = useNotificationSettingsUi();
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', colors.text.muted)}>
      <Lock className={iconSizes.xs} aria-hidden="true" />
      {t('common-account:account.notificationSettings.preferences.always')}
    </span>
  );
}

function PreferenceRowView({ row, columns, context }: { row: PreferenceRow; columns: ColumnIds; context: MatrixContext }) {
  const { t, colors, typography } = useNotificationSettingsUi();
  const rowId = preferenceRowId(row.path);
  const master = categorySettingEnabled(context.settings, row.ref);

  return (
    <TableRow>
      <TableHead scope="row" id={rowId} className={cn('h-auto py-2 font-normal', typography.body.sm, colors.text.secondary)}>
        {t(row.labelKey)}
      </TableHead>
      <TableCell className="text-center">
        {row.mandatory ? <LockedCell /> : (
          <Switch
            id={`${rowId}-notify`}
            aria-labelledby={`${rowId} ${columns.notify}`}
            checked={master}
            onCheckedChange={(checked) => context.onTypeEnabled(row.ref, checked)}
          />
        )}
      </TableCell>
      <TableCell className="text-center">
        {row.mandatory ? <LockedCell /> : (
          <Switch
            id={`${rowId}-email`}
            aria-labelledby={`${rowId} ${columns.email}`}
            checked={emailModeFor(context.settings, row.ref) === 'on'}
            disabled={!master || !context.emailsOn}
            onCheckedChange={(checked) => context.onTypeEmail(row.ref, checked ? 'on' : 'off')}
          />
        )}
      </TableCell>
    </TableRow>
  );
}

function MatrixHead({ columns, frequency }: { columns: ColumnIds; frequency: EmailFrequency | null }) {
  const { t } = useNotificationSettingsUi();
  return (
    <TableHeader>
      <TableRow>
        <TableHead scope="col">
          <span className="sr-only">{t('common-account:account.notificationSettings.preferences.columns.type')}</span>
        </TableHead>
        <TableHead scope="col" className="h-auto w-20 py-1 text-center">
          <span id={columns.notify}>{t('common-account:account.notificationSettings.preferences.columns.notify')}</span>
        </TableHead>
        <TableHead scope="col" className="h-auto w-20 py-1 text-center">
          <span id={columns.email}>{t('common-account:account.notificationSettings.preferences.columns.email')}</span>
          {frequency !== null && <span className="block text-xs font-normal">{t(FREQUENCY_LABEL_KEYS[frequency])}</span>}
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

function PreferenceGroup({ entry, context }: { entry: PreferenceGroupRows; context: MatrixContext }) {
  const { t, colors, layout, iconSizes, typography } = useNotificationSettingsUi();
  const { group, rows, hasMandatory } = entry;
  const Icon = CATEGORY_ICONS[group.category];
  const headingId = `notification-group-${group.category}`;
  const columns = columnIdsOf(group.category);

  return (
    <section aria-labelledby={headingId} className={cn(layout.flexColGap2, 'py-4 border-t border-border')}>
      <header className={layout.flexCenterGap2}>
        <Icon className={cn(iconSizes.md, colors.text.primary)} aria-hidden="true" />
        <hgroup>
          <h3 id={headingId} className={cn(typography.label.sm, colors.text.primary)}>{t(group.titleKey)}</h3>
          <p className={cn(typography.body.sm, colors.text.muted)}>{t(group.descriptionKey)}</p>
        </hgroup>
      </header>
      <Table aria-labelledby={headingId}>
        <MatrixHead columns={columns} frequency={context.emailsOn ? context.settings.emailFrequency : null} />
        <TableBody>
          {rows.map((row) => <PreferenceRowView key={row.path} row={row} columns={columns} context={context} />)}
        </TableBody>
      </Table>
      {hasMandatory && (
        <p className={cn(typography.body.xs, colors.text.muted)}>
          {t('common-account:account.notificationSettings.preferences.mandatoryNote')}
        </p>
      )}
    </section>
  );
}

function EmailsOffNotice({ settings }: { settings: UserNotificationSettings }) {
  const { t, colors, layout, borders, typography } = useNotificationSettingsUi();
  // Κλειστό `emailEnabled` ⇒ ο διακόπτης email· ανοιχτό αλλά συχνότητα `disabled` ⇒ ο επιλογέας.
  const target = settings.emailEnabled ? DELIVERY_CONTROL_IDS.emailFrequency : DELIVERY_CONTROL_IDS.email;

  return (
    <aside role="note" className={cn(layout.flexColGap2, layout.padding4, borders.radiusClass.md, colors.bg.muted)}>
      <p className={cn(typography.body.sm, colors.text.secondary)}>
        {t('common-account:account.notificationSettings.preferences.emailsOffNote')}
      </p>
      <Button type="button" variant="link" className="h-auto self-start p-0" onClick={() => focusControl(target)}>
        {t('common-account:account.notificationSettings.preferences.emailsOffAction')}
      </Button>
    </aside>
  );
}

export function NotificationPreferenceMatrix(props: NotificationPreferenceMatrixProps): React.JSX.Element {
  const emailsOn = emailsAreOn(props.settings);
  const context: MatrixContext = { ...props, emailsOn };

  return (
    <>
      {!emailsOn && <EmailsOffNotice settings={props.settings} />}
      {PREFERENCE_TABLE.map((entry) => (
        <PreferenceGroup key={entry.group.category} entry={entry} context={context} />
      ))}
    </>
  );
}
