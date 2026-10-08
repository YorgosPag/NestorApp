/**
 * Unit tests — οι ΕΤΙΚΕΤΕΣ των τιμών στην κάρτα ακινήτου (ADR-777 §8.2 #3).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Ο φάκελος `src/domain/cards/property/` δεν είχε **κανένα**
 * test (ADR-777, ανοιχτό #6): ο resolver ήταν αποδεδειγμένος, αλλά **τίποτα
 * δεν κλείδωνε τι ΛΕΞΗ γράφεται δίπλα σε κάθε αριθμό**. Η κάρτα έγραφε τη
 * δεύτερη γραμμή σκληρά ως «Ενοίκιο», κάτι που ήταν αληθές μόνο όσο η δεύτερη
 * γραμμή μπορούσε να είναι μόνο ενοίκιο. Από τη στιγμή που ένα πωλημένο
 * ακίνητο άρχισε να κουβαλά εκεί τη ζητούμενη τιμή του, η ίδια γραμμή θα
 * βάφτιζε **200.000 € ως «Ενοίκιο»** — και καμία πύλη δεν θα το έβλεπε, γιατί
 * ο μεταγλωττιστής δεν έχει γνώμη για μια συμβολοσειρά κλειδιού.
 *
 * ⚠️ Ο έλεγχος γίνεται στις **ετικέτες**, όχι στα ποσά: τα ποσά τα αποδεικνύει
 * ήδη το `price-resolver.test.ts`. Εδώ κρίνεται μόνο το ερώτημα που κανείς δεν
 * ρωτούσε: *«λέει η κάρτα την αλήθεια για το τι είναι ο κάθε αριθμός;»*
 */
import {
  MISSING_PRICE_LABEL_KEYS,
  buildCardPriceText,
  buildListingAudienceBadge,
  buildPropertyBadges,
  buildPropertyStatusBadge,
  buildPropertyPriceStats,
  buildPropertyPricePerSqmStats,
  pricePerSqmAmount,
} from '@/domain/cards/property/property-card-shared';
import { resolveDisplayPrice, type MissingPriceReason } from '@/lib/properties/price-resolver';
import type { Property } from '@/types/property-viewer';

/** Το `t` επιστρέφει το ίδιο το κλειδί — κρίνουμε ΠΟΙΟ κλειδί ζητήθηκε (και με ποιο ποσό). */
const t = (key: string, opts?: Record<string, unknown>): string =>
  opts && 'price' in opts ? `${key}:${String(opts.price)}` : key;

/** Δομικό ελάχιστο — μόνο ό,τι διαβάζει ο resolver. */
function unit(commercialStatus: string, commercial: Record<string, number>): Property {
  return { commercialStatus, commercial } as unknown as Property;
}

/** Κατάλυμα **μόνο** βραχυχρόνιας — η περίπτωση του §8.60.13 (Θεσσαλονίκη, 50 €/νύχτα). */
function shortStay(commercial: Record<string, number>): Property {
  return { offerKinds: ['leaseShort'], commercial } as unknown as Property;
}

const labelsOf = (p: Property): string[] =>
  buildPropertyPriceStats(p, t).map((s) => s.label);

// =============================================================================
// Κ1 — ΤΟ ΠΩΛΗΜΕΝΟ: «Τιμή πώλησης» + «Ζητούσε», ΠΟΤΕ «Ενοίκιο»
// =============================================================================

describe('Κ1 — sold: η δεύτερη γραμμή είναι η ζητούμενη, όχι ενοίκιο', () => {
  const sold = unit('sold', { askingPrice: 200_000, finalPrice: 185_000 });

  it('γράφει «τιμή πώλησης» και «ζητούσε»', () => {
    expect(labelsOf(sold)).toEqual(['card.stats.soldFor', 'card.stats.askedFor']);
  });

  it('🔴 ΔΕΝ γράφει ΠΟΥΘΕΝΑ «ενοίκιο» σε πωλημένο ακίνητο', () => {
    // Η άγκυρα του πραγματικού κινδύνου: η παλιά γραμμή ήταν σκληρά 'rent'.
    expect(labelsOf(sold)).not.toContain('card.stats.rent');
  });

  it('τα ποσά γράφονται με τη μονάδα ΠΩΛΗΣΗΣ — καμία περίοδος «/μήνα»', () => {
    const values = buildPropertyPriceStats(sold, t).map((s) => String(s.value));
    expect(values.every((v) => v.startsWith('common:priceAmount.sale:'))).toBe(true);
  });
});

// =============================================================================
// Κ2 — ΟΙ ΥΠΟΛΟΙΠΕΣ ΠΕΡΙΠΤΩΣΕΙΣ ΔΕΝ ΑΛΛΑΞΑΝ
// =============================================================================

describe('Κ2 — οι προϋπάρχουσες περιπτώσεις μένουν ακριβώς ίδιες', () => {
  it('σκέτη πώληση → μία γραμμή «Τιμή»', () => {
    expect(labelsOf(unit('for-sale', { askingPrice: 200_000 }))).toEqual([
      'card.stats.price',
    ]);
  });

  it('σκέτη ενοικίαση → μία γραμμή «Ενοίκιο»', () => {
    expect(labelsOf(unit('for-rent', { rentPrice: 500 }))).toEqual(['card.stats.rent']);
  });

  it('διπλό listing → «Πώληση» + «Ενοίκιο», με αυτή τη σειρά', () => {
    expect(
      labelsOf(unit('for-sale-and-rent', { askingPrice: 200_000, rentPrice: 500 })),
    ).toEqual(['card.stats.sale', 'card.stats.rent']);
  });

  it('χωρίς τιμή → καμία γραμμή τιμής (η απουσία λέγεται αλλού)', () => {
    expect(buildPropertyPriceStats(unit('for-sale', {}), t)).toEqual([]);
  });
});

// =============================================================================
// Κ3 — €/τ.μ.: δύο γραμμές μόνο όταν είναι ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΕΣ ΠΛΕΥΡΕΣ
// =============================================================================

describe('Κ3 — €/τ.μ. δεν τυπώνεται δύο φορές κάτω από την ίδια ετικέτα', () => {
  it('πωλημένο → ΜΙΑ γραμμή (και οι δύο αριθμοί είναι πώληση)', () => {
    const rows = buildPropertyPricePerSqmStats(
      unit('sold', { askingPrice: 200_000, finalPrice: 185_000 }),
      100,
      t,
    );
    // Δύο γραμμές «Πώληση/τ.μ.» με διαφορετικό νούμερο είναι γραμμή που ο
    // αναγνώστης δεν μπορεί να ερμηνεύσει.
    expect(rows.map((r) => r.label)).toEqual(['card.stats.salePricePerSqm']);
    // 185.000/100 = 1.850 — ΤΟΥ ΣΥΜΒΟΛΑΙΟΥ. Η ζητούμενη θα έδινε 2.000.
    // (Ο διαχωριστής χιλιάδων εξαρτάται από τη locale του περιβάλλοντος, γι'
    //  αυτό συγκρίνονται τα ψηφία, όχι η μορφοποίηση.)
    const digits = String(rows[0]?.value).replace(/\D/g, '');
    expect(digits).toBe('1850');
    expect(digits).not.toBe('2000');
  });

  it('διπλό listing → ΔΥΟ γραμμές (πώληση και ενοίκιο είναι άλλη πλευρά)', () => {
    const rows = buildPropertyPricePerSqmStats(
      unit('for-sale-and-rent', { askingPrice: 200_000, rentPrice: 500 }),
      100,
      t,
    );
    expect(rows.map((r) => r.label)).toEqual([
      'card.stats.salePricePerSqm',
      'card.stats.rentPricePerSqm',
    ]);
  });

  it('χωρίς εμβαδόν → καμία γραμμή', () => {
    expect(
      buildPropertyPricePerSqmStats(unit('sold', { finalPrice: 185_000 }), 0, t),
    ).toEqual([]);
  });
});

// =============================================================================
// Κ4 — Η ΔΙΑΝΥΚΤΕΡΕΥΣΗ (ADR-777 §8.60.13): ετικέτα, μονάδα, €/τ.μ., απουσία
// =============================================================================

describe('Κ4 — τιμή ανά νύχτα: ποτέ «Τιμή», ποτέ χωρίς μονάδα, ποτέ €/τ.μ.', () => {
  const nightly = shortStay({ nightlyRate: 50 });

  it('ετικέτα «Διανυκτέρευση», όχι η λέξη της πώλησης', () => {
    expect(labelsOf(nightly)).toEqual(['card.stats.nightly']);
  });

  it('η τιμή γράφεται με τη μονάδα της νύχτας — στη γραμμή ΚΑΙ στη συμπαγή κάρτα', () => {
    expect(buildPropertyPriceStats(nightly, t).map((s) => String(s.value)))
      .toEqual([expect.stringMatching(/^common:priceAmount.nightly:/)]);
    expect(buildCardPriceText(resolveDisplayPrice(nightly), t)?.headline)
      .toMatch(/^common:priceAmount.nightly:/);
  });

  it('🔴 €/τ.μ.: καμία γραμμή — και η κάρτα ΔΕΝ σκάει (πριν: destructuring σε undefined)', () => {
    expect(() => buildPropertyPricePerSqmStats(nightly, 85, t)).not.toThrow();
    expect(buildPropertyPricePerSqmStats(nightly, 85, t)).toEqual([]);
    expect(pricePerSqmAmount({ role: 'nightly', amount: 50 }, 85)).toBeNull();
  });

  it('το ενοίκιο κρατά τη μονάδα του μήνα και το €/τ.μ. του', () => {
    const rent = unit('for-rent', { rentPrice: 500 });
    expect(String(buildPropertyPriceStats(rent, t)[0]?.value)).toMatch(/^common:priceAmount.rent:/);
    expect(pricePerSqmAmount({ role: 'rent', amount: 500 }, 100)).toBe(5);
  });

  it('χωρίς καταχωρημένη τιμή νύχτας → δική της αιτία, όχι ωμό κλειδί', () => {
    const verdict = resolveDisplayPrice(shortStay({}));
    expect(verdict).toEqual({ kind: 'missing', reason: 'nightly-rate-missing' });
    expect(MISSING_PRICE_LABEL_KEYS['nightly-rate-missing']).toBe('card.price.nightlyMissing');
  });

  it('κάθε αιτία απουσίας έχει κλειδί (ο πίνακας είναι ΟΛΙΚΟΣ, όχι δείγμα)', () => {
    const reasons: readonly MissingPriceReason[] = [
      'not-listed', 'sale-price-missing', 'rent-price-missing', 'nightly-rate-missing',
    ];
    expect(Object.keys(MISSING_PRICE_LABEL_KEYS).sort()).toEqual([...reasons].sort());
  });
});

// =============================================================================
// Κ-ΑΠΟΣΥΡΣΗ — αποσυρμένο ακίνητο ΔΕΝ είναι προσφορά (ADR-281 · ADR-329 §3.9)
// =============================================================================

describe('αποσυρμένο ακίνητο: ετικέτα κύκλου ζωής, όχι εμπορική· τιμή ως ιστορικό', () => {
  const listed = { commercialStatus: 'for-sale', commercial: { askingPrice: 150_000 } };
  const live = listed as unknown as Property;
  const archived = { ...listed, status: 'archived' } as unknown as Property;
  const trashed = { ...listed, status: 'deleted' } as unknown as Property;

  const badgeLabels = (p: Property): string[] =>
    buildPropertyBadges('operationalStatus.ready', 'success', p, t).map((b) => b.label);

  it('ζωντανό: φυσική κατάσταση + εμπορική ετικέτα, καμία ετικέτα κύκλου ζωής', () => {
    const labels = badgeLabels(live);
    expect(labels[0]).toBe('operationalStatus.ready');
    expect(labels[1]).toBe('commercialStatus.for-sale');
    expect(labels).not.toContain('trash:archivedLabel');
  });

  // ADR-777 §8.87.8 — η γραμμή της λίστας λέει ό,τι και η κεφαλίδα της σελίδας, από τον ΙΔΙΟ κατασκευαστή.
  // Το `type` είναι γεγονός διάθεσης: χωρίς αυτό ο κριτής (`offeredAudienceOf`) δεν βλέπει προσφορά.
  const offered = { ...listed, type: 'apartment' };

  it('✅ παρονομαστής: διατίθεται χωρίς πεδίο κοινού ⇒ τρίτο σήμα «Δημόσια» (ADR-864 Α3)', () => {
    expect(badgeLabels(offered as unknown as Property)).toEqual([
      'operationalStatus.ready',
      'commercialStatus.for-sale',
      'marketingAudience.public',
    ]);
  });

  it('🔴 το σήμα κοινού της λίστας ΕΙΝΑΙ το σήμα κοινού της κεφαλίδας — για κάθε κοινό', () => {
    for (const marketingAudience of ['public', 'network', 'custodians'] as const) {
      const property = { ...offered, marketingAudience } as unknown as Property;
      const badges = buildPropertyBadges('operationalStatus.ready', 'success', property, t);
      const last = badges[badges.length - 1];
      expect(last?.label).toBe(`marketingAudience.${marketingAudience}`);
      expect(last).toEqual(buildListingAudienceBadge(property, t));
    }
  });

  it('🔴 ακίνητο που ΔΕΝ διατίθεται ⇒ κανένα σήμα κοινού στη λίστα (απουσία πεδίου ≠ «Δημόσια»)', () => {
    const unavailable = { ...offered, commercialStatus: 'unavailable' } as unknown as Property;
    const sold = { ...offered, commercialStatus: 'sold' } as unknown as Property;
    const retired = { ...offered, status: 'archived' } as unknown as Property;
    for (const property of [unavailable, sold, retired]) {
      expect(badgeLabels(property).some((label) => label.startsWith('marketingAudience.'))).toBe(false);
    }
  });

  it('🔴 στο αρχείο: ΠΡΩΤΗ η «Αρχειοθετημένο», η εμπορική ΛΕΙΠΕΙ, η φυσική μένει', () => {
    expect(badgeLabels(archived)).toEqual(['trash:archivedLabel', 'operationalStatus.ready']);
  });

  it('🔴 στον κάδο: «Στον κάδο», με άλλη απόχρωση από το αρχείο (εκεί δεν σβήνεται τίποτα)', () => {
    const [archivedBadge] = buildPropertyBadges('operationalStatus.ready', 'success', archived, t);
    const [trashedBadge] = buildPropertyBadges('operationalStatus.ready', 'success', trashed, t);
    expect(trashedBadge?.label).toBe('trash:trashedLabel');
    expect(trashedBadge?.variant).toBe('destructive');
    expect(archivedBadge?.variant).not.toBe('destructive');
  });

  it('🔴 η τιμή λέγεται «Τελευταία τιμή» — μία γραμμή, χωρίς το χρώμα της προσφοράς', () => {
    const liveRow = buildPropertyPriceStats(live, t)[0];
    const rows = buildPropertyPriceStats(archived, t);
    expect(rows.map((r) => r.label)).toEqual(['card.stats.lastPrice']);
    expect(rows[0]?.value).toBe(liveRow?.value);
    expect(rows[0]?.valueColor).toBeUndefined();
    expect(liveRow?.valueColor).toBeDefined();
    expect(labelsOf(trashed)).toEqual(['card.stats.lastPrice']);
  });

  it('ακίνητο με δύο σκέλη προσφοράς ⇒ ΜΙΑ γραμμή ιστορικού, όχι δύο', () => {
    const both = {
      commercialStatus: 'for-sale-and-rent',
      commercial: { askingPrice: 150_000, rentPrice: 500 },
      status: 'archived',
    } as unknown as Property;
    expect(labelsOf(both)).toEqual(['card.stats.lastPrice']);
  });
});

// =============================================================================
// Κ-ΣΗΜΑ — το ΕΝΑ σήμα κατάστασης της κεφαλίδας και του πλέγματος (ADR-777 §8.30.6 · ADR-329 §3.9)
// =============================================================================
//
// 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Το `resolvePropertyBadge` είχε δικό του `switch` με `default: available`:
// ακίνητο **εκτός αγοράς**, **στον κάδο** ή **στο αρχείο** έγραφε «Διαθέσιμο» στην κεφαλίδα της
// καρτέλας, ενώ η κάρτα της λίστας —από το SSoT— έγραφε «Μη διαθέσιμο» / «Στον κάδο». Μετρήθηκε
// ζωντανά 2026-10-07 σε δύο ακίνητα. Δεν είχε κανένα test.

describe('το σήμα κατάστασης: η πραγματική κατάσταση, ποτέ «Διαθέσιμο» από προεπιλογή', () => {
  const of = (fields: Record<string, unknown>): Property => fields as unknown as Property;
  const labelOf = (fields: Record<string, unknown>): string | undefined =>
    buildPropertyStatusBadge(of(fields), t)?.label;

  it('🔴 εκτός αγοράς ⇒ «Μη διαθέσιμο», όχι «Διαθέσιμο»', () => {
    expect(labelOf({ commercialStatus: 'unavailable' })).toBe('commercialStatus.unavailable');
  });

  it('🔴 κάθε εμπορική κατάσταση λέει το ΔΙΚΟ της όνομα (ενοικίαση ≠ πώληση, ενοικιάστηκε ≠ πωλήθηκε)', () => {
    const statuses = ['unavailable', 'for-sale', 'for-rent', 'for-sale-and-rent', 'reserved', 'sold', 'rented'];
    const labels = statuses.map((commercialStatus) => labelOf({ commercialStatus }));
    expect(labels).toEqual(statuses.map((status) => `commercialStatus.${status}`));
  });

  it('🔴 αποσυρμένο με ΠΑΛΙΟ `commercialStatus` ⇒ η ετικέτα κύκλου ζωής, όχι η εμπορική', () => {
    expect(labelOf({ commercialStatus: 'for-sale', status: 'archived' })).toBe('trash:archivedLabel');
    expect(labelOf({ commercialStatus: 'for-sale', status: 'deleted' })).toBe('trash:trashedLabel');
  });

  it('παλιό έγγραφο χωρίς `commercialStatus` ⇒ το `status` ως εφεδρεία (ADR-258)', () => {
    expect(labelOf({ status: 'for-rent' })).toBe('commercialStatus.for-rent');
  });

  it('🔴 άγνωστη κατάσταση ⇒ ΚΑΝΕΝΑ σήμα — ποτέ εικασία', () => {
    expect(buildPropertyStatusBadge(of({ commercialStatus: 'κάτι-άλλο' }), t)).toBeNull();
    expect(buildPropertyStatusBadge(of({}), t)).toBeNull();
  });

  it('ίδιο σήμα αποσυρμένου με την κάρτα της λίστας (ΕΝΑΣ πίνακας, όχι δύο)', () => {
    const trashed = of({ commercialStatus: 'for-sale', status: 'deleted' });
    const [fromList] = buildPropertyBadges('operationalStatus.ready', 'success', trashed, t);
    expect(buildPropertyStatusBadge(trashed, t)).toEqual(fromList);
  });

  // Ν7 (2026-10-08) — η κάρτα της «Διαχείρισης» έκοβε το εμπορικό σήμα με `isEditorCommercialStatus`:
  // κρατημένο / πωλημένο / ενοικιασμένο έγραφαν ΜΟΝΟ τη φυσική κατάσταση («Ημιτελές»). Η αιτιολογία του
  // φίλτρου («τις δείχνει ήδη το κύριο σήμα») πέθανε μαζί με το `resolvePropertyBadge`.
  it('🔴 η κάρτα λίστας/πλέγματος δείχνει ΚΑΙ τις επτά — το ΙΔΙΟ σήμα με την κεφαλίδα', () => {
    const statuses = ['unavailable', 'for-sale', 'for-rent', 'for-sale-and-rent', 'reserved', 'sold', 'rented'];
    for (const commercialStatus of statuses) {
      const property = of({ commercialStatus });
      const [, second] = buildPropertyBadges('operationalStatus.under-construction', 'warning', property, t);
      expect(second?.label).toBe(`commercialStatus.${commercialStatus}`);
      expect(second).toEqual(buildPropertyStatusBadge(property, t));
    }
  });

  it('🔴 παλιό έγγραφο χωρίς `commercialStatus` ⇒ η κάρτα διαβάζει την ΙΔΙΑ εφεδρεία με την κεφαλίδα', () => {
    const legacy = of({ status: 'sold' });
    const [, second] = buildPropertyBadges('operationalStatus.ready', 'success', legacy, t);
    expect(second).toEqual(buildPropertyStatusBadge(legacy, t));
    expect(second?.label).toBe('commercialStatus.sold');
  });

  it('άγνωστη κατάσταση ⇒ η κάρτα μένει με τη φυσική μόνο — κανένα σήμα από εικασία', () => {
    expect(buildPropertyBadges('operationalStatus.ready', 'success', of({}), t)).toHaveLength(1);
  });
});

// =============================================================================
// Κ-ΣΤΑΘΜΗ — ΠΟΣΟ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΠΡΟΣΦΟΡΑ ΔΕΝ ΦΟΡΑ ΤΟ ΧΡΩΜΑ ΤΗΣ (ADR-329 §3.9 · Ν3)
// =============================================================================

/**
 * 🔴 Μετρημένο ζωντανά 2026-10-08: «Τιμή 100.000 €» στο πράσινο της προσφοράς για ακίνητο «Μη
 * διαθέσιμο», σε κάρτα **και** κεφαλίδα· και για ακίνητο στον κάδο, η κάρτα έλεγε «Τελευταία τιμή»
 * ενώ η κεφαλίδα του ίδιου ακινήτου «Τιμή». Η λέξη έρχεται πλέον από τη **στάθμη** της ετυμηγορίας.
 */
describe('Κ-ΣΤΑΘΜΗ — η λέξη και το χρώμα ακολουθούν το `standing`', () => {
  const offMarket = unit('unavailable', { askingPrice: 100_000 });
  const forSale = unit('for-sale', { askingPrice: 100_000 });
  const trashedForSale = { ...forSale, status: 'deleted' } as unknown as Property;

  it('🔴 εκτός αγοράς: ΜΙΑ γραμμή «Τιμή ζήτησης», το ποσό μένει, χωρίς το χρώμα της προσφοράς', () => {
    const rows = buildPropertyPriceStats(offMarket, t);
    expect(rows.map((r) => r.label)).toEqual(['card.stats.askingPrice']);
    expect(rows[0]?.value).toBe(buildPropertyPriceStats(forSale, t)[0]?.value);
    expect(rows[0]?.valueColor).toBeUndefined();
    expect(buildPropertyPriceStats(forSale, t)[0]?.valueColor).toBeDefined();
  });

  it('κρατημένο ακίνητο ΕΙΝΑΙ συναλλαγή σε εξέλιξη ⇒ «Τιμή», με το χρώμα της (Zillow «Pending»)', () => {
    const rows = buildPropertyPriceStats(unit('reserved', { askingPrice: 100_000 }), t);
    expect(rows.map((r) => r.label)).toEqual(['card.stats.price']);
    expect(rows[0]?.valueColor).toBeDefined();
  });

  it('🔴 συμπαγής κάρτα / κεφαλίδα: η προσφορά ΔΕΝ έχει σημείωση στάθμης, το εκτός αγοράς έχει', () => {
    expect(buildCardPriceText(resolveDisplayPrice(forSale), t)?.standingLabel).toBeNull();
    expect(buildCardPriceText(resolveDisplayPrice(offMarket), t)).toEqual({
      headline: buildCardPriceText(resolveDisplayPrice(forSale), t)?.headline,
      secondary: null,
      standingLabel: 'card.stats.askingPrice',
    });
  });

  it('🔴 κεφαλίδα και κάρτα λένε την ΙΔΙΑ λέξη για το ίδιο αποσυρμένο ακίνητο', () => {
    const header = buildCardPriceText(resolveDisplayPrice(trashedForSale), t);
    expect(header?.standingLabel).toBe('card.stats.lastPrice');
    expect([header?.standingLabel]).toEqual(labelsOf(trashedForSale));
  });

  it('αποσυρμένο με δύο σκέλη ⇒ καμία δεύτερη τιμή και στη συμπαγή όψη (ιστορικό, όχι προσφορά)', () => {
    const both = {
      commercialStatus: 'for-sale-and-rent',
      commercial: { askingPrice: 150_000, rentPrice: 500 },
      status: 'archived',
    } as unknown as Property;
    expect(buildCardPriceText(resolveDisplayPrice(both), t)?.secondary).toBeNull();
  });
});
