/**
 * ⚓ ADR-915 §14 — ο διάλογος ελέγχου ζητά την ΤΥΠΩΜΕΝΗ λήξη μόνο εκεί όπου η διάρκεια εξαρτάται από το ίδιο το έγγραφο
 * (κανόνας `printed`), την προσυμπληρώνει από το αρχείο, και τη στέλνει στην εντολή.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { getChecklistItem } from '@/config/conveyance-checklist/catalog';
import type { ConveyanceCommand } from '@/lib/conveyance/conveyance-commands';
import type { ChecklistRow, EvidenceFile } from '@/types/conveyance-case';
import { ConveyanceRowDialog } from '../ConveyanceRowDialog';

const mockReadCaseDocumentText = jest.fn();
jest.mock('@/services/conveyance/conveyance-case-gateway', () => ({
  readCaseDocumentTextRequest: (...args: unknown[]) => mockReadCaseDocumentText(...args),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

function rowOf(
  itemId: string,
  documentFacts: EvidenceFile['documentFacts'] = null,
  source: EvidenceFile['source'] = { kind: 'owned' },
): ChecklistRow {
  const item = getChecklistItem(itemId);
  if (item === undefined) throw new Error(itemId);
  const file: EvidenceFile = {
    source, fileId: 'file_1', displayName: 'doc.pdf', entityType: 'contact', entityId: 'cont_s',
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
  render(<ConveyanceRowDialog caseId="cvc_1" target={{ row, mode: 'accept' }} onClose={jest.fn()} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
  const [command] = onSubmit.mock.calls[0] ?? [];
  if (command === undefined) throw new Error('no command');
  return command;
}

describe('ConveyanceRowDialog — τυπωμένη λήξη (ADR-915 §14)', () => {
  it('φορολογική: δείχνει το πεδίο «Ισχύει έως» με τη γενική οδηγία', () => {
    render(<ConveyanceRowDialog caseId="cvc_1" target={{ row: rowOf('seller_tax_clearance'), mode: 'accept' }} onClose={jest.fn()} onSubmit={jest.fn()} />);
    expect(screen.getByText('dialogs.validUntilLabel')).toBeInTheDocument();
    expect(screen.getByText('dialogs.validUntilHint')).toBeInTheDocument();
  });

  it('ΠΕΑ (κανόνας από τη διάρκεια): ΚΑΝΕΝΑ πεδίο τυπωμένης λήξης — δεν το χρειάζεται', () => {
    render(<ConveyanceRowDialog caseId="cvc_1" target={{ row: rowOf('energy_certificate'), mode: 'accept' }} onClose={jest.fn()} onSubmit={jest.fn()} />);
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

// ⚓ ADR-915 §20 — «Ανάγνωση από το έγγραφο»: το δίχτυ της ανάγνωσης στο ανέβασμα, με την έκβαση ΜΕ ΟΝΟΜΑ.
describe('ConveyanceRowDialog — ανάγνωση από το έγγραφο (ADR-915 §20)', () => {
  const ACTION = { name: /dialogs\.documentText\.action/ };
  const READ = {
    kind: 'tax-clearance', issuedOn: '2026-07-22', printedValidUntil: '2026-08-22',
    source: { kind: 'document-text', reader: 'aade-tax-clearance-text' },
  } as const;

  beforeEach(() => mockReadCaseDocumentText.mockReset());

  async function clickRead(): Promise<void> {
    await act(async () => { fireEvent.click(screen.getByRole('button', ACTION)); });
  }

  it('διαβάστηκε ⇒ ζητά ΤΟ αρχείο που βλέπει ο άνθρωπος, κλειδώνει τα πεδία, η εντολή φέρει ό,τι διαβάστηκε', async () => {
    mockReadCaseDocumentText.mockResolvedValue({ result: { kind: 'recorded', verdict: 'write', facts: READ } });
    const onSubmit = jest.fn<void, [ConveyanceCommand]>();
    render(<ConveyanceRowDialog caseId="cvc_1" target={{ row: rowOf('seller_tax_clearance'), mode: 'accept' }} onClose={jest.fn()} onSubmit={onSubmit} />);
    await clickRead();
    expect(mockReadCaseDocumentText).toHaveBeenCalledWith('cvc_1', 'seller_tax_clearance', 'file_1');
    expect(screen.getByText('dialogs.issuedOnFromDocument')).toBeInTheDocument();
    expect(screen.queryByRole('button', ACTION)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ issuedOn: '2026-07-22', validUntil: '2026-08-22' });
  });

  it('άλλο έγγραφο ⇒ το λέει ΜΕ ΤΟ ΟΝΟΜΑ του, και τίποτα δεν προσυμπληρώνεται', async () => {
    mockReadCaseDocumentText.mockResolvedValue({ result: { kind: 'kind-mismatch', found: 'enfia-certificate' } });
    render(<ConveyanceRowDialog caseId="cvc_1" target={{ row: rowOf('seller_tax_clearance'), mode: 'accept' }} onClose={jest.fn()} onSubmit={jest.fn()} />);
    await clickRead();
    expect(screen.getByRole('status')).toHaveTextContent('dialogs.documentText.kindMismatch');
    expect(screen.getByRole('status')).toHaveTextContent('conveyance:items.seller_enfia_certificate.label');
    expect(screen.getByText('dialogs.issuedOnHint')).toBeInTheDocument();
  });

  it('νεότερη έκδοση στο μεταξύ ⇒ «stale», όχι γενικό «απέτυχε»', async () => {
    mockReadCaseDocumentText.mockResolvedValue({ result: { kind: 'refused', reason: 'stale' } });
    render(<ConveyanceRowDialog caseId="cvc_1" target={{ row: rowOf('seller_tax_clearance'), mode: 'accept' }} onClose={jest.fn()} onSubmit={jest.fn()} />);
    await clickRead();
    expect(screen.getByRole('status')).toHaveTextContent('dialogs.documentText.stale');
  });

  it('βλάβη δικτύου ⇒ «ξαναδοκίμασε», και το κουμπί μένει', async () => {
    mockReadCaseDocumentText.mockRejectedValue(new Error('network'));
    render(<ConveyanceRowDialog caseId="cvc_1" target={{ row: rowOf('seller_tax_clearance'), mode: 'accept' }} onClose={jest.fn()} onSubmit={jest.fn()} />);
    await clickRead();
    expect(screen.getByRole('status')).toHaveTextContent('dialogs.documentText.failed');
    expect(screen.getByRole('button', ACTION)).toBeEnabled();
  });

  it('ήδη διαβασμένο από το έγγραφο · αρχείο επαγγελματία ⇒ ΚΑΝΕΝΑ κουμπί', () => {
    const { unmount } = render(<ConveyanceRowDialog caseId="cvc_1" target={{ row: rowOf('seller_tax_clearance', READ), mode: 'accept' }} onClose={jest.fn()} onSubmit={jest.fn()} />);
    expect(screen.queryByRole('button', ACTION)).not.toBeInTheDocument();
    unmount();
    const contributed: EvidenceFile['source'] = {
      kind: 'transmittal', contributionId: 'ctb_1', authorRole: 'seller_lawyer', onBehalf: false, own: false,
    };
    render(<ConveyanceRowDialog caseId="cvc_1" target={{ row: rowOf('seller_tax_clearance', null, contributed), mode: 'accept' }} onClose={jest.fn()} onSubmit={jest.fn()} />);
    expect(screen.queryByRole('button', ACTION)).not.toBeInTheDocument();
  });
});
