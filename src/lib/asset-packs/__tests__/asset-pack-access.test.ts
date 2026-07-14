/**
 * ADR-655 — Εξαντλητικά tests της απόφασης πρόσβασης.
 *
 * ΓΙΑΤΙ ΕΧΟΥΝ ΣΗΜΑΣΙΑ: το dev auth bypass (`auth-context.ts`) σημαίνει ότι το gating **ΔΕΝ
 * επαληθεύεται τρέχοντας την εφαρμογή τοπικά** — κάθε τοπικός χρήστης περνά. Αυτά τα tests είναι
 * η ΜΟΝΗ αυτόματη απόδειξη ότι η πύλη κλείνει. Κάθε deny path καλύπτεται ρητά.
 */

import {
  decideAssetPackAccess,
  assetPackDenyStatus,
  type AssetPackAccessInput,
} from '../asset-pack-access';

/** Βάση: entitled pack, εταιρεία που το έχει, χρήστης με δικαίωμα ⇒ allow. */
function input(overrides: Partial<AssetPackAccessInput> = {}): AssetPackAccessInput {
  return {
    packId: 'furniture-plan-2d',
    status: 'entitled',
    companyEntitlements: ['furniture-plan-2d'],
    hasUsePermission: true,
    isSuperAdmin: false,
    ...overrides,
  };
}

describe('decideAssetPackAccess', () => {
  it('επιτρέπει όταν εταιρεία + δικαίωμα υπάρχουν', () => {
    expect(decideAssetPackAccess(input())).toBe('allow');
  });

  it('απορρίπτει άγνωστο pack χωρίς να κοιτάξει τίποτε άλλο', () => {
    expect(decideAssetPackAccess(input({ status: null }))).toBe('deny:unknown-pack');
  });

  describe('ο διακόπτης πανικού (disabled)', () => {
    it('κόβει ακόμη και εταιρεία που το έχει αποκτήσει', () => {
      expect(decideAssetPackAccess(input({ status: 'disabled' }))).toBe('deny:disabled');
    });

    it('υπερισχύει του δικαιώματος χρήσης', () => {
      const decision = decideAssetPackAccess(
        input({ status: 'disabled', hasUsePermission: true }),
      );
      expect(decision).toBe('deny:disabled');
    });

    it('αφήνει τον super-admin να περάσει (curation)', () => {
      const decision = decideAssetPackAccess(
        input({ status: 'disabled', isSuperAdmin: true, companyEntitlements: [] }),
      );
      expect(decision).toBe('allow');
    });
  });

  describe('entitled', () => {
    it('απορρίπτει εταιρεία που ΔΕΝ το έχει αποκτήσει — ακόμη κι αν ο χρήστης έχει δικαίωμα', () => {
      const decision = decideAssetPackAccess(
        input({ companyEntitlements: [], hasUsePermission: true }),
      );
      expect(decision).toBe('deny:not-entitled');
    });

    it('απορρίπτει χρήστη χωρίς δικαίωμα — ακόμη κι αν η εταιρεία το έχει', () => {
      expect(decideAssetPackAccess(input({ hasUsePermission: false }))).toBe('deny:no-permission');
    });

    it('δεν μπερδεύει entitlement άλλου pack', () => {
      const decision = decideAssetPackAccess(input({ companyEntitlements: ['some-other-pack'] }));
      expect(decision).toBe('deny:not-entitled');
    });

    it('ο super-admin περνά χωρίς εταιρικό entitlement', () => {
      const decision = decideAssetPackAccess(
        input({ isSuperAdmin: true, companyEntitlements: [], hasUsePermission: false }),
      );
      expect(decision).toBe('allow');
    });
  });

  describe('public (δωρεάν περιεχόμενο)', () => {
    it('επιτρέπει χωρίς entitlement και χωρίς δικαίωμα χρήσης', () => {
      const decision = decideAssetPackAccess(
        input({ status: 'public', companyEntitlements: [], hasUsePermission: false }),
      );
      expect(decision).toBe('allow');
    });
  });
});

describe('assetPackDenyStatus', () => {
  it('άγνωστο pack → 404, κάθε άλλο deny → 403', () => {
    expect(assetPackDenyStatus('deny:unknown-pack')).toBe(404);
    expect(assetPackDenyStatus('deny:disabled')).toBe(403);
    expect(assetPackDenyStatus('deny:not-entitled')).toBe(403);
    expect(assetPackDenyStatus('deny:no-permission')).toBe(403);
  });
});
