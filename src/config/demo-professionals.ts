/**
 * @fileoverview **ΤΟ ΜΗΤΡΩΟ ΤΩΝ ΔΟΚΙΜΑΣΤΙΚΩΝ ΕΠΑΓΓΕΛΜΑΤΙΩΝ** — δεδομένα, ποτέ λογική.
 * @related ADR-841 Α9.5 · scripts/seed-demo-professionals.ts · config/isco-registry-authority.ts
 * @module config/demo-professionals
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ «21 ΤΥΧΑΙΑ ΟΝΟΜΑΤΑ»
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Ο τεχνικός/κατασκευαστικός χώρος **δεν** έχει μία μορφή αξιοπιστίας — έχει
 * **πέντε**, και το `isco-registry-authority.ts` τις ονομάζει:
 *
 * | Ετυμηγορία | Τι σημαίνει | Πώς πρέπει να δείχνει η κάρτα |
 * |---|---|---|
 * | `authority: 'tee'` | εθνικό μητρώο, **ένας** εκδότης | αρχή + αριθμός |
 * | `authority: 'regional-authority'` | μητρώο **με παραρτήματα** | αρχή + **εκδότης** + αριθμός |
 * | `authority: 'gemi'` | ρυθμιζόμενη **μεσιτεία** | περνά από φρουρό ικανότητας |
 * | `no-registry` | **δηλωμένη απουσία** μητρώου | «δήλωση του ίδιου», ρητά |
 * | `unexamined` | *κανείς δεν εξέτασε τον κωδικό* | **όχι** το ίδιο με «δεν έχει» |
 *
 * Δοκιμαστικά δεδομένα που καλύπτουν **μία** από αυτές δεν δείχνουν πώς
 * εμφανίζεται ο κατάλογος — δείχνουν πώς εμφανίζεται **μία περίπτωση**. Αυτό το
 * μητρώο καλύπτει και τις **τέσσερις** που ένας seeder μπορεί να φτάσει· η πέμπτη
 * *(`gemi`)* είναι **σκόπιμα απρόσιτη**, δες παρακάτω.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔒 ΓΙΑΤΙ ΚΑΝΕΝΑ `gemi` ΕΔΩ — ΚΑΙ ΓΙΑΤΙ ΑΥΤΟ ΕΙΝΑΙ ΕΓΓΥΗΣΗ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η μεσιτεία περνά από τον `gateShowcase`, που απαιτεί **ενεργή ικανότητα** και
 * παράγει `BrokerageAuthority` — τύπο με `unique symbol`, **ακατασκεύαστο** έξω
 * από τον κριτή του. Ο seeder χτίζει μόνο `{ kind: 'unregulated' }`, άρα είναι
 * **δομικά ανίκανος** να κόψει μεσίτη ακόμη κι αν κάποιος γράψει `gemi` εδώ.
 * Το μητρώο το δηλώνει στον τύπο *(δες {@link DemoAttestation})* ώστε η αστοχία
 * να είναι **σφάλμα σχήματος**, όχι έκπληξη σε χρόνο εκτέλεσης.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΟ `escoUri` ΕΙΝΑΙ Η ΤΑΥΤΟΤΗΤΑ. ΤΟ `label` ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ, ΕΠΙΤΗΔΕΣ.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο seeder διαβάζει **την ταξινομία** για ετικέτα και `iscoCode` — ίδιο δόγμα με
 * το `showcase-wire.ts`: *«ετικέτα από το σύρμα θα επέτρεπε “Δικηγόρος” πάνω σε
 * URI υδραυλικού: σωστό φίλτρο, ψεύτικη κάρτα»*. Εδώ ο κίνδυνος είναι ο ίδιος με
 * άλλο ρούχο — μια χειρόγραφη ελληνική ετικέτα που **παλιώνει** όταν το ESCO
 * ξαναεισαχθεί, και κανείς δεν το μαθαίνει.
 *
 * Το {@link DemoProfessional.expectedIscoCode} υπάρχει **ακριβώς** για να το
 * μαθαίνει κάποιος: ο seeder το συγκρίνει με ό,τι λέει η ταξινομία και
 * **αρνείται να γράψει** σε απόκλιση. Δεν είναι αντίγραφο της αυθεντίας — είναι
 * **η υπόσχεση που επαληθεύεται**.
 */

import type { ChapteredRegistryId, NationalRegistryId } from '@/constants/professional-registries';

// =============================================================================
// ΤΥΠΟΙ
// =============================================================================

/**
 * **Τι δηλώνει ο δοκιμαστικός επαγγελματίας** για την εγγραφή του σε μητρώο.
 *
 * 🔑 Οι τρεις παραλλαγές αντιστοιχούν **ένα προς ένα** στις εκβάσεις του
 * `resolveRegistryAuthority` — και ο seeder το **επαληθεύει**, δεν το εμπιστεύεται.
 */
export type DemoAttestation =
  /**
   * Το επάγγελμα **δεν έχει** μητρώο *(`no-registry`)*, ή **κανείς δεν το
   * εξέτασε** *(`unexamined`)*. Δύο διαφορετικά πράγματα για τον τομέα, **ένα**
   * για τη δήλωση: δεν υπάρχει αριθμός να δηλωθεί.
   */
  | { readonly kind: 'none' }
  /** Μητρώο με **έναν** εκδότη *(ΤΕΕ, ΟΕΕ)* ⇒ αρκεί ο αριθμός. */
  | { readonly kind: 'national'; readonly authority: NationalRegistryId; readonly number: string }
  /**
   * Μητρώο με **παραρτήματα** *(περιφέρειες, δικηγορικοί σύλλογοι)* ⇒ ο εκδότης
   * είναι **υποχρεωτικός**: «1234» χωρίς «Περιφέρεια Κ. Μακεδονίας» δεν
   * επαληθεύεται από κανέναν *(ADR-841 Α9.1)*.
   */
  | {
      readonly kind: 'chapter';
      readonly authority: ChapteredRegistryId;
      readonly chapter: string;
      readonly number: string;
    };

/** **Πού εδρεύει** ο δοκιμαστικός επαγγελματίας — ή πουθενά. */
export type DemoAnchor =
  /** Δεμένος σε **υπαρκτή** γη· ο seeder παίρνει τη γεωμετρία **από εκείνη**. */
  | { readonly kind: 'land'; readonly landId: string }
  /**
   * **Χωρίς τόπο** — και είναι νόμιμο *(το `place` της βιτρίνας είναι
   * `PlaceRef | null`)*. Υπάρχει στο μητρώο ώστε ο κατάλογος να δείχνει **και**
   * την κάρτα που δεν δηλώνει έδρα: αν όλοι είχαν τόπο, κανείς δεν θα έβλεπε
   * ποτέ αυτή την όψη.
   */
  | { readonly kind: 'none' };

/** Μία γραμμή του μητρώου. */
export interface DemoProfessional {
  /**
   * **Ο σπόρος της ταυτότητας** — και **μόνο** αυτό.
   *
   * ────────────────────────────────────────────────────────────────────────
   * 🔴 ΔΕΝ ΕΙΝΑΙ ΨΕΥΔΩΝΥΜΟ ΧΩΡΟΥ, ΚΑΙ ΤΟ ΓΙΑΤΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ
   * ────────────────────────────────────────────────────────────────────────
   *
   * Η πρώτη γραφή αυτού του μητρώου το προόριζε για `/pro/<slug>`, δηλαδή για
   * εγγραφή στο `workspace_aliases`. **Το κλειδί εκείνης της συλλογής δεν είναι
   * το ψευδώνυμο** — είναι το `skeleton(alias)` του UTS #39 *(`alias-rules.ts:189`)*.
   * Και μετρήθηκε ότι ο πίνακας συγχύσιμων φυλλομετρά **και ASCII**:
   *
   * ```
   * skeleton('demo-ktistis') === 'derno-ktistis'     // 'm' → 'rn'
   * skeleton('pagonis')      === 'pagonis'           // γι' αυτό το υπάρχον δουλεύει
   * ```
   *
   * Ένας seeder που έγραφε doc id `demo-ktistis` θα παρήγαγε εγγραφή που **ο
   * `resolveAlias` δεν βρίσκει ποτέ** — ψευδώνυμο που φαίνεται γραμμένο και δεν
   * είναι. Η **σωστή** θεραπεία είναι να καλέσει τον ίδιο τον `skeleton()`, που
   * όμως ζει πίσω από `import 'server-only'` *(`lib/unicode/skeleton.ts:51`)* σε
   * έργο όπου το πακέτο `server-only` **δεν είναι καν εγκατεστημένο** ⇒ κανένα
   * `scripts/*.ts` δεν μπορεί να το εισαγάγει.
   *
   * ✅ **Η απόφαση**: το ψευδώνυμο της δοκιμαστικής βιτρίνας είναι το ίδιο το
   * `companyId`, που το {@link readsAsWorkspaceIdentity} λύνει **χωρίς καμία
   * ανάγνωση**. Μηδέν νέα συλλογή, μηδέν εξάρτηση, μηδέν ψευδώνυμο-φάντασμα.
   *
   * 🔶 **ΔΗΛΩΜΕΝΟ ΚΕΝΟ**: οι διευθύνσεις βγαίνουν `/pro/comp_<uuid>` αντί για
   * `/pro/demo-ktistis`. Είναι **καλλωπισμός**, όχι λειτουργία — η κάρτα, το
   * φίλτρο και η σελίδα βιτρίνας δουλεύουν ακέραια. Όποιος θελήσει ανθρώπινες
   * διευθύνσεις χρειάζεται **πρώτα** τον `skeleton()` προσιτό σε σκριπτ, όχι
   * αντιγραφή του τύπου του (ο πίνακας έχει **6.565** εγγραφές).
   *
   * ⚠️ Παραμένει **σταθερός και μοναδικός**: αλλαγή του εδώ γεννά **νέα**
   * ταυτότητα, άρα **δεύτερη** κάρτα — και η παλιά μένει ορφανή, γιατί η
   * διαγραφή ξαναϋπολογίζει από αυτόν ακριβώς τον σπόρο.
   */
  readonly slug: string;
  /** Ό,τι δείχνει η κάρτα. */
  readonly displayName: string;
  /** **Η ταυτότητα του επαγγέλματος.** Ετικέτα και `iscoCode` έρχονται από την ταξινομία. */
  readonly escoUri: string;
  /** Η υπόσχεση που ο seeder **επαληθεύει** απέναντι στην ταξινομία. */
  readonly expectedIscoCode: string;
  readonly attestation: DemoAttestation;
  readonly anchor: DemoAnchor;
}

// =============================================================================
// ΟΙ ΤΟΠΟΙ
// =============================================================================

/**
 * Υπαρκτές γαίες του `public_lands`, ονομασμένες.
 *
 * 🔴 **ΔΕΝ είναι συντεταγμένες** — είναι **κλειδιά**. Το σημείο το κρατά η γη, και
 * ο seeder το διαβάζει από εκεί, με το ίδιο δόγμα που ο διακομιστής παράγει το
 * `position` της βιτρίνας από το `place` *(`showcase-wire.ts`)*. Γραμμένο εδώ
 * ζεύγος lat/lng θα ήταν **δεύτερη αλήθεια** που παλιώνει σιωπηλά όταν η γη
 * μετακινηθεί.
 *
 * ⚠️ Αν κάποιο κλειδί σβηστεί από τη βάση, ο seeder **σταματά ονομαστικά** — δεν
 * γράφει βιτρίνα με τόπο που δεν υπάρχει *(«σωστή κάρτα, ψεύτικο φίλτρο»)*.
 */
export const DEMO_LANDS = {
  /** Θεσσαλονίκη, Στέφανου Δραγούμη 8 — μέσα στην ακτίνα του `?lat=40.64&lng=22.94`. */
  thessaloniki: 'land_0cb5cbb6-bb31-4954-a7f9-8e8f9ac00a00',
  /** Αθήνα — **έξω** από εκείνη την ακτίνα, και γι' αυτό αποδεικνύει ότι φιλτράρει. */
  athensA: 'land_27dc91c5-feaa-463c-9380-f9926c03d9f7',
  athensB: 'land_a6883010-8d61-413b-a744-e65337999f65',
  athensC: 'land_ddc3d8c0-f05c-4116-ae6f-5d431c334186',
} as const;

const AT_THESSALONIKI: DemoAnchor = { kind: 'land', landId: DEMO_LANDS.thessaloniki };
const NOWHERE: DemoAnchor = { kind: 'none' };

// =============================================================================
// ΤΟ ΜΗΤΡΩΟ
// =============================================================================

/**
 * **21 δοκιμαστικοί επαγγελματίες του τεχνικού/κατασκευαστικού χώρου.**
 *
 * 📐 Η σύνθεση είναι σκόπιμη, όχι αλφαβητική:
 * - **7** με εθνικό μητρώο *(ΤΕΕ)* — η «καθαρή» περίπτωση
 * - **6** με μητρώο **παραρτημάτων** *(περιφέρεια)* — η περίπτωση που **χρειάζεται εκδότη**
 * - **6** με **δηλωμένη απουσία** μητρώου — η περίπτωση «δήλωση του ίδιου»
 * - **2** **ανεξέταστες** — η περίπτωση που το ADR-841 αρνείται να συγχωνεύσει με την προηγούμενη
 *
 * 🗺️ Και **τρεις** κατανομές τόπου: Θεσσαλονίκη *(μέσα στην ακτίνα)*, Αθήνα
 * *(έξω)*, και **χωρίς τόπο**. Χωρίς αυτό, ένα πράσινο φίλτρο ακτίνας δεν θα
 * σήμαινε τίποτα — δες Α6.6: *546 πράσινα suites, σελίδα 500*.
 */
export const DEMO_PROFESSIONALS: readonly DemoProfessional[] = [
  // ── ΤΕΕ — εθνικό μητρώο, ένας εκδότης ─────────────────────────────────────
  {
    slug: 'demo-politikos-mixanikos',
    displayName: 'Δομοστατική Μελετητική Ε.Ε.',
    escoUri: 'http://data.europa.eu/esco/occupation/d7d986e1-7333-431b-9719-0c5c6939e360',
    expectedIscoCode: '2142',
    attestation: { kind: 'national', authority: 'tee', number: '112345' },
    anchor: AT_THESSALONIKI,
  },
  {
    slug: 'demo-arxitektonas',
    displayName: 'Αρχιτεκτονικό Γραφείο Ήλιος',
    escoUri: 'http://data.europa.eu/esco/occupation/8c3f536e-ba66-4321-ba40-363dc39f129b',
    expectedIscoCode: '2161',
    attestation: { kind: 'national', authority: 'tee', number: '123456' },
    anchor: AT_THESSALONIKI,
  },
  {
    slug: 'demo-topografos',
    displayName: 'Τοπογραφικό Γραφείο Άξονας',
    escoUri: 'http://data.europa.eu/esco/occupation/d8e502b4-1be6-4d10-a224-151688f8f0c8',
    expectedIscoCode: '2165',
    attestation: { kind: 'national', authority: 'tee', number: '134567' },
    anchor: { kind: 'land', landId: DEMO_LANDS.athensA },
  },
  {
    slug: 'demo-mixanikos-domikwn-ergwn',
    displayName: 'Κατασκευαστική Πυθαγόρας Α.Ε.',
    escoUri: 'http://data.europa.eu/esco/occupation/2a914d26-42aa-46b5-acf3-097d51ba4617',
    expectedIscoCode: '2142',
    attestation: { kind: 'national', authority: 'tee', number: '145678' },
    anchor: { kind: 'land', landId: DEMO_LANDS.athensB },
  },
  {
    slug: 'demo-gewtexnikos-mixanikos',
    displayName: 'Γεωτεχνική Μελετητική Ρήγας',
    escoUri: 'http://data.europa.eu/esco/occupation/efc75d4e-dfbf-4178-929c-0ae198801c36',
    expectedIscoCode: '2142',
    attestation: { kind: 'national', authority: 'tee', number: '156789' },
    anchor: NOWHERE,
  },
  {
    slug: 'demo-ilektrologos-mixanikos',
    displayName: 'Ηλεκτρομηχανολογικές Μελέτες Βολτ',
    escoUri: 'http://data.europa.eu/esco/occupation/86ca306c-ab99-420a-9e2a-aa73c5c4de22',
    expectedIscoCode: '2151',
    attestation: { kind: 'national', authority: 'tee', number: '167890' },
    anchor: AT_THESSALONIKI,
  },
  {
    slug: 'demo-ilektromixanologos',
    displayName: 'Μηχανολογικό Γραφείο Κινητήρας',
    escoUri: 'http://data.europa.eu/esco/occupation/77abfaec-a250-4765-95fa-6091e8da1bba',
    expectedIscoCode: '2151',
    attestation: { kind: 'national', authority: 'tee', number: '178901' },
    anchor: NOWHERE,
  },

  // ── ΠΕΡΙΦΕΡΕΙΑ — μητρώο με παραρτήματα ⇒ ο εκδότης είναι ΥΠΟΧΡΕΩΤΙΚΟΣ ───────
  {
    slug: 'demo-texnikos-fysikou-aeriou',
    displayName: 'Θερμοδομή — Εγκαταστάσεις Φυσικού Αερίου',
    escoUri: 'http://data.europa.eu/esco/occupation/97b3cab1-f4f0-41ed-8c80-e65e6c067e95',
    expectedIscoCode: '7126',
    attestation: {
      kind: 'chapter',
      authority: 'regional-authority',
      chapter: 'Περιφέρεια Κεντρικής Μακεδονίας',
      number: 'ΦΑ-4471',
    },
    anchor: AT_THESSALONIKI,
  },
  {
    slug: 'demo-mixanikos-thermansis',
    displayName: 'Θέρμανση Βορρά',
    escoUri: 'http://data.europa.eu/esco/occupation/7259dc48-004a-4ceb-aa4e-5bbd548c2397',
    expectedIscoCode: '7126',
    attestation: {
      kind: 'chapter',
      authority: 'regional-authority',
      chapter: 'Περιφέρεια Κεντρικής Μακεδονίας',
      number: 'ΘΕ-2208',
    },
    anchor: AT_THESSALONIKI,
  },
  {
    slug: 'demo-texnikos-apoxeteysewn',
    displayName: 'Αποχετευτικά Έργα Ροή',
    escoUri: 'http://data.europa.eu/esco/occupation/461959ed-6a80-4c33-a75e-26aaeb52a5a7',
    expectedIscoCode: '7126',
    attestation: {
      kind: 'chapter',
      authority: 'regional-authority',
      chapter: 'Περιφέρεια Αττικής',
      number: 'ΑΠ-9013',
    },
    anchor: { kind: 'land', landId: DEMO_LANDS.athensC },
  },
  {
    slug: 'demo-ilektrologos-ktiriwn',
    displayName: 'Ηλεκτρολογικές Εγκαταστάσεις Φως',
    escoUri: 'http://data.europa.eu/esco/occupation/33960bab-4423-4808-af6c-ec2b485dba41',
    expectedIscoCode: '7411',
    attestation: {
      kind: 'chapter',
      authority: 'regional-authority',
      chapter: 'Περιφέρεια Κεντρικής Μακεδονίας',
      number: 'ΗΛ-5566',
    },
    anchor: AT_THESSALONIKI,
  },
  {
    slug: 'demo-ilektrologos-viomixanikos',
    displayName: 'Βιομηχανικός Ηλεκτρισμός Δύναμις',
    escoUri: 'http://data.europa.eu/esco/occupation/5df63943-f1bc-4438-90f1-92768a7a23c8',
    expectedIscoCode: '7411',
    attestation: {
      kind: 'chapter',
      authority: 'regional-authority',
      chapter: 'Περιφέρεια Αττικής',
      number: 'ΗΛ-7788',
    },
    anchor: { kind: 'land', landId: DEMO_LANDS.athensA },
  },
  {
    slug: 'demo-texnikos-iliakis-energeias',
    displayName: 'Ηλιακά Συστήματα Ακτίνα',
    escoUri: 'http://data.europa.eu/esco/occupation/75b63949-1b93-4bf2-a777-ccf978dc3e8a',
    expectedIscoCode: '7411',
    attestation: {
      kind: 'chapter',
      authority: 'regional-authority',
      chapter: 'Περιφέρεια Κεντρικής Μακεδονίας',
      number: 'ΗΛ-3121',
    },
    anchor: NOWHERE,
  },

  // ── ΔΗΛΩΜΕΝΗ ΑΠΟΥΣΙΑ ΜΗΤΡΩΟΥ — «δήλωση του ίδιου», ρητά ────────────────────
  {
    slug: 'demo-xylourgos',
    displayName: 'Ξυλουργείο Δρυς',
    escoUri: 'http://data.europa.eu/esco/occupation/2a22ff9e-de3b-408d-b312-5034896cc4f4',
    expectedIscoCode: '7115',
    attestation: { kind: 'none' },
    anchor: AT_THESSALONIKI,
  },
  {
    slug: 'demo-plakas',
    displayName: 'Τοποθετήσεις Πλακιδίων Ψηφίδα',
    escoUri: 'http://data.europa.eu/esco/occupation/02447817-ea01-4d8b-b09c-8bc128e447e6',
    expectedIscoCode: '7122',
    attestation: { kind: 'none' },
    anchor: { kind: 'land', landId: DEMO_LANDS.athensB },
  },
  {
    slug: 'demo-parketa',
    displayName: 'Ξύλινα Δάπεδα Παρκέ Τέχνη',
    escoUri: 'http://data.europa.eu/esco/occupation/4f1bb8b4-3fff-4e68-b427-8c892534a181',
    expectedIscoCode: '7122',
    attestation: { kind: 'none' },
    anchor: NOWHERE,
  },
  {
    slug: 'demo-elaioxrwmatistis',
    displayName: 'Χρωματισμοί Παλέτα',
    escoUri: 'http://data.europa.eu/esco/occupation/15620506-fb5d-49cd-87a2-1c9047fb406a',
    expectedIscoCode: '7131',
    attestation: { kind: 'none' },
    anchor: AT_THESSALONIKI,
  },
  {
    slug: 'demo-viomixanika-dapeda',
    displayName: 'Βιομηχανικά Δάπεδα Επιφάνεια',
    escoUri: 'http://data.europa.eu/esco/occupation/a9068f84-cecd-4cbb-9acb-e20c714435ec',
    expectedIscoCode: '7114',
    attestation: { kind: 'none' },
    anchor: NOWHERE,
  },
  {
    slug: 'demo-diakosmitis',
    displayName: 'Διακόσμηση Εσωτερικών Χώρων Αρμονία',
    escoUri: 'http://data.europa.eu/esco/occupation/73e776fb-4d99-4031-bad4-7716f121155d',
    expectedIscoCode: '3432',
    attestation: { kind: 'none' },
    anchor: { kind: 'land', landId: DEMO_LANDS.athensC },
  },

  // ── ΑΝΕΞΕΤΑΣΤΑ — καμία γραμμή στον πίνακα ISCO. ΔΕΝ είναι «δεν έχει μητρώο». ─
  {
    slug: 'demo-ktistis',
    displayName: 'Οικοδομικές Εργασίες Θεμέλιο',
    escoUri: 'http://data.europa.eu/esco/occupation/05f321f8-055b-407d-bf19-e0ddabda56b7',
    expectedIscoCode: '7112',
    attestation: { kind: 'none' },
    anchor: AT_THESSALONIKI,
  },
  {
    slug: 'demo-sygkollitis',
    displayName: 'Μεταλλικές Κατασκευές Σπίθα',
    escoUri: 'http://data.europa.eu/esco/occupation/7aedaa07-3884-4c5b-88f9-80997b2aa54b',
    expectedIscoCode: '7212',
    attestation: { kind: 'none' },
    anchor: NOWHERE,
  },
];
