/**
 * ⚓ ADR-777 §8.96 — η προεπισκόπηση της εισαγωγής ΠΕΑ: τίποτα δεν εφαρμόζεται πριν κλείσει ο άνθρωπος ό,τι δεν λέει
 * το έγγραφο (αμφίσημη κλάση · μονάδα ή κτήριο), και η διόρθωση που φεύγει είναι ΟΛΟΚΛΗΡΗ, με προέλευση.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { UNDECLARED_ENERGY_CERTIFICATE } from '@/lib/energy-certificate/energy-certificate';
import {
  peaPagesJoined,
  peaPagesPdfjs,
  SYNTHETIC_PEA,
  type SyntheticPea,
} from '@/lib/energy-certificate/__tests__/pea-text.fixture';
import { peaProposalOf, type PeaProposal } from '@/lib/energy-certificate/pea-proposal';
import { readPeaText } from '@/lib/energy-certificate/pea-text';

import { EnergyCertificateImportReview } from '../EnergyCertificateImportReview';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string) => key;
  const stable = { t, i18n: { language: 'el' }, ready: true, currentLanguage: 'el' };
  return { useTranslation: () => stable };
});

const R = 'properties-enums:energyCertificate.import.review';

function proposalOf(pea: SyntheticPea, propertyArea: number | null): PeaProposal {
  const read = readPeaText(peaPagesJoined(pea));
  if (read.kind !== 'read') throw new Error('αναμενόταν ανάγνωση');
  return peaProposalOf(read.reading, { fileId: 'file_pea', current: UNDECLARED_ENERGY_CERTIFICATE, propertyArea, today: '2026-10-14' });
}

function show(proposal: PeaProposal) {
  const onApply = jest.fn();
  render(
    <EnergyCertificateImportReview
      proposal={proposal}
      current={UNDECLARED_ENERGY_CERTIFICATE}
      commit="form-save"
      onCancel={jest.fn()}
      onApply={onApply}
    />,
  );
  return { onApply, apply: () => screen.getByRole('button', { name: `${R}.apply` }) };
}

describe('Ο1 — καθαρή περίπτωση: κλάση από τον λόγο, μονάδα από το εμβαδόν', () => {
  it('«Εφαρμογή» ενεργό αμέσως· φεύγει ΟΛΟΚΛΗΡΟ μπλοκ με προέλευση', () => {
    const { onApply, apply } = show(proposalOf(SYNTHETIC_PEA, 80));
    expect(apply()).toBeEnabled();
    fireEvent.click(apply());
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ class: 'B+', scope: 'unit', sourceFileId: 'file_pea', primaryEnergy: 84, absence: null }),
    );
  });
});

describe('Ο2 — 🔴 ό,τι δεν λέει το έγγραφο το κλείνει ο άνθρωπος', () => {
  it('αμφίσημη κλάση ⇒ «Εφαρμογή» ανενεργό ώσπου να διαλέξει (καμία προεπιλογή)', () => {
    const { onApply, apply } = show(proposalOf({ ...SYNTHETIC_PEA, primary: '60.0' }, 80));
    expect(apply()).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'properties-enums:energyClass.bPlus' }));
    expect(apply()).toBeEnabled();
    fireEvent.click(apply());
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ class: 'B+' }));
  });

  it('άγνωστο εμβαδόν ακινήτου ⇒ καμία προεπιλεγμένη εμβέλεια ⇒ ανενεργό ώσπου να απαντήσει', () => {
    const { onApply, apply } = show(proposalOf(SYNTHETIC_PEA, null));
    expect(apply()).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'properties-enums:energyCertificate.scope.building' }));
    fireEvent.click(apply());
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ scope: 'building' }));
  });
});

describe('Ο4 — 🔴 η ζωντανή δοκιμή (ADR-777 §8.96.5): ΠΕΑ κτηρίου σε στούντιο, κείμενο όπως το δίνει το pdf.js', () => {
  function liveCase(): PeaProposal {
    const read = readPeaText(peaPagesPdfjs({ ...SYNTHETIC_PEA, useful: '131.5' }));
    if (read.kind !== 'read') throw new Error('αναμενόταν ανάγνωση');
    return peaProposalOf(read.reading, { fileId: 'file_pea', current: UNDECLARED_ENERGY_CERTIFICATE, propertyArea: 35, today: '2026-10-14' });
  }

  it('η κλάση βγαίνει από τον λόγο — ΚΑΜΙΑ χειροκίνητη επιλογή κλάσης', () => {
    show(liveCase());
    expect(screen.queryByRole('radio', { name: 'properties-enums:energyClass.aPlus' })).not.toBeInTheDocument();
  });

  it('προεπιλεγμένο «Ολόκληρο το κτήριο» — και ΑΥΤΟ φεύγει στην εφαρμογή', () => {
    const { onApply, apply } = show(liveCase());
    expect(screen.getByRole('radio', { name: 'properties-enums:energyCertificate.scope.building' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'properties-enums:energyCertificate.scope.unit' })).not.toBeChecked();
    fireEvent.click(apply());
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ class: 'B+', scope: 'building', usefulArea: 131.5 }));
  });
});

describe('Ο3 — επαλήθευση γνησιότητας', () => {
  it('δείχνει τους δύο αριθμούς του εγγράφου και τον σύνδεσμο του μητρώου', () => {
    show(proposalOf(SYNTHETIC_PEA, 80));
    expect(screen.getByText('123456/2026')).toBeInTheDocument();
    expect(screen.getByText('AB12C-DE34F-GH56J-7')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `${R}.verifyLink` })).toHaveAttribute('href', 'https://www.buildingcert.gr/');
  });
});
