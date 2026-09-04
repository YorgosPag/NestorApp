/**
 * Άγκυρες — **«ΤΟ ΙΔΙΟ»** (ADR-777 Α9 · SPEC-777B §12.6).
 *
 * **Σ — ΣΥΜΜΕΤΡΙΑ.** Αν το «ο Α είναι όμοιος με τον Β» δεν συνεπαγόταν το αντίστροφο,
 * δύο άνθρωποι θα έβλεπαν **διαφορετικό** αριθμό ανταγωνιστών για την ίδια αγορά.
 *
 * **Γ — ΓΕΝΝΑΙΟΔΩΡΙΑ.** Το κριτήριο μετρά **περισσότερους**, ποτέ λιγότερους — και
 * αυτό είναι η **σωστή** κατεύθυνση σφάλματος: μια γενναιόδωρη εκτίμηση είναι
 * ειλικρινής προειδοποίηση, μια στενή είναι ψεύτικη ησυχία.
 *
 * **Δ — ΔΙΑΚΡΙΣΗ.** Και δεν είναι «όλοι όμοιοι με όλους»: ένα κριτήριο που δεν
 * απορρίπτει ποτέ είναι φρουρός χωρίς απόδειξη ζωής (ADR-749 §5).
 */

import { demandsAreSimilar, selectSimilarDemands } from '../demand-similarity';
import { NO_DEMAND_FEATURES, type PropertyDemand } from '@/types/property-demand';
import { demand } from './demand-fixtures';

/** Θεσσαλονίκη. */
const THESSALONIKI = { lat: 40.64, lng: 22.94 };
/** Αθήνα — ~300 χλμ. μακριά. */
const ATHENS = { lat: 37.98, lng: 23.73 };

function near(center: { lat: number; lng: number }, radiusKm: number): PropertyDemand {
  return demand({ place: { kind: 'near', center, radiusKm } });
}

describe('🔴 Σ — συμμετρία', () => {
  const PAIRS: readonly (readonly [PropertyDemand, PropertyDemand])[] = [
    [demand(), demand({ seeks: ['leaseOut'] })],
    [near(THESSALONIKI, 5), near(ATHENS, 5)],
    [near(THESSALONIKI, 5), demand()],
    [
      demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 100_000 } }),
      demand({ features: { ...NO_DEMAND_FEATURES, priceMin: 200_000 } }),
    ],
  ];

  it.each(PAIRS.map((pair, index) => [index, pair] as const))(
    'ζεύγος %i: η ομοιότητα διαβάζεται το ίδιο και από τις δύο πλευρές',
    (_index, [a, b]) => {
      expect(demandsAreSimilar(a, b)).toBe(demandsAreSimilar(b, a));
    },
  );
});

describe('🔴 Δ — το κριτήριο ΟΝΤΩΣ απορρίπτει', () => {
  it('άλλο είδος συναλλαγής ⇒ όχι όμοιες', () => {
    // Ο αγοραστής και ο ενοικιαστής **δεν** ανταγωνίζονται για την ίδια αγγελία.
    expect(demandsAreSimilar(demand({ seeks: ['sell'] }), demand({ seeks: ['leaseOut'] }))).toBe(
      false,
    );
  });

  it('άλλη πόλη ⇒ όχι όμοιες', () => {
    expect(demandsAreSimilar(near(THESSALONIKI, 5), near(ATHENS, 5))).toBe(false);
  });

  it('εύρη τιμής που δεν τέμνονται ⇒ όχι όμοιες', () => {
    expect(
      demandsAreSimilar(
        demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 100_000 } }),
        demand({ features: { ...NO_DEMAND_FEATURES, priceMin: 200_000 } }),
      ),
    ).toBe(false);
  });

  it('άλλα είδη ακινήτου ⇒ όχι όμοιες', () => {
    expect(
      demandsAreSimilar(
        demand({ features: { ...NO_DEMAND_FEATURES, types: ['shop'] } }),
        demand({ features: { ...NO_DEMAND_FEATURES, types: ['apartment'] } }),
      ),
    ).toBe(false);
  });
});

describe('🔴 Γ — γενναιοδωρία: ό,τι ΘΑ μπορούσε να ανταγωνιστεί, μετράει', () => {
  it('🔑 ΓΕΙΤΟΝΙΚΕΣ περιοχές που επικαλύπτονται ⇒ όμοιες', () => {
    // Δύο κύκλοι 10 χλμ. με κέντρα 8 χλμ. μακριά **βλέπουν τα ίδια ακίνητα στη μέση**.
    // Ένα κριτήριο ισότητας κέντρου θα έλεγε «κανένας άλλος» και θα ήταν ψευδές.
    const a = near(THESSALONIKI, 10);
    const b = near({ lat: 40.71, lng: 22.94 }, 10);
    expect(demandsAreSimilar(a, b)).toBe(true);
  });

  it('🔑 ΓΕΙΤΟΝΙΚΟΙ προϋπολογισμοί που επικαλύπτονται ⇒ όμοιες', () => {
    // «ως 250.000» και «ως 260.000» ανταγωνίζονται για τα ίδια ακίνητα.
    expect(
      demandsAreSimilar(
        demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 250_000 } }),
        demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 260_000 } }),
      ),
    ).toBe(true);
  });

  it('«οπουδήποτε» τέμνεται με τα πάντα — είναι κυριολεκτικά οπουδήποτε', () => {
    expect(demandsAreSimilar(demand(), near(ATHENS, 1))).toBe(true);
  });

  it('κενό σύνολο ειδών σημαίνει «όλα», όχι «κανένα»', () => {
    expect(
      demandsAreSimilar(demand(), demand({ features: { ...NO_DEMAND_FEATURES, types: ['shop'] } })),
    ).toBe(true);
  });

  it('🔴 άξονας που ΔΕΝ ταξιδεύει στην προβολή ΔΕΝ στενεύει την ομοιότητα', () => {
    // Ο χρόνος και η γειτονιά χάνονται στα φίλτρα — άρα δεν κρίνονται εδώ. Ο ΟΡΟΦΟΣ
    // ταξιδεύει πλέον, αλλά ΔΕΝ μπήκε εδώ: δες τη σημείωση πάνω από το `labels`.
    // Είναι το δηλωμένο, σκόπιμο όριο: μετράμε περισσότερους, ποτέ λιγότερους.
    const a = demand({ timing: { kind: 'window', fromDate: '2027-01-01', toDate: '2027-12-31' } });
    const b = demand({ timing: { kind: 'now' } });
    expect(demandsAreSimilar(a, b)).toBe(true);
  });
});

describe('🔴 selectSimilarDemands — ΔΕΝ αφαιρεί τον εαυτό της', () => {
  it('η ίδια η ζήτηση περιλαμβάνεται· ο αποκλεισμός είναι δουλειά του καλούντος', () => {
    // «Όμοια» και «άλλη» είναι **δύο** ερωτήσεις — και μια ζήτηση είναι, προφανώς,
    // όμοια με τον εαυτό της.
    const me = demand({ id: 'dmnd_me' });
    const others = [me, demand({ id: 'dmnd_1' }), near(ATHENS, 1)];
    const similar = selectSimilarDemands(me, others);

    expect(similar.map((entry) => entry.id)).toEqual(['dmnd_me', 'dmnd_1', 'dmnd_1']);
  });
});
