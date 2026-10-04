/**
 * ADR-900 §3.8 — άγκυρα της κάρτας «Επαλήθευση ιδιοκτησίας».
 *
 * Κ1 χωρίς επαλήθευση ⇒ γιατί + πώς + κουμπί · Κ2 επαληθευμένος ⇒ κανένα κουμπί · Κ3 σε έλεγχο ⇒ λόγοι, κανένα
 * κουμπί (όχι διπλή υποβολή) · Κ4 ελλιπής ταυτότητα ⇒ διέξοδος προς το προφίλ · Κ5 κάθε κλειδί υπάρχει el+en ·
 * Κ6 αποδέσμευση (ADR-900 §8 #2 Β3): μόνο όταν επαληθευμένος· ανακλημένη ⇒ ο λόγος λέγεται + νέα υποβολή.
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import el from '@/i18n/locales/el/property-market.json';
import en from '@/i18n/locales/en/property-market.json';
import type { OwnershipVerificationApi } from '@/hooks/owner-property/useOwnershipVerification';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }),
}));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

let api: OwnershipVerificationApi;
jest.mock('@/hooks/owner-property/useOwnershipVerification', () => ({
  useOwnershipVerification: () => api,
}));

import { OwnershipVerificationPanel } from '../OwnershipVerificationPanel';
import {
  OWNERSHIP_KEYS,
  REASON_KEYS,
  REVOCATION_ADMIN_KEYS,
  REVOCATION_REASON_KEYS,
  REVOKE_ERROR_KEYS,
  STATUS_KEYS,
  SUBMIT_ERROR_KEYS,
} from '../ownership-verification-labels';

const DOSSIER = { id: 'pdos_a', userId: 'user-1', label: 'Διαμέρισμα' };
const idle = { state: 'idle' } as const;
const releaseIdle = { release: idle, releaseOwnership: jest.fn() };

function show(next: OwnershipVerificationApi) {
  api = next;
  render(<OwnershipVerificationPanel ownerPropertyId="ownp_a" dossier={DOSSIER} />);
}

const view = (
  status: 'verified' | 'pending-review' | 'revoked',
  reasons: ReadonlyArray<'issuer-unconfirmed'> = [],
  revocationReason: 'evidence-invalid' | null = null,
) => ({
  id: 'ovr_1', status, reasons, kaek: '050681726003/0/1', createdAt: '2026-10-02', decidedAt: null, revocationReason,
});

describe('Κ1–Κ3 — καταστάσεις', () => {
  it('Κ1 — χωρίς επαλήθευση: γιατί + πώς + κουμπί ανεβάσματος', () => {
    show({ status: { state: 'ready', verification: null }, submit: idle, submitCertificate: jest.fn(), ...releaseIdle });
    expect(screen.getByText(OWNERSHIP_KEYS.intro)).toBeInTheDocument();
    expect(screen.getByText(OWNERSHIP_KEYS.howTo)).toBeInTheDocument();
    expect(screen.getByText(OWNERSHIP_KEYS.upload)).toBeInTheDocument();
  });

  it('Κ2 — επαληθευμένος: τίτλος κατάστασης, κανένα κουμπί', () => {
    show({ status: { state: 'ready', verification: view('verified') }, submit: idle, submitCertificate: jest.fn(), ...releaseIdle });
    expect(screen.getByRole('status')).toHaveTextContent(STATUS_KEYS.verified.title);
    expect(screen.queryByText(OWNERSHIP_KEYS.upload)).not.toBeInTheDocument();
    expect(screen.queryByText(OWNERSHIP_KEYS.uploadAgain)).not.toBeInTheDocument();
  });

  it('Κ3 — σε έλεγχο: οι λόγοι λέγονται, και ΔΕΝ προσφέρεται δεύτερη υποβολή', () => {
    show({
      status: { state: 'ready', verification: view('pending-review', ['issuer-unconfirmed']) },
      submit: idle,
      submitCertificate: jest.fn(),
      ...releaseIdle,
    });
    expect(screen.getByText(REASON_KEYS['issuer-unconfirmed'])).toBeInTheDocument();
    expect(screen.queryByText(OWNERSHIP_KEYS.uploadAgain)).not.toBeInTheDocument();
  });
});

describe('Κ4 — διέξοδος', () => {
  it('ελλιπής ταυτότητα ⇒ σύνδεσμος προς το προφίλ', () => {
    show({
      status: { state: 'ready', verification: null },
      submit: { state: 'failed', code: 'identity-incomplete' },
      submitCertificate: jest.fn(),
      ...releaseIdle,
    });
    expect(screen.getByRole('alert')).toHaveTextContent(SUBMIT_ERROR_KEYS['identity-incomplete']);
    expect(screen.getByRole('link', { name: OWNERSHIP_KEYS.remedyProfile })).toHaveAttribute('href', '/profile');
  });
});

describe('Κ6 — αποδέσμευση (σχήμα Zillow «unclaim»)', () => {
  it('επαληθευμένος ⇒ κουμπί αποδέσμευσης · σε έλεγχο ⇒ κανένα', () => {
    show({ status: { state: 'ready', verification: view('verified') }, submit: idle, submitCertificate: jest.fn(), ...releaseIdle });
    expect(screen.getByRole('button', { name: OWNERSHIP_KEYS.release })).toBeInTheDocument();
  });

  it('σε έλεγχο ⇒ ΚΑΜΙΑ αποδέσμευση (δεν υπάρχει ενεργή απόδειξη)', () => {
    show({ status: { state: 'ready', verification: view('pending-review') }, submit: idle, submitCertificate: jest.fn(), ...releaseIdle });
    expect(screen.queryByRole('button', { name: OWNERSHIP_KEYS.release })).not.toBeInTheDocument();
  });

  it('ανακλημένη ⇒ ο λόγος λέγεται + προσφέρεται νέα υποβολή', () => {
    show({
      status: { state: 'ready', verification: view('revoked', [], 'evidence-invalid') },
      submit: idle,
      submitCertificate: jest.fn(),
      ...releaseIdle,
    });
    expect(screen.getByRole('status')).toHaveTextContent(STATUS_KEYS.revoked.title);
    expect(screen.getByText(OWNERSHIP_KEYS.revocationReasonLabel)).toBeInTheDocument();
    expect(screen.getByText(OWNERSHIP_KEYS.uploadAgain)).toBeInTheDocument();
  });

  it('αποτυχία ⇒ η άρνηση λέγεται', () => {
    show({
      status: { state: 'ready', verification: view('verified') },
      submit: idle,
      submitCertificate: jest.fn(),
      release: { state: 'failed', code: 'not-revocable' },
      releaseOwnership: jest.fn(),
    });
    expect(screen.getByRole('alert')).toHaveTextContent(REVOKE_ERROR_KEYS['not-revocable']);
  });
});

describe('Κ5 — κάθε κλειδί υπάρχει και στις δύο γλώσσες', () => {
  const keys = [
    ...Object.values(OWNERSHIP_KEYS),
    ...Object.values(STATUS_KEYS).flatMap((k) => [k.title, k.detail]),
    ...Object.values(REASON_KEYS),
    ...Object.values(SUBMIT_ERROR_KEYS),
    ...Object.values(REVOCATION_REASON_KEYS),
    ...Object.values(REVOKE_ERROR_KEYS),
    ...Object.values(REVOCATION_ADMIN_KEYS),
  ];
  const resolve = (bundle: unknown, key: string): unknown =>
    key.replace(/^property-market:/, '').split('.').reduce<unknown>(
      (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
      bundle,
    );

  it.each(keys)('%s', (key) => {
    expect(typeof resolve(el, key)).toBe('string');
    expect(typeof resolve(en, key)).toBe('string');
  });
});
