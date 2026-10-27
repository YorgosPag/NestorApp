/**
 * **Ο επανυπολογισμός δεν δηλώνει άρνηση πριν κριθεί η ταυτότητα** (ADR-923 §5.10.5 — ζωντανό σφάλμα της Φάσης 2ε).
 *
 * Ζωντανά: «…χρειάζεται επανυπολογισμός. Μπορεί να τον εκτελέσει όποιος διαχειρίζεται προϊόντα.» σε άνθρωπο που
 * **έχει** το δικαίωμα — το `canRun: boolean` είχε χάσει το `pending` (ίδια κλάση με το υποσέλιδο).
 */
import { render, screen } from '@testing-library/react';

import type { CapabilityGate } from '@/auth/hooks/useCapability';
import type { CatalogRecompute } from '@/hooks/catalog/useCatalogRecompute';
import { RecomputePanel } from '../RecomputePanel';

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
