/**
 * 🔴 ΑΓΚΥΡΑ Ζ9 — **Η ΓΚΑΛΕΡΙ ΤΗΣ ΚΑΡΤΕΛΑΣ «ΠΑΡΑΔΟΣΗ» ΔΕΙΧΝΕΙ ΚΑΘΕ ΛΟΓΟ, ΜΕ ΤΑ ΔΙΚΑ ΤΟΥ ΛΟΓΙΑ** (ADR-916 §5.15 Φ-Δ).
 * @related components/property-handover-office/testing/* · πρότυπο `handover-protocol-verify-gallery.test.tsx`
 *
 * Ρωτά **μόνο** όσα δεν ρωτούν οι άλλες άγκυρες (η κρίση = Ζ1–Ζ7, η πόρτα = Ζ8):
 *   Α — κάθε πάνελ αποδίδει τον λόγο του σεναρίου του, με τίτλο **και** οδηγία (ποτέ ωμή κατάσταση);
 *   Β — η κάρτα Πρωτοκόλλου εμφανίζεται **μόνο** όπου σφραγίστηκε, με το αντίτυπο **εταιρείας** και παραπομπή στη Σ6·
 *       καμία λέξη «επαληθευμένο» πουθενά;
 *   Γ — η σειρά «κίνηση γραφείου πρώτα», η σημείωση σφραγίδας, και κανένα αίτημα δεν φεύγει από τη σελίδα.
 */

jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }) }));
jest.mock('@/lib/intl-formatting', () => ({
  formatDate: (iso: string) => `date(${iso})`,
  formatDateTime: (iso: string) => `abs(${iso})`,
}));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
jest.mock('@/components/shared/files/hooks/useFileDownload', () => ({ useFileDownload: () => ({ handleDownload: jest.fn() }) }));

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import el from '@/i18n/locales/el/properties-detail.json';
import en from '@/i18n/locales/en/properties-detail.json';
import { apiClient } from '@/lib/api/enterprise-api-client';
import {
  HANDOVER_OFFICE_MOVES,
  HANDOVER_OFFICE_REASONS,
  HANDOVER_OFFICE_SIGNALS,
  HANDOVER_OFFICE_STEP_STATES,
  HANDOVER_OFFICE_STEPS,
} from '@/types/property-handover';

import { HANDOVER_OFFICE_SCENARIOS } from '../testing/handover-office-scenarios';
import { PANEL_COUNT, PropertyHandoverOfficeHarness } from '../testing/PropertyHandoverOfficeHarness';

const K = 'properties-detail:handover';
const panel = (id: string) => screen.getByTestId(`harness-panel-${id}`);

beforeEach(() => render(<PropertyHandoverOfficeHarness />));

describe('Ζ9 Α — ένα πάνελ ανά λόγο, με τα δικά του λόγια', () => {
  it.each(HANDOVER_OFFICE_SCENARIOS.map((s) => [s.id, s.expected.reason] as const))('%s ⇒ %s', (id, reason) => {
    const scoped = within(panel(id));
    expect(panel(id).querySelector('[data-reason]')).toHaveAttribute('data-reason', reason);
    expect(scoped.getByText(`${K}.reason.${reason}.title`)).toBeInTheDocument();
    expect(scoped.getByText(`${K}.reason.${reason}.hint`)).toBeInTheDocument();
  });

  it('τα πάνελ είναι όσα δηλώνει η γκαλερί', () => {
    expect(screen.getAllByTestId(/^harness-panel-/)).toHaveLength(PANEL_COUNT);
  });

  it('το σήμα «λήγει σύντομα» και τα αρχεία που περιμένουν απόφαση φαίνονται στα πάνελ τους', () => {
    expect(panel('awaiting-buyer-expiring').querySelector('[data-signal="invitation-expiring"]')).not.toBeNull();
    expect(panel('files-awaiting-review').querySelector('[data-signal="files-awaiting-review"]')).not.toBeNull();
  });
});

describe('Ζ9 Β — Πρωτόκολλο: μόνο όπου σφραγίστηκε, αντίτυπο εταιρείας, ποτέ «επαληθευμένο»', () => {
  it('η κάρτα Πρωτοκόλλου και η παραπομπή επαλήθευσης ζουν ΜΟΝΟ στο σφραγισμένο πάνελ', () => {
    const withVerifyLink = HANDOVER_OFFICE_SCENARIOS.filter((s) => within(panel(s.id)).queryByText(`${K}.verify`) !== null).map((s) => s.id);
    expect(withVerifyLink).toEqual(['sealed']);
    expect(within(panel('sealed')).getByText(`${K}.verify`).closest('a')).toHaveAttribute('href', expect.stringMatching(/\/verify\/phpr_/));
  });

  it('καμία λέξη «verified» / «επαληθευμένο» σε όλη τη γκαλερί', () => {
    expect(document.body.textContent ?? '').not.toMatch(/verified|επαληθευμ/i);
  });
});

describe('Ζ9 Δ — κάθε λέξη του λεξιλογίου έχει κείμενο ΚΑΙ στις δύο γλώσσες (τα δυναμικά κλειδιά δεν τα βλέπει το CHECK 3.8)', () => {
  const vocabularyKeys = [
    ...HANDOVER_OFFICE_REASONS.flatMap((reason) => [`reason.${reason}.title`, `reason.${reason}.hint`]),
    ...HANDOVER_OFFICE_MOVES.flatMap((move) => [`move.${move}`, `summary.${move}`]),
    ...HANDOVER_OFFICE_SIGNALS.map((signal) => `signal.${signal}`),
    ...HANDOVER_OFFICE_STEPS.map((step) => `step.${step}`),
    ...HANDOVER_OFFICE_STEP_STATES.map((state) => `stepState.${state}`),
  ];
  const lookup = (bundle: unknown, path: string): unknown =>
    path.split('.').reduce<unknown>((node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined), bundle);

  it.each([['el', el], ['en', en]] as const)('%s', (_, bundle) => {
    const missing = vocabularyKeys.filter((key) => typeof lookup(bundle, `handover.${key}`) !== 'string');
    expect(missing).toEqual([]);
  });
});

describe('Ζ9 Γ — ολόκληρη η καρτέλα', () => {
  it('«κίνηση γραφείου» πρώτα · η σημείωση σφραγίδας όταν λείπει ο πάροχος', () => {
    const whole = panel('whole-tab-mixed');
    const reasons = [...whole.querySelectorAll('[data-reason]')].map((node) => node.getAttribute('data-reason'));
    expect(reasons[0]).toBe('declined');
    expect(reasons.slice(-2).sort()).toEqual(['cancelled', 'sealed']);
    expect(within(whole).getByText(`${K}.sealNotConfigured`)).toBeInTheDocument();
    expect(whole.querySelector('details[data-group="review"]')).toHaveAttribute('open');
  });

  it('χωρίς παραδόσεις ⇒ ο λόγος που λείπουν, όχι κενό', () => {
    expect(within(panel('whole-tab-empty')).getByText(`${K}.empty`)).toBeInTheDocument();
    expect(within(panel('whole-tab-empty')).queryByText(`${K}.sealNotConfigured`)).toBeNull();
  });

  it('κανένα αίτημα δεν φεύγει από τη σελίδα', () => {
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
