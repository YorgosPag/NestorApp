/**
 * Οι κοινοί κανόνες ανάγνωσης BOQ — το SSoT που μοιράζονται client & admin
 *
 * Αυτά τα modules υπάρχουν επειδή **δύο** διαδρομές ανάγνωσης (UI με client SDK,
 * πράκτορας με admin SDK) πρέπει να απαντούν **τον ίδιο αριθμό** για το ίδιο
 * έγγραφο (ADR-734 §8.3). Τα tests εδώ κλειδώνουν ακριβώς αυτό: τη σημασιολογία
 * που, αν αντιγραφόταν, θα απέκλινε σιωπηλά.
 *
 * @module services/measurements/__tests__/boq-read-shared
 * @see ADR-734 §8.3
 */

import type { BOQCategory, BOQItem } from '@/types/boq';
import { makeItem } from '@/services/agent-capability/vqe/__tests__/vqe-test-fixtures';
import {
  applyBoqSearchText,
  buildCategoryNameMap,
  computeBoqStats,
  EMPTY_BOQ_STATS,
  matchesBoqSearchText,
} from '../boq-read-shared';
import { normalizeBOQCategory, normalizeBOQItem } from '../boq-document-normalize';
import { buildStaticAtoeCategories, STATIC_CATEGORY_ID_PREFIX } from '../boq-atoe-fallback';

const category = (code: string, nameEL: string): BOQCategory => ({
  id: `cat-${code}`,
  companyId: 'co-1',
  code,
  nameEL,
  nameEN: code,
  description: null,
  level: 'group',
  parentId: null,
  sortOrder: 1,
  defaultWasteFactor: 0,
  allowedUnits: ['m3'],
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

// ============================================================================
// ΧΑΡΤΗΣ ΟΝΟΜΑΤΩΝ ΚΑΤΗΓΟΡΙΑΣ
// ============================================================================

describe('buildCategoryNameMap — άγνωστος κωδικός δεν εξαφανίζεται', () => {
  it('αποδίδει το ελληνικό όνομα όταν η κατηγορία υπάρχει', () => {
    const items = [makeItem({ id: 'a', categoryCode: 'OIK-2' })];
    const names = buildCategoryNameMap(items, [category('OIK-2', 'Σκυροδέματα')]);

    expect(names.get('OIK-2')).toBe('Σκυροδέματα');
  });

  it('εφεδρεία = ο ίδιος ο κωδικός, ποτέ κενό ή undefined', () => {
    const items = [makeItem({ id: 'a', categoryCode: 'OIK-99' })];
    const names = buildCategoryNameMap(items, [category('OIK-2', 'Σκυροδέματα')]);

    // Αν αυτό γίνει '' ή undefined, η σύνοψη εμφανίζει ανώνυμη γραμμή κόστους.
    expect(names.get('OIK-99')).toBe('OIK-99');
  });

  it('η υπάρχουσα κατηγορία ΔΕΝ επισκιάζεται από την εφεδρεία', () => {
    const items = [makeItem({ id: 'a', categoryCode: 'OIK-2' })];
    const names = buildCategoryNameMap(items, [category('OIK-2', 'Σκυροδέματα')]);

    expect(names.get('OIK-2')).not.toBe('OIK-2');
  });
});

// ============================================================================
// ΑΝΑΖΗΤΗΣΗ ΚΕΙΜΕΝΟΥ
// ============================================================================

describe('matchesBoqSearchText — τα τρία πεδία του συμβολαίου', () => {
  const item = makeItem({
    id: 'a',
    title: 'Οπλισμένο σκυρόδεμα C20/25',
    categoryCode: 'OIK-2',
    description: 'Θεμελίωση υπογείου',
  });

  it.each([
    ['τίτλο', 'σκυρόδεμα'],
    ['κωδικό κατηγορίας', 'oik-2'],
    ['περιγραφή', 'θεμελίωση'],
  ])('ταιριάζει σε %s', (_field, term) => {
    expect(matchesBoqSearchText(item, term)).toBe(true);
  });

  it('δεν ταιριάζει σε άσχετο όρο', () => {
    expect(matchesBoqSearchText(item, 'χάλυβας')).toBe(false);
  });

  it('γραμμή χωρίς περιγραφή δεν ρίχνει', () => {
    const noDescription = makeItem({ id: 'b', title: 'Χωματουργικά', description: null });
    expect(matchesBoqSearchText(noDescription, 'ό,τι να ναι')).toBe(false);
  });
});

describe('applyBoqSearchText — κενός όρος σημαίνει «χωρίς φίλτρο»', () => {
  const items: readonly BOQItem[] = [
    makeItem({ id: 'a', title: 'Σκυρόδεμα' }),
    makeItem({ id: 'b', title: 'Χωματουργικά' }),
  ];

  it.each([undefined, '', '   '])('όρος %p ⇒ όλη η λίστα', (term) => {
    expect(applyBoqSearchText(items, term)).toHaveLength(2);
  });

  it('φιλτράρει όταν υπάρχει πραγματικός όρος', () => {
    expect(applyBoqSearchText(items, 'σκυρ').map((i) => i.id)).toEqual(['a']);
  });

  it('δεν μεταλλάσσει τη λίστα εισόδου', () => {
    applyBoqSearchText(items, 'σκυρ');
    expect(items).toHaveLength(2);
  });
});

// ============================================================================
// ΣΤΑΤΙΣΤΙΚΑ
// ============================================================================

describe('computeBoqStats — η φύρα εφαρμόζεται ΠΡΙΝ τον πολλαπλασιασμό', () => {
  it('υπολογίζει μεικτή ποσότητα × άθροισμα μοναδιαίων κοστών', () => {
    const items = [
      makeItem({
        id: 'a',
        estimatedQuantity: 100,
        wasteFactor: 0.1,
        materialUnitCost: 50,
        laborUnitCost: 30,
        equipmentUnitCost: 20,
      }),
    ];

    // 100 × 1,1 = 110 μεικτή· 50+30+20 = 100 €/μον. ⇒ 11.000 €
    // Αν η φύρα εφαρμοζόταν μετά, ή καθόλου, θα έβγαινε 10.000 €.
    expect(computeBoqStats(items).totalEstimatedCost).toBeCloseTo(11_000, 6);
  });

  it('μετρά κάθε κατάσταση χωριστά και αθροίζει σωστά', () => {
    const items = [
      makeItem({ id: 'a', status: 'draft' }),
      makeItem({ id: 'b', status: 'draft' }),
      makeItem({ id: 'c', status: 'certified' }),
      makeItem({ id: 'd', status: 'locked' }),
    ];
    const stats = computeBoqStats(items);

    expect(stats).toMatchObject({
      total: 4,
      draft: 2,
      submitted: 0,
      approved: 0,
      certified: 1,
      locked: 1,
    });
  });

  it('κενή λίστα ⇒ ταυτόσημο με το EMPTY_BOQ_STATS', () => {
    expect(computeBoqStats([])).toEqual(EMPTY_BOQ_STATS);
  });
});

// ============================================================================
// ΚΑΝΟΝΙΚΟΠΟΙΗΣΗ ΕΓΓΡΑΦΟΥ
// ============================================================================

describe('normalizeBOQItem — ένας μεταφραστής για δύο SDK', () => {
  it('συμπληρώνει προεπιλογές για κενό έγγραφο αντί να ρίξει', () => {
    const item = normalizeBOQItem('boq-1', {});

    expect(item.id).toBe('boq-1');
    expect(item.status).toBe('draft');
    expect(item.scope).toBe('building');
    expect(item.unit).toBe('m2');
    expect(item.estimatedQuantity).toBe(0);
    expect(item.costAllocationMethod).toBe('by_area');
  });

  it('διατηρεί τις τιμές του εγγράφου όταν υπάρχουν', () => {
    const item = normalizeBOQItem('boq-2', {
      companyId: 'co-1',
      buildingId: 'bld-1',
      categoryCode: 'OIK-2',
      estimatedQuantity: 42.5,
      wasteFactor: 0.05,
      status: 'certified',
    });

    expect(item).toMatchObject({
      companyId: 'co-1',
      buildingId: 'bld-1',
      categoryCode: 'OIK-2',
      estimatedQuantity: 42.5,
      wasteFactor: 0.05,
      status: 'certified',
    });
  });

  it('τα προαιρετικά πεδία γίνονται null, όχι undefined', () => {
    const item = normalizeBOQItem('boq-3', {});

    // `undefined` θα εξαφανιζόταν σε JSON.stringify και άρα από τον φάκελο VQE.
    expect(item.description).toBeNull();
    expect(item.linkedUnitId).toBeNull();
    expect(item.notes).toBeNull();
  });

  it('κανονικοποιεί ημερομηνίες σε συμβολοσειρά ISO', () => {
    const item = normalizeBOQItem('boq-4', { createdAt: '2026-03-01T10:00:00.000Z' });

    expect(item.createdAt).toBe('2026-03-01T10:00:00.000Z');
    expect(typeof item.updatedAt).toBe('string');
  });
});

describe('normalizeBOQCategory', () => {
  it('συμπληρώνει προεπιλογές και διατηρεί τα ονόματα', () => {
    const parsed = normalizeBOQCategory('cat-1', { code: 'OIK-2', nameEL: 'Σκυροδέματα' });

    expect(parsed).toMatchObject({ id: 'cat-1', code: 'OIK-2', nameEL: 'Σκυροδέματα' });
    expect(parsed.isActive).toBe(true);
    expect(parsed.allowedUnits).toEqual(['m2']);
  });
});

// ============================================================================
// STATIC ΑΤΟΕ FALLBACK
// ============================================================================

describe('buildStaticAtoeCategories — αναγνωρίσιμα ως ΜΗ έγγραφα', () => {
  it('κάθε id φέρει το πρόθεμα που δηλώνει «δεν ήρθε από Firestore»', () => {
    const categories = buildStaticAtoeCategories('co-1');

    expect(categories.length).toBeGreaterThan(0);
    for (const category_ of categories) {
      expect(category_.id.startsWith(STATIC_CATEGORY_ID_PREFIX)).toBe(true);
    }
  });

  it('αποδίδονται στον καλούντα tenant', () => {
    expect(buildStaticAtoeCategories('co-7').every((c) => c.companyId === 'co-7')).toBe(true);
  });

  it('τα allowedUnits είναι αντίγραφο — μετάλλαξη δεν μολύνει τον master κατάλογο', () => {
    const first = buildStaticAtoeCategories('co-1')[0];
    const second = buildStaticAtoeCategories('co-1')[0];

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    first?.allowedUnits.push('m2');
    expect(second?.allowedUnits).not.toContain('m2');
  });
});
