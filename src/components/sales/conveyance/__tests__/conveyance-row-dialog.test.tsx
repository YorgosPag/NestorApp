/**
 * ⚓ ADR-915 §14 — ο διάλογος ελέγχου ζητά την ΤΥΠΩΜΕΝΗ λήξη μόνο εκεί όπου η διάρκεια εξαρτάται από το ίδιο το έγγραφο
 * (κανόνας `printed`), την προσυμπληρώνει από το αρχείο, και τη στέλνει στην εντολή.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { getChecklistItem } from '@/config/conveyance-checklist/catalog';
import type { ConveyanceCommand } from '@/lib/conveyance/conveyance-commands';
import type { ChecklistRow, EvidenceFile } from '@/types/conveyance-case';
import { ConveyanceRowDialog } from '../ConveyanceRowDialog';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

function rowOf(itemId: string, documentFacts: EvidenceFile['documentFacts'] = null): ChecklistRow {
  const item = getChecklistItem(itemId);
  if (item === undefined) throw new Error(itemId);
  const file: EvidenceFile = {
    source: { kind: 'owned' }, fileId: 'file_1', displayName: 'doc.pdf', entityType: 'contact', entityId: 'cont_s',
    purpose: 'tax-clearance', level: 'seller_contact', fingerprint: 'file_1:0:x', createdAt: 't', documentFacts,
  };
  return {
    itemId, item, section: item.section, provider: item.provider, status: 'uploaded', files: [file], sealed: null,
    review: null, notApplicable: null, notApplicableBy: null, pendingFact: null,
    expiresOn: null, expiryIsFloor: false, validOnSigning: null, issueFrom: null,
  };
}

function submitAccept(row: ChecklistRow): ConveyanceCommand {
  const onSubmit = jest.fn<void, [ConveyanceCommand]>();
  render(<ConveyanceRowDialog target={{ row, mode: 'accept' }} onClose={jest.fn()} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
  const [command] = onSubmit.mock.calls[0] ?? [];
  if (command === undefined) throw new Error('no command');
  return command;
}

describe('ConveyanceRowDialog — τυπωμένη λήξη (ADR-915 §14)', () => {
  it('φορολογική: δείχνει το πεδίο «Ισχύει έως» με τη γενική οδηγία', () => {
    render(<ConveyanceRowDialog target={{ row: rowOf('seller_tax_clearance'), mode: 'accept' }} onClose={jest.fn()} onSubmit={jest.fn()} />);
    expect(screen.getByText('dialogs.validUntilLabel')).toBeInTheDocument();
    expect(screen.getByText('dialogs.validUntilHint')).toBeInTheDocument();
  });

  it('ΠΕΑ (κανόνας από τη διάρκεια): ΚΑΝΕΝΑ πεδίο τυπωμένης λήξης — δεν το χρειάζεται', () => {
    render(<ConveyanceRowDialog target={{ row: rowOf('energy_certificate'), mode: 'accept' }} onClose={jest.fn()} onSubmit={jest.fn()} />);
    expect(screen.queryByText('dialogs.validUntilLabel')).not.toBeInTheDocument();
  });

  it('προσυμπλήρωση από το αρχείο ⇒ η εντολή μεταφέρει έκδοση ΚΑΙ τυπωμένη λήξη · το νόμιμο εύρος λέγεται', () => {
    const facts = {
      kind: 'tax-clearance', issuedOn: '2026-09-20', printedValidUntil: '2026-11-20', source: { kind: 'attested', via: 'conveyance-review' },
    } as const;
    const command = submitAccept(rowOf('seller_tax_clearance', facts));
    expect(command).toMatchObject({ type: 'review', verdict: 'accepted', issuedOn: '2026-09-20', validUntil: '2026-11-20' });
    expect(screen.getByText(/^dialogs\.validUntilRange /)).toBeInTheDocument();
  });

  it('κενό πεδίο ⇒ `validUntil: null` (ισχύει το κατώτατο), ποτέ επινοημένη ημερομηνία', () => {
    expect(submitAccept(rowOf('seller_tax_clearance'))).toMatchObject({ issuedOn: null, validUntil: null });
  });

  it('γραμμή χωρίς `printed` ⇒ `validUntil: null` στην εντολή', () => {
    expect(submitAccept(rowOf('energy_certificate'))).toMatchObject({ validUntil: null });
  });
});
