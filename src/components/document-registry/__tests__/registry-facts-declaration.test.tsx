/**
 * @fileoverview ADR-915 §33 — **«Συμπλήρωση στοιχείων»** στη σελίδα «Λήξεις εγγράφων», όπως τη βλέπει ο άνθρωπος: η
 *   γραμμή λέει «χωρίς στοιχεία» · το κουμπί · η πρόταση κατηγορίας από τον τύπο ακινήτου · η ζωντανή άρνηση του
 *   κριτή · η άρνηση του διακομιστή με τον λόγο της · χωρίς δικαίωμα / με βαρύτερη μαρτυρία ⇒ κανένα κουμπί.
 *
 * 🔴 **Διαβάζει ΑΠΟΔΟΣΗ**: αληθινά `DocumentRegistryContent` · ο πυρήνας · ο κριτής · το hook · η φόρμα (μέσα από το
 *    `next/dynamic`). Ψεύτικα μόνο το δίκτυο (`saveFactsDeclaration`), το δικαίωμα και τα μηνύματα. Το `t` επιστρέφει το
 *    κλειδί (+ παραμέτρους).
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DocumentRegistryContent } from '../DocumentRegistryContent';
import {
  CLASSIFICATION_LABEL_KEYS,
  FACTS_DECLARATION_ERROR_KEYS,
  FACTS_DECLARATION_KEYS,
  REGISTRY_KEYS,
} from '../document-registry-labels';
import type { RegistryDocument } from '@/lib/document-validity/document-registry';
import { fixtureResponse } from '@/lib/document-validity/__tests__/registry-fixture';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import type { ObligorDesignationSave } from '@/services/document-registry/document-registry.client';

const revalidate = jest.fn(async () => undefined);
let registry: DocumentRegistryResponse;
jest.mock('@/hooks/document-registry/useDocumentRegistry', () => ({
  useDocumentRegistry: () => ({ view: { state: 'ready', registry }, reload: jest.fn(), revalidate }),
}));

const save = jest.fn(async (..._args: unknown[]): Promise<ObligorDesignationSave> => ({ kind: 'saved' }));
jest.mock('@/services/document-registry/document-registry.client', () => ({
  saveFactsDeclaration: (...args: unknown[]) => save(...args),
}));

let verdict = 'granted-by-role';
jest.mock('@/auth/hooks/useCapability', () => ({ useCapability: () => ({ verdict }) }));

const notifySuccess = jest.fn();
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ error: jest.fn(), success: notifySuccess }) }));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

const PATH = 'companies/comp_alfa/yde-a1.pdf';

/** ΥΔΕ στο p1 (κατοικία στο fixture) — χωρίς στοιχεία, ή με όσα δίνονται. */
function yde(extra: Partial<RegistryDocument> = {}): RegistryDocument {
  return {
    id: 'file:f-yde', kind: 'electrical-installation', propertyId: 'p1', party: null, origin: { kind: 'file', fileId: 'f-yde' },
    issuedOn: null, printedValidUntil: null, classification: null, source: null, pinned: false, ...extra,
  };
}

function withYde(document: RegistryDocument, storagePath: string | null = PATH): DocumentRegistryResponse {
  return fixtureResponse({ files: { 'f-yde': { name: 'ΥΔΕ Α1.pdf', storagePath } } }, [document], []);
}

const row = () => screen.getByRole('article');
const declareButton = () => within(row()).queryByRole('button', { name: FACTS_DECLARATION_KEYS.declare });

beforeEach(() => {
  verdict = 'granted-by-role';
  save.mockReset().mockResolvedValue({ kind: 'saved' });
  revalidate.mockClear();
  notifySuccess.mockClear();
});

describe('η γραμμή ΧΩΡΙΣ στοιχεία', () => {
  it('λέει «χωρίς στοιχεία» (όχι απλώς «άγνωστη λήξη») και προσφέρει «Συμπλήρωση στοιχείων»', () => {
    registry = withYde(yde());
    render(<DocumentRegistryContent />);
    expect(within(row()).getByText(REGISTRY_KEYS.undeclared)).toBeTruthy();
    expect(declareButton()).toBeTruthy();
  });

  it('⛔ χωρίς δικαίωμα ⇒ κανένα κουμπί (ο διακομιστής κρίνει ξανά)', () => {
    verdict = 'denied';
    registry = withYde(yde());
    render(<DocumentRegistryContent />);
    expect(declareButton()).toBeNull();
  });

  it('⛔ στοιχεία από έγκριση ελεγκτή μεταβίβασης ⇒ κανένα κουμπί, ούτε «Διόρθωση»', () => {
    registry = withYde(yde({ issuedOn: '2022-03-01', source: { kind: 'attested', via: 'conveyance-review' } }));
    render(<DocumentRegistryContent />);
    expect(within(row()).queryByRole('button', { name: /factsDeclaration/ })).toBeNull();
  });

  it('⛔ χωρίς αντικείμενο (CAS) ⇒ κανένα κουμπί — καμία δήλωση «στα τυφλά»', () => {
    registry = withYde(yde(), null);
    render(<DocumentRegistryContent />);
    expect(declareButton()).toBeNull();
  });
});

describe('ο διάλογος', () => {
  async function open(document: RegistryDocument, name: string = FACTS_DECLARATION_KEYS.declare) {
    registry = withYde(document);
    render(<DocumentRegistryContent />);
    await userEvent.click(within(row()).getByRole('button', { name }));
    return screen.findByRole('dialog');
  }

  it('κατοικία ⇒ προεπιλογή «Α», ΛΕΓΕΤΑΙ ως πρόταση· η κατηγορία είναι radio με «Δεν τη γράφει»', async () => {
    const dialog = await open(yde());
    expect(within(dialog).getByRole('radio', { name: CLASSIFICATION_LABEL_KEYS.A }).getAttribute('aria-checked')).toBe('true');
    expect(within(dialog).getByRole('radio', { name: FACTS_DECLARATION_KEYS.classificationUnknown })).toBeTruthy();
    expect(within(dialog).getByText(FACTS_DECLARATION_KEYS.classificationSuggested)).toBeTruthy();
  });

  it('χωρίς ημερομηνία ⇒ η αποθήκευση είναι ανενεργή, χωρίς μήνυμα λάθους (δεν έγραψε ακόμη τίποτα)', async () => {
    const dialog = await open(yde());
    expect(within(dialog).getByRole('button', { name: FACTS_DECLARATION_KEYS.save }).hasAttribute('disabled')).toBe(true);
    expect(within(dialog).queryByRole('note')).toBeNull();
  });

  it('⛔ ζωντανός κριτής: λήξη πριν από έκδοση ⇒ ο λόγος λέγεται ΠΡΙΝ την αποστολή, αποθήκευση ανενεργή', async () => {
    const declared = yde({ issuedOn: '2022-03-01', printedValidUntil: '2021-01-01', classification: 'A', source: { kind: 'attested', via: 'registry-declaration' } });
    const dialog = await open(declared, FACTS_DECLARATION_KEYS.correct);
    expect(within(dialog).getByText(FACTS_DECLARATION_ERROR_KEYS['validity-before-issue'])).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: FACTS_DECLARATION_KEYS.save }).hasAttribute('disabled')).toBe(true);
  });

  it('«Διόρθωση»: αποθήκευση στέλνει ΑΚΡΙΒΩΣ ό,τι φαίνεται + το αντικείμενο· μετά το μητρώο ξαναδιαβάζεται', async () => {
    const declared = yde({ issuedOn: '2022-03-01', printedValidUntil: '2032-03-01', classification: 'A', source: { kind: 'attested', via: 'registry-declaration' } });
    const dialog = await open(declared, FACTS_DECLARATION_KEYS.correct);
    await userEvent.click(within(dialog).getByRole('radio', { name: CLASSIFICATION_LABEL_KEYS.B }));
    await userEvent.click(within(dialog).getByRole('button', { name: FACTS_DECLARATION_KEYS.save }));
    await waitFor(() => expect(revalidate).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith({
      kind: 'electrical-installation', issuedOn: '2022-03-01', printedValidUntil: '2032-03-01', classification: 'B',
      fileId: 'f-yde', storagePath: PATH,
    });
    expect(notifySuccess).toHaveBeenCalledWith(FACTS_DECLARATION_KEYS.saved);
  });

  it('⛔ άρνηση του διακομιστή ⇒ ο διάλογος ΜΕΝΕΙ και λέει ΓΙΑΤΙ (κωδικός → λόγος), κανένα ξαναδιάβασμα', async () => {
    save.mockResolvedValue({ kind: 'failed', code: 'OUTRANKED' });
    const declared = yde({ issuedOn: '2022-03-01', printedValidUntil: '2032-03-01', classification: 'A', source: { kind: 'attested', via: 'registry-declaration' } });
    const dialog = await open(declared, FACTS_DECLARATION_KEYS.correct);
    await userEvent.click(within(dialog).getByRole('button', { name: FACTS_DECLARATION_KEYS.save }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe(FACTS_DECLARATION_ERROR_KEYS.outranked);
    expect(revalidate).not.toHaveBeenCalled();
  });
});
