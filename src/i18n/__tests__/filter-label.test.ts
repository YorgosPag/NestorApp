/**
 * ΑΓΚΥΡΕΣ — **ο αποκωδικοποιητής ετικέτας φίλτρου** (ADR-823 §14)
 *
 * ## Το περιστατικό
 *
 * Οι σταθερές των φίλτρων κωδικοποιούν το namespace με **τελεία**
 * (`'parking.status.available'`). Δύο καταναλωτές τις διάβαζαν: το `FilterField`
 * **ήξερε** τη σύμβαση, το `CompactToolbar` **όχι** — έγραφε
 * `t(label, { ns: 'common' })`. Ζωντανά, με το bundle **πλήρες**:
 *
 * ```
 * raw key reached the UI → common:parking.types.electric   bundles:["common=complete"]
 * ```
 *
 * ⚠️ **ΜΕΤΡΑΜΕ ΤΗ ΔΡΟΜΟΛΟΓΗΣΗ, ΟΧΙ ΤΗΝ ΚΛΗΣΗ.** Άγκυρα που ζητούσε «κλήθηκε το
 * `t`;» θα ήταν πράσινη και πάνω στο **σπασμένο** `{ ns: 'common' }`. Εδώ ο
 * κατάσκοπος **καταγράφει ποιο namespace ζητήθηκε** — αυτό ήταν το σφάλμα.
 *
 * @see ADR-823 §14
 */

import {
  translateFilterLabel,
  splitFilterLabel,
  FILTER_LABEL_NAMESPACES,
} from '../filter-label';

/** Κατάσκοπος: θυμάται **τι** ζητήθηκε, όχι μόνο **ότι** ζητήθηκε. */
function spy() {
  const calls: { key: string; ns?: string }[] = [];
  const t = (key: string, options?: Record<string, unknown>) => {
    calls.push({ key, ns: options?.ns as string | undefined });
    return `«${options?.ns ?? '?'}:${key}»`;
  };
  return { t, calls };
}

describe('splitFilterLabel — η απόφαση, χωρίς i18next', () => {
  it('🔑 σπάει στο ΠΡΩΤΟ τμήμα και κρατά το υπόλοιπο ΑΚΕΡΑΙΟ', () => {
    expect(splitFilterLabel('parking.status.available')).toEqual({
      namespace: 'parking',
      key: 'status.available',
    });
    // ⚠️ Το κλειδί έχει κι άλλες τελείες — δεν επιτρέπεται να κοπεί ξανά.
    expect(splitFilterLabel('filters.parking.ariaLabels.search')).toEqual({
      namespace: 'filters',
      key: 'parking.ariaLabels.search',
    });
  });

  it('άγνωστο πρόθεμα ΔΕΝ θεωρείται namespace', () => {
    // Αυτό είναι που κρατά ασφαλή τη σύμβαση: `operationalStatus` ΔΕΝ υπάρχει
    // ως namespace, άρα το κλειδί πρέπει να μείνει ολόκληρο.
    expect(splitFilterLabel('operationalStatus.ready')).toBeNull();
    expect(splitFilterLabel('quotes.sources.manual')).toBeNull(); // δεν είναι στη λίστα
  });

  it('εκφυλισμένες μορφές δεν σπάνε', () => {
    expect(splitFilterLabel('parking')).toBeNull();      // χωρίς τελεία
    expect(splitFilterLabel('parking.')).toBeNull();     // κενό κλειδί
    expect(splitFilterLabel('.status')).toBeNull();      // κενό namespace
  });

  it('η λίστα namespaces είναι κλειστή και μη κενή', () => {
    expect(FILTER_LABEL_NAMESPACES.length).toBeGreaterThan(3);
    expect(FILTER_LABEL_NAMESPACES).toContain('parking');
    expect(FILTER_LABEL_NAMESPACES).toContain('filters');
    expect(FILTER_LABEL_NAMESPACES).toContain('building');
  });
});

describe('translateFilterLabel — ΠΟΙΟ namespace ζητήθηκε', () => {
  it('🔴 ΤΟ ΣΦΑΛΜΑ: το parking ΔΕΝ ζητιέται από το common', () => {
    const { t, calls } = spy();
    translateFilterLabel(t, 'parking.status.available');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ key: 'status.available', ns: 'parking' });
    // Η ρητή άρνηση του παλιού λάθους:
    expect(calls[0]!.ns).not.toBe('common');
  });

  it('όλες οι σταθερές του parking δρομολογούνται στο parking', () => {
    for (const label of [
      'parking.types.standard', 'parking.types.handicapped', 'parking.types.motorcycle',
      'parking.types.electric', 'parking.types.visitor',
      'parking.status.available', 'parking.status.occupied', 'parking.status.reserved',
      'parking.status.sold', 'parking.status.maintenance',
    ]) {
      const { t, calls } = spy();
      translateFilterLabel(t, label);
      expect(calls[0]!.ns).toBe('parking');
      expect(calls[0]!.key).toBe(label.slice('parking.'.length));
    }
  });

  it('οι ετικέτες ορόφου δρομολογούνται στο building', () => {
    const { t, calls } = spy();
    translateFilterLabel(t, 'building.floors.basementMinus2');
    expect(calls[0]).toEqual({ key: 'floors.basementMinus2', ns: 'building' });
  });

  it('οι ετικέτες του shared.ts δρομολογούνται στο filters', () => {
    const { t, calls } = spy();
    translateFilterLabel(t, 'filters.placeholders.selectStatus');
    expect(calls[0]).toEqual({ key: 'placeholders.selectStatus', ns: 'filters' });
  });

  it('κενή/απούσα ετικέτα → κενό, ΧΩΡΙΣ κλήση μετάφρασης', () => {
    for (const empty of [undefined, null, '']) {
      const { t, calls } = spy();
      expect(translateFilterLabel(t, empty)).toBe('');
      expect(calls).toHaveLength(0);
    }
  });

  it('δυναμική ΤΙΜΗ (χωρίς τελεία) επιστρέφεται ΑΤΟΦΙΑ — δεν μεταφράζεται', () => {
    // Ονόματα πόλεων, κωδικοί κτιρίων κ.λπ. Αν περνούσαν από το `t`, θα έβγαιναν
    // ως κλειδιά που δεν υπάρχουν — δηλαδή ωμά, ακριβώς το σφάλμα ανάποδα.
    const { t, calls } = spy();
    expect(translateFilterLabel(t, 'Θεσσαλονίκη')).toBe('Θεσσαλονίκη');
    expect(calls).toHaveLength(0);
  });

  it('κλειδί με τελεία αλλά ΧΩΡΙΣ γνωστό namespace πάει στο προεπιλεγμένο', () => {
    const { t, calls } = spy();
    translateFilterLabel(t, 'operationalStatus.ready');
    expect(calls[0]).toEqual({ key: 'operationalStatus.ready', ns: undefined });
  });
});
