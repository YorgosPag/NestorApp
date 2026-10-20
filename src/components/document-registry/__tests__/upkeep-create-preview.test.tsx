/**
 * @fileoverview ADR-915 §37 (Γ) — **η πρόταση μόνιμων υποχρεώσεων στο συρτάρι δημιουργίας**, όπως τη βλέπει ο άνθρωπος:
 *   ζωντανή από είδος + φάση της φόρμας, με λόγο, **χωρίς** απόφαση, κουμπί ή κλήση δικτύου (§35 Μ3).
 *
 * 🔴 **Διαβάζει ΑΠΟΔΟΣΗ**: αληθινά `UpkeepCreatePreview` · `upkeepItemsOf` · η κοινή ενότητα. Ψεύτικη μόνο η μετάφραση
 *    (επιστρέφει το κλειδί). Το δίκτυο του μητρώου **σκάει** αν το αγγίξει κανείς — η δημιουργία δεν ρωτά, δεν γράφει.
 */

import { render, screen, within } from '@testing-library/react';
import React from 'react';

import { UpkeepCreatePreview } from '../UpkeepCreatePreview';
import { UPKEEP_KEYS, UPKEEP_PROPOSAL_KEYS, UPKEEP_SECTION_LEAD_KEYS, UPKEEP_SECTION_TITLE_KEYS } from '../upkeep-labels';

jest.mock('@/services/document-registry/document-registry.client', () => ({
  fetchPropertyUpkeep: () => {
    throw new Error('Το συρτάρι δημιουργίας ΔΕΝ διαβάζει από το δίκτυο');
  },
  saveUpkeepDeclaration: () => {
    throw new Error('Η δημιουργία ΔΕΝ γράφει απόφαση (§35 Μ3)');
  },
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

const region = () => screen.getByRole('region', { name: new RegExp(UPKEEP_SECTION_TITLE_KEYS.create) });

describe('§37 (Γ) — η πρόταση πριν σωθεί το ακίνητο', () => {
  it('νέα κατοικία (`draft`) ⇒ «Προτείνεται: φάση μη δηλωμένη», με τίτλο/υπότιτλο του συρταριού, ΧΩΡΙΣ κουμπί ή «Εκκρεμούν»', () => {
    render(<UpkeepCreatePreview type="apartment" phase="draft" />);
    const section = region();
    expect(within(section).getByText(UPKEEP_PROPOSAL_KEYS['phase-undeclared'])).toBeInTheDocument();
    // ⚠️ Κυριολεκτικό κλειδί, ΟΧΙ ο χάρτης: ο χάρτης είναι αυτό που κρίνεται (μετάλλαξη Μ9 — κυκλικός παρονομαστής).
    expect(within(section).getByText('document-registry:upkeep.createLead')).toBeInTheDocument();
    expect(within(section).queryByText(UPKEEP_SECTION_LEAD_KEYS.registry)).toBeNull();
    expect(within(section).queryByRole('button')).toBeNull();
    expect(within(section).queryByText(new RegExp(UPKEEP_KEYS.pending))).toBeNull();
  });

  it('η πρόταση αλλάζει ΖΩΝΤΑΝΑ με τη φάση: `ready` ⇒ «σε χρήση»· υπό κατασκευή ⇒ σιωπή (δεν προτείνεται)', () => {
    const { rerender, container } = render(<UpkeepCreatePreview type="apartment" phase="ready" />);
    expect(within(region()).getByText(UPKEEP_PROPOSAL_KEYS['in-use'])).toBeInTheDocument();
    rerender(<UpkeepCreatePreview type="apartment" phase="under-construction" />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['είδος που δεν διαλέχτηκε ακόμη', ''],
    ['οικόπεδο (ποτέ ΥΔΕ)', 'plot'],
  ])('%s ⇒ καμία ενότητα (κανένας θόρυβος)', (_case, type) => {
    const { container } = render(<UpkeepCreatePreview type={type} phase="draft" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('είδος που η εφαρμογή δεν αναγνωρίζει ⇒ το ΛΕΕΙ («Άγνωστο είδος ακινήτου»), δεν σιωπά', () => {
    render(<UpkeepCreatePreview type="not-a-type" phase="draft" />);
    expect(within(region()).getByText(UPKEEP_PROPOSAL_KEYS['class-unknown'])).toBeInTheDocument();
  });
});
