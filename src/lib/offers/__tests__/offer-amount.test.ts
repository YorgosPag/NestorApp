/**
 * @fileoverview **Το ποσό ανά ΔΙΑΘΕΣΗ** — και η **απόδειξη** ότι συμφωνεί με την Α22.
 * @related ADR-777 §7 (Α20 · Α22) · §8.7 · lib/offers/offer-amount.ts
 */

import {
  EXCHANGE_PERCENTAGE_MAX_INCLUSIVE,
  liveOfferAmountGaps,
  offerAmount,
  offerAmountMissing,
  offerPercentageOutOfRange,
} from '../offer-amount';
import { deriveCommercialStatus } from '../derive-commercial-status';
import { requiresAskingPrice, requiresRentPrice } from '@/constants/commercial-statuses';
import {
  OFFER_KINDS,
  OFFER_LIFECYCLES,
  type OfferKind,
  type OfferLifecycle,
  type PropertyOffer,
} from '@/types/property-offers';

// =============================================================================
// ΕΡΓΑΛΕΙΑ — μία γεννήτρια, ώστε τα σχήματα να μη γράφονται με το χέρι
// =============================================================================

function offerOf(
  kind: OfferKind,
  lifecycle: OfferLifecycle,
  amount: number | null,
): PropertyOffer {
  const id = `offr_${kind}_${lifecycle}`;
  switch (kind) {
    case 'sell':
      return { id, kind, lifecycle, askingPrice: amount };
    case 'leaseOut':
      return { id, kind, lifecycle, rentPrice: amount };
    case 'exchange':
      return { id, kind, lifecycle, percentage: amount };
  }
}

// =============================================================================
// Μ — Η ΜΗΧΑΝΗ
// =============================================================================

describe('offerAmount — ο τύπος ΕΙΝΑΙ ο κανόνας', () => {
  it('Μ1 — κάθε είδος επιστρέφει ΤΟ ΔΙΚΟ ΤΟΥ ποσό', () => {
    expect(offerAmount(offerOf('sell', 'active', 210000))).toBe(210000);
    expect(offerAmount(offerOf('leaseOut', 'active', 800))).toBe(800);
    expect(offerAmount(offerOf('exchange', 'active', 45))).toBe(45);
  });

  it('Μ2 — κάθε είδος του κλειστού συνόλου έχει απάντηση (κανένα σιωπηλό default)', () => {
    for (const kind of OFFER_KINDS) {
      expect(offerAmount(offerOf(kind, 'active', 7))).toBe(7);
    }
  });

  it('Μ3 — το `0` μετράει ως ΑΠΟΥΣΙΑ (Α22: «ψευδής τιμή πχ 1€» απαγορεύεται)', () => {
    expect(offerAmountMissing(offerOf('sell', 'active', 0))).toBe(true);
    expect(offerAmountMissing(offerOf('sell', 'active', 1))).toBe(false);
  });

  it('Μ4 — το `null` μετράει ως απουσία, το αρνητικό επίσης', () => {
    expect(offerAmountMissing(offerOf('leaseOut', 'active', null))).toBe(true);
    expect(offerAmountMissing(offerOf('leaseOut', 'active', -5))).toBe(true);
  });
});

describe('offerPercentageOutOfRange — ξεχωριστό ερώτημα από την απουσία', () => {
  it('Μ5 — μόνο η αντιπαροχή κρίνεται· τα άλλα δύο επιστρέφουν πάντα false', () => {
    expect(offerPercentageOutOfRange(offerOf('sell', 'active', 250))).toBe(false);
    expect(offerPercentageOutOfRange(offerOf('leaseOut', 'active', 5000))).toBe(false);
  });

  it('Μ6 — το εύρος είναι (0, 100]', () => {
    expect(offerPercentageOutOfRange(offerOf('exchange', 'active', 0))).toBe(true);
    expect(offerPercentageOutOfRange(offerOf('exchange', 'active', 1))).toBe(false);
    expect(
      offerPercentageOutOfRange(
        offerOf('exchange', 'active', EXCHANGE_PERCENTAGE_MAX_INCLUSIVE),
      ),
    ).toBe(false);
    expect(
      offerPercentageOutOfRange(
        offerOf('exchange', 'active', EXCHANGE_PERCENTAGE_MAX_INCLUSIVE + 1),
      ),
    ).toBe(true);
  });

  it('Μ7 — το `null` ΔΕΝ είναι «εκτός εύρους»: είναι απουσία, και το λέει η άλλη', () => {
    const empty = offerOf('exchange', 'active', null);
    expect(offerPercentageOutOfRange(empty)).toBe(false);
    expect(offerAmountMissing(empty)).toBe(true);
  });
});

describe('liveOfferAmountGaps — μόνο οι ΖΩΝΤΑΝΕΣ, ονομαστικά', () => {
  it('Μ8 — επιστρέφει ΕΙΔΗ, όχι πλήθος (Α22: «το λέμε καθαρά στον ιδιοκτήτη»)', () => {
    const gaps = liveOfferAmountGaps([
      offerOf('sell', 'active', null),
      offerOf('leaseOut', 'active', 800),
    ]);
    expect(gaps.missing).toEqual(['sell']);
  });

  it('Μ9 — μια ΑΠΟΣΥΡΜΕΝΗ διάθεση χωρίς ποσό ΔΕΝ μπλοκάρει', () => {
    const gaps = liveOfferAmountGaps([
      offerOf('sell', 'withdrawn', null),
      offerOf('leaseOut', 'active', 800),
    ]);
    expect(gaps.missing).toEqual([]);
  });

  it('Μ10 — κενός/απών πίνακας δεν έχει κενά (και δεν πετά)', () => {
    expect(liveOfferAmountGaps([]).missing).toEqual([]);
    expect(liveOfferAmountGaps(null).missing).toEqual([]);
    expect(liveOfferAmountGaps(undefined).percentageOutOfRange).toEqual([]);
  });
});

// =============================================================================
// Α — Η ΑΠΟΔΕΙΞΗ ΣΥΜΦΩΝΙΑΣ ΜΕ ΤΟ ΥΠΑΡΧΟΝ SSoT ΤΗΣ Α22
// =============================================================================

/**
 * 🔴 **Ο λόγος που αυτή η ομάδα υπάρχει.**
 *
 * Το §8.7 έμαθε με κόστος ότι *«ένα σχόλιο που δηλώνει συμφωνία **δεν είναι**
 * συμφωνία»*: η προηγούμενη πύλη τιμής ισχυριζόταν συνέπεια με το alert και για
 * `for-rent` **αρνιόταν** ό,τι το alert **υποσχόταν**.
 *
 * Άρα η συμφωνία εδώ **δεν δηλώνεται — εκτελείται**: για **κάθε** συνδυασμό ειδών και
 * κύκλων ζωής, η σύνθεση `deriveCommercialStatus` → `requiresAskingPrice` /
 * `requiresRentPrice` πρέπει να συμφωνεί με το τι κρίνει αυτό το αρχείο, **για τα δύο
 * είδη που το παλιό λεξιλόγιο μπορεί να εκφράσει**.
 */
describe('🔑 Α — συμφωνία με τα υπάρχοντα κατηγορήματα της Α22, ΕΚΤΕΛΕΣΜΕΝΗ', () => {
  it('Α1 — για κάθε σχήμα διαθέσεων, «η κατάσταση ζητά τιμή πώλησης» ⇔ «υπάρχει ζωντανή sell»', () => {
    for (const lifecycle of OFFER_LIFECYCLES) {
      for (const kind of OFFER_KINDS) {
        const offers = [offerOf(kind, lifecycle, 100)];
        const status = deriveCommercialStatus(offers);

        // Το παλιό λεξιλόγιο ζητά `askingPrice` **μόνο** σε ενεργή πώληση.
        const legacyWantsAsking = requiresAskingPrice(status);
        const liveActiveSell = kind === 'sell' && lifecycle === 'active';

        expect(legacyWantsAsking).toBe(liveActiveSell);
      }
    }
  });

  it('Α2 — το ίδιο για το ενοίκιο', () => {
    for (const lifecycle of OFFER_LIFECYCLES) {
      for (const kind of OFFER_KINDS) {
        const status = deriveCommercialStatus([offerOf(kind, lifecycle, 100)]);
        expect(requiresRentPrice(status)).toBe(kind === 'leaseOut' && lifecycle === 'active');
      }
    }
  });

  /**
   * 🔴 **ΤΟ ΚΕΝΟ ΠΟΥ ΓΕΝΝΗΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ, ΩΣ ΕΚΤΕΛΕΣΜΕΝΗ ΜΕΤΡΗΣΗ.**
   *
   * Μια **αντιπαροχή χωρίς ποσοστό** προβάλλεται σε `'unavailable'`, και το
   * `'unavailable'` **δεν ζητά καμία τιμή** από τα δύο υπάρχοντα κατηγορήματα. Δηλαδή
   * η Α22, όπως ήταν γραμμένη, **δομικά δεν μπορούσε να τη δει**.
   *
   * Αυτή η δοκιμή είναι ο **παρονομαστής**: αποδεικνύει ότι το κενό είναι πραγματικό
   * (τα δύο κατηγορήματα λένε «όλα καλά») **και** ότι το νέο κριτήριο το πιάνει.
   */
  it('🔴 Α3 — αντιπαροχή ΧΩΡΙΣ ποσοστό: τα παλιά κατηγορήματα λένε «εντάξει», το νέο ΟΧΙ', () => {
    const offers = [offerOf('exchange', 'active', null)];
    const status = deriveCommercialStatus(offers);

    // Ο παρονομαστής — το παλιό λεξιλόγιο δεν έχει λέξη να το ζητήσει.
    expect(status).toBe('unavailable');
    expect(requiresAskingPrice(status)).toBe(false);
    expect(requiresRentPrice(status)).toBe(false);

    // Το νέο κριτήριο, στο επίπεδο της διάθεσης.
    expect(liveOfferAmountGaps(offers).missing).toEqual(['exchange']);
  });
});
