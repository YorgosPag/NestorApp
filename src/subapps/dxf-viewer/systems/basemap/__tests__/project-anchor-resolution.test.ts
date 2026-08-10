/**
 * ADR-782 §21 — άγκυρες `Α1`-`Α14` για την κρίση «δίνει η διεύθυνση του έργου θέση;».
 *
 * ⚠️ Οι άγκυρες κρίνουν **συμπεριφορά**, όχι υλοποίηση: καμία δεν καρφώνει το `0.7`. Το κατώφλι
 * διαβάζεται από το SSoT (`SUGGESTION_DEFAULTS`) και τα δείγματα χτίζονται **γύρω του** — έτσι μια
 * μελλοντική αλλαγή πολιτικής μετακινεί τα tests μαζί της, ενώ η αντικατάσταση του SSoT με τοπικό
 * αριθμό (η βλάβη που φοβόμαστε) τα ρίχνει.
 */

import { SUGGESTION_DEFAULTS } from '@/lib/geocoding/geocoding-thresholds';
import type { ProjectAddress } from '@/types/project/addresses';
import { resolveProjectAnchor } from '../project-anchor-resolution';

const THRESHOLD = SUGGESTION_DEFAULTS.lowConfidenceThreshold;

/** Θεσσαλονίκη — πραγματικό σημείο, ώστε καμία άγκυρα να μην περνά χάρη σε μηδενικά. */
const THESSALONIKI = { lat: 40.6401, lng: 22.9444 } as const;

function address(overrides: Partial<ProjectAddress> = {}): ProjectAddress {
  return {
    id: 'addr_test',
    street: 'Σαμοθράκης',
    number: '16',
    city: 'Θεσσαλονίκη',
    postalCode: '54621',
    country: 'Greece',
    type: 'site',
    isPrimary: true,
    coordinates: { ...THESSALONIKI },
    ...overrides,
  };
}

function metadata(
  overrides: Partial<NonNullable<ProjectAddress['geocodingMetadata']>> = {},
): NonNullable<ProjectAddress['geocodingMetadata']> {
  return { confidence: 0.9, accuracy: 'exact', variantUsed: 1, ...overrides };
}

describe('resolveProjectAnchor — απουσία δεδομένων (Α1-Α3)', () => {
  it('Α1 — καμία διεύθυνση ⇒ no-address', () => {
    expect(resolveProjectAnchor(undefined)).toEqual({ kind: 'refused', reason: 'no-address' });
  });

  it('Α2 — κενός πίνακας διευθύνσεων ⇒ no-address (όχι σφάλμα)', () => {
    expect(resolveProjectAnchor([])).toEqual({ kind: 'refused', reason: 'no-address' });
  });

  it('Α3 — διεύθυνση χωρίς συντεταγμένες ⇒ no-coordinates, ΞΕΧΩΡΙΣΤΟ από no-address', () => {
    const result = resolveProjectAnchor([address({ coordinates: undefined })]);
    expect(result).toEqual({ kind: 'refused', reason: 'no-coordinates' });
  });
});

describe('resolveProjectAnchor — εγκυρότητα σημείου (Α4-Α6)', () => {
  it('Α4 — «Null Island» (0,0) ⇒ invalid-coordinates, όχι αποδεκτό σημείο', () => {
    const result = resolveProjectAnchor([address({ coordinates: { lat: 0, lng: 0 } })]);
    expect(result).toEqual({ kind: 'refused', reason: 'invalid-coordinates' });
  });

  it('Α5 — εκτός ορίων Γης ⇒ invalid-coordinates', () => {
    const result = resolveProjectAnchor([address({ coordinates: { lat: 91, lng: 22.9 } })]);
    expect(result).toEqual({ kind: 'refused', reason: 'invalid-coordinates' });
  });

  it('Α6 — NaN ⇒ invalid-coordinates (δεν διαρρέει ως θέση)', () => {
    const result = resolveProjectAnchor([address({ coordinates: { lat: Number.NaN, lng: 22.9 } })]);
    expect(result).toEqual({ kind: 'refused', reason: 'invalid-coordinates' });
  });
});

describe('resolveProjectAnchor — ποιότητα γεωκωδικοποίησης (Α7-Α10)', () => {
  it('Α7 — ΚΡΙΣΙΜΗ ΣΕΙΡΑ: «κέντρο οικισμού» με ΥΨΗΛΗ βεβαιότητα ⇒ too-coarse', () => {
    // Η χειρότερη περίπτωση που υπάρχει: απόλυτα σίγουρη και χιλιόμετρα λάθος. Αν κρινόταν
    // πρώτα η βεβαιότητα, αυτή ακριβώς θα περνούσε — και ο χάρτης θα έμοιαζε σωστός.
    const result = resolveProjectAnchor([
      address({ geocodingMetadata: metadata({ accuracy: 'center', confidence: 0.99 }) }),
    ]);
    expect(result).toEqual({ kind: 'refused', reason: 'too-coarse' });
  });

  it('Α8 — βεβαιότητα κάτω από το κατώφλι του SSoT ⇒ low-confidence', () => {
    const result = resolveProjectAnchor([
      address({ geocodingMetadata: metadata({ confidence: THRESHOLD - 0.01 }) }),
    ]);
    expect(result).toEqual({ kind: 'refused', reason: 'low-confidence' });
  });

  it('Α9 — ΑΚΡΙΒΩΣ στο κατώφλι ⇒ γίνεται δεκτή (το κατώφλι είναι «κάτω από», όχι «έως»)', () => {
    const result = resolveProjectAnchor([
      address({ geocodingMetadata: metadata({ confidence: THRESHOLD }) }),
    ]);
    expect(result.kind).toBe('anchored');
  });

  it.each(['exact', 'interpolated', 'approximate'] as const)(
    'Α10 — ακρίβεια «%s» εντοπίζει σημείο ⇒ γίνεται δεκτή',
    (accuracy) => {
      const result = resolveProjectAnchor([address({ geocodingMetadata: metadata({ accuracy }) })]);
      expect(result).toEqual({
        kind: 'anchored',
        anchor: { lat: THESSALONIKI.lat, lon: THESSALONIKI.lng, originKey: 'projectAddressGeocoded' },
      });
    },
  );
});

describe('resolveProjectAnchor — προέλευση (Α11-Α13)', () => {
  it('Α11 — ανθρώπινη πινέζα ΥΠΕΡΙΣΧΥΕΙ παλιάς κακής κρίσης γεωκωδικοποιητή', () => {
    // Ο άνθρωπος είδε το λάθος και το διόρθωσε· απορρίπτοντάς το θα επικαλούμασταν το ίδιο
    // το σφάλμα που διορθώθηκε.
    const result = resolveProjectAnchor([
      address({
        source: 'dragged',
        geocodingMetadata: metadata({ accuracy: 'center', confidence: 0.1 }),
      }),
    ]);
    expect(result).toEqual({
      kind: 'anchored',
      anchor: { lat: THESSALONIKI.lat, lon: THESSALONIKI.lng, originKey: 'projectAddressPinned' },
    });
  });

  it('Α12 — συντεταγμένες χωρίς μεταδεδομένα ⇒ δεκτές, αλλά ΔΗΛΩΜΕΝΕΣ ως άγνωστης ακρίβειας', () => {
    const result = resolveProjectAnchor([address({ geocodingMetadata: undefined })]);
    expect(result).toEqual({
      kind: 'anchored',
      anchor: { lat: THESSALONIKI.lat, lon: THESSALONIKI.lng, originKey: 'projectAddressStored' },
    });
  });

  it('Α13 — η ΚΥΡΙΑ διεύθυνση κρίνεται, όχι η πρώτη του πίνακα', () => {
    const secondary = address({ id: 'a1', isPrimary: false, coordinates: { lat: 37.98, lng: 23.72 } });
    const primary = address({ id: 'a2', isPrimary: true });
    const result = resolveProjectAnchor([secondary, primary]);
    expect(result).toEqual({
      kind: 'anchored',
      anchor: { lat: THESSALONIKI.lat, lon: THESSALONIKI.lng, originKey: 'projectAddressStored' },
    });
  });
});

describe('resolveProjectAnchor — καθαρότητα (Α14)', () => {
  it('Α14 — δεν μεταλλάσσει την είσοδο (ο πίνακας διευθύνσεων μένει ανέπαφος)', () => {
    const input = [address({ isPrimary: false }), address({ id: 'a2' })];
    const snapshot = JSON.parse(JSON.stringify(input));
    resolveProjectAnchor(input);
    expect(input).toEqual(snapshot);
  });
});
