/**
 * ADR-866 §3.1 · ADR-905 §7 βήμα 6 — **η καρτέλα «Έγγραφα» γράφει τον σκοπό του ΤΥΠΟΥ, όχι τον δικό της**.
 *
 * Ζωντανό εύρημα 2026-10-07 (παραγωγή): αρχείο από την κάρτα «Πιστοποιητικό» γράφτηκε `purpose: 'document'` ⇒
 * καμία γραμμή του καταλόγου μεταβίβασης (ADR-901) δεν το αναγνώρισε, και ο αναμεταδότη σημάτων — σωστά — σώπασε.
 *
 * Ο επιλυτής, ο κατάλογος τύπων και ο κατάλογος μεταβίβασης τρέχουν **αληθινά**· τίποτα δεν κόβεται.
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | `DOCUMENTS_TAB_PURPOSE` εκτός `META_TAB_PURPOSES` | «κάθε τύπος κρατά τον σκοπό του» + «γραμμές καταλόγου» ⇒ 🔴 |
 * | `purposeAuthorityOf` αγνοεί το ρητό `purposeAuthority` | «ρητή δήλωση `tab` κερδίζει» ⇒ 🔴 |
 * | `resolveUploadScope` χωρίς εφεδρεία `tab.purpose` | «χωρίς επιλογή ⇒ ο μετα-σκοπός» ⇒ 🔴 |
 */

import { CONVEYANCE_CHECKLIST } from '@/config/conveyance-checklist/catalog';
import type { EvidenceLevel } from '@/config/conveyance-checklist/types';
import { ENTITY_TYPES, type FileCategory } from '@/config/domain-constants';
import { selectOfferedEntryPoints, type UploadEntryPoint } from '@/config/upload-entry-points';
import { DOCUMENTS_TAB_PURPOSE, buildPurposeFilter } from '../../hooks/useEntityFiles-purpose-filter';
import { resolveUploadScope, type UploadTabDefaults } from '../upload-scope';

/** Οι τρεις καρτέλες «Έγγραφα», όπως δηλώνονται στα components τους (τύπος οντότητας · τι αποκλείουν). */
const DOCUMENT_TABS: ReadonlyArray<{
  readonly level: EvidenceLevel;
  readonly entityType: string;
  readonly excludeCategories: FileCategory[];
}> = [
  { level: 'property', entityType: ENTITY_TYPES.PROPERTY, excludeCategories: ['photos', 'videos', 'floorplans'] },
  { level: 'project', entityType: ENTITY_TYPES.PROJECT, excludeCategories: ['photos', 'videos'] },
  { level: 'building', entityType: ENTITY_TYPES.BUILDING, excludeCategories: ['photos', 'videos'] },
];

const TAB_DEFAULTS: UploadTabDefaults = { domain: 'sales', category: 'documents', purpose: DOCUMENTS_TAB_PURPOSE };

function offeredBy(tab: (typeof DOCUMENT_TABS)[number]): UploadEntryPoint[] {
  return selectOfferedEntryPoints({ entityType: tab.entityType, excludeCategories: tab.excludeCategories });
}

/** Οι τύποι εγγράφου που ζητά ο κατάλογος μεταβίβασης σε ένα επίπεδο. */
function catalogEntryPointIds(level: EvidenceLevel): string[] {
  return CONVEYANCE_CHECKLIST.flatMap((item) =>
    item.satisfaction.kind === 'files'
      ? item.satisfaction.matchers.filter((m) => m.level === level).flatMap((m) => [...m.entryPointIds])
      : []);
}

describe('καρτέλες «Έγγραφα» — ο σκοπός του τύπου είναι η ταυτότητα του εγγράφου', () => {
  it.each(DOCUMENT_TABS)('$level: κάθε προσφερόμενος τύπος με σκοπό κρατά τον σκοπό ΤΟΥ', (tab) => {
    const withPurpose = offeredBy(tab).filter((ep) => ep.purpose);
    expect(withPurpose.length).toBeGreaterThan(0);
    for (const ep of withPurpose) {
      expect({ id: ep.id, purpose: resolveUploadScope(ep, TAB_DEFAULTS).purpose }).toEqual({ id: ep.id, purpose: ep.purpose });
    }
  });

  it('ακίνητο: «Πιστοποιητικό» γράφεται `certificate` (το αρχείο της ζωντανής δοκιμής γράφτηκε `document`)', () => {
    const certificate = offeredBy(DOCUMENT_TABS[0]).find((ep) => ep.id === 'unit-certificate');
    expect(certificate).toBeDefined();
    expect(resolveUploadScope(certificate ?? null, TAB_DEFAULTS).purpose).toBe('certificate');
  });

  it.each(DOCUMENT_TABS)('$level: ό,τι ζητά ο κατάλογος μεταβίβασης και προσφέρει η καρτέλα, γράφεται με σκοπό που ΔΕΝ είναι ο μετα-σκοπός', (tab) => {
    const wanted = new Set(catalogEntryPointIds(tab.level));
    for (const ep of offeredBy(tab).filter((candidate) => wanted.has(candidate.id))) {
      const { purpose } = resolveUploadScope(ep, TAB_DEFAULTS);
      expect({ id: ep.id, purpose }).toEqual({ id: ep.id, purpose: ep.purpose });
      expect(purpose).not.toBe(DOCUMENTS_TAB_PURPOSE);
    }
  });

  it('το ακίνητο προσφέρει πράγματι τύπους που ζητά ο κατάλογος (αλλιώς η προηγούμενη άγκυρα θα πρασίνιζε κενή)', () => {
    const wanted = new Set(catalogEntryPointIds('property'));
    expect(offeredBy(DOCUMENT_TABS[0]).filter((ep) => wanted.has(ep.id)).map((ep) => ep.id).sort())
      .toEqual(expect.arrayContaining(['unit-certificate', 'unit-deed', 'unit-permit']));
  });

  it('χωρίς επιλογή τύπου (λήψη · σημείωση) ⇒ ο μετα-σκοπός μένει ως εφεδρεία', () => {
    expect(resolveUploadScope(null, TAB_DEFAULTS).purpose).toBe(DOCUMENTS_TAB_PURPOSE);
  });

  it('ρητή δήλωση `tab` κερδίζει τον κανόνα των μετα-σκοπών', () => {
    const entry = { domain: 'admin', category: 'documents', purpose: 'certificate' } as const;
    expect(resolveUploadScope(entry, { ...TAB_DEFAULTS, purposeAuthority: 'tab' }).purpose).toBe(DOCUMENTS_TAB_PURPOSE);
  });

  it('καρτέλα με ΔΙΚΟ της (μη μετα-) σκοπό μένει όπως ήταν: ο σκοπός της καρτέλας κερδίζει', () => {
    const entry = { domain: 'construction', category: 'floorplans', purpose: 'floorplan' } as const;
    expect(resolveUploadScope(entry, { domain: 'construction', category: 'floorplans', purpose: 'parking-floorplan' }).purpose)
      .toBe('parking-floorplan');
  });

  it('ανάγνωση με τον μετα-σκοπό δεν κρύβει αρχείο με σκοπό τύπου (ό,τι ανεβαίνει, φαίνεται)', () => {
    const reads = buildPurposeFilter(DOCUMENTS_TAB_PURPOSE);
    expect([reads({ purpose: 'certificate' }), reads({ purpose: DOCUMENTS_TAB_PURPOSE }), reads({ purpose: undefined })])
      .toEqual([true, true, true]);
  });
});
