/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ ADR-895 §2.3 Ρ4** — η σάρωση προθέματος διαγραφής απαριθμεί τον
 * **κατάλογο** κάδων πρωτοτύπων (`originalStorageBuckets`), ΟΧΙ «τον κάδο».
 *
 * | Άγκυρα | Υπόσχεση |
 * |---|---|
 * | 🔴 δύο προβλεπόμενοι κάδοι | το πρόθεμα σαρώνεται και στους ΔΥΟ, το άθροισμα είναι ΚΑΙ των δύο |
 * | 🔴 μη-προβλεπόμενος κάδος ΕΕ | παραλείπεται με σημείωση — η σάρωση ΔΕΝ σκάει (Ρ4) |
 * | 🔑 παρονομαστής | ένας μόνο κάδος (Φ0 σήμερα) — ίδια συμπεριφορά με πριν |
 */

import type { StorageCleanupDef } from '@/config/deletion-registry';

interface FakeBucketObject {
  readonly exists: boolean;
  readonly files: string[];
}

/** Πλαστός κάδος: μιμείται μόνο `.exists()` / `.getFiles({prefix})` / `.deleteFiles({prefix})`. */
function fakeBucket(state: FakeBucketObject) {
  return {
    exists: async () => [state.exists] as const,
    getFiles: async ({ prefix }: { readonly prefix: string }) => [
      state.files.filter((f) => f.startsWith(prefix)).map((name) => ({ name })),
    ],
    deleteFiles: async ({ prefix }: { readonly prefix: string }) => {
      state.files = state.files.filter((f) => !f.startsWith(prefix));
    },
  };
}

let legacy: FakeBucketObject;
let eu: FakeBucketObject;

// Ο ΠΡΑΓΜΑΤΙΚΟΣ επιλογέας/κατάλογος (ADR-895 SSoT) — πλαστοί μόνο οι δύο accessors κάδων.
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminBucket: () => fakeBucket(legacy),
  getFilesEuBucket: () => fakeBucket(eu),
}));

import { executeStorageCleanup } from '../deletion-storage-cleanup';

const DEF: StorageCleanupDef = { pathTemplate: 'companies/{companyId}/entities/{entityId}/', label: 'Έγγραφα οντότητας' };

beforeEach(() => {
  legacy = { exists: true, files: ['companies/c1/entities/e1/a.pdf', 'companies/c1/entities/e1/b.pdf'] };
  eu = { exists: true, files: ['companies/c1/entities/e1/c.pdf'] };
});

describe('🏆 ADR-895 §2.3 Ρ4 — σάρωση σε ΟΛΟΝ τον κατάλογο κάδων', () => {
  it('🔴 δύο προβλεπόμενοι κάδοι ⇒ σαρώνονται ΚΑΙ οι δύο, το άθροισμα είναι και των δύο', async () => {
    const result = await executeStorageCleanup([DEF], 'e1', 'c1');

    expect(result.totalDeleted).toBe(3);
    expect(result.details).toHaveLength(2);
    const byPlacement = Object.fromEntries(result.details.map((d) => [d.placement, d.filesDeleted]));
    expect(byPlacement).toEqual({ 'legacy-default': 2, 'eu-originals': 1 });
    expect(legacy.files).toEqual([]);
    expect(eu.files).toEqual([]);
  });

  it('🔴 κάδος ΕΕ μη-προβλεπόμενος ⇒ παραλείπεται, η σάρωση ΔΕΝ σκάει (μόνο ο legacy σαρώνεται)', async () => {
    eu.exists = false;

    const result = await executeStorageCleanup([DEF], 'e1', 'c1');

    expect(result.totalDeleted).toBe(2);
    expect(result.details).toHaveLength(1);
    expect(result.details[0]?.placement).toBe('legacy-default');
  });

  it('🔑 παρονομαστής: και οι δύο κάδοι άδειοι ⇒ μηδέν, καμία εξαίρεση', async () => {
    legacy.files = [];
    eu.files = [];

    const result = await executeStorageCleanup([DEF], 'e1', 'c1');

    expect(result.totalDeleted).toBe(0);
    expect(result.details.every((d) => d.filesDeleted === 0)).toBe(true);
  });
});
