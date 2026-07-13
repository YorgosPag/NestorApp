/**
 * ADR-652 M3 — Η ΕΤΟΙΜΗ βιβλιοθήκη + το φίλτρο + τα δικαιώματα των καρτών.
 *
 * Τι κατοχυρώνει (τα σημεία που, αν σπάσουν, χαλάει είτε ο ΝΟΜΟΣ είτε η τοποθέτηση):
 *  - Το seed **παράγεται** από τον κατάλογο συμβόλων του ADR-415 (δεν συντηρείται δεύτερη λίστα).
 *  - Το seeded περιεχόμενο είναι ΟΛΟ `redistributable` — αλλιώς δεν θα επιτρεπόταν σε `system` scope.
 *  - Η παραγόμενη γεωμετρία είναι BLOCK-LOCAL (κεντραρισμένη στο origin) και με τις σωστές διαστάσεις.
 *  - Το system geometry path ΔΕΝ είναι company-scoped (αλλιώς το system block δεν κατεβαίνει ποτέ).
 *  - Το gate & τα δικαιώματα καρτών (delete/promote) — pure κανόνες, χωρίς Firestore.
 */

import { BLOCK_LIBRARY_ERRORS } from '../block-library-types';
import { assertBlockScopeAllowed, canPromoteToSharedScope } from '../block-scope-guard';
import { buildSystemBlockMembers } from '../system-block-geometry';
import { computeBlockLocalBoundsMm } from '../block-local-bounds';
import {
  SYSTEM_BLOCKS_SEED,
  SYSTEM_BLOCK_LICENSE,
} from '../../data/system-blocks-seed';
import { FLOORPLAN_SYMBOL_CATALOG } from '../../floorplan-symbols/floorplan-symbol-catalog';
import { buildBlockLibraryGeometryPath } from '@/services/upload/utils/storage-path';
import {
  canDeleteBlockEntry,
  canPromoteBlockEntry,
  mergeBlockPaletteEntries,
  type BlockPaletteEntry,
} from '../block-palette-entries';
import {
  EMPTY_LIBRARY_FILTER,
  LIBRARY_FILTER_ALL,
  matchesLibraryFilter,
} from '../../../ui/panels/shared/library-filter';
import type { BlockLibraryItem } from '../block-library-types';

// ---------------------------------------------------------------------------
// Ο κατάλογος: παράγεται, δεν αντιγράφεται
// ---------------------------------------------------------------------------

describe('SYSTEM_BLOCKS_SEED', () => {
  it('καλύπτει ΟΛΟΝ τον κατάλογο συμβόλων του ADR-415 (μία πηγή περιεχομένου)', () => {
    expect(SYSTEM_BLOCKS_SEED).toHaveLength(FLOORPLAN_SYMBOL_CATALOG.length);
  });

  it('έχει μοναδικά ντετερμινιστικά ids + ονόματα (idempotent seed)', () => {
    const ids = SYSTEM_BLOCKS_SEED.map((s) => s.id);
    const names = SYSTEM_BLOCKS_SEED.map((s) => s.name);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    expect(ids.every((id) => id.startsWith('blklib_sys_'))).toBe(true);
  });

  it('⚖️ ΟΛΟ το seeded περιεχόμενο επιτρέπεται να αναδιανεμηθεί (προϋπόθεση του system scope)', () => {
    expect(SYSTEM_BLOCK_LICENSE.redistributable).toBe(true);
    expect(canPromoteToSharedScope(SYSTEM_BLOCK_LICENSE)).toBe(true);
    // Το περιεχόμενο είναι δικής μας παραμετρικής συγγραφής (ADR-415 Δ1).
    expect(FLOORPLAN_SYMBOL_CATALOG.every((p) => p.source === 'parametric (own)')).toBe(true);
  });

  it('κάθε block έχει i18n ετικέτα (μηδέν νέα strings για τα ονόματα)', () => {
    expect(SYSTEM_BLOCKS_SEED.every((s) => s.labelKey.length > 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Η γεωμετρία: BLOCK-LOCAL, από τον drawer SSoT
// ---------------------------------------------------------------------------

describe('buildSystemBlockMembers', () => {
  it('παράγει BLOCK-LOCAL γεωμετρία με τις διαστάσεις του preset (κέντρο στο origin)', () => {
    const seed = SYSTEM_BLOCKS_SEED.find((s) => s.preset.id === 'bed_double_01');
    expect(seed).toBeDefined();

    const members = buildSystemBlockMembers(seed!.preset, seed!.id);
    const bounds = computeBlockLocalBoundsMm(members);
    expect(bounds).not.toBeNull();

    const { widthMm, depthMm } = seed!.preset;
    expect(bounds!.maxX - bounds!.minX).toBeCloseTo(widthMm, 6);
    expect(bounds!.maxY - bounds!.minY).toBeCloseTo(depthMm, 6);
    // BLOCK-LOCAL ⇒ base = κέντρο = (0,0): συμμετρικά bounds.
    expect(bounds!.minX).toBeCloseTo(-widthMm / 2, 6);
    expect(bounds!.minY).toBeCloseTo(-depthMm / 2, 6);
  });

  it('κάθε preset παράγει τουλάχιστον το περίγραμμα + ντετερμινιστικά member ids', () => {
    for (const seed of SYSTEM_BLOCKS_SEED) {
      const members = buildSystemBlockMembers(seed.preset, seed.id);
      expect(members.length).toBeGreaterThanOrEqual(1);
      expect(members[0]!.id).toBe(`${seed.id}_s0`);
      expect(members.every((m) => m.type === 'polyline')).toBe(true);
      // Ίδιο seed → ίδια bytes (idempotent upload).
      expect(buildSystemBlockMembers(seed.preset, seed.id)).toEqual(members);
    }
  });
});

// ---------------------------------------------------------------------------
// Το path: system content ΔΕΝ ζει κάτω από εταιρεία
// ---------------------------------------------------------------------------

describe('buildBlockLibraryGeometryPath', () => {
  it('company block → tenant-isolated path', () => {
    expect(buildBlockLibraryGeometryPath({ companyId: 'co_a', blockId: 'blklib_1' })).toBe(
      'companies/co_a/block-library/blklib_1.json',
    );
  });

  it('system block (companyId: null) → κοινό path, ορατό σε κάθε πελάτη', () => {
    expect(buildBlockLibraryGeometryPath({ companyId: null, blockId: 'blklib_sys_wc' })).toBe(
      'system/block-library/blklib_sys_wc.json',
    );
  });
});

// ---------------------------------------------------------------------------
// Το gate (pure)
// ---------------------------------------------------------------------------

describe('assertBlockScopeAllowed', () => {
  const OPEN = { type: 'cc0' as const, redistributable: true };
  const CLOSED = { type: 'unknown' as const, redistributable: false };

  it('ιδιωτικό scope: περνά ό,τι κι αν λέει η άδεια', () => {
    expect(() =>
      assertBlockScopeAllowed({ scope: 'user', license: CLOSED, hasProjectId: false }),
    ).not.toThrow();
  });

  it('κοινόχρηστο scope χωρίς δικαίωμα αναδιανομής → μπλοκ', () => {
    expect(() =>
      assertBlockScopeAllowed({ scope: 'company', license: CLOSED, hasProjectId: false }),
    ).toThrow(BLOCK_LIBRARY_ERRORS.SHARED_SCOPE_REQUIRES_REDISTRIBUTABLE);
  });

  it('project scope χωρίς ενεργό έργο → μπλοκ', () => {
    expect(() =>
      assertBlockScopeAllowed({ scope: 'project', license: OPEN, hasProjectId: false }),
    ).toThrow(BLOCK_LIBRARY_ERRORS.PROJECT_SCOPE_REQUIRES_PROJECT_ID);
  });

  it('system scope από client → ΠΟΤΕ', () => {
    expect(() =>
      assertBlockScopeAllowed({ scope: 'system', license: OPEN, hasProjectId: true }),
    ).toThrow(BLOCK_LIBRARY_ERRORS.SYSTEM_SCOPE_CLIENT_FORBIDDEN);
  });
});

// ---------------------------------------------------------------------------
// Δικαιώματα καρτών + φίλτρο
// ---------------------------------------------------------------------------

const ME = 'usr_me';

function cloudItem(partial: Partial<BlockLibraryItem>): BlockLibraryItem {
  return {
    id: 'blklib_1',
    scope: 'user',
    companyId: 'co_a',
    projectId: null,
    createdBy: ME,
    builtin: false,
    name: 'CHAIR',
    category: 'furniture',
    boundsMm: { minX: 0, minY: 0, maxX: 450, maxY: 450 },
    geometryUrl: 'https://storage.test/x.json',
    provenance: { sourceType: 'user-import', importedAt: 1, importedBy: ME },
    license: { type: 'unknown', redistributable: false },
    ...partial,
  };
}

function entryOf(item: BlockLibraryItem): BlockPaletteEntry {
  const [entry] = mergeBlockPaletteEntries([], [item]);
  return entry!;
}

describe('δικαιώματα κάρτας', () => {
  it('δικό μου ιδιωτικό block: διαγράφεται ΚΑΙ δημοσιεύεται', () => {
    const entry = entryOf(cloudItem({}));
    expect(canDeleteBlockEntry(entry, ME)).toBe(true);
    expect(canPromoteBlockEntry(entry, ME)).toBe(true);
  });

  it('ήδη δημοσιευμένο (company): δεν ξανα-δημοσιεύεται', () => {
    const entry = entryOf(cloudItem({ scope: 'company' }));
    expect(canPromoteBlockEntry(entry, ME)).toBe(false);
    expect(canDeleteBlockEntry(entry, ME)).toBe(true);
  });

  it('έτοιμο/partner (builtin): read-only — καμία ενέργεια', () => {
    const entry = entryOf(cloudItem({ scope: 'system', builtin: true, createdBy: 'system_seed' }));
    expect(canDeleteBlockEntry(entry, ME)).toBe(false);
    expect(canPromoteBlockEntry(entry, ME)).toBe(false);
  });

  it('ξένο block: καμία ενέργεια', () => {
    const entry = entryOf(cloudItem({ createdBy: 'usr_other' }));
    expect(canDeleteBlockEntry(entry, ME)).toBe(false);
  });

  it('session block (δεν σώθηκε ακόμα): ούτε διαγραφή ούτε δημοσίευση', () => {
    const [entry] = mergeBlockPaletteEntries(
      [{ name: 'IMPORTED', localMembers: [], boundsMm: null }],
      [],
    );
    expect(entry!.scope).toBe('session');
    expect(canDeleteBlockEntry(entry!, ME)).toBe(false);
    expect(canPromoteBlockEntry(entry!, ME)).toBe(false);
  });
});

describe('matchesLibraryFilter', () => {
  const subject = { names: ['WC_STANDARD_01', 'Λεκάνη'], category: 'sanitary', scope: 'system' };

  it('κενό φίλτρο → δείχνει τα πάντα', () => {
    expect(matchesLibraryFilter(subject, EMPTY_LIBRARY_FILTER)).toBe(true);
  });

  it('αναζήτηση: case-insensitive, σε ΟΛΑ τα ονόματα (raw + μεταφρασμένο)', () => {
    const base = { ...EMPTY_LIBRARY_FILTER };
    expect(matchesLibraryFilter(subject, { ...base, query: 'wc_stan' })).toBe(true);
    expect(matchesLibraryFilter(subject, { ...base, query: 'λεκάν' })).toBe(true);
    expect(matchesLibraryFilter(subject, { ...base, query: 'καρέκλα' })).toBe(false);
  });

  it('κατηγορία + scope', () => {
    expect(
      matchesLibraryFilter(subject, { ...EMPTY_LIBRARY_FILTER, category: 'sanitary' }),
    ).toBe(true);
    expect(
      matchesLibraryFilter(subject, { ...EMPTY_LIBRARY_FILTER, category: 'furniture' }),
    ).toBe(false);
    expect(matchesLibraryFilter(subject, { ...EMPTY_LIBRARY_FILTER, scope: 'user' })).toBe(false);
    expect(
      matchesLibraryFilter(subject, { ...EMPTY_LIBRARY_FILTER, scope: LIBRARY_FILTER_ALL }),
    ).toBe(true);
  });

  it('session block (χωρίς κατηγορία) κρύβεται μόλις μπει φίλτρο κατηγορίας', () => {
    const sessionSubject = { names: ['IMPORTED'], category: null, scope: 'session' };
    expect(
      matchesLibraryFilter(sessionSubject, { ...EMPTY_LIBRARY_FILTER, category: 'furniture' }),
    ).toBe(false);
    expect(matchesLibraryFilter(sessionSubject, EMPTY_LIBRARY_FILTER)).toBe(true);
  });
});
