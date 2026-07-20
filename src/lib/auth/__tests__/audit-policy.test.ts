/**
 * ADR-438 — three-tier audit policy (retention / delivery / dedup).
 *
 * ΓΙΑΤΙ ΕΧΟΥΝ ΣΗΜΑΣΙΑ: το `AUDIT_ACTION_TIER` είναι ο μοναδικός φρουρός που εμποδίζει
 * ένα νέο `AuditAction` να μείνει χωρίς tier — αλλά αυτό ο TypeScript compiler το πιάνει
 * ΜΟΝΟ όταν κάποιος προσθέτει tier χωρίς να προσθέσει action στο registry κι αντίστροφα
 * ξεχνώντας. Το exhaustiveness test εδώ κάνει runtime την ίδια απόδειξη πάνω στα ΠΡΑΓΜΑΤΙΚΑ
 * registries, ώστε να μην «σαπίζει» αν κάποιος προσθέσει action με ΚΑΙ tier μαζί (οπότε ο
 * compiler δεν θα διαμαρτυρηθεί καθόλου, αλλά ο αριθμός/η αντιστοίχιση θα μπορούσε ακόμα
 * να είναι λάθος).
 */

import {
  AUDIT_TIER_CONFIG,
  AUDIT_ACTION_TIER,
  resolveAuditTier,
  resolveAuditPolicy,
  computeAuditExpiry,
  buildAuditDedupKey,
  releaseDedupKey,
  resolveDedupWindowMs,
  shouldSuppressDuplicate,
} from '../audit-policy';
import { AUDIT_ACTIONS, type AuditAction } from '../audit-types';

describe('AUDIT_ACTION_TIER — exhaustiveness over AUDIT_ACTIONS', () => {
  const registryKeys = Object.keys(AUDIT_ACTIONS).sort();
  const tierKeys = Object.keys(AUDIT_ACTION_TIER).sort();

  it('έχει tier entry για κάθε action του registry', () => {
    const missing = registryKeys.filter((k) => !tierKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it('δεν έχει tier entries που δεν υπάρχουν στο registry', () => {
    const extra = tierKeys.filter((k) => !registryKeys.includes(k));
    expect(extra).toEqual([]);
  });

  it('τα δύο σύνολα κλειδιών ταυτίζονται ακριβώς', () => {
    expect(tierKeys).toEqual(registryKeys);
  });

  it('δεν είναι κενό/κολοβωμένο registry (κατώφλι πλήθους)', () => {
    // Μετρημένο πραγματικό πλήθος στο registry κατά τη συγγραφή: 43 actions.
    // Το κατώφλι εμποδίζει το test να περάσει "πράσινο" πάνω σε άδειο/truncated αντικείμενο.
    expect(registryKeys.length).toBeGreaterThanOrEqual(43);
    expect(Object.keys(AUDIT_ACTION_TIER).length).toBeGreaterThanOrEqual(43);
  });

  it('κάθε τιμή tier είναι έγκυρο κλειδί του AUDIT_TIER_CONFIG', () => {
    const validTiers = Object.keys(AUDIT_TIER_CONFIG);
    for (const key of tierKeys) {
      expect(validTiers).toContain(AUDIT_ACTION_TIER[key as AuditAction]);
    }
  });
});

describe('resolveAuditTier / resolveAuditPolicy — spot checks', () => {
  it.each<[AuditAction, 'security' | 'compliance' | 'access']>([
    ['data_accessed', 'access'],
    ['access_denied', 'security'],
    ['data_created', 'compliance'],
    ['procurement.po.created', 'compliance'],
    ['claims_updated', 'security'],
    ['webhook_received', 'compliance'],
    ['asset_pack.access_denied', 'security'],
  ])('%s -> %s', (action, expectedTier) => {
    expect(resolveAuditTier(action)).toBe(expectedTier);
  });

  it('resolveAuditPolicy επιστρέφει την πλήρη config του tier', () => {
    expect(resolveAuditPolicy('data_accessed')).toEqual(AUDIT_TIER_CONFIG.access);
    expect(resolveAuditPolicy('access_denied')).toEqual(AUDIT_TIER_CONFIG.security);
    expect(resolveAuditPolicy('data_created')).toEqual(AUDIT_TIER_CONFIG.compliance);
  });
});

describe('computeAuditExpiry', () => {
  // Η υλοποίηση χρησιμοποιεί setMonth/getMonth (τοπική ώρα), όχι UTC — τα asserts
  // εδώ διαβάζουν επίσης με τοπικούς getters ώστε το test να μην είναι timezone-fragile.
  const fixedNow = new Date(2026, 2, 15, 10, 0, 0); // 15 Μαρτίου 2026

  it('access tier: +1 μήνας', () => {
    const expiry = computeAuditExpiry('data_accessed', fixedNow);
    expect(expiry.getFullYear()).toBe(2026);
    expect(expiry.getMonth()).toBe(3); // April (0-indexed)
    expect(expiry.getDate()).toBe(15);
  });

  it('compliance tier: +12 μήνες', () => {
    const expiry = computeAuditExpiry('data_created', fixedNow);
    expect(expiry.getFullYear()).toBe(2027);
    expect(expiry.getMonth()).toBe(2); // March
    expect(expiry.getDate()).toBe(15);
  });

  it('security tier: +24 μήνες', () => {
    const expiry = computeAuditExpiry('access_denied', fixedNow);
    expect(expiry.getFullYear()).toBe(2028);
    expect(expiry.getMonth()).toBe(2); // March
    expect(expiry.getDate()).toBe(15);
  });

  describe('year-boundary rollover (setMonth)', () => {
    const yearEndNow = new Date(2026, 11, 15, 10, 0, 0); // 15 Δεκεμβρίου 2026

    it('access tier: Δεκέμβριος 2026 + 1 -> Ιανουάριος 2027', () => {
      const expiry = computeAuditExpiry('data_accessed', yearEndNow);
      expect(expiry.getFullYear()).toBe(2027);
      expect(expiry.getMonth()).toBe(0); // January
      expect(expiry.getDate()).toBe(15);
    });

    it('compliance tier: Δεκέμβριος 2026 + 12 -> Δεκέμβριος 2027', () => {
      const expiry = computeAuditExpiry('data_created', yearEndNow);
      expect(expiry.getFullYear()).toBe(2027);
      expect(expiry.getMonth()).toBe(11); // December
      expect(expiry.getDate()).toBe(15);
    });

    it('security tier: Δεκέμβριος 2026 + 24 -> Δεκέμβριος 2028', () => {
      const expiry = computeAuditExpiry('access_denied', yearEndNow);
      expect(expiry.getFullYear()).toBe(2028);
      expect(expiry.getMonth()).toBe(11); // December
      expect(expiry.getDate()).toBe(15);
    });
  });

  it('default now: όταν παραλείπεται, χρησιμοποιεί το τρέχον Date (δεν πετάει, επιστρέφει μελλοντική ημερομηνία)', () => {
    const before = Date.now();
    const expiry = computeAuditExpiry('data_created');
    expect(expiry.getTime()).toBeGreaterThan(before);
  });
});

describe('buildAuditDedupKey', () => {
  const base = {
    companyId: 'company-1',
    actorId: 'user-1',
    action: 'data_accessed' as AuditAction,
    targetId: 'target-1',
  };

  it('ίδια είσοδος -> ίδιο κλειδί', () => {
    expect(buildAuditDedupKey(base)).toBe(buildAuditDedupKey({ ...base }));
  });

  it('διαφορετικό companyId -> διαφορετικό κλειδί', () => {
    expect(buildAuditDedupKey(base)).not.toBe(buildAuditDedupKey({ ...base, companyId: 'company-2' }));
  });

  it('διαφορετικό actorId -> διαφορετικό κλειδί', () => {
    expect(buildAuditDedupKey(base)).not.toBe(buildAuditDedupKey({ ...base, actorId: 'user-2' }));
  });

  it('διαφορετικό action -> διαφορετικό κλειδί', () => {
    expect(buildAuditDedupKey(base)).not.toBe(
      buildAuditDedupKey({ ...base, action: 'data_created' as AuditAction })
    );
  });

  it('διαφορετικό targetId -> διαφορετικό κλειδί', () => {
    expect(buildAuditDedupKey(base)).not.toBe(buildAuditDedupKey({ ...base, targetId: 'target-2' }));
  });

  it('διαφορετικό path -> διαφορετικό κλειδί', () => {
    expect(buildAuditDedupKey({ ...base, path: '/api/a' })).not.toBe(
      buildAuditDedupKey({ ...base, path: '/api/b' })
    );
  });

  it('απών path ΔΕΝ συγκρούεται με παρόν path', () => {
    const withoutPath = buildAuditDedupKey(base);
    const withEmptyPath = buildAuditDedupKey({ ...base, path: '' });
    const withRealPath = buildAuditDedupKey({ ...base, path: '/api/x' });

    // Missing path και explicit empty-string path καταλήγουν στο ίδιο "κενό" segment —
    // τεκμηριώνουμε τη ΠΡΑΓΜΑΤΙΚΗ συμπεριφορά (join με fallback '').
    expect(withoutPath).toBe(withEmptyPath);
    expect(withoutPath).not.toBe(withRealPath);
  });
});

describe('resolveDedupWindowMs — dedup είναι opt-in ανά call site', () => {
  it('χωρίς dedupable -> 0 (καμία καταστολή), ακόμη και σε access tier', () => {
    expect(resolveDedupWindowMs('data_accessed', undefined)).toBe(0);
  });

  it('dedupable: false -> 0', () => {
    expect(resolveDedupWindowMs('data_accessed', false)).toBe(0);
  });

  it('dedupable: true σε access tier -> το παράθυρο του tier', () => {
    expect(resolveDedupWindowMs('data_accessed', true)).toBe(AUDIT_TIER_CONFIG.access.dedupWindowMs);
    expect(resolveDedupWindowMs('data_accessed', true)).toBeGreaterThan(0);
  });

  it('ΚΡΙΣΙΜΟ: dedupable: true σε security action -> ΠΑΡΑΜΕΝΕΙ 0 (το tier υπερισχύει)', () => {
    // Δεύτερος φρουρός: λάθος `dedupable: true` σε call site forensics ΔΕΝ μπορεί να
    // καταπιεί audit γραμμή. Αν αυτό γίνει ποτέ > 0, χάνονται γραμμές ασφαλείας.
    expect(resolveDedupWindowMs('access_denied', true)).toBe(0);
    expect(resolveDedupWindowMs('role_changed', true)).toBe(0);
    expect(resolveDedupWindowMs('permission_revoked', true)).toBe(0);
  });

  it('ΚΡΙΣΙΜΟ: dedupable: true σε compliance action -> ΠΑΡΑΜΕΝΕΙ 0', () => {
    expect(resolveDedupWindowMs('data_created', true)).toBe(0);
    expect(resolveDedupWindowMs('data_updated', true)).toBe(0);
    expect(resolveDedupWindowMs('data_deleted', true)).toBe(0);
  });

  it('ΚΑΝΕΝΑ action δεν αποκτά dedup χωρίς ρητή δήλωση του call site', () => {
    // Καθολικό δίχτυ: αν κάποιος επαναφέρει «dedup ανά tier», αυτό σκάει για ΟΛΑ.
    const actions = Object.keys(AUDIT_ACTION_TIER) as AuditAction[];
    expect(actions.length).toBeGreaterThanOrEqual(43);
    for (const action of actions) {
      expect(resolveDedupWindowMs(action, undefined)).toBe(0);
    }
  });
});

describe('shouldSuppressDuplicate', () => {
  it('πρώτη κλήση για ένα κλειδί -> false (δεν καταστέλλεται)', () => {
    const key = `unit-test-first-${Math.random()}`;
    expect(shouldSuppressDuplicate(key, 300_000, 1_000_000)).toBe(false);
  });

  it('άμεση επανάληψη μέσα στο παράθυρο -> true (καταστέλλεται)', () => {
    const key = `unit-test-repeat-${Math.random()}`;
    const windowMs = 300_000;
    const t0 = 2_000_000;

    expect(shouldSuppressDuplicate(key, windowMs, t0)).toBe(false);
    expect(shouldSuppressDuplicate(key, windowMs, t0 + 1)).toBe(true);
    expect(shouldSuppressDuplicate(key, windowMs, t0 + windowMs - 1)).toBe(true);
  });

  it('επανάληψη ΜΕΤΑ τη λήξη του παραθύρου -> false', () => {
    const key = `unit-test-expired-${Math.random()}`;
    const windowMs = 300_000;
    const t0 = 3_000_000;

    expect(shouldSuppressDuplicate(key, windowMs, t0)).toBe(false);
    expect(shouldSuppressDuplicate(key, windowMs, t0 + windowMs)).toBe(false);
  });

  it('windowMs === 0 -> ποτέ καταστολή, ούτε σε επανειλημμένες κλήσεις με το ίδιο ts', () => {
    const key = `unit-test-zero-window-${Math.random()}`;
    expect(shouldSuppressDuplicate(key, 0, 4_000_000)).toBe(false);
    expect(shouldSuppressDuplicate(key, 0, 4_000_000)).toBe(false);
    expect(shouldSuppressDuplicate(key, 0, 4_000_000)).toBe(false);
  });

  it('διαφορετικά κλειδιά δεν συγκρούονται μεταξύ τους', () => {
    const windowMs = 300_000;
    const t0 = 5_000_000;
    const keyA = `unit-test-collide-a-${Math.random()}`;
    const keyB = `unit-test-collide-b-${Math.random()}`;

    expect(shouldSuppressDuplicate(keyA, windowMs, t0)).toBe(false);
    // Το keyB δεν πρέπει να επηρεαστεί από την εγγραφή του keyA στο ίδιο ts.
    expect(shouldSuppressDuplicate(keyB, windowMs, t0)).toBe(false);
    // Και το keyA παραμένει καταπιεσμένο ανεξάρτητα από το keyB.
    expect(shouldSuppressDuplicate(keyA, windowMs, t0 + 1)).toBe(true);
  });
});

describe('releaseDedupKey — η αισιόδοξη σφραγίδα λύνεται όταν το write χαθεί', () => {
  const windowMs = 300_000;

  it('μετά από release, το ΙΔΙΟ κλειδί ξαναγράφεται μέσα στο ίδιο παράθυρο', () => {
    const key = `unit-test-release-${Math.random()}`;
    const t0 = 6_000_000;

    // Σφραγίζεται αισιόδοξα...
    expect(shouldSuppressDuplicate(key, windowMs, t0)).toBe(false);
    // ...και χωρίς release θα ήταν τυφλό για όλο το παράθυρο:
    expect(shouldSuppressDuplicate(key, windowMs, t0 + 1)).toBe(true);

    // Το write απέτυχε ⇒ λύνουμε τη σφραγίδα.
    releaseDedupKey(key);

    // Η επόμενη ΠΡΑΓΜΑΤΙΚΗ πρόσβαση γράφεται, αντί να χαθεί κι αυτή.
    expect(shouldSuppressDuplicate(key, windowMs, t0 + 2)).toBe(false);
  });

  it('είναι idempotent — release άγνωστου κλειδιού δεν πετάει', () => {
    expect(() => releaseDedupKey(`unit-test-never-sealed-${Math.random()}`)).not.toThrow();
  });

  it('απελευθερώνει ΜΟΝΟ το κλειδί που του δόθηκε', () => {
    const keyA = `unit-test-rel-a-${Math.random()}`;
    const keyB = `unit-test-rel-b-${Math.random()}`;
    const t0 = 7_000_000;

    expect(shouldSuppressDuplicate(keyA, windowMs, t0)).toBe(false);
    expect(shouldSuppressDuplicate(keyB, windowMs, t0)).toBe(false);

    releaseDedupKey(keyA);

    expect(shouldSuppressDuplicate(keyA, windowMs, t0 + 1)).toBe(false); // λύθηκε
    expect(shouldSuppressDuplicate(keyB, windowMs, t0 + 1)).toBe(true);  // ανέπαφο
  });
});

/**
 * Το `dedupSeen` Map είναι module-level και μεγαλώνει με κάθε νέο κλειδί. Ο ίδιος ο
 * κώδικας δηλώνει ότι αυτό — όχι μια διπλή γραμμή audit — είναι το μοναδικό πραγματικό
 * ρίσκο του dedup. Μέχρι τώρα ΔΕΝ υπήρχε test γι' αυτό.
 *
 * ⚠️ ΤΕΛΕΥΤΑΙΟ describe του αρχείου ΣΚΟΠΙΜΑ: γεμίζει και καθαρίζει το κοινόχρηστο Map,
 * οπότε θα μόλυνε την κατάσταση οποιουδήποτε test έτρεχε μετά.
 */
describe('bounded dedup map — eviction στα 5.000 entries', () => {
  const windowMs = 300_000;

  it('ΔΕΝ μεγαλώνει απεριόριστα: μετά από 6.000 φρέσκα κλειδιά, τα παλιά έχουν καθαριστεί', () => {
    const t0 = 10_000_000;
    const firstKey = 'bound-test-key-0';

    for (let i = 0; i < 6000; i++) {
      shouldSuppressDuplicate(`bound-test-key-${i}`, windowMs, t0);
    }

    // Αν το Map μεγάλωνε ανεξέλεγκτα, το πρώτο κλειδί θα ήταν ακόμη σφραγισμένο (φρέσκο,
    // ίδιο t0). Το ότι ΔΕΝ είναι, αποδεικνύει ότι έγινε eviction/clear ⇒ φραγμένο.
    expect(shouldSuppressDuplicate(firstKey, windowMs, t0)).toBe(false);
  });

  it('η εκκαθάριση πετάει ΠΡΩΤΑ τα ληγμένα και ΑΦΗΝΕΙ τα φρέσκα', () => {
    const t0 = 20_000_000;

    // 5.000 κλειδιά που θα λήξουν...
    for (let i = 0; i < 5000; i++) {
      shouldSuppressDuplicate(`stale-test-key-${i}`, windowMs, t0);
    }

    // ...κι ένα φρέσκο, στη μέση του παραθύρου.
    const freshKey = 'stale-test-FRESH';
    expect(shouldSuppressDuplicate(freshKey, windowMs, t0 + windowMs / 2)).toBe(false);

    // Τη στιγμή που τα 5.000 λήγουν, νέο κλειδί πυροδοτεί eviction.
    shouldSuppressDuplicate('stale-test-TRIGGER', windowMs, t0 + windowMs);

    // Το φρέσκο κλειδί ΕΠΙΒΙΩΝΕΙ — δεν σαρώθηκε μαζί με τα ληγμένα.
    expect(shouldSuppressDuplicate(freshKey, windowMs, t0 + windowMs)).toBe(true);
    // Ενώ ένα από τα ληγμένα έχει όντως φύγει.
    expect(shouldSuppressDuplicate('stale-test-key-0', windowMs, t0 + windowMs)).toBe(false);
  });
});
