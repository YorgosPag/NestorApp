/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **Η ΑΓΚΥΡΑ ΤΗΣ ΔΙΑΔΟΧΗΣ (Ο-27)** — *«δημοσίευσα δεύτερη φορά. Ποιο ισχύει;»*
 * @related ADR-845 §7.12 (Ο-27) · §8 (Α-15) · services/listings/agency-media-publication
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ ΠΟΥ ΤΗ ΓΕΝΝΗΣΕ — ΜΕΤΡΗΜΕΝΟ ΣΤΗΝ ΠΑΡΑΓΩΓΗ, 2026-09-09
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο Giorgio πρόσθεσε σκάλα στον viewer και ξαναδημοσίευσε. Το ζωντανό
 * `public_listings/prop_ef2eaebd…` απάντησε **δύο** μοντέλα:
 *
 * ```
 * models[0]  provenance:'measured'  altKey:'…model.alt.agency'  at:11:23:03   (κολώνες)
 * models[1]  provenance:'measured'  altKey:'…model.alt.agency'  at:17:27:04   (+ σκάλα)
 * ```
 *
 * **Κάθε πεδίο ταυτόσημο εκτός από `url` και `at`** — και το `at` δεν αποδίδεται πουθενά:
 * η λεζάντα γεννιέται από το `altKey`, που είναι `LISTING_MATERIAL_KEYS[authorship]`, ίδιο
 * και για τα δύο. **Ο επισκέπτης δεν έχει ΚΑΝΕΝΑΝ τρόπο να ξέρει ποιο ισχύει.**
 *
 * Και τα δύο `files` έγγραφα ήταν ταυτόσημα σε **κάθε** πεδίο πλην ταυτοποιητικού, μεγέθους
 * και στιγμής — **ακόμα και το `originalFilename`** *(`${propertyId}.glb`, από τον πελάτη)*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΠΛΗΘΥΝΤΙΚΟΣ ΕΙΝΑΙ ΣΩΣΤΟΣ — ΤΟ ΕΛΑΤΤΩΜΑ ΕΙΝΑΙ ΟΤΙ ΔΕΝ ΕΧΕΙ ΚΡΙΤΗΡΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `public-listing.ts` δικαιολογεί γραπτώς **γιατί πίνακας**: `as-built` + `proposal`
 * *(«σήμερα vs μετά την ανακαίνιση» — **αξία, όχι κίνδυνος**)*, και **δύο ανεξάρτητοι
 * παραγωγοί** *(εργολάβος `measured` · αρχιτέκτονας ιδιώτη `declared`)*.
 *
 * ⚠️ **Αλλά τίποτα δεν εμπόδιζε δύο μοντέλα με ΤΑΥΤΟΣΗΜΗ δήλωση** — και τότε ο πληθυντικός
 * παύει να είναι χαρακτηριστικό και γίνεται **διπλότυπο**. Είναι η **τρίτη** εμφάνιση της
 * ίδιας κλάσης την ίδια μέρα *(4 κτήρια «Κτήριο Α» · Ο-20 δύο μονάδες `A-ΔΙ-0.01` · αυτό)*:
 * **το όνομα συμφωνεί, η ταυτότητα όχι.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Ο ΚΑΝΟΝΑΣ — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΕΠΙΝΟΗΣΗ ΜΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * > **Ίδια ταυτότητα ⇒ ΕΚΔΟΧΕΣ ⇒ το νεότερο ΔΙΑΔΕΧΕΤΑΙ το παλιό.**
 * > **Άλλη ταυτότητα ⇒ ΠΑΡΑΛΛΑΓΕΣ ⇒ συνυπάρχουν.**
 *
 * Είναι το **Information Container ID** του **ISO 19650** *(Originator · Volume/Level ·
 * Role — και το `revision` χωριστά από το `status`)*, εφαρμοσμένο στον μηχανισμό
 * *«immutable content-addressed objects + mutable named pointers»* του **OCI/Git/IPFS**:
 * το ράφι μας **είναι ήδη registry** *(κλειδί = sha256 των καθαρισμένων bytes)* και ο
 * σβήστης του **είναι ήδη garbage collector**. Έλειπε **το tag**.
 *
 * ⚠️ Το **RESO Data Dictionary 1.7** *(Zillow · Idealista · κάθε MLS)* **δεν έχει καθόλου
 * διαδοχή** — μόνο `MediaStatus: Updated|Deleted`. Γι' αυτό εκείνοι **διαγράφουν**, και
 * χάνουν το «σήμερα vs μετά». Εμείς κρατάμε **και τα δύο**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ Η ΑΓΚΥΡΑ **ΕΚΤΕΛΕΙ ΤΟΝ ΠΑΡΑΓΩΓΟ** ΚΑΙ ΔΕΝ ΓΡΑΦΕΙ FIXTURE
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το μάθημα του **Ο-13**, αυτούσιο: το fixture της παλιάς άγκυρας έγραφε
 * `classification: 'public'` **με το χέρι** — σχήμα που ο γραφέας **δεν παρήγαγε ποτέ** —
 * και έμεινε πράσινη όσο η παραγωγή έστελνε `models: []`. *«Ένα fixture που περιγράφει
 * έγγραφο το οποίο κανείς δεν γράφει δεν είναι κάλυψη· είναι ευχή.»*
 *
 * ⇒ Εδώ **κάθε** υποψήφιος παράγεται από το `buildPublishedModelFileRecord` — το **ΕΝΑ**
 * σώμα που απαντά *«τι έγγραφο γεννιέται;»* και το οποίο εκτελεί και η πόρτα.
 */

import { MODEL_MATERIAL } from '@/lib/listings/listing-material';
import {
  MODEL_PUBLICATION_SCOPES,
  MODEL_STATE_MARKS,
  type ModelPublicationDeclaration,
  type ModelPublicationScope,
  type ModelStateMark,
} from '@/lib/listings/listing-model-declaration';
import { buildPublishedModelFileRecord } from '@/lib/listings/model-file-record';
import {
  enumerateModelIdentities,
  modelPublicationIdentityKey,
} from '@/lib/listings/model-publication-identity';
import { buildFinalizeFileRecordUpdate } from '@/services/file-record';

import {
  orderedPublishableAgencyMedia,
  publishedAgencyMediaSources,
  type AgencyMediaCandidate,
} from '../agency-media-publication';

const LISTING = 'prop_ef2eaebd-de24-4058-a76e-6f2ec389aff9';
const COMPANY = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';
const AUTHOR = 'WKBWEg3DSfcdSbLNJfzGEW3vkct1';
const MODEL_MIME = 'model/gltf-binary';

/**
 * **Η δήλωση όπως τη στέλνει ο πελάτης** — ό,τι ταξιδεύει δίπλα στα bytes.
 *
 * ⚠️ Η **γεωμετρία** είναι σκόπιμα ελάχιστη: αυτή η σουίτα ρωτά *«ποιο πράγμα δημοσιεύεται;»*,
 * και η λογιστική *«είναι αυτό που στάλθηκε;»* έχει **δικές της** άγκυρες *(Α-6)*. Ένα
 * ρεαλιστικό αποτύπωμα εδώ θα ήταν θόρυβος που δεν ελέγχεται από κανένα ισχυρισμό.
 */
function declaration(
  scope: ModelPublicationScope,
  state: ModelStateMark,
): ModelPublicationDeclaration {
  return {
    state,
    scope,
    signatory: { name: 'Γ. Παγώνης', discipline: 'πολιτικός μηχανικός', studiedAt: '2026-09-01' },
    geometry: {
      meshCount: 12,
      triangleCount: 288,
      materialCount: 1,
      textureCount: 0,
      fingerprint: null,
    },
  };
}

/**
 * **Μία δημοσίευση μοντέλου, όπως ΠΡΟΣΓΕΙΩΝΕΤΑΙ** — παραγόμενη από τα ίδια σώματα με την πόρτα.
 *
 * ⚠️ Το `createdAt` δίνεται ως όρισμα και **όχι** ως ρολόι: στην παραγωγή το γράφει ο
 * `serverTimestamp()`, και η άγκυρα οφείλει να ελέγχει **ποιο** από τα δύο επιβιώνει — άρα
 * χρειάζεται δύο **γνωστές**, διακριτές στιγμές. Ίδιος λόγος με το `landedModelRecord`
 * της αδελφής σουίτας: ο γραφέας δεν την ξέρει, ο κριτής την χρειάζεται.
 *
 * ⚠️ **Ξεχωριστή κλήση ανά δημοσίευση**: το ταυτοποιητικό και το μονοπάτι γεννιούνται
 * **νέα** κάθε φορά — ακριβώς όπως στην παραγωγή, όπου οι δύο δημοσιεύσεις έδωσαν
 * `file_51f3bb6d…` και `file_0aba3b80…`.
 */
function publishedModel(
  createdAt: string,
  sizeBytes: number,
  scope: ModelPublicationScope = 'active-floor',
  state: ModelStateMark = 'as-built',
): AgencyMediaCandidate {
  const { recordBase, storagePath } = buildPublishedModelFileRecord({
    companyId: COMPANY,
    propertyId: LISTING,
    contentType: MODEL_MIME,
    originalFilename: `${LISTING}.glb`,
    createdBy: AUTHOR,
    declaration: declaration(scope, state),
  });

  const finalized = buildFinalizeFileRecordUpdate({
    sizeBytes,
    downloadUrl: `/api/storage/file/${storagePath}`,
  });

  return { ...recordBase, ...finalized, createdAt } as AgencyMediaCandidate;
}

// ═══════════════════════════════════════════════════════════════════════════
// Ο-27 — ΔΥΟ ΔΗΜΟΣΙΕΥΣΕΙΣ ΤΟΥ ΙΔΙΟΥ ΠΡΑΓΜΑΤΟΣ ΕΙΝΑΙ **ΕΚΔΟΧΕΣ**, ΟΧΙ ΔΥΟ ΠΡΑΓΜΑΤΑ
// ═══════════════════════════════════════════════════════════════════════════

describe('ADR-845 Ο-27 — η διαδοχή του δημοσιευμένου μοντέλου', () => {
  it('Κ1 — 🏆 ΔΥΟ δημοσιεύσεις με ΤΑΥΤΟΣΗΜΗ ταυτότητα φεύγουν ως **ΕΝΑ**', () => {
    // Η ζωντανή αναπαραγωγή, με τις **πραγματικές** στιγμές και μεγέθη της παραγωγής:
    // 11:23:02 → 112.980 B (μόνο κολώνες) · 17:27:02 → 251.004 B (+ σκάλα).
    const older = publishedModel('2026-09-09T11:23:02.639Z', 112980);
    const newer = publishedModel('2026-09-09T17:27:02.745Z', 251004);

    const sources = publishedAgencyMediaSources([older, newer]);

    // 🔴 ΤΟ ΜΕΤΡΗΜΕΝΟ ΕΛΑΤΤΩΜΑ: σήμερα αυτό απαντά **2**, και η αγγελία δείχνει δύο
    //    κάρτες με **ταυτόσημη** λεζάντα. Ο πληθυντικός είναι σωστός· το ΔΙΠΛΟΤΥΠΟ όχι.
    expect(sources).toHaveLength(1);
    expect(sources[0].material).toEqual(MODEL_MATERIAL);
  });

  it('Κ2 — και ο επιζών είναι το **ΝΕΟΤΕΡΟ**, ποτέ το πρώτο που βρέθηκε', () => {
    const older = publishedModel('2026-09-09T11:23:02.639Z', 112980);
    const newer = publishedModel('2026-09-09T17:27:02.745Z', 251004);

    // ⚠️ **Και οι δύο σειρές εισόδου**, γιατί το Firestore δεν υπόσχεται καμία: ένας
    //    κανόνας «κράτα το πρώτο» θα ήταν πράσινος στη μία και κόκκινος στην άλλη —
    //    δηλαδή θα δημοσίευε **άλλο μοντέλο ανά πέρασμα**, χωρίς να αλλάξει τίποτα.
    for (const order of [[older, newer], [newer, older]]) {
      const sources = publishedAgencyMediaSources(order);
      expect(sources).toHaveLength(1);
      expect(sources[0].privateStoragePath).toBe(newer.storagePath);
    }
  });

  it('Κ3 — 🔑 Ο ΠΛΗΘΥΝΤΙΚΟΣ ΕΠΙΒΙΩΝΕΙ: άλλη ταυτότητα ⇒ **ΠΑΡΑΛΛΑΓΕΣ**, συνυπάρχουν', () => {
    // Ο γραμμένος λόγος του πίνακα (`types/public-listing.ts`): «διαμέρισμα με έτοιμη μελέτη
    // ανακαίνισης» θέλει να δείξει **πώς είναι σήμερα** ΚΑΙ **πώς θα γίνει**. Αν η επιμέλεια
    // τα συγχώνευε, η θεραπεία θα είχε σκοτώσει το χαρακτηριστικό μαζί με το ελάττωμα.
    const asBuilt = publishedModel('2026-09-09T11:23:02.639Z', 112980, 'active-floor', 'as-built');
    const proposal = publishedModel('2026-09-09T11:24:02.639Z', 118400, 'active-floor', 'proposal');
    // …και το ίδιο ισχύει για το **εύρος**: όροφος ≠ κτίσμα, όσο ίδια κι αν είναι τα υπόλοιπα.
    const whole = publishedModel('2026-09-09T11:25:02.639Z', 802100, 'all-floors', 'as-built');

    expect(publishedAgencyMediaSources([asBuilt, proposal, whole])).toHaveLength(3);
  });

  it('Κ4 — ⚠️ ΧΩΡΙΣ ταυτότητα ΔΕΝ συγχωνεύεται ΤΙΠΟΤΑ — «δεν ξέρω» ≠ «είναι το ίδιο»', () => {
    // 🔴 Τα **δύο ζωντανά** μοντέλα της 2026-09-09 γεννήθηκαν πριν υπάρξει το πεδίο. Μια
    //    σιωπηλή συγχώνευσή τους θα **έκρυβε** υλικό που κάποιος δημοσίευσε ρητά — fail-closed
    //    με φορά προς την προβολή, ίδια κατεύθυνση με το `fingerprint: null` του Α-6.
    const legacyA = publishedModel('2026-09-09T11:23:02.639Z', 112980);
    const legacyB = publishedModel('2026-09-09T17:27:02.745Z', 251004);

    const anonymised = [legacyA, legacyB].map(({ publicationIdentity: _drop, ...rest }) => rest);

    expect(publishedAgencyMediaSources(anonymised)).toHaveLength(2);
  });

  it('Κ5 — η επιμέλεια τρέχει ΠΡΙΝ τη σειρά: δήλωση ανθρώπου ΔΕΝ ανασταίνει το παλιό', () => {
    // Α14.7.2 αυτούσιο: η `order` «δεν μπορεί να δημοσιεύσει τίποτα — μόνο να τακτοποιήσει ό,τι
    // ήδη φεύγει». Ένα μπαγιάτικο ταυτοποιητικό στο `publishedMediaOrder` είναι ακριβώς αυτό.
    const older = publishedModel('2026-09-09T11:23:02.639Z', 112980);
    const newer = publishedModel('2026-09-09T17:27:02.745Z', 251004);

    const ordered = orderedPublishableAgencyMedia([older, newer], {
      order: [older.id],
      floorplans: [],
    });

    expect(ordered).toHaveLength(1);
    expect(ordered[0].id).toBe(newer.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ TAG — ΜΟΝΑΔΙΚΟ ΑΝΑ ΤΡΙΑΔΑ, ΚΑΙ ΠΑΡΑΜΕΝΕΙ ΟΤΑΝ ΜΕΓΑΛΩΣΕΙ ΤΟ ΛΕΞΙΛΟΓΙΟ
// ═══════════════════════════════════════════════════════════════════════════

describe('ADR-845 Ο-27 — το κλειδί ταυτότητας', () => {
  it('Κ6 — 🏆 ΚΑΘΕ δυνατή τριάδα δίνει **ΔΙΑΚΡΙΤΟ** κλειδί — απαριθμημένη, όχι δειγματοληπτική', () => {
    // 🔑 **Ο παραγωγός απαριθμεί, η άγκυρα μετρά.** Την ημέρα που μπει τέταρτη σήμανση ή
    //    τρίτο εύρος, αυτός ο έλεγχος τα δοκιμάζει **χωρίς να τα προσθέσει κανείς** — και θα
    //    κοκκινίσει αν μια νέα τιμή περιέχει τον διαχωριστή και «φάει» γειτονικό σκέλος.
    const identities = enumerateModelIdentities(['measured', 'declared']);
    const keys = identities.map(modelPublicationIdentityKey);

    expect(identities).toHaveLength(2 * MODEL_PUBLICATION_SCOPES.length * MODEL_STATE_MARKS.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('Κ7 — το κλειδί ΓΕΝΝΙΕΤΑΙ από τον γραφέα του εγγράφου, ποτέ γραμμένο με το χέρι', () => {
    // Το μάθημα του Ο-13: fixture που περιγράφει έγγραφο το οποίο κανείς δεν γράφει είναι ευχή.
    const landed = publishedModel('2026-09-09T17:27:02.745Z', 251004, 'all-floors', 'proposal');

    expect(landed.publicationIdentity).toBe(
      modelPublicationIdentityKey({
        provenance: 'measured',
        scope: 'all-floors',
        state: 'proposal',
      }),
    );
  });
});
