/**
 * Άγκυρες του **ΙΣΧΥΡΙΣΜΟΥ ΑΚΡΙΒΕΙΑΣ** — ADR-332 D27 **Ζ6**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ, ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ (2026-09-12) — όχι υποθετικό
 * ────────────────────────────────────────────────────────────────────────────
 * ALFA `cont_be5f5144…`, έδρα `addr_30739b3e…`, στο Firestore:
 *
 *     street: «Εγνατία»  number: «102»  postalCode: «54002»
 *     coordinates: 40.6345573 / 22.9461936
 *     source: 'geocoded'  accuracy: 'exact'  confidence: 0.91
 *
 * Η **αντίστροφη** γεωκωδικοποίηση εκείνου του σημείου απαντά `number: «100»`, Τ.Κ. «546 23».
 * Η **εμπρός** για «Εγνατία 102» απαντά `40.6345089 / 22.9464481` — **~22 μέτρα αλλού** — και
 * δηλώνει `partialMatch: true` με `fieldMatches.postalCode: 'mismatch'`.
 *
 * ⇒ Το `accuracy: 'exact'` είναι **αληθές για την 100** και **ψευδές** για το αποθηκευμένο
 * κείμενο. Κανένα σημάδι δεν το δηλώνει, και **κανένας αναγνώστης δεν μπορούσε να ρωτήσει**:
 * η θέση δεν κρατούσε πουθενά **για ποιο κείμενο λύθηκε**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΔΥΟ ΔΙΑΔΡΟΜΕΣ, ΜΙΑ ΨΕΥΔΗΣ ΠΡΟΤΑΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 * **(Α) χρονική** — το `keepStored` κρατά τα **παλιά** μεταδεδομένα δίπλα στο **νέο** κείμενο
 * όταν η μηχανή δεν απαντά (`geocoder-unavailable`, `budget-exhausted`). Έτσι γεννήθηκε το
 * δείγμα. Η πράξη είναι **σωστή** (άγνοια δεν σβήνει θέση)· η **σιωπή** δεν είναι.
 * **(Β) στιγμιαία** — ο πάροχος **ξέρει ήδη** ότι δεν ταίριαξαν όλα, και η γνώση **χανόταν στη
 * μεταφορά** επειδή το `GeocodeHit` δεν είχε το πεδίο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ
 * ────────────────────────────────────────────────────────────────────────────
 * Η Google επιστρέφει `partial_match` **στη στιγμή** και αφήνει τον καταναλωτή να θυμηθεί να το
 * κρατήσει — και η δική μας μετατροπή **δεν το θυμήθηκε**. Εδώ η απόδειξη ταξιδεύει **μέσα** στα
 * μεταδεδομένα: κάθε μελλοντικός αναγνώστης, από οποιαδήποτε διαδρομή, μπορεί να ρωτήσει
 * *«ισχύει αυτό για ό,τι βλέπω;»* χωρίς δίκτυο. Ίδιο πρότυπο με το «content last read» του
 * ADR-769 (CAS): η ταυτότητα του περιεχομένου ταξιδεύει με την απόφαση που πάρθηκε γι' αυτό.
 */

import {
  positionTextVerdict,
  resolveAddressPosition,
  type AddressGeocoder,
  type AddressLike,
  type GeocodeHit,
} from '../address-position';

const NOW = 1_757_000_000_000;
const EARLIER = NOW - 86_400_000;

/** Το σημείο που ο πάροχος δίνει για «Εγνατία 100» — αυτό που είναι ΑΠΟΘΗΚΕΥΜΕΝΟ. */
const POINT_100 = { lat: 40.6345573, lng: 22.9461936 };

/** Το σημείο που ο πάροχος δίνει για «Εγνατία 102» — ~22 μ. αλλού (μετρημένο). */
const HIT_102: GeocodeHit = {
  lat: 40.6345089,
  lng: 22.9464481,
  accuracy: 'exact',
  confidence: 0.85,
  variantUsed: 1,
};

/** Ο γεωκωδικοποιητής-μάρτυρας — `Error` σημαίνει «δεν μπόρεσα να ρωτήσω». */
function witness(answer: GeocodeHit | null | Error): AddressGeocoder {
  return async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  };
}

/** Η έδρα όπως λύθηκε ΤΟΤΕ: κείμενο «Εγνατία 100», θέση μηχανής. */
const HQ_AS_RESOLVED: AddressLike & { id: string } = {
  id: 'addr_hq',
  street: 'Εγνατία',
  number: '100',
  city: 'Θεσσαλονίκη',
  postalCode: '54623',
  coordinates: POINT_100,
  source: 'geocoded',
  verifiedAt: EARLIER,
};

describe('Ζ6 — η θέση κουβαλά ΓΙΑ ΠΟΙΟ ΚΕΙΜΕΝΟ λύθηκε', () => {
  it('Ζ6-Α1 — μετά από `geocoded`, τα μεταδεδομένα κρατούν το κείμενο που ρωτήθηκε', async () => {
    const incoming: AddressLike = { ...HQ_AS_RESOLVED, number: '102', coordinates: undefined };

    const { outcome, position } = await resolveAddressPosition(
      HQ_AS_RESOLVED,
      incoming,
      witness(HIT_102),
      NOW,
    );

    expect(outcome).toBe('geocoded');
    // Ό,τι ρωτήθηκε, όπως ρωτήθηκε — τα πεδία ταυτότητας με περιεχόμενο.
    expect(position.geocodingMetadata?.resolvedFor).toEqual({
      street: 'Εγνατία',
      number: '102',
      city: 'Θεσσαλονίκη',
      postalCode: '54623',
    });
  });

  it('Ζ6-Α2 — αποθηκευμένο «100», κείμενο «102» ⇒ ετυμηγορία `differs`', () => {
    const stored: AddressLike = {
      ...HQ_AS_RESOLVED,
      number: '102',
      geocodingMetadata: {
        confidence: 0.91,
        accuracy: 'exact',
        variantUsed: 1,
        resolvedFor: { street: 'Εγνατία', number: '100', city: 'Θεσσαλονίκη', postalCode: '54623' },
      },
    };

    expect(positionTextVerdict(stored)).toBe('differs');
  });

  it('Ζ6-Α2β — το ίδιο ακριβώς κείμενο ⇒ `matches`', () => {
    const stored: AddressLike = {
      ...HQ_AS_RESOLVED,
      geocodingMetadata: {
        confidence: 0.91,
        accuracy: 'exact',
        variantUsed: 1,
        resolvedFor: { street: 'Εγνατία', number: '100', city: 'Θεσσαλονίκη', postalCode: '54623' },
      },
    };

    expect(positionTextVerdict(stored)).toBe('matches');
  });

  it('Ζ6-Α3 — 🔴 ΠΑΛΙΑ εγγραφή χωρίς απόδειξη ⇒ `unverifiable`, ΠΟΤΕ `differs`', () => {
    // ΑΚΡΙΒΩΣ το έγγραφο της ALFA σήμερα: μεταδεδομένα χωρίς `resolvedFor`.
    // Άγνοια ΔΕΝ είναι γνώση: μια εγγραφή που προηγείται του πεδίου δεν κατηγορείται.
    const legacy: AddressLike = {
      ...HQ_AS_RESOLVED,
      number: '102',
      geocodingMetadata: { confidence: 0.91, accuracy: 'exact', variantUsed: 1, osmType: 'way' },
    };

    expect(positionTextVerdict(legacy)).toBe('unverifiable');
  });

  it('Ζ6-Α3β — πινέζα ανθρώπου (καμία κλίμακα ακρίβειας) ⇒ `not-geocoded`', () => {
    const human: AddressLike = { ...HQ_AS_RESOLVED, source: 'dragged' };

    // Δεν υπάρχει ισχυρισμός ακρίβειας να ελεγχθεί — η ερώτηση δεν έχει νόημα εδώ.
    expect(positionTextVerdict(human)).toBe('not-geocoded');
  });

  it('Ζ6-Α4 — 🔴 Η ΚΑΡΔΙΑ: η μηχανή δεν απάντησε ⇒ θέση ΚΡΑΤΙΕΤΑΙ και η απόδειξη ΜΕΝΕΙ ΠΑΛΙΑ', async () => {
    // Η διαδρομή που γέννησε το ζωντανό δείγμα: το κείμενο έγινε «102», η μηχανή σιώπησε,
    // τα μεταδεδομένα της «100» έμειναν. Το `keepStored` έχει ΔΙΚΙΟ να τα κρατά — αλλά το
    // `resolvedFor` ΔΕΝ επιτρέπεται να «φρεσκαριστεί» από το νέο κείμενο, αλλιώς η ψευδής
    // πρόταση γίνεται ΑΥΤΟ-ΕΠΙΚΥΡΩΜΕΝΗ και κανένας δεν μπορεί πια να τη δει.
    const stored: AddressLike = {
      ...HQ_AS_RESOLVED,
      geocodingMetadata: {
        confidence: 0.91,
        accuracy: 'exact',
        variantUsed: 1,
        resolvedFor: { street: 'Εγνατία', number: '100', city: 'Θεσσαλονίκη', postalCode: '54623' },
      },
    };
    const incoming: AddressLike = { ...stored, number: '102' };

    const { outcome, position } = await resolveAddressPosition(
      stored,
      incoming,
      witness(new Error('geocoder-unavailable')),
      NOW,
    );

    expect(outcome).toBe('geocoder-unavailable');
    expect(position.coordinates).toEqual(POINT_100);
    expect(position.geocodingMetadata?.resolvedFor).toEqual({
      street: 'Εγνατία',
      number: '100',
      city: 'Θεσσαλονίκη',
      postalCode: '54623',
    });
    // Και το αποτέλεσμα της κράτησης είναι ΟΡΑΤΟ: η γραμμένη διεύθυνση αυτο-καταγγέλλεται.
    expect(positionTextVerdict({ ...incoming, ...position })).toBe('differs');
  });

  it('Ζ6-Α4β — 🔴 ΔΕΥΤΕΡΗ σιωπή της μηχανής: η απόδειξη μένει η ΑΡΧΙΚΗ, όχι η ενδιάμεση', async () => {
    // ⚠️ Η άγκυρα Α4 μόνη της ΔΕΝ φυλάει το συμβόλαιο: εκεί το αποθηκευμένο κείμενο και η
    // απόδειξη **συμπίπτουν**, άρα ένα `resolvedFor: toQuery(stored)` θα περνούσε αθόρυβα
    // (μετρημένο — η μετάλλαξη επέζησε). Ο πραγματικός κίνδυνος φαίνεται μόνο όταν το
    // αποθηκευμένο **κείμενο** έχει ήδη αποκλίνει από την απόδειξή του: ακριβώς η κατάσταση
    // του ζωντανού δείγματος της ALFA (κείμενο «102», θέση της «100»).
    //
    // 🔴 Αν εδώ η απόδειξη «φρεσκάρει» από το αποθηκευμένο κείμενο, η ψευδής πρόταση γίνεται
    // **αυτο-επικυρωμένη**: κάθε επόμενη αποθήκευση που δεν ρωτά τη μηχανή θα «αποδείκνυε»
    // ότι η θέση ισχύει για το κείμενο που τυχαίνει να συνοδεύει. Η σιωπή θα γινόταν μόνιμη.
    const alreadyDrifted: AddressLike = {
      ...HQ_AS_RESOLVED,
      number: '102', // το κείμενο λέει 102…
      geocodingMetadata: {
        confidence: 0.91,
        accuracy: 'exact',
        variantUsed: 1,
        // …η απόδειξη λέει 100. Αυτή είναι η ΑΛΗΘΕΙΑ και δεν επιτρέπεται να χαθεί.
        resolvedFor: { street: 'Εγνατία', number: '100', city: 'Θεσσαλονίκη', postalCode: '54623' },
      },
    };
    const incoming: AddressLike = { ...alreadyDrifted, number: '104' };

    const { outcome, position } = await resolveAddressPosition(
      alreadyDrifted,
      incoming,
      witness(new Error('geocoder-unavailable')),
      NOW,
    );

    expect(outcome).toBe('geocoder-unavailable');
    expect(position.geocodingMetadata?.resolvedFor).toEqual({
      street: 'Εγνατία',
      number: '100',
      city: 'Θεσσαλονίκη',
      postalCode: '54623',
    });
    expect(positionTextVerdict({ ...incoming, ...position })).toBe('differs');
  });

  it('Ζ6-Β1 — ο πάροχος δήλωσε ΜΕΡΙΚΗ αντιστοίχιση ⇒ αποθηκεύεται δίπλα στην ακρίβεια', async () => {
    // Μετρημένο ζωντανά: «Εγνατία 102» με Τ.Κ. 54002 ⇒ `accuracy: 'exact'` ΚΑΙ
    // `partialMatch: true` (ο Τ.Κ. δεν ταίριαξε). Οι δύο ΔΕΝ είναι η ίδια ερώτηση:
    // η ακρίβεια αφορά ΤΟ ΑΠΟΤΕΛΕΣΜΑ, η μερικότητα αφορά ΤΟ ΠΟΣΟ ΤΑΙΡΙΑΞΕ ΜΕ ΟΣΑ ΖΗΤΗΘΗΚΑΝ.
    const incoming: AddressLike = {
      ...HQ_AS_RESOLVED,
      number: '102',
      postalCode: '54002',
      coordinates: undefined,
    };

    const { position } = await resolveAddressPosition(
      HQ_AS_RESOLVED,
      incoming,
      witness({ ...HIT_102, partialMatch: true }),
      NOW,
    );

    expect(position.geocodingMetadata?.accuracy).toBe('exact');
    expect(position.geocodingMetadata?.partialMatch).toBe(true);
  });

  it('Ζ6-Β1β — πλήρης αντιστοίχιση ⇒ το πεδίο ΔΕΝ γράφεται (απουσία = καμία επιφύλαξη)', async () => {
    const incoming: AddressLike = { ...HQ_AS_RESOLVED, number: '102', coordinates: undefined };

    const { position } = await resolveAddressPosition(
      HQ_AS_RESOLVED,
      incoming,
      witness(HIT_102),
      NOW,
    );

    expect(position.geocodingMetadata?.partialMatch).toBeUndefined();
  });
});
