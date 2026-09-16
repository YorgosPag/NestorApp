'use client';

/**
 * Ο **ένας** renderer νομικού κειμένου — αποδίδει **παγωμένη έκδοση**, ποτέ ζωντανά κλειδιά.
 *
 * Τον χρησιμοποιούν η τρέχουσα σελίδα **και** το αρχείο εκδόσεων: ό,τι βλέπει ο αναγνώστης
 * σήμερα είναι **ακριβώς** τα bytes που υπογράφει το αποτύπωμα της έκδοσης σε ισχύ (ADR-861 Φ3).
 *
 * 🔑 Η ταμπέλα του φορέα αποδίδεται **για την ημέρα ισχύος της έκδοσης**, όχι για σήμερα: μια παλιά
 * έκδοση δείχνει τον φορέα που ίσχυε **τότε** (ADR-861 Σ1). Την ισότητα με ό,τι πάγωσε την
 * εγγυάται η CHECK 3.85 Κ5.
 *
 * ⚠️ Η γλώσσα `pseudo` (ADR-666) πέφτει στην προεπιλεγμένη: νομικό κείμενο **δεν** ψευδομεταφράζεται
 * — είναι δεδομένο παγωμένο, όχι συμβολοσειρά διεπαφής.
 *
 * @module components/legal/LegalDocumentBody
 * @see ADR-861 §7
 */

import React from 'react';

import { OperatorIdentityStatement, OperatorMailboxValue } from '@/components/legal/OperatorIdentityStatement';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import type { FrozenLegalBlock, FrozenLegalSection, FrozenLegalText } from '@/lib/legal/frozen-legal-document';
import type { LegalDocumentVersion } from '@/lib/legal/legal-document-versions';
import { fillLegalText, type PlaceholderValues } from '@/lib/legal/legal-text-placeholders';

/** Μεσημέρι UTC της ημέρας ισχύος — πέφτει στην **ίδια** ελληνική μέρα σε κάθε εποχή. */
export const instantOfDay = (day: string): Date => new Date(`${day}T12:00:00Z`);

/** Το κείμενο στη γλώσσα του αναγνώστη. */
export function useFrozenText(version: LegalDocumentVersion): FrozenLegalText {
  const { i18n } = useTranslation('legal');
  return version.frozen.locales[resolveHumanLanguage(i18n.language)];
}

/**
 * Συμπληρωτής θέσεων τιμών (`{agency}` · `{expiresOn}`). Χωρίς τιμές ⇒ ονομασμένες ετικέτες.
 * ⚠️ Ρητές κλήσεις `t('…')` — ο σαρωτής του route slice (ADR-744) δεν βλέπει αναζητήσεις σε χάρτη.
 */
export function useLegalTextFill(values: PlaceholderValues = {}): (text: string) => string {
  const { t } = useTranslation('legal');
  const labels = { agency: t('versions.placeholders.agency'), expiresOn: t('versions.placeholders.expiresOn') };
  return (text) => fillLegalText(text, values, labels);
}

interface BlockProps {
  readonly block: FrozenLegalBlock;
  readonly asOf: Date;
  readonly fill: (text: string) => string;
}

function Block({ block, asOf, fill }: BlockProps): React.JSX.Element {
  switch (block.kind) {
    case 'paragraph':
      return <p>{fill(block.text)}</p>;
    case 'clause':
      return <p id={`legal-clause-${block.id}`}>{fill(block.text)}</p>;
    case 'operator-identity':
      return <OperatorIdentityStatement now={asOf} />;
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul';
      return (
        <ListTag>
          {block.items.map((item) => (
            <li key={item.text}>
              {fill(item.text)}
              {item.mailbox === undefined ? null : (
                <>
                  {' '}
                  <OperatorMailboxValue role={item.mailbox} now={asOf} />
                </>
              )}
            </li>
          ))}
        </ListTag>
      );
    }
  }
}

export function LegalSectionContent({
  section,
  asOf,
  idPrefix = 'legal-section',
  headingLevel = 'h2',
  values,
}: {
  readonly section: FrozenLegalSection;
  readonly asOf: Date;
  /** Διαφορετικό πρόθεμα όταν δύο εκδόσεις της ίδιας ενότητας αποδίδονται δίπλα-δίπλα. */
  readonly idPrefix?: string;
  /** `h3` όταν η ενότητα αποδίδεται **μέσα** σε άλλη ενότητα (π.χ. «τι άλλαξε»). */
  readonly headingLevel?: 'h2' | 'h3';
  /** Τιμές θέσεων (π.χ. από μια καταγεγραμμένη συναίνεση) — χωρίς αυτές, ονομασμένες ετικέτες. */
  readonly values?: PlaceholderValues;
}): React.JSX.Element {
  const fill = useLegalTextFill(values);
  const headingId = `${idPrefix}-${section.id}`;
  const Heading = headingLevel;
  return (
    <section aria-labelledby={headingId}>
      <Heading id={headingId}>{section.heading}</Heading>
      {section.blocks.map((block, i) => (
        <Block key={`${section.id}-${i}`} block={block} asOf={asOf} fill={fill} />
      ))}
    </section>
  );
}

export function LegalDocumentBody({
  version,
  values,
}: {
  readonly version: LegalDocumentVersion;
  readonly values?: PlaceholderValues;
}): React.JSX.Element {
  const text = useFrozenText(version);
  const asOf = instantOfDay(version.frozen.effectiveFrom);
  return (
    <>
      {text.sections.map((section) => (
        <LegalSectionContent key={section.id} section={section} asOf={asOf} values={values} />
      ))}
    </>
  );
}
