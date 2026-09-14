/**
 * Άγκυρες της **ΙΣΟΔΥΝΑΜΙΑΣ ΤΩΝ ΚΑΤΟΠΤΡΩΝ** — ADR-332 D27 **Ζ8**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ, ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ (2026-09-13) — όχι υποθετικό
 * ────────────────────────────────────────────────────────────────────────────
 * ALFA `cont_be5f5144…`, έδρα `addr_30739b3e…`. Στην **ίδια οθόνη**:
 *
 *   κάρτα λίστας      (`ContactListCard:43`      ← `contact.addresses[]`)   → 🔺 «Παλιά»
 *   καρτέλα διευθύνσεων (`SharedAddressActionCard:107` ← `…PositionView()`) → 🔄 «Σχετικά πρόσφατη»
 *
 * Το `verifiedAt` ήταν **1,01 ημέρας**. Η κλίμακα ηλικίας δίνει `stale` μόνο πάνω από **30**
 * ημέρες ⇒ το κόκκινο **δεν μπορούσε** να προέρχεται από τον χρόνο. Η μόνη άλλη διαδρομή είναι
 * το `positionTextVerdict(...) === 'differs'` (`computeFreshness.ts:70`).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Η ΑΙΤΙΑ: Ο ΚΡΙΤΗΣ ΕΙΝΑΙ ΕΝΑΣ, ΟΙ ΕΙΣΟΔΟΙ ΤΟΥ ΟΧΙ
 * ────────────────────────────────────────────────────────────────────────────
 * Το `resolvedFor` γεννιέται από `toQuery()` πάνω στη **γλώσσα του γραφέα**
 * (`contactAddressPositionView`). Όποια επιφάνεια κρίνει από **άλλο** κάτοπτρο συγκρίνει
 * μήλα με πορτοκάλια — και ο κριτής, σωστά, φωνάζει «άλλαξε».
 *
 * ⚠️ **ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΔΕΝ ΕΙΝΑΙ «TEST ΓΙΑ ΤΗ ΧΩΡΑ».** Το `country` ήταν το πρώτο που φάνηκε.
 * Η ερώτηση που φυλάει η άγκυρα είναι γενική: *«δίνουν τα δύο κάτοπτρα την ΙΔΙΑ ετυμηγορία
 * για την ΙΔΙΑ αποθηκευμένη εγγραφή;»* — και ο βρόχος τρέχει πάνω στον **ίδιο τον πίνακα**
 * `ADDRESS_IDENTITY_FIELDS`, ώστε ένα μελλοντικό ασύμμετρο πεδίο να κοκκινίσει **μόνο του**.
 *
 * ⚠️ **Η ΙΣΟΤΗΤΑ ΔΕΝ ΑΡΚΕΙ** (η παγίδα «το αρνητικό δείγμα δεν ξεχωρίζει τίποτα»): δύο κάτοπτρα
 * που λένε **και τα δύο** `differs` είναι ίσα και **και τα δύο λάθος**. Γι' αυτό κάθε άγκυρα
 * ισοδυναμίας συνοδεύεται από **θετικό** ισχυρισμό για τη συγκεκριμένη αναμενόμενη τιμή.
 */

import { buildAddressInfoListFromCompanyAddresses } from '../address-info-builder';
import { addressInfoPositionView } from '../address-info-position-view';
import { contactAddressPositionView } from '../contact-address-position-view';
import {
  ADDRESS_IDENTITY_FIELDS,
  positionTextVerdict,
  type AddressIdentityField,
  type AddressLike,
} from '@/lib/geocoding/address-position';
import type { CompanyAddress } from '@/types/ContactFormTypes';

const VERIFIED_AT = 1_789_248_178_948;

/**
 * Η έδρα της ALFA **όπως είναι σήμερα** στο `customFields.companyAddresses[0]`.
 *
 * 🔑 Αντιγραμμένη από το έγγραφο, **χωρίς** `country` — γιατί έτσι είναι: ο γραφέας
 * (`buildCompanyAddressFromAddressInfo:231`) γράφει χώρα **μόνο αν υπάρχει**.
 */
const ALFA_HQ_STORED: CompanyAddress & { readonly id: string } = {
  id: 'addr_30739b3e-4df7-491d-9639-4c629b5e31ea',
  type: 'headquarters',
  street: 'Εγνατία',
  number: '104',
  city: 'Δημοτική Ενότητα Θεσαλονίκης',
  postalCode: '54002',
  municipalityName: 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ',
  municipalityId: 'municipality:0701',
  regionalUnitName: 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ',
  regionName: 'ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ',
  settlementId: 'settlement:0701010001',
  coordinates: { lat: 40.6062745, lng: 22.9635559 },
  source: 'geocoded',
  verifiedAt: VERIFIED_AT,
  geocodingMetadata: {
    confidence: 0.66,
    accuracy: 'exact',
    variantUsed: 1,
    osmType: 'way',
    partialMatch: true,
    // 🔴 Το ερώτημα **όπως τέθηκε πραγματικά** — αντιγραμμένο από το Firestore.
    // Παρατήρησε τι ΔΕΝ έχει: `country`. Ο γραφέας δεν το είχε να το στείλει.
    resolvedFor: {
      street: 'Εγνατία',
      number: '104',
      city: 'Δημοτική Ενότητα Θεσαλονίκης',
      postalCode: '54002',
      municipality: 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ',
      regionalUnit: 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ',
      region: 'ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ',
    },
  },
};

/**
 * Το υποκατάστημα «Ονειροπόλων 42» — **το δείγμα που ασκεί τη ΔΕΥΤΕΡΗ υποψία**.
 *
 * 🔑 Η έδρα δεν έχει ούτε `neighborhood` ούτε `communityName`, άρα και τα δύο κάτοπτρα
 * απαντούν `''` και το πεδίο **δεν εξετάζεται**. Εδώ υπάρχουν **και τα δύο**, και ο πίνακας
 * λεξιλογίου (ADR-772) τα στέλνει σε **διαφορετικά** πεδία ανά διάλεκτο:
 *
 *   L7 «Κοινότητα»       companyAddress `communityName` → projectAddress `neighborhood` · addressInfo `community`
 *   ταχυδρομική γειτονιά companyAddress `neighborhood`  → projectAddress  NOT_STORED    · addressInfo `neighborhood`
 *
 * Αν η υποψία ισχύει, το `neighborhood` είναι **δεύτερο** ασύμμετρο πεδίο ταυτότητας — και
 * τότε η κανονικοποίηση της **χώρας δεν αρκεί**. Η άγκυρα το μετρά αντί να το υποθέτει.
 */
const ALFA_BRANCH_STORED: CompanyAddress & { readonly id: string } = {
  id: 'addr_0598edf6-6613-4caf-ac8e-efa0bcf36c3d',
  type: 'branch',
  street: 'Ονειροπόλων',
  number: '42',
  city: 'Τριανδρία',
  postalCode: '54624',
  neighborhood: 'Κέντρο',
  communityName: 'Δημοτική Κοινότητα Τριανδρίας',
  municipalUnitName: 'ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ ΤΡΙΑΝΔΡΙΑΣ',
  municipalityName: 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ',
  municipalityId: 'municipality:0701',
  regionalUnitName: 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ',
  regionName: 'ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ',
  settlementId: 'settlement:0701020101',
  coordinates: { lat: 40.6229682, lng: 22.9703544 },
  source: 'geocoded',
  verifiedAt: VERIFIED_AT,
  geocodingMetadata: {
    confidence: 0.66,
    accuracy: 'center',
    variantUsed: 8,
    osmType: 'relation',
    // Η απόδειξη γεννιέται από τη **γλώσσα του γραφέα** — άρα ό,τι βλέπει εκείνη.
    resolvedFor: {
      street: 'Ονειροπόλων',
      number: '42',
      city: 'Τριανδρία',
      postalCode: '54624',
      neighborhood: 'Δημοτική Κοινότητα Τριανδρίας',
      municipality: 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ',
      regionalUnit: 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ',
      region: 'ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ',
    },
  },
};

/**
 * Το κάτοπτρο **Α**: ό,τι γράφεται στο `contacts/<id>.addresses[]` και τρέφει τη λίστα —
 * **όπως ακριβώς το ρωτά η κάρτα** (`ContactListCard`), δηλαδή μέσα από τον προσαρμογέα.
 */
function mirrorAddressInfo(stored: CompanyAddress): AddressLike {
  return addressInfoPositionView(buildAddressInfoListFromCompanyAddresses([stored])[0]);
}

/** Το κάτοπτρο **Β**: η γλώσσα του γραφέα — αυτή που γέννησε το `resolvedFor`. */
function mirrorWriterView(stored: CompanyAddress & { readonly id: string }): AddressLike {
  return contactAddressPositionView(stored) as AddressLike;
}

/** Η τιμή ταυτότητας όπως τη διαβάζει ο κριτής (ίδιος κανόνας: `''` = απουσία). */
function identityText(address: AddressLike, field: AddressIdentityField): string {
  const raw = address[field];
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Η απόδειξη **όπως θα τη γεννούσε η παραγωγή**: `toQuery()` πάνω στη γλώσσα του γραφέα.
 *
 * 🔑 Αναπαράγεται εδώ (αντί να εισαχθεί) επειδή το `toQuery` είναι **εσωτερικό** του
 * `address-position-rules` — δεν επανεξάγεται από το σύνορο `address-position`. Ο κανόνας
 * είναι μία γραμμή («τα πεδία ταυτότητας με περιεχόμενο») και τον φυλάει το Ζ6-Α1.
 */
function proofFromWriterView(
  stored: CompanyAddress & { readonly id: string },
): Record<string, string> {
  const view = mirrorWriterView(stored);
  const proof: Record<string, string> = {};
  for (const field of ADDRESS_IDENTITY_FIELDS) {
    const text = identityText(view, field);
    if (text) proof[field] = text;
  }
  return proof;
}

/** Η ίδια εγγραφή, με **δηλωμένη** απόδειξη — ό,τι κρατά το `geocodingMetadata`. */
function withProof(
  stored: CompanyAddress & { readonly id: string },
  resolvedFor: Record<string, string>,
): CompanyAddress & { readonly id: string } {
  return {
    ...stored,
    geocodingMetadata: { confidence: 0.9, accuracy: 'exact', variantUsed: 1, resolvedFor },
  };
}

/**
 * Δείγμα που δηλώνει **και τα εννέα** πεδία ταυτότητας — η βάση του εξαντλητικού βρόχου.
 *
 * 🔴 **Γιατί χωριστό fixture**: με το υποκατάστημα, το `country` **έλειπε** από την απόδειξη,
 * οπότε ο βρόχος **σιωπούσε** γι' αυτό το πεδίο και η άγκυρα περνούσε **κενή** (μετρημένο:
 * 0 ms, καμία διεκδίκηση). Η σιωπή είναι χειρότερη από την αποτυχία — γι' αυτό υπάρχει και
 * ο φρουρός Ζ8-Κ0 παρακάτω, που την κάνει **αδύνατη** να επιστρέψει απαρατήρητη.
 */
const FULL_IDENTITY_STORED: CompanyAddress & { readonly id: string } = {
  ...ALFA_BRANCH_STORED,
  country: 'DE',
};

describe('Ζ8 — ΜΙΑ αποθηκευμένη διεύθυνση, ΜΙΑ ετυμηγορία, όποιο κάτοπτρο κι αν ρωτήσεις', () => {
  it('Ζ8-Κ0 — 🔴 ΦΡΟΥΡΟΣ: το δείγμα του εξαντλητικού βρόχου δηλώνει ΚΑΘΕ πεδίο ταυτότητας', () => {
    // Χωρίς αυτό, ένα πεδίο που λείπει από το δείγμα κάνει τον βρόχο να **σιωπά** γι' αυτό —
    // και μια σιωπηλή περίπτωση μοιάζει με πράσινη. Ο φρουρός μετατρέπει τη σιωπή σε αποτυχία.
    const proof = proofFromWriterView(FULL_IDENTITY_STORED);

    expect(Object.keys(proof).sort()).toEqual([...ADDRESS_IDENTITY_FIELDS].sort());
  });

  it('Ζ8-Κ1 — 🔴 Η ΚΑΡΔΙΑ: το ζωντανό δείγμα της ALFA κρίνεται ΤΟ ΙΔΙΟ και από τα δύο κάτοπτρα', () => {
    const viaListMirror = positionTextVerdict(mirrorAddressInfo(ALFA_HQ_STORED));
    const viaWriterView = positionTextVerdict(mirrorWriterView(ALFA_HQ_STORED));

    expect(viaListMirror).toBe(viaWriterView);
    // ⚠️ Ο θετικός ισχυρισμός: η ισότητα μόνη της θα περνούσε με δύο «differs».
    // Η θέση λύθηκε **γι' αυτό ακριβώς** το κείμενο — τίποτα δεν άλλαξε από τότε.
    expect(viaWriterView).toBe('matches');
  });

  it.each([
    ['έδρα (Εγνατία 104)', ALFA_HQ_STORED],
    ['υποκατάστημα (Ονειροπόλων 42) — έχει ΚΑΙ neighborhood ΚΑΙ communityName', ALFA_BRANCH_STORED],
  ])(
    'Ζ8-Κ2 — 🔴 η απόδειξη που ΠΑΡΑΓΕΙ ο γραφέας ικανοποιεί ΚΑΙ ΤΑ ΔΥΟ κάτοπτρα · %s',
    (_label, stored) => {
      // ⚠️ Το συμβόλαιο ΔΕΝ είναι «ίδιες ωμές τιμές» — το `AddressInfo` **νόμιμα** κρατά
      // `country: 'GR'` για εμφάνιση (Φάση Α). Το συμβόλαιο είναι **ίδια ΕΤΥΜΗΓΟΡΙΑ**.
      const withRealProof = withProof(stored, proofFromWriterView(stored));

      expect(positionTextVerdict(mirrorAddressInfo(withRealProof))).toBe('matches');
      expect(positionTextVerdict(mirrorWriterView(withRealProof))).toBe('matches');
    },
  );

  it.each(ADDRESS_IDENTITY_FIELDS.map((field) => [field] as const))(
    'Ζ8-Κ2γ — 🔴 ΕΞΑΝΤΛΗΤΙΚΟ: αλλαγή στο «%s» γίνεται αντιληπτή ΚΑΙ ΑΠΟ ΤΑ ΔΥΟ κάτοπτρα',
    (field) => {
      // Ο βρόχος τρέχει πάνω στον ΙΔΙΟ τον πίνακα ⇒ μελλοντικό πεδίο μπαίνει εδώ **μόνο του**.
      //
      // 🔑 Γιατί αυτή η μορφή πιάνει την ασυμμετρία: αν ένα κάτοπτρο **δεν βλέπει** το πεδίο
      // (το χάνει ή το λέει αλλιώς), θα απαντήσει `matches` ενώ το άλλο λέει `differs` —
      // ακριβώς το σχήμα του `neighborhood`, όπου η μία διάλεκτος διάβαζε «Κέντρο» και η
      // άλλη «Δημοτική Κοινότητα Τριανδρίας» για την **ίδια** εγγραφή.
      const proof = proofFromWriterView(FULL_IDENTITY_STORED);
      const drifted = withProof(FULL_IDENTITY_STORED, { ...proof, [field]: 'ΑΛΛΟ ΚΕΙΜΕΝΟ' });

      expect(positionTextVerdict(mirrorAddressInfo(drifted))).toBe('differs');
      expect(positionTextVerdict(mirrorWriterView(drifted))).toBe('differs');
    },
  );

  it('Ζ8-Κ2β — 🔴 το υποκατάστημα κρίνεται ΤΟ ΙΔΙΟ και από τα δύο κάτοπτρα', () => {
    const viaListMirror = positionTextVerdict(mirrorAddressInfo(ALFA_BRANCH_STORED));
    const viaWriterView = positionTextVerdict(mirrorWriterView(ALFA_BRANCH_STORED));

    expect(viaListMirror).toBe(viaWriterView);
    expect(viaWriterView).toBe('matches');
  });

  it('Ζ8-Κ3 — αρνητικός έλεγχος: αλλαγμένη οδός ⇒ `differs` ΚΑΙ ΑΠΟ ΤΑ ΔΥΟ κάτοπτρα', () => {
    // Δεν κώφωσα τον κριτή: πραγματική αλλαγή κειμένου εξακολουθεί να καταγγέλλεται.
    const moved = { ...ALFA_HQ_STORED, street: 'Τσιμισκή' };

    expect(positionTextVerdict(mirrorAddressInfo(moved))).toBe('differs');
    expect(positionTextVerdict(mirrorWriterView(moved))).toBe('differs');
  });

  it('Ζ8-Κ4 — ξένη χώρα δηλωμένη ΚΑΙ στις δύο πλευρές ⇒ `matches`', () => {
    const abroad: CompanyAddress & { readonly id: string } = {
      ...ALFA_HQ_STORED,
      country: 'DE',
      geocodingMetadata: {
        ...ALFA_HQ_STORED.geocodingMetadata!,
        resolvedFor: { ...ALFA_HQ_STORED.geocodingMetadata!.resolvedFor, country: 'DE' },
      },
    };

    expect(positionTextVerdict(mirrorAddressInfo(abroad))).toBe('matches');
    expect(positionTextVerdict(mirrorWriterView(abroad))).toBe('matches');
  });

  it('Ζ8-Κ5 — 🔴 αποθηκευμένη «DE» με απόδειξη ΧΩΡΙΣ χώρα ⇒ `differs` (η απουσία σημαίνει Ελλάδα)', () => {
    // Η κανονικοποίηση ΔΕΝ είναι «αγνόησε τα κενά»: απουσία ≡ «GR», και «GR» ≠ «DE».
    // Αν αυτό γύριζε `matches`, θα είχα κωφώσει μια πραγματική αλλαγή χώρας.
    const abroad = { ...ALFA_HQ_STORED, country: 'DE' };

    expect(positionTextVerdict(mirrorAddressInfo(abroad))).toBe('differs');
    expect(positionTextVerdict(mirrorWriterView(abroad))).toBe('differs');
  });

  it('Ζ8-Κ6 — εγγραφή χωρίς απόδειξη ⇒ `unverifiable` και από τα δύο (η άγνοια δεν έγινε βεβαιότητα)', () => {
    const legacy: CompanyAddress & { readonly id: string } = {
      ...ALFA_HQ_STORED,
      geocodingMetadata: { confidence: 0.66, accuracy: 'exact', variantUsed: 1, osmType: 'way' },
    };

    expect(positionTextVerdict(mirrorAddressInfo(legacy))).toBe('unverifiable');
    expect(positionTextVerdict(mirrorWriterView(legacy))).toBe('unverifiable');
  });

  it('Ζ8-Κ7 — τεκμηρίωση της ασυμμετρίας: η γλώσσα του γραφέα ΔΕΝ κουβαλά χώρα, το κάτοπτρο ΝΑΙ', () => {
    // Δεν είναι ισχυρισμός ορθότητας — είναι **η μέτρηση** που εξηγεί γιατί υπάρχει το Ζ8.
    // Αν κάποτε πάψει να ισχύει (π.χ. ο γραφέας αρχίσει να αποθηκεύει χώρα), θέλω να το μάθω.
    expect(identityText(mirrorWriterView(ALFA_HQ_STORED), 'country')).toBe('');
    expect(identityText(mirrorAddressInfo(ALFA_HQ_STORED), 'country')).toBe('GR');
  });
});
