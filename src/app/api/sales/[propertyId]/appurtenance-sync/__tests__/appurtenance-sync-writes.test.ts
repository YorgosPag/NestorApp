/**
 * 🔴 **ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΓΡΑΦΗΣ ΠΑΡΑΚΟΛΟΥΘΗΜΑΤΩΝ** — ADR-777 §8.5α (δ).
 *
 * ── ΤΙ ΦΥΛΑΝΕ ──
 *
 * Μέχρι τις 2026-08-11 ο κλάδος `revert` έγραφε `commercialStatus: null` — τιμή
 * **εκτός** του κλειστού συνόλου των επτά (`COMMERCIAL_STATUSES`). Δεν το έπιασε
 * ούτε ο μεταγλωττιστής (το `batch.update()` δεχόταν ωμό αντικείμενο) ούτε καμία
 * πύλη· το έπιασε **άνθρωπος διαβάζοντας**, και το ADR το κατέγραψε ως ανοιχτό.
 *
 * 🔑 **Ο ΜΟΝΑΔΙΚΟΣ ΖΩΝΤΑΝΟΣ ΑΝΑΓΝΩΣΤΗΣ ΤΟ ΜΑΝΤΕΥΕ.** Το `useEntityStatusResolver`
 * γράφει `commercialStatus ?? 'unavailable'` — δηλαδή ο γράφων έγραφε άκυρα και ο
 * αναγνώστης διόρθωνε **σιωπηλά**. Γι' αυτό η διόρθωση έχει **μηδενική οπτική
 * αλλαγή**: δεν αλλάζει τι βλέπει ο χρήστης, αλλάζει **ποιος λέει την αλήθεια**.
 *
 * ── ⚠️ ΤΙ ΑΠΟΔΕΙΚΝΥΟΥΝ ΚΑΙ ΤΙ ΟΧΙ ──
 *
 * Εδώ αποδεικνύεται το **σχήμα της γραφής** — ποια τιμή παράγεται, ποια πεδία
 * αγγίζονται, ότι το σύνολο είναι κλειστό. **Δεν** αποδεικνύεται ότι το Firestore
 * τη δέχτηκε: οι συλλογές `parking_spaces` / `storage` **δεν υπάρχουν στη βάση**
 * (ADR-777 §8.5α γ), άρα ζωντανή επαλήθευση είναι **δομικά αδύνατη** — δηλωμένο
 * όριο, όχι παράλειψη.
 */

import {
  COMMERCIAL_STATUSES,
  APPURTENANCE_REVERTED_STATUS,
  DEFAULT_COMMERCIAL_STATUS,
} from '@/constants/commercial-statuses';

import {
  buildAppurtenanceUpdate,
  validateSyncBody,
  VALID_ACTIONS,
  type SyncAction,
  type AppurtenanceUpdate,
} from '../appurtenance-sync-writes';

const SPACE = { spaceId: 'PRK-000001', spaceType: 'parking' as const, salePrice: 12_000 };
const NOW = '2026-08-11T10:00:00.000Z';

const build = (action: SyncAction): AppurtenanceUpdate =>
  buildAppurtenanceUpdate({
    action,
    space: SPACE,
    propertyId: 'PROP-000001',
    owners: null,
    ownerContactIds: null,
    now: NOW,
  });

// ═══════════════════════════════════════════════════════════════════════════
// Α1 — 🔴 ΚΑΜΙΑ ΕΝΕΡΓΕΙΑ ΔΕΝ ΓΡΑΦΕΙ ΤΙΜΗ ΕΚΤΟΣ ΤΟΥ ΚΛΕΙΣΤΟΥ ΣΥΝΟΛΟΥ
// ═══════════════════════════════════════════════════════════════════════════

describe('Α1 · κάθε ενέργεια προσγειώνεται σε κανονική κατάσταση', () => {
  it.each(VALID_ACTIONS)(
    'Α1 · η «%s» γράφει τιμή που ΥΠΑΡΧΕΙ στο COMMERCIAL_STATUSES',
    (action) => {
      // Η άγκυρα ρωτά **το ίδιο το λεξιλόγιο**, όχι χειρόγραφη λίστα: μια όγδοη
      // κατάσταση καλύπτεται δωρεάν, και μια διαγραφή δεν περνά απαρατήρητη.
      expect(COMMERCIAL_STATUSES).toContain(build(action).commercialStatus);
    },
  );

  it('Α1β · η κάλυψη είναι ΕΞΑΝΤΛΗΤΙΚΗ — καμία ενέργεια χωρίς άγκυρα', () => {
    // Χωρίς αυτό, μια τέταρτη ενέργεια θα προσγειωνόταν με το Α1 πράσινο απλώς
    // επειδή κανείς δεν τη ρώτησε — το σχήμα «0 = κανείς δεν κοίταξε».
    const actions: SyncAction[] = ['reserve', 'sell', 'revert'];
    expect([...VALID_ACTIONS].sort()).toEqual([...actions].sort());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Α2 — 🔴 Η ΑΠΟΦΑΣΗ: ΤΟ ΠΑΡΑΚΟΛΟΥΘΗΜΑ ΔΕΝ ΑΚΟΛΟΥΘΕΙ ΤΟ ΑΚΙΝΗΤΟ
// ═══════════════════════════════════════════════════════════════════════════

describe('Α2 · η επαναφορά βγάζει τον χώρο ΕΚΤΟΣ αγοράς', () => {
  it('Α2 · «revert» ⇒ η ονομασμένη κατάσταση επαναφοράς, ΠΟΤΕ null', () => {
    const update = build('revert');
    expect(update.commercialStatus).toBe(APPURTENANCE_REVERTED_STATUS);
    // Ρητά: η παλιά τιμή ήταν `null`. Η άγκυρα ονομάζει τη ΒΛΑΒΗ, όχι μόνο τη θεραπεία.
    expect(update.commercialStatus).not.toBeNull();
  });

  it('Α2β · ΔΕΝ γράφει «for-sale» — δεν είναι αυτόνομα εμπορεύσιμος', () => {
    // 🔴 Στο ΙΔΙΟ γεγονός το κύριο ακίνητο πάει `for-sale` (το
    // `revertPropertySaleWithPolicy` ΠΕΤΑ αν ο στόχος είναι άλλος). Η ασυμμετρία
    // είναι **η απόφαση** (Giorgio 2026-08-11): ένα παρακολούθημα θα πάει ξανά
    // *μαζί* με το ακίνητο, και αυτόνομη προσφορά θα ήταν φάντασμα.
    expect(build('revert').commercialStatus).not.toBe('for-sale');
  });

  it('Α2γ · η επαναφορά ΣΒΗΝΕΙ κάθε ίχνος της συναλλαγής', () => {
    const update = build('revert');
    // Ένα υπόλειμμα `linkedPropertyId` θα κρατούσε τον χώρο δεμένο σε πώληση που
    // ακυρώθηκε — και ο `deletion-registry` μπλοκάρει διαγραφή όταν υπάρχουν owners.
    expect(update['commercial.owners']).toBeNull();
    expect(update['commercial.ownerContactIds']).toBeNull();
    expect(update['commercial.linkedPropertyId']).toBeNull();
    expect(update['commercial.finalPrice']).toBeNull();
    expect(update['commercial.saleDate']).toBeNull();
    expect(update['commercial.reservationDeposit']).toBeNull();
  });

  it('Α2δ · η σταθερά ΔΕΝ είναι ψευδώνυμο του DEFAULT — ίδια τιμή, άλλο ερώτημα', () => {
    // Συμπίπτουν σήμερα. Η άγκυρα κλειδώνει ότι είναι **δύο δηλώσεις**: όταν
    // αλλάξει «τι είναι μια νεοδημιουργημένη μονάδα», δεν σέρνει μαζί της το
    // «πού προσγειώνεται μια ακύρωση».
    expect(APPURTENANCE_REVERTED_STATUS).toBe(DEFAULT_COMMERCIAL_STATUS);
    expect(COMMERCIAL_STATUSES).toContain(APPURTENANCE_REVERTED_STATUS);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Α3 — ΟΙ ΔΕΣΜΕΥΤΙΚΕΣ ΕΝΕΡΓΕΙΕΣ ΚΑΘΡΕΦΤΙΖΟΥΝ ΤΟ ΑΚΙΝΗΤΟ
// ═══════════════════════════════════════════════════════════════════════════

describe('Α3 · reserve/sell — ο χώρος ακολουθεί το ακίνητο όσο είναι δεσμευμένος', () => {
  it('Α3 · «reserve» ⇒ reserved, με ημερομηνία κράτησης και δεσμό', () => {
    const update = build('reserve');
    expect(update.commercialStatus).toBe('reserved');
    expect(update['commercial.reservationDate']).toBe(NOW);
    expect(update['commercial.linkedPropertyId']).toBe('PROP-000001');
    expect(update['commercial.askingPrice']).toBe(12_000);
  });

  it('Α3β · «sell» ⇒ sold, με ΤΕΛΙΚΗ τιμή — όχι ζητούμενη', () => {
    const update = build('sell');
    expect(update.commercialStatus).toBe('sold');
    expect(update['commercial.finalPrice']).toBe(12_000);
    expect(update['commercial.saleDate']).toBe(NOW);
    expect(update['commercial.askingPrice']).toBeUndefined();
  });

  it('Α3γ · χωρίς τιμή ⇒ ρητό null, ΠΟΤΕ undefined', () => {
    // Το Firestore αγνοεί τα `undefined` — μια ξεχασμένη τιμή θα άφηνε την
    // ΠΡΟΗΓΟΥΜΕΝΗ στο έγγραφο, δηλαδή τιμή περασμένης συναλλαγής.
    const update = buildAppurtenanceUpdate({
      action: 'sell',
      space: { spaceId: 'STR-000001', spaceType: 'storage' },
      propertyId: 'PROP-000002',
      owners: null,
      ownerContactIds: null,
      now: NOW,
    });
    expect(update['commercial.finalPrice']).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Α4 — ΤΑ ΓΡΑΦΟΜΕΝΑ ΠΕΔΙΑ ΕΙΝΑΙ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ
// ═══════════════════════════════════════════════════════════════════════════

describe('Α4 · καμία ενέργεια δεν αγγίζει πεδίο εκτός του δηλωμένου συνόλου', () => {
  const ALLOWED = new Set([
    'commercialStatus',
    'commercial.owners',
    'commercial.ownerContactIds',
    'commercial.askingPrice',
    'commercial.finalPrice',
    'commercial.reservationDeposit',
    'commercial.reservationDate',
    'commercial.saleDate',
    'commercial.linkedPropertyId',
  ]);

  it.each(VALID_ACTIONS)('Α4 · η «%s» γράφει μόνο δηλωμένα πεδία', (action) => {
    // 🔴 Ένα ορθογραφικό λάθος σε δοτικό μονοπάτι δεν σπάει τίποτα στο Firestore:
    // **δημιουργεί νέο πεδίο**. Ο τύπος το κόβει στη μεταγλώττιση· αυτό εδώ είναι
    // η δεύτερη ζώνη, για την περίπτωση που κάποιος χαλαρώσει τον τύπο.
    for (const key of Object.keys(build(action))) expect(ALLOWED.has(key)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Α5 — ΕΠΙΚΥΡΩΣΗ ΕΙΣΟΔΟΥ
// ═══════════════════════════════════════════════════════════════════════════

describe('Α5 · η επικύρωση απορρίπτει ό,τι δεν μπορεί να γραφτεί', () => {
  it.each([
    [{}, 'action'],
    [{ action: 'destroy', spaces: [SPACE] }, 'action'],
    [{ action: 'sell', spaces: [] }, 'spaces'],
    [{ action: 'sell', spaces: [{ spaceId: '  ', spaceType: 'parking' }] }, 'spaceId'],
    [{ action: 'sell', spaces: [{ spaceId: 'X', spaceType: 'garage' }] }, 'spaceType'],
  ])('Α5 · %j ⇒ απορρίπτεται και ΟΝΟΜΑΖΕΙ το πεδίο', (body, mentions) => {
    const error = validateSyncBody(body as never);
    expect(error).not.toBeNull();
    expect(error).toContain(mentions);
  });

  it('Α5β · έγκυρο σώμα ⇒ κανένα σφάλμα', () => {
    expect(validateSyncBody({ action: 'revert', spaces: [SPACE] })).toBeNull();
  });

  it('Α5γ · το μήνυμα σφάλματος ΠΑΡΑΓΕΤΑΙ από τις ενέργειες, δεν είναι γραμμένο', () => {
    // Χειρόγραφη λίστα μέσα σε μήνυμα αποκλίνει σιωπηλά από την πραγματική —
    // το σχήμα των δύο λιστών namespace του CHECK 3.34 (απόκλιση 63).
    const error = validateSyncBody({ spaces: [SPACE] }) ?? '';
    for (const action of VALID_ACTIONS) expect(error).toContain(action);
  });
});
