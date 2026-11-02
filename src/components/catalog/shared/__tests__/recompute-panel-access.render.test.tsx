/**
 * **Ο επανυπολογισμός δεν δηλώνει άρνηση πριν κριθεί η ταυτότητα** (ADR-923 §5.10.5 — ζωντανό σφάλμα της Φάσης 2ε).
 *
 * Ζωντανά: «…χρειάζεται επανυπολογισμός. Μπορεί να τον εκτελέσει όποιος διαχειρίζεται προϊόντα.» σε άνθρωπο που
 * **έχει** το δικαίωμα — το `canRun: boolean` είχε χάσει το `pending` (ίδια κλάση με το υποσέλιδο).
 */
import { fireEvent, render, screen } from '@testing-library/react';

import type { CapabilityGate } from '@/auth/hooks/useCapability';
import type { CatalogRecompute } from '@/hooks/catalog/useCatalogRecompute';
import { RecomputePanel, SearchIndexRecompute, maintenanceRecomputeNeeded } from '../RecomputePanel';

let gate: Partial<CapabilityGate> = { pending: true, verdict: 'denied-unauthenticated' };
const asked: string[] = [];

jest.mock('@/auth/hooks/useCapability', () => ({
  useCapability: (action: string) => { asked.push(action); return { action, reason: null, ...gate }; },
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

const recompute = { state: { kind: 'idle' }, needed: true, run: jest.fn() } as unknown as CatalogRecompute;
const panel = () => render(<RecomputePanel recompute={recompute} familyId={null} prompt="stale" needed />);

describe('maintenanceRecomputeNeeded — η μόνιμη ενέργεια των ρυθμίσεων (ADR-923 §5.12)', () => {
  it('🔴 διαθέσιμη χωρίς καμία αλλαγή: νέο παράγωγο δεν αλλάζει το αποτύπωμα πληρότητας', () => {
    expect(maintenanceRecomputeNeeded({ state: { kind: 'idle' }, needed: false })).toBe(true);
  });

  it('μετά την ολοκλήρωση σβήνει, εκτός αν ήρθε νεότερη αλλαγή', () => {
    const done = { kind: 'done', processed: 3, rejected: 0 } as const;
    expect(maintenanceRecomputeNeeded({ state: done, needed: false })).toBe(false);
    expect(maintenanceRecomputeNeeded({ state: done, needed: true })).toBe(true);
  });
});

describe('SearchIndexRecompute — η πρόταση μετά από αλλαγή σχήματος (ADR-923 §5.12)', () => {
  const job = (over: Partial<CatalogRecompute>): CatalogRecompute =>
    ({ state: { kind: 'idle' }, needed: false, invalidate: jest.fn(), run: jest.fn(), ...over });

  it('🔴 χωρίς αλλαγή δεν εμφανίζεται τίποτα', () => {
    const { container } = render(<SearchIndexRecompute recompute={job({})} familyId={null} />);
    expect(container.textContent).toBe('');
  });

  it('🔴 μετά την αλλαγή προτείνει επανυπολογισμό της ίδιας οικογένειας', () => {
    gate = { pending: false, verdict: 'granted-by-role' };
    const run = jest.fn();
    render(<SearchIndexRecompute recompute={job({ needed: true, run })} familyId="cfam_1" />);
    expect(screen.getByRole('status').textContent).toBe('recompute.searchIndexPrompt');
    fireEvent.click(screen.getByRole('button', { name: 'recompute.run' }));
    expect(run).toHaveBeenCalledWith('cfam_1');
  });

  it('το αποτέλεσμα μένει ορατό όταν τελειώσει', () => {
    render(<SearchIndexRecompute recompute={job({ state: { kind: 'done', processed: 2, rejected: 0 } })} familyId={null} />);
    expect(screen.getByRole('status').textContent).toBe('recompute.done');
  });
});

describe('RecomputePanel — δικαιοδοσία', () => {
  it('🔴 εκκρεμεί η ταυτότητα ⇒ η πρόταση ΧΩΡΙΣ «χρειάζεται δικαίωμα», χωρίς κουμπί', () => {
    gate = { pending: true, verdict: 'denied-unauthenticated' };
    panel();
    expect(screen.getByRole('status').textContent).toBe('stale');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('άρνηση ⇒ λέει ποιος μπορεί · χορήγηση ⇒ κουμπί — και ρωτά την ικανότητα των ΠΡΟΪΟΝΤΩΝ', () => {
    gate = { pending: false, verdict: 'denied-insufficient' };
    const { unmount } = panel();
    expect(screen.getByRole('status').textContent).toContain('recompute.needsPermission');
    unmount();
    gate = { pending: false, verdict: 'granted-by-role' };
    panel();
    expect(screen.getByRole('button', { name: 'recompute.run' })).toBeTruthy();
    expect(asked.every((action) => action === 'catalog:products:manage')).toBe(true);
  });
});
