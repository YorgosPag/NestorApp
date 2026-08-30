/**
 * @fileoverview **ΑΓΚΥΡΑ Κ11 (ADR-824 §8)** — *«μπορεί η οθόνη να απαντήσει “γιατί μου το
 * πήρατε;”»*.
 * @related ADR-824 §8 Κ11 · ADR-824 §12.12 · types/organization-capability
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΑΡΚΟΥΣΕ ΝΑ ΥΠΑΡΧΕΙ ΤΟ ΠΕΔΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `revokeBrokerage` **απαιτεί** γραπτό λόγο (1..500 χαρακτήρες) και τον γράφει στο
 * έγγραφο. Παρ' όλα αυτά, ο πελατικός αναγνώστης κρατούσε **μόνο** το `status` και πετούσε
 * `declaration` · `revocationReason` · `decidedAt`. Δηλαδή ο λόγος **γραφόταν σωστά και δεν
 * έφτανε ποτέ** — η ακριβής κλάση «η πληροφορία υπάρχει, απλώς κανείς δεν τη μεταφέρει».
 *
 * ⛔ Και το `revoked` **δεν** επιστρέφει σε `unrequested`, επίτηδες: *«δεν ζήτησε ποτέ»* και
 * *«του το πήραμε»* είναι **διαφορετικά γεγονότα με διαφορετική θεραπεία στην οθόνη**. Χωρίς
 * τον λόγο, η δεύτερη περίπτωση είναι σιωπή που ο άνθρωπος **δεν μπορεί να διορθώσει**.
 *
 * ⚠️ **Η κρίση δοκιμάζεται ως ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ, επίτηδες** — ίδιο σκεπτικό με το
 * `use-public-place.test.ts`: μέσα σε `useEffect` θα ελεγχόταν μόνο με προσομοίωση Firestore,
 * «σε κόσμο που δεν υπάρχει». Γι' αυτό ο χειριστής του στιγμιότυπου είναι **μία κλήση χωρίς
 * λογική** ({@link capabilitiesStateOf}) και η λογική ελέγχεται ολόκληρη εδώ.
 */

// ⚠️ Ο ΕΝΑΣ αναγνώστης εισάγει το `useAuth` (για να ενώσει ταυτότητα + ικανότητα), που
// σέρνει ολόκληρο το `@firebase/auth` — και εκείνο απαιτεί `fetch` σε περιβάλλον node.
// Η κρίση που ελέγχεται εδώ είναι **καθαρή** και δεν αγγίζει ταυτότητα, οπότε η ταυτότητα
// κόβεται στη ρίζα της. Ίδιο ιδίωμα με το `mandate-catalog-gate.test.tsx`.
jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

import { capabilitiesStateOf } from '../useOrganizationCapability';
import {
  ORGANIZATION_CAPABILITIES,
  capabilityDisclosureOf,
  type BrokerageDeclaration,
  type OrganizationCapabilities,
} from '@/types/organization-capability';

const DECLARED_AT = '2026-08-20T09:00:00.000Z';
const DECIDED_AT = '2026-08-28T17:30:00.000Z';
const SUPER_ADMIN_UID = 'WKBWEg3DsuperadminUID';
const REASON = 'Η άδεια του Επιμελητηρίου έληξε στις 2026-08-15 και δεν ανανεώθηκε.';

const DECLARATION: BrokerageDeclaration = {
  gemiNumber: '123456789000',
  chamberRegistryNumber: 'ΕΕΑ-4711',
  legalRepresentativeName: 'Δοκιμαστικός Εκπρόσωπος',
  declaredAt: DECLARED_AT,
  declaredByUserId: 'user_founder',
};

/** Το σχήμα που γράφει **πράγματι** το `revokeBrokerage` — όχι επινοημένο δείγμα. */
const REVOKED: OrganizationCapabilities = {
  brokerage_listings: {
    status: 'revoked',
    requirements: [],
    declaration: DECLARATION,
    decidedByUserId: SUPER_ADMIN_UID,
    decidedAt: DECIDED_AT,
    revocationReason: REASON,
  },
};

const PENDING: OrganizationCapabilities = {
  brokerage_listings: {
    status: 'pending',
    requirements: [{ key: 'brokerage.requirement.chamberRegistration' }],
    declaration: DECLARATION,
    decidedByUserId: null,
    decidedAt: null,
    revocationReason: null,
  },
};

// ═══ Κ11 — η αποκάλυψη φτάνει ΟΛΟΚΛΗΡΗ ══════════════════════════════════════

describe('Κ11 — ο λόγος της ανάκλησης φτάνει στην οθόνη', () => {
  test('Κ11α: `revoked` ⇒ η οθόνη μπορεί να πει ΓΙΑΤΙ και ΠΟΤΕ', () => {
    // 🔴 Αυτό ακριβώς ήταν αδύνατο: το `viewOf` κρατούσε μόνο το `status`.
    const disclosure = capabilityDisclosureOf(REVOKED, 'brokerage_listings');

    expect(disclosure?.status).toBe('revoked');
    expect(disclosure?.revocationReason).toBe(REASON);
    expect(disclosure?.decidedAt).toBe(DECIDED_AT);
  });

  test('Κ11β: το uid του υπερδιαχειριστή ΔΕΝ ταξιδεύει στον μισθωτή', () => {
    // Στενή προβολή (ίδιο δόγμα με το `company-capabilities.reader.ts`): η οθόνη χρειάζεται
    // «πότε» και «γιατί» — ΠΟΤΕ «ποιανού το uid». Ό,τι δεν γυρίζει, δεν μπορεί να διαρρεύσει.
    const disclosure = capabilityDisclosureOf(REVOKED, 'brokerage_listings');

    expect(JSON.stringify(disclosure)).not.toContain(SUPER_ADMIN_UID);
    expect(Object.keys(disclosure ?? {})).not.toContain('decidedByUserId');
  });

  test('Κ11γ: «δεν ζήτησε ποτέ» ⇒ `null` — ΟΧΙ εγγραφή χωρίς λόγο', () => {
    // Αν εδώ επέστρεφε αντικείμενο με `revocationReason: null`, η οθόνη δεν θα μπορούσε να
    // ξεχωρίσει «δεν ζήτησε» από «του το πήραν χωρίς να γράψουν γιατί».
    expect(capabilityDisclosureOf({}, 'brokerage_listings')).toBeNull();
    expect(capabilityDisclosureOf(undefined, 'brokerage_listings')).toBeNull();
  });

  test('Κ11δ: `pending` ⇒ η δήλωση ΚΑΙ το τι εκκρεμεί φτάνουν', () => {
    const disclosure = capabilityDisclosureOf(PENDING, 'brokerage_listings');

    expect(disclosure?.declaration?.gemiNumber).toBe('123456789000');
    expect(disclosure?.requirements).toHaveLength(1);
    expect(disclosure?.revocationReason).toBeNull();
  });
});

// ═══ Κ11 — η κατάσταση που δημοσιεύει ο ΕΝΑΣ αναγνώστης ═════════════════════

describe('Κ11 — ό,τι δημοσιεύει ο αναγνώστης', () => {
  test('Κ11ε: ο χάρτης είναι ΟΛΙΚΟΣ — κλειδί για κάθε ικανότητα του κλειστού συνόλου', () => {
    // Παράγεται από το σύνολο, ποτέ γραμμένος στο χέρι: χειρόγραφο literal θα έμενε ελλιπές
    // τη μέρα που προστεθεί δεύτερη ικανότητα, και ο τύπος ΔΕΝ θα το έπιανε.
    const state = capabilitiesStateOf(REVOKED);

    for (const capability of ORGANIZATION_CAPABILITIES) {
      expect(state.disclosures).toHaveProperty(capability);
      expect(state.view).toHaveProperty(capability);
    }
  });

  test('Κ11ζ: η αποκάλυψη ταξιδεύει ΜΑΖΙ με την όψη, από την ΙΔΙΑ ανάγνωση', () => {
    // Δεύτερος αναγνώστης θα ήταν δεύτερο `onSnapshot` στο ΙΔΙΟ έγγραφο — δύο μονοπάτια
    // που μπορούν να αποκλίνουν (ADR-749). Εδώ αποδεικνύεται ότι είναι ένα.
    const state = capabilitiesStateOf(REVOKED);

    expect(state.view.brokerage_listings).toBe('revoked');
    expect(state.disclosures.brokerage_listings?.revocationReason).toBe(REASON);
  });

  test('Κ11η: κενό έγγραφο ⇒ όλα `unrequested` / `null`, και ΓΝΩΣΤΟ (`settled`)', () => {
    const state = capabilitiesStateOf(undefined);

    expect(state.view.brokerage_listings).toBe('unrequested');
    expect(state.disclosures.brokerage_listings).toBeNull();
    // 🔑 Fail-closed ΚΑΙ τερματίζει: το «δεν ξέρω» είναι το `settled`, ποτέ η αποκάλυψη.
    expect(state.settled).toBe(true);
  });

  test('Κ11θ: το «δεν ξέρω ακόμη» ΔΕΝ εκφράζεται ως κενή αποκάλυψη', () => {
    // Το `settled: false` είναι κατάσταση ΤΟΥ ΠΕΛΑΤΗ και ταξιδεύει χωριστά — μετρημένος
    // λόγος: εγκεκριμένο γραφείο διάβαζε «δεν έχεις δηλώσει» για ~1,5s σε κάθε φόρτωση.
    // Άρα μια αποκάλυψη `null` ΔΕΝ επιτρέπεται να σημαίνει «φορτώνει».
    expect(capabilitiesStateOf(REVOKED).settled).toBe(true);
    expect(capabilitiesStateOf(undefined).settled).toBe(true);
  });
});
