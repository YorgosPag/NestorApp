/**
 * `BOQAdminReadService` — η απόδειξη ότι η αστοχία ΔΕΝ γίνεται «κενό»
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΕΛΕΓΧΕΤΑΙ ΕΔΩ ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΤΟ ΚΡΙΣΙΜΟ TEST ΤΗΣ ΦΑΣΗΣ 3
 * ─────────────────────────────────────────────────────────────────────────────
 * Το client repository καταπίνει κάθε σφάλμα υποδομής και επιστρέφει `[]`/`null`.
 * Αν το admin μονοπάτι έκανε το ίδιο, ο πράκτορας θα ανακοίνωνε «δεν βρέθηκαν
 * επιμετρήσεις» όταν στην πραγματικότητα **δεν μπόρεσε να διαβάσει** — ψευδές
 * αρνητικό, σιωπηλό, σε αριθμό που προορίζεται για υπογραφή.
 *
 * Τα tests παρακάτω απαιτούν να **ρίχνει**. Το registry μετατρέπει την εξαίρεση
 * σε `INTERNAL` (ADR-734 §5.2), δηλαδή ο πράκτορας μαθαίνει «απέτυχε» αντί για
 * «δεν υπάρχει».
 *
 * @module services/measurements/admin/__tests__/boq-admin-read-service
 * @see ADR-734 §7.2 #2, §8.3
 */

import type { Firestore } from 'firebase-admin/firestore';
import { BOQAdminReadService } from '../boq-admin-read-service';
import { STATIC_CATEGORY_ID_PREFIX } from '../../boq-atoe-fallback';

const OWNER = 'co-1';
const BUILDING = 'bld-1';

interface FakeDocument {
  readonly id: string;
  readonly data: Record<string, unknown>;
}

interface FakeCollectionPlan {
  /** Έγγραφα που επιστρέφει το `get()` της συλλογής. */
  readonly documents?: readonly FakeDocument[];
  /** Αν οριστεί, το `get()` ρίχνει με αυτό το μήνυμα. */
  readonly failWith?: string;
  /** Απάντηση για `.doc(id).get()`. */
  readonly byId?: Readonly<Record<string, Record<string, unknown> | null>>;
}

/**
 * Ελάχιστο ψεύτικο Admin Firestore.
 *
 * Υλοποιεί μόνο την αλυσίδα που χρησιμοποιεί το service (`collection → where* →
 * orderBy → get`, `collection → doc → get`). Αν το service αρχίσει να καλεί κάτι
 * άλλο, το test **σπάει** — που είναι το ζητούμενο: ο ψεύτης δεν πρέπει να είναι
 * πιο ανεκτικός από την πραγματικότητα.
 */
function fakeFirestore(plan: Readonly<Record<string, FakeCollectionPlan>>): Firestore {
  const collection = (name: string) => {
    const entry = plan[name] ?? {};

    const query = {
      where: () => query,
      orderBy: () => query,
      get: async () => {
        if (entry.failWith !== undefined) throw new Error(entry.failWith);
        const documents = entry.documents ?? [];
        return {
          empty: documents.length === 0,
          docs: documents.map((d) => ({ id: d.id, data: () => d.data })),
        };
      },
    };

    return {
      ...query,
      doc: (id: string) => ({
        get: async () => {
          if (entry.failWith !== undefined) throw new Error(entry.failWith);
          const data = entry.byId?.[id] ?? null;
          return { exists: data !== null, id, data: () => data };
        },
      }),
    };
  };

  return { collection } as unknown as Firestore;
}

const ITEMS_COLLECTION = 'boq_items';
const CATEGORIES_COLLECTION = 'boq_categories';

const itemDocument = (id: string, overrides: Record<string, unknown> = {}): FakeDocument => ({
  id,
  data: {
    companyId: OWNER,
    buildingId: BUILDING,
    categoryCode: 'OIK-2',
    title: 'Σκυρόδεμα C20/25',
    estimatedQuantity: 100,
    wasteFactor: 0.1,
    materialUnitCost: 50,
    laborUnitCost: 30,
    equipmentUnitCost: 20,
    status: 'draft',
    ...overrides,
  },
});

// ============================================================================
// Ο ΚΑΝΟΝΑΣ: ΑΣΤΟΧΙΑ ⇒ ΕΞΑΙΡΕΣΗ, ΟΧΙ ΚΕΝΟ
// ============================================================================

describe('αστοχία υποδομής ΔΕΝ μεταμφιέζεται σε «κανένα αποτέλεσμα»', () => {
  const broken = () =>
    new BOQAdminReadService(
      fakeFirestore({ [ITEMS_COLLECTION]: { failWith: 'PERMISSION_DENIED' } }),
    );

  it('getByBuilding ρίχνει αντί να επιστρέψει []', async () => {
    await expect(broken().getByBuilding(OWNER, BUILDING)).rejects.toThrow('PERMISSION_DENIED');
  });

  it('search ρίχνει αντί να επιστρέψει []', async () => {
    await expect(broken().search(OWNER, BUILDING)).rejects.toThrow('PERMISSION_DENIED');
  });

  it('getStatistics ρίχνει αντί να επιστρέψει μηδενικά', async () => {
    // Μηδενικά στατιστικά από αποτυχημένη ανάγνωση = «το κτίριο δεν κοστίζει τίποτα».
    await expect(broken().getStatistics(OWNER, BUILDING)).rejects.toThrow('PERMISSION_DENIED');
  });

  it('getBuildingSummary ρίχνει αντί να επιστρέψει null', async () => {
    // `null` εδώ θα διαβαζόταν από τον πράκτορα ως «κτίριο χωρίς επιμετρήσεις».
    await expect(broken().getBuildingSummary(OWNER, BUILDING)).rejects.toThrow('PERMISSION_DENIED');
  });

  it('getCategories ρίχνει αντί να γυρίσει τον static κατάλογο ΑΤΟΕ', async () => {
    const service = new BOQAdminReadService(
      fakeFirestore({ [CATEGORIES_COLLECTION]: { failWith: 'UNAVAILABLE' } }),
    );

    await expect(service.getCategories(OWNER)).rejects.toThrow('UNAVAILABLE');
  });
});

// ============================================================================
// ΦΥΣΙΟΛΟΓΙΚΕΣ ΔΙΑΔΡΟΜΕΣ
// ============================================================================

describe('ανάγνωση γραμμών', () => {
  const service = () =>
    new BOQAdminReadService(
      fakeFirestore({
        [ITEMS_COLLECTION]: {
          documents: [itemDocument('boq-1'), itemDocument('boq-2', { status: 'certified' })],
          byId: { 'boq-1': itemDocument('boq-1').data },
        },
      }),
    );

  it('κανονικοποιεί τα έγγραφα σε BOQItem', async () => {
    const items = await service().getByBuilding(OWNER, BUILDING);

    expect(items.map((i) => i.id)).toEqual(['boq-1', 'boq-2']);
    expect(items[0]?.estimatedQuantity).toBe(100);
    expect(items[0]?.description).toBeNull();
  });

  it('getById επιστρέφει null για ανύπαρκτο id χωρίς να ρίξει', async () => {
    await expect(service().getById('boq-missing')).resolves.toBeNull();
  });

  it('getById επιστρέφει τη γραμμή όταν υπάρχει', async () => {
    const item = await service().getById('boq-1');
    expect(item?.id).toBe('boq-1');
  });

  it('τα στατιστικά χρησιμοποιούν τον ΚΟΙΝΟ υπολογισμό (φύρα πριν)', async () => {
    const stats = await service().getStatistics(OWNER, BUILDING);

    expect(stats.total).toBe(2);
    expect(stats.draft).toBe(1);
    expect(stats.certified).toBe(1);
    // 2 × (100 × 1,1 × 100) = 22.000
    expect(stats.totalEstimatedCost).toBeCloseTo(22_000, 6);
  });

  it('το φίλτρο κειμένου εφαρμόζεται στη μνήμη με τον κοινό κανόνα', async () => {
    await expect(service().search(OWNER, BUILDING, { searchText: 'σκυρ' })).resolves.toHaveLength(2);
    await expect(service().search(OWNER, BUILDING, { searchText: 'χάλυβας' })).resolves.toHaveLength(0);
  });
});

describe('κατηγορίες — κενή συλλογή ΔΕΝ είναι αστοχία', () => {
  it('κενή συλλογή ⇒ static κατάλογος ΑΤΟΕ', async () => {
    const service = new BOQAdminReadService(
      fakeFirestore({ [CATEGORIES_COLLECTION]: { documents: [] } }),
    );
    const categories = await service.getCategories(OWNER);

    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0]?.id.startsWith(STATIC_CATEGORY_ID_PREFIX)).toBe(true);
  });

  it('υπάρχουσες κατηγορίες υπερισχύουν του static καταλόγου', async () => {
    const service = new BOQAdminReadService(
      fakeFirestore({
        [CATEGORIES_COLLECTION]: {
          documents: [{ id: 'cat-1', data: { companyId: OWNER, code: 'OIK-2', nameEL: 'Σκυροδέματα' } }],
        },
      }),
    );
    const categories = await service.getCategories(OWNER);

    expect(categories).toHaveLength(1);
    expect(categories[0]?.nameEL).toBe('Σκυροδέματα');
  });
});

describe('σύνοψη κτιρίου — το null σημαίνει ΕΝΑ πράγμα', () => {
  it('κτίριο χωρίς γραμμές ⇒ null (και χωρίς ανάγνωση κατηγοριών)', async () => {
    const service = new BOQAdminReadService(
      fakeFirestore({
        [ITEMS_COLLECTION]: { documents: [] },
        // Αν το service διάβαζε κατηγορίες πριν ελέγξει τις γραμμές, θα έριχνε.
        [CATEGORIES_COLLECTION]: { failWith: 'should not be read' },
      }),
    );

    await expect(service.getBuildingSummary(OWNER, BUILDING)).resolves.toBeNull();
  });

  it('κτίριο με γραμμές ⇒ σύνοψη με ονόματα κατηγοριών', async () => {
    const service = new BOQAdminReadService(
      fakeFirestore({
        [ITEMS_COLLECTION]: { documents: [itemDocument('boq-1')] },
        [CATEGORIES_COLLECTION]: {
          documents: [{ id: 'cat-1', data: { companyId: OWNER, code: 'OIK-2', nameEL: 'Σκυροδέματα' } }],
        },
      }),
    );
    const summary = await service.getBuildingSummary(OWNER, BUILDING);

    expect(summary).not.toBeNull();
    expect(summary?.buildingId).toBe(BUILDING);
  });
});
