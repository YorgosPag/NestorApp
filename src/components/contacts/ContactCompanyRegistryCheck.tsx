'use client';

/**
 * @fileoverview **«Έλεγχος στο ΓΕΜΗ»** στα βασικά στοιχεία της επαφής-εταιρείας (ADR-948 §8 Βήμα 7).
 * @module components/contacts/ContactCompanyRegistryCheck
 *
 * Καθρέφτης του `ContactLicenceRegistryCheck` (ίδιο hook, `useRegistryCheckReport`), για το ΓΕΜΗ:
 * - η **ανάγνωση** δεν ρωτά το ΓΕΜΗ· μόνο το πάτημα ρωτά (κάθε κλήση = μία ανθρώπινη πράξη)·
 * - η σύγκριση τρέχει **πάνω στη φόρμα** (`liveRegistryComparison`), όχι στο `report.comparison` του server ⇒
 *   το «Δέξου» πρασινίζει αμέσως και το σήμα σβήνει μόνο του αν αλλάξει η τιμή·
 * - «Δέξου» = `setFormData(acceptRegistryField(…))` — η εγγραφή περνά από την υπάρχουσα αποθήκευση· καμία δεύτερη πόρτα·
 * - η έδρα πηγαίνει ως **πρόταση** στον editor διευθύνσεων (`proposeHqAddress`) και η φόρμα πάει στην καρτέλα του·
 * - κάθε αποτυχία λέει **τι** απέτυχε· «δεν μπόρεσα να ρωτήσω» δεν λέγεται ποτέ «δεν υπάρχει».
 * 🔑 Ο server ρωτά με τα **αποθηκευμένα** Αρ. ΓΕΜΗ / ΑΦΜ — η οθόνη το λέει δίπλα στο κουμπί.
 * ⚖️ ODC-BY-1.0: η αναφορά πηγής φαίνεται πάντα κάτω από την απάντηση (`GEMI_OPEN_DATA_ATTRIBUTION`).
 */

import React from 'react';

import { proposeHqAddress } from '@/components/contacts/dynamic/hq-address-proposal-store';
import { Button } from '@/components/ui/button';
import { GEMI_OPEN_DATA_ATTRIBUTION } from '@/config/company-registry/gemi-open-data-attribution';
import { API_ROUTES } from '@/config/domain-constants';
import { useRegistryCheckReport } from '@/hooks/useRegistryCheckReport';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ContactRegistryComparison } from '@/lib/company/contact-registry-comparison';
import { acceptRegistryField, liveRegistryComparison, type AcceptableRegistryField } from '@/lib/company/registry-form-acceptance';
import { formatDate } from '@/lib/intl-formatting';
import type { RegistryCheck } from '@/types/company-registry';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { ContactRegistryAttempt, ContactRegistryReport } from '@/types/contact-registry-check';

import { ContactCompanyRegistryComparison } from './ContactCompanyRegistryComparison';
import {
  CONTACT_COMPANY_REGISTRY_ATTEMPT_KEYS as ATTEMPT_KEYS,
  CONTACT_COMPANY_REGISTRY_KEYS as KEYS,
  CONTACT_COMPANY_REGISTRY_REFUSAL_KEYS as REFUSAL_KEYS,
  CONTACT_COMPANY_REGISTRY_UNAVAILABLE_KEYS as UNAVAILABLE_KEYS,
} from './contact-company-registry-labels';

type Translate = ReturnType<typeof useTranslation>['t'];

export interface ContactCompanyRegistryCheckProps {
  /** Αποθηκευμένη επαφή — ο server ελέγχει τα αποθηκευμένα της. */
  readonly contactId: string;
  readonly formData: ContactFormData;
  readonly setFormData?: (data: ContactFormData) => void;
  readonly disabled: boolean;
  /** Πηγαίνει τη φόρμα στην καρτέλα διευθύνσεων — εκεί παραλαμβάνεται η πρόταση έδρας. */
  readonly onOpenAddresses?: () => void;
}

/** Η γραμμή της τελευταίας ερώτησης — `null` όταν έφερε απάντηση ή δεν έγινε. */
function attemptText(attempt: ContactRegistryAttempt, t: Translate): string | null {
  switch (attempt.kind) {
    case 'not-asked':
    case 'asked':
      return null;
    case 'ambiguous':
      return t(ATTEMPT_KEYS.ambiguous, { numbers: attempt.registrationNumbers.join(', ') });
    case 'refused':
      return t(REFUSAL_KEYS[attempt.reason]);
    case 'unavailable':
      return t(UNAVAILABLE_KEYS[attempt.reason]);
    default:
      return t(ATTEMPT_KEYS[attempt.kind]);
  }
}

/** Ό,τι το ίδιο το ΓΕΜΗ λέει για την επιχείρηση και αλλάζει την ανάγνωση όλων των άλλων. */
function RegistryWarnings({ check, t }: { readonly check: RegistryCheck; readonly t: Translate }) {
  const inactive = check.record.status.activity === 'inactive';
  const incomplete = !check.record.selfRegistered;
  if (!inactive && !incomplete) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0" role="status">
      {inactive && <li className="text-xs font-medium text-destructive">{t(KEYS.inactive)}</li>}
      {incomplete && <li className="text-xs text-muted-foreground">{t(KEYS.incomplete)}</li>}
    </ul>
  );
}

function Attribution({ t }: { readonly t: Translate }) {
  const linkClass = 'underline underline-offset-2 hover:text-foreground';
  return (
    <p className="m-0 text-xs text-muted-foreground">
      <a className={linkClass} href={GEMI_OPEN_DATA_ATTRIBUTION.sourceUrl} target="_blank" rel="noopener noreferrer">
        {t(KEYS.attributionSource)}
      </a>
      {' · '}
      <a className={linkClass} href={GEMI_OPEN_DATA_ATTRIBUTION.licenceUrl} target="_blank" rel="noopener noreferrer">
        {t(KEYS.attributionLicence)}
      </a>
    </p>
  );
}

interface AnswerProps {
  readonly check: RegistryCheck | null;
  readonly comparison: ContactRegistryComparison | null;
  readonly canEdit: boolean;
  readonly onAccept: (field: AcceptableRegistryField) => void;
  readonly onProposeSeat: () => void;
  readonly t: Translate;
}

function RegistryAnswer({ check, comparison, canEdit, onAccept, onProposeSeat, t }: AnswerProps) {
  if (check === null) return <p className="m-0 text-xs text-muted-foreground">{t(KEYS.notChecked)}</p>;
  return (
    <>
      <p className="m-0 text-xs text-foreground">{t(KEYS.checkedAt, { date: formatDate(check.checkedAt) })}</p>
      <RegistryWarnings check={check} t={t} />
      {comparison === null ? (
        <p className="m-0 text-xs text-muted-foreground">{t(KEYS.noComparison)}</p>
      ) : (
        <ContactCompanyRegistryComparison
          comparison={comparison}
          checkedAt={check.checkedAt}
          canEdit={canEdit}
          onAccept={onAccept}
          onProposeSeat={onProposeSeat}
        />
      )}
      <Attribution t={t} />
    </>
  );
}

/** «Δέξου» και «Διόρθωσε την έδρα» — οι δύο πράξεις πάνω στη φόρμα, ποτέ πάνω στη βάση. */
function useRegistryActions(props: ContactCompanyRegistryCheckProps, check: RegistryCheck | null, comparison: ContactRegistryComparison | null) {
  const { contactId, formData, setFormData, onOpenAddresses } = props;
  const onAccept = (field: AcceptableRegistryField): void => {
    if (comparison !== null && setFormData) setFormData(acceptRegistryField(formData, comparison, field));
  };
  const onProposeSeat = (): void => {
    const seat = comparison?.seat.registry ?? null;
    if (check === null || seat === null) return;
    proposeHqAddress({ contactId, source: check.record.source, observedAt: check.checkedAt, seat });
    onOpenAddresses?.();
  };
  return { onAccept, onProposeSeat, canEdit: !props.disabled && setFormData !== undefined };
}

interface CheckButtonProps {
  readonly answered: boolean;
  readonly checking: boolean;
  readonly check: () => Promise<void>;
  readonly t: Translate;
}

/** Μένει και μετά από αποτυχία — αλλιώς ο άνθρωπος δεν θα μπορούσε να ξαναδοκιμάσει. */
function CheckButton({ answered, checking, check, t }: CheckButtonProps) {
  return (
    <Button type="button" variant="outline" size="sm" className="self-start" disabled={checking} aria-busy={checking} onClick={() => void check()}>
      {checking ? t(KEYS.checking) : answered ? t(KEYS.recheck) : t(KEYS.check)}
    </Button>
  );
}

export function ContactCompanyRegistryCheck(props: ContactCompanyRegistryCheckProps) {
  const { t } = useTranslation('contacts-form');
  const headingId = React.useId();
  const { state, checking, check } = useRegistryCheckReport<ContactRegistryReport>(
    API_ROUTES.CONTACTS.REGISTRY_CHECK(props.contactId),
    props.contactId,
  );
  const report = state.kind === 'ready' ? state.report : null;
  const comparison = liveRegistryComparison(props.formData, report?.check ?? null);
  const actions = useRegistryActions(props, report?.check ?? null, comparison);
  if (state.kind === 'loading') return null;
  const attempt = report === null ? null : attemptText(report.attempt, t);
  return (
    <section className="flex flex-col gap-2 rounded-md border p-3" aria-labelledby={headingId}>
      <h3 id={headingId} className="m-0 text-sm font-semibold text-foreground">{t(KEYS.title)}</h3>
      <p className="m-0 text-xs text-muted-foreground">{t(KEYS.hint)}</p>
      {report === null ? (
        <p className="m-0 text-xs text-muted-foreground" role="status">{t(KEYS.failed)}</p>
      ) : (
        <RegistryAnswer check={report.check} comparison={comparison} t={t} {...actions} />
      )}
      {attempt !== null && <p className="m-0 text-xs text-foreground" role="status">{attempt}</p>}
      <CheckButton answered={(report?.check ?? null) !== null} checking={checking} check={check} t={t} />
      <p className="m-0 text-xs text-muted-foreground">{t(KEYS.unsavedHint)}</p>
    </section>
  );
}
