/**
 * Ο σχεδιασμός tenant-scoped query — N.0.2 Boy Scout της Φάσης Δ (ADR-742).
 *
 * 🔴 Το test που έχει σημασία είναι το «companyId only»: η εξαγωγή του κοινού
 * βρόχου παραλίγο να μετατρέψει το τελευταίο καταφύγιο από «η εταιρεία μου» σε
 * «ό,τι έστειλε το μοντέλο» — και το μοντέλο μπορεί να στείλει `!=`.
 */

import {
  buildFallbackAttempts,
  buildFilteredQuery,
  planScopedRead,
  tenantEqualityFilter,
} from '../handlers/firestore-query-plan';
import type { AgenticContext, QueryFilter } from '../executor-shared-types';

const OWNER = 'co-1';

/** Καταγραφικό ψεύτικο: κρατά τι ζητήθηκε από το Firestore, δεν μιλά σε δίκτυο. */
function recordingDb() {
  const calls: Array<{ kind: string; args: unknown[] }> = [];
  const q: Record<string, (...a: unknown[]) => unknown> = {};
  for (const kind of ['where', 'orderBy', 'limit']) {
    q[kind] = (...args: unknown[]) => {
      calls.push({ kind, args });
      return q;
    };
  }
  const db = {
    collection: (name: string) => {
      calls.push({ kind: 'collection', args: [name] });
      return q;
    },
  };
  return { db: db as unknown as FirebaseFirestore.Firestore, calls };
}

describe('buildFilteredQuery', () => {
  it('εφαρμόζει φίλτρα, ταξινόμηση και όριο με τη σειρά', () => {
    const { db, calls } = recordingDb();

    buildFilteredQuery(db, 'contacts', [{ field: 'status', operator: '==', value: 'active' }], {
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit: 25,
    });

    expect(calls.map((c) => c.kind)).toEqual(['collection', 'where', 'orderBy', 'limit']);
    expect(calls[1].args).toEqual(['status', '==', 'active']);
    expect(calls[2].args).toEqual(['createdAt', 'desc']);
    expect(calls[3].args).toEqual([25]);
  });

  it('`limit: null` ⇒ κανένα limit (το `count()` μετρά τα πάντα)', () => {
    const { db, calls } = recordingDb();
    buildFilteredQuery(db, 'contacts', [], { limit: null });
    expect(calls.map((c) => c.kind)).not.toContain('limit');
  });

  it('άγνωστος operator αγνοείται (συμπεριφορά που προϋπήρχε)', () => {
    const { db, calls } = recordingDb();
    buildFilteredQuery(db, 'contacts', [{ field: 'x', operator: 'LIKE', value: 'a' }], {});
    expect(calls.map((c) => c.kind)).not.toContain('where');
  });
});

describe('🔴 tenantEqualityFilter — το καταφύγιο επιβάλλει ΙΣΟΤΗΤΑ', () => {
  // Το `enforceCompanyScope` κρατά τον operator που έστειλε το μοντέλο όταν
  // βρει υπάρχον φίλτρο `companyId` (αλλάζει μόνο την τιμή). Το `mapOperator`
  // δέχεται `!=` και `not-in`. Αν το καταφύγιο τα σεβόταν, θα ρωτούσε «όλες οι
  // ΑΛΛΕΣ εταιρείες».
  it.each(['!=', 'not-in', 'in', '>='])('operator «%s» γίνεται «==»', (operator) => {
    const out = tenantEqualityFilter({ field: 'companyId', operator, value: OWNER });
    expect(out).toEqual({ field: 'companyId', operator: '==', value: OWNER });
  });

  it('το τελευταίο attempt χτίζεται ΜΟΝΟ με ισότητα tenant', () => {
    const attempts = buildFallbackAttempts({
      filters: [{ field: 'companyId', operator: '!=', value: OWNER }],
      orderBy: null,
      orderDirection: 'asc',
    });

    const last = attempts[attempts.length - 1];
    expect(last.label).toBe('companyId only');
    expect(last.filters).toEqual([{ field: 'companyId', operator: '==', value: OWNER }]);
  });
});

describe('buildFallbackAttempts — η σειρά ΕΙΝΑΙ το συμβόλαιο', () => {
  const filters: QueryFilter[] = [
    { field: 'companyId', operator: '==', value: OWNER },
    { field: 'meta.tag', operator: '==', value: 'x' },
  ];

  it('θυσιάζει ένα πράγμα τη φορά: ταξινόμηση → ένθετα → όλα πλην tenant', () => {
    const attempts = buildFallbackAttempts({ filters, orderBy: 'createdAt', orderDirection: 'desc' });

    expect(attempts.map((a) => a.label)).toEqual([
      'full query',
      'without orderBy',
      'flat filters only (no nested)',
      'companyId only',
    ]);

    expect(attempts[0].orderBy).toEqual({ field: 'createdAt', direction: 'desc' });
    expect(attempts[1].orderBy).toBeNull();
    // Το 3ο πετά το ένθετο `meta.tag`, κρατά το `companyId`.
    expect(attempts[2].filters.map((f) => f.field)).toEqual(['companyId']);
  });

  it('χωρίς orderBy, το πρώτο attempt δεν ταξινομεί', () => {
    const attempts = buildFallbackAttempts({ filters, orderBy: null, orderDirection: 'asc' });
    expect(attempts[0].orderBy).toBeNull();
  });

  it('🔴 ο tenant επιβιώνει σε ΚΑΘΕ επίπεδο υποχώρησης', () => {
    const attempts = buildFallbackAttempts({ filters, orderBy: 'createdAt', orderDirection: 'asc' });

    for (const attempt of attempts) {
      expect(attempt.filters.some((f) => f.field === 'companyId')).toBe(true);
    }
  });
});

describe('planScopedRead — η αλυσίδα ασφαλείας', () => {
  const ctx = { companyId: OWNER, isAdmin: true, channel: 'telegram' } as AgenticContext;

  it('μη επιτρεπτή συλλογή κόβεται πριν από οτιδήποτε άλλο', () => {
    const plan = planScopedRead({ collection: 'secret_stuff' }, ctx);
    expect(plan.ok).toBe(false);
    if (plan.ok) throw new Error('αναμενόταν άρνηση');
    expect(plan.result.success).toBe(false);
  });

  it('επιτρεπτή συλλογή ⇒ ο tenant επιβάλλεται ακόμη κι αν το μοντέλο δεν τον ζήτησε', () => {
    const plan = planScopedRead({ collection: 'contacts', filters: [] }, ctx);
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw new Error('αναμενόταν έγκριση');
    expect(plan.filters).toContainEqual({ field: 'companyId', operator: '==', value: OWNER });
  });

  it('🔴 companyId που έστειλε το μοντέλο ΑΝΤΙΚΑΘΙΣΤΑΤΑΙ από τον δικό του', () => {
    const plan = planScopedRead(
      { collection: 'contacts', filters: [{ field: 'companyId', operator: '==', value: 'co-ΞΕΝΗ' }] },
      ctx,
    );
    if (!plan.ok) throw new Error('αναμενόταν έγκριση');
    expect(JSON.stringify(plan.filters)).not.toContain('co-ΞΕΝΗ');
    expect(plan.filters).toContainEqual({ field: 'companyId', operator: '==', value: OWNER });
  });
});
