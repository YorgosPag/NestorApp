'use client';

/**
 * @fileoverview ⚖️ **Η «ΤΑΜΠΕΛΑ» ΤΟΥ ΦΟΡΕΑ** — ποιος παρέχει την υπηρεσία και πώς τον βρίσκεις (ADR-861 Φ2).
 * @related lib/platform-operator/operator-presentation.ts · constants/platform-operator.ts · components/mandate/LegalIdentityStatement.tsx
 * @module components/legal/OperatorIdentityStatement
 *
 * 🏆 **Ένα component, κάθε νομική σελίδα** (πολιτική απορρήτου · όροι · διαγραφή δεδομένων · νομικά
 * στοιχεία). Π.Δ. 131/2003 άρθ. 4 (επωνυμία · γεωγραφική διεύθυνση · email · μητρώο · ΑΦΜ) **και**
 * ΓΚΠΔ άρθ. 13(1)(α)-(β) (ταυτότητα υπευθύνου · επαφή για το απόρρητο) σε **ένα** σημείο κώδικα.
 *
 * 🔑 **Εξυπνότερα από τους μεγάλους** (Figma/Stripe γράφουν τη διεύθυνση στο κείμενο της πολιτικής):
 * - η ταμπέλα **παράγεται** από το ιστορικό του φορέα τη **σημερινή μέρα** — μεταβίβαση = νέα γραμμή,
 *   καμία σελίδα δεν ξαναγράφεται·
 * - email που **δεν έχει επιβεβαιωθεί** ότι διαβάζεται **δεν** εμφανίζεται ως λειτουργικό — ο ίδιος
 *   κανόνας με την άρνηση δημόσιου ανοίγματος (`isMailboxConfirmed`)·
 * - χωρίς φορέα ⇒ «θα αναρτηθούν», **ποτέ** πλαστά ή «ενδεικτικά» στοιχεία.
 *
 * ⚠️ Σημασιολογία: `<address>` (στοιχεία επικοινωνίας) γύρω από `<dl>` με το **υπάρχον** `Fact` —
 * καμία δεύτερη γραμμή «ετικέτα → τιμή». Το όνομα της χώρας το δίνει η γλώσσα του αναγνώστη
 * (`Intl.DisplayNames`), ποτέ η ρίζα.
 */

import React from 'react';

import { Fact } from '@/components/mandate/AgencyFact';
import { PLATFORM_OPERATORS, calendarDayOf, type OperatorRecord } from '@/constants/platform-operator';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getDisplayNames } from '@/lib/intl-formatting';
import {
  operatorStatementOn,
  type OperatorStatement,
  type OperatorStatementView,
} from '@/lib/platform-operator/operator-presentation';
import { emailHref } from '@/lib/validation/text-link-segments';

const LEGAL_NS = 'legal';

/** Ρητός χάρτης — ο γεννήτορας του slice λύνει τις τιμές του, όχι ένα template literal. */
const QUALIFIER_KEYS = {
  'trade-name': 'operator.qualifier.tradeName',
  'legal-form': 'operator.qualifier.legalForm',
} as const;

/** Η στιγμή και το ιστορικό είναι ορίσματα μόνο για τις άγκυρες· η εφαρμογή περνά τίποτα. */
export interface OperatorStatementSource {
  readonly now?: Date;
  readonly history?: readonly OperatorRecord[];
}

function useOperatorStatement({ now, history = PLATFORM_OPERATORS }: OperatorStatementSource): OperatorStatement {
  return operatorStatementOn(calendarDayOf(now ?? new Date()), history);
}

function MailboxValue({ address }: { readonly address: string | null }): React.JSX.Element {
  const { t } = useTranslation(LEGAL_NS);
  if (address === null) return <span>{t('operator.mailboxPending')}</span>;
  const href = emailHref(address);
  if (href === null) return <span>{address}</span>;
  return (
    <a href={href} className="font-medium text-foreground underline underline-offset-4">
      {address}
    </a>
  );
}

/**
 * **Μόνο η διεύθυνση ενός ρόλου** — για προτάσεις όπως «στείλτε email στη διεύθυνση: …» μέσα στο κείμενο.
 * Ίδια πηγή, ίδιος κανόνας επιβεβαίωσης με την πλήρη ταμπέλα.
 */
export function OperatorMailboxValue({
  role,
  ...source
}: OperatorStatementSource & { readonly role: 'contact' | 'privacy' }): React.JSX.Element {
  const statement = useOperatorStatement(source);
  if (statement.kind === 'pending') return <MailboxValue address={null} />;
  const { view } = statement;
  return <MailboxValue address={role === 'contact' ? view.contactEmail : view.privacyEmail} />;
}

function DeclaredStatement({ view }: { readonly view: OperatorStatementView }): React.JSX.Element {
  const { t } = useTranslation(LEGAL_NS);
  const country = getDisplayNames().region.of(view.countryCode) ?? view.countryCode;
  return (
    <address className="not-italic">
      <dl className="m-0 flex flex-col gap-3">
        <Fact label={t('operator.labels.operator')} value={view.name}>
          {view.qualifier === null ? null : (
            <span>{t(QUALIFIER_KEYS[view.qualifier.kind], { text: view.qualifier.text })}</span>
          )}
        </Fact>
        <Fact label={t('operator.labels.seat')} value={`${view.seatLine}, ${country}`} />
        <Fact label={t('operator.labels.vat')} value={view.vatNumber} />
        <Fact label={t('operator.labels.gemi')} value={view.gemiNumber ?? t('operator.noGemi')} />
        <Fact label={t('operator.labels.contact')}>
          <MailboxValue address={view.contactEmail} />
        </Fact>
        <Fact label={t('operator.labels.privacy')}>
          <MailboxValue address={view.privacyEmail} />
          <span className="text-xs">{t('operator.noDpo')}</span>
        </Fact>
      </dl>
    </address>
  );
}

/** **Ποιος παρέχει την υπηρεσία σήμερα** — δηλωμένος φορέας ή «θα αναρτηθούν». */
export function OperatorIdentityStatement(source: OperatorStatementSource): React.JSX.Element {
  const statement = useOperatorStatement(source);
  const { t } = useTranslation(LEGAL_NS);
  if (statement.kind === 'pending') return <p>{t('operator.pending')}</p>;
  return <DeclaredStatement view={statement.view} />;
}
