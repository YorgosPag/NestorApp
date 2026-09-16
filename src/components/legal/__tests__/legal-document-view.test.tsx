/**
 * @fileoverview Άγκυρες της τρέχουσας σελίδας νομικού εγγράφου (ADR-861 Φ3).
 *
 * | # | Κανόνας | Μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Λ5 | Η σελίδα αποδίδει **την παγωμένη έκδοση σε ισχύ** — τίτλος/ενότητες/ημερομηνία από το μητρώο | ζωντανά κλειδιά i18n ή χειρόγραφη ημερομηνία |
 * | Λ5α | Γλώσσα αναγνώστη ⇒ το κείμενο **αυτής** της γλώσσας από την ίδια έκδοση | πάντα ελληνικά |
 * | Λ8 | Άκυρο τμήμα έκδοσης (`01`, `1.0`, `abc`) ⇒ 404, ποτέ «κάποια» έκδοση | αποδοχή με `Number()` |
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

let language = 'el';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
    i18n: { language },
    isNamespaceReady: true,
  }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

jest.mock('@/components/legal/OperatorIdentityStatement', () => ({
  OperatorIdentityStatement: () => <p>operator-statement</p>,
  OperatorMailboxValue: () => <span>operator-mailbox</span>,
}));

import { LegalDocumentView } from '../LegalDocumentView';
import { VERSION_SEGMENT } from '../LegalVersionDetail';
import { legalDocumentInForce } from '@/lib/legal/legal-document-versions';
import { calendarDayOf } from '@/constants/platform-operator';

function inForce() {
  const lookup = legalDocumentInForce('privacy-policy', calendarDayOf(new Date()));
  if (lookup.kind !== 'in-force') throw new Error('η πολιτική απορρήτου δεν έχει έκδοση σε ισχύ');
  return lookup.version;
}

describe('ADR-861 Φ3 — η τρέχουσα σελίδα νομικού εγγράφου', () => {
  beforeEach(() => {
    language = 'el';
  });

  it('Λ5 — τίτλος, ενότητες και «έκδοση · σε ισχύ από» προέρχονται από την παγωμένη έκδοση', () => {
    const version = inForce();
    render(<LegalDocumentView document="privacy-policy" />);

    const text = version.frozen.locales.el;
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(text.title);
    for (const section of text.sections) {
      expect(screen.getByRole('heading', { level: 2, name: section.heading })).toBeInTheDocument();
    }
    expect(screen.getByText(new RegExp(`versions\\.line .*"version":${version.frozen.version}`))).toBeInTheDocument();
    // Κανένα ζωντανό κλειδί σώματος: το κείμενο δεν περνά πια από το i18n.
    expect(screen.queryByText(/privacyPolicy\./)).not.toBeInTheDocument();
  });

  it('Λ5α — αγγλικά ⇒ το αγγλικό κείμενο της ΙΔΙΑΣ έκδοσης', () => {
    language = 'en';
    const version = inForce();
    render(<LegalDocumentView document="privacy-policy" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(version.frozen.locales.en.title);
  });

  it('Λ8 — μόνο θετικός ακέραιος χωρίς μηδενικά μπροστά είναι τμήμα έκδοσης', () => {
    for (const valid of ['1', '2', '10']) expect(VERSION_SEGMENT.test(valid)).toBe(true);
    for (const invalid of ['0', '01', '1.0', 'abc', '', '-1', '1e2']) expect(VERSION_SEGMENT.test(invalid)).toBe(false);
  });
});
