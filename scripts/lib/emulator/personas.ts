/**
 * ADR-798 Φάση 6 — **ΤΑ ΔΕΔΟΜΕΝΑ** των ανθρώπων. Καμία εκτέλεση.
 *
 * 🔴 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΟΝ ΣΠΟΡΕΑ — ΤΟ ΕΔΕΙΞΕ Η ΠΡΩΤΗ ΑΓΚΥΡΑ.** Όσο ζούσαν
 * μέσα στο `emulator-seed-personas.ts`, κάθε `import` τους **εκτελούσε** τον
 * σπορέα: ο φρουρός του emulator έβγαινε `process.exit(1)` και ο jest ανέφερε
 * *«Jest worker encountered 4 child process exceptions»* — δηλαδή τα δεδομένα
 * ήταν **αδοκίμαστα** επειδή το άγγιγμά τους ήταν πράξη.
 *
 * 🔑 Ίδια τομή με το `lib/auth/role-catalogue.ts`: **κάτω τα δεδομένα** (καμία
 * εξάρτηση, καμία παρενέργεια), **πάνω οι πράξεις**.
 *
 * @module scripts/lib/emulator/personas
 * @see docs/centralized-systems/reference/adrs/ADR-798-person-professional-identity.md
 */

import type { SeedIdentity } from './identity';

export const COMPANY_ID = 'comp_alpha_emulator';
export const COMPANY_NAME = 'Άλφα Τεχνική (DEMO)';

/**
 * **Η ΔΙΕΥΘΥΝΣΗ του χώρου** — το τμήμα που μπαίνει στο `/o/<εδώ>/…` (ADR-819 §4.3).
 *
 * 🔴 **ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΚΑΘΟΛΟΥ — ΜΕΤΡΗΜΕΝΟ 2026-08-26**: ο σπορέας έγραφε χώρο
 * **χωρίς ψευδώνυμο**, και το `comp_alpha_emulator` είναι **δομικά
 * αδιευθυνσιοδότητο**:
 *
 * * `parseEnterpriseId` κάνει `split('_')` και απαιτεί **2** μέρη — εδώ δίνει **3**
 *   ⇒ `isValidEnterpriseId` = **false** ⇒ δεν διαβάζεται ως ταυτότητα χώρου·
 * * το `ALIAS_PATTERN` **απορρίπτει το `_`** ⇒ δεν διαβάζεται ούτε ως ψευδώνυμο.
 *
 * ⇒ Ο `int.architect@alpha.local` έπαιρνε **404 ό,τι κι αν διορθωνόταν αλλού**.
 *
 * 🔑 Η παραγωγή **δεν έχει** αυτό το πρόβλημα: το `workspace-provisioning.ts`
 * απαιτεί ψευδώνυμο τη στιγμή της δημιουργίας και το γράφει **στο έγγραφο του
 * χώρου**. Ο σπορέας απλώς **δεν περνούσε από εκείνη την πόρτα** — τώρα σπέρνει
 * την **ίδια αναλλοίωτη**: *κάθε χώρος έχει διεύθυνση*.
 *
 * ⚠️ **ΚΑΘΑΡΑ ΛΑΤΙΝΙΚΟ, ΕΠΙΤΗΔΕΣ**: το `judgeAliasShape` απορρίπτει ανάμειξη
 * σεναρίων γραφής, και ο σκελετός UTS #39 του ελληνικού `αλφα` συμπίπτει με του
 * λατινικού `alfa`. Ένα δοκιμαστικό ψευδώνυμο δεν έχει λόγο να δοκιμάζει και τα
 * όρια της ομοιογραφίας.
 */
export const COMPANY_ALIAS = 'alpha-techniki';

/**
 * **Το κλειδί εγγράφου** του `workspace_aliases/` — δηλαδή `skeleton(COMPANY_ALIAS)`.
 *
 * 🔴 **ΓΙΑΤΙ ΠΑΓΩΜΕΝΟ ΚΑΙ ΟΧΙ ΚΛΗΣΗ — ΟΠΩΣ ΤΑ `escoUri` ΠΑΡΑΠΑΝΩ**: το
 * `lib/unicode/skeleton.ts` είναι **`server-only`** *(φρουρός bundle: ο πίνακας
 * UTS #39 είναι ~80 KB και ο πελάτης δεν τον χρειάζεται ποτέ)*, και ο σπορέας
 * τρέχει σε **σκέτο `tsx`**, όπου το `server-only` **δεν επιλύεται καν** —
 * μετρημένο: `Cannot find module 'server-only'`.
 *
 * ⛔ **ΜΗΝ γράψεις εδώ δεύτερη υλοποίηση σκελετού.** Θα ήταν δεύτερη γραμματική
 *    για το ίδιο κλειδί — ακριβώς το σχήμα που γέννησε το ADR-749.
 *
 * 🔑 **Η ΤΙΜΗ ΕΙΝΑΙ ΕΛΕΓΞΙΜΗ, ΟΧΙ ΘΕΜΑ ΕΜΠΙΣΤΟΣΥΝΗΣ**: η άγκυρα **Κ9δ**
 * (`lib/workspace/__tests__/workspace-segment.test.ts`) τρέχει σε jest, όπου το
 * `server-only` **επιλύεται**, και **ΕΚΤΕΛΕΙ** την αυθεντία:
 * `expect(skeleton(COMPANY_ALIAS)).toBe(COMPANY_ALIAS_KEY)`. Αν αποκλίνουν, ο
 * σπορέας θα έγραφε το ευρετήριο σε **λάθος κλειδί** και ο επαγγελματίας θα
 * ξανάβλεπε 404 — και το μαθαίνεις στην πύλη, όχι στην οθόνη.
 */
export const COMPANY_ALIAS_KEY = 'alpha-techniki';

/**
 * ⚠️ **Οι κωδικοί ISCO ΔΕΝ είναι διακοσμητικοί** — τους διαβάζει το
 * `ISCO_JOB_AFFINITY` (`config/isco-job-affinity.ts`) και **σπάει την ισοβαθμία**
 * της πρότασης δουλειάς.
 *
 * ⛔ **ΜΗΝ επινοήσεις κωδικό.** Κάθε τιμή εδώ υπάρχει στον χάρτη ή είναι πρόθεμά
 * του (`2142` ⇒ `214`). Άγνωστος κωδικός δεν σπάει τίποτα — απλώς **δεν κάνει
 * τίποτα**, και η προσωπικότητα γίνεται σιωπηλά ισοδύναμη με «χωρίς επάγγελμα».
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΚΑΘΕ `escoUri` ΕΔΩ ΤΟ ΑΠΑΝΤΗΣΕ Η ΑΥΘΕΝΤΙΑ — ΚΑΝΕΝΑ ΔΕΝ ΓΡΑΦΤΗΚΕ ΑΠΟ ΜΝΗΜΗ
 *
 * Τα URI και οι κωδικοί τους αντλήθηκαν **ζωντανά** από το ESCO Web Service API
 * (2026-08-26). Το ESCO εγγυάται ότι **κάθε occupation ανήκει σε ακριβώς μία**
 * ομάδα ISCO-08 ⇒ το ζεύγος `(escoUri, iscoCode)` είναι **ελέγξιμο**, όχι θέμα
 * εμπιστοσύνης. Το φυλάει η άγκυρα `Κ8`.
 *
 * ⚠️ **ΓΙΑΤΙ ΠΑΓΩΜΕΝΑ ΚΑΙ ΟΧΙ ΚΛΗΣΗ ΤΗΝ ΩΡΑ ΤΗΣ ΣΠΟΡΑΣ — ΜΕΤΡΗΜΕΝΟ**: το ζωντανό
 * ESCO API **σπάει** πάνω στο κεντρικότερο επάγγελμα της εφαρμογής.
 * Αναπαραγώγιμο 2026-08-26:
 *
 *   `search?text=civil engineer&language=en&limit=3`            ⇒ **200**, `2142.1`
 *   `search?…&limit=3&full=true`                                ⇒ **HTTP 500**
 *   `resource/occupation?uri=…d7d986e1…` *(κάθε γλώσσα)*        ⇒ **HTTP 500**
 *   `More than one value found for field 'hasSkillType' and language 'null'`
 *
 * Δηλαδή **μία** χαλασμένη εγγραφή της αυθεντίας μηδενίζει **ολόκληρη** την
 * απάντηση — δεν υποβαθμίζεται, **σκάει**. Σπορέας που ρωτούσε το δίκτυο θα ήταν
 * μη ντετερμινιστικός **και** δομικά ανίκανος να φτιάξει πολιτικό μηχανικό.
 *
 * 🔑 Γι' αυτό η παραγωγή διαβάζει τον **καθρέφτη** (`system/esco_cache/occupations`,
 * `esco.service.ts`) και **ποτέ** το ζωντανό API — αρχιτεκτονική που αυτή η
 * μέτρηση **επικυρώνει εκ των υστέρων**.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΤΙ **ΔΕΝ** ΕΙΝΑΙ ΑΥΤΟΣ Ο ΚΑΤΑΛΟΓΟΣ: ΛΕΞΙΚΟ ΕΠΑΓΓΕΛΜΑΤΩΝ
 *
 * Ο **μισθωτής** και ο **προμηθευτής** — ρητά ζητούμενοι — **δεν είναι εδώ, και
 * δεν είναι παράλειψη**: δεν είναι επαγγέλματα αλλά **ρόλοι σε συναλλαγή**, και
 * ζουν ήδη αλλού *(`contacts.personaTypes` · `RelationshipType`)*. Κανείς δεν
 * είναι «μισθωτής» ως **επάγγελμα** — είναι μισθωτής **ενός ακινήτου**.
 *
 * 🏆 Το `IfcRoleEnum` κάνει **ακριβώς αυτό το λάθος**, και είναι το πρότυπο που
 * εξάγουν **Revit και ArchiCAD**: στις **23** τιμές του *(επαληθευμένο στο
 * IFC4x3)* βάζει δίπλα-δίπλα `ARCHITECT`/`CIVILENGINEER` *(επαγγέλματα)* και
 * `CLIENT`/`OWNER`/`SUPPLIER`/`RESELLER` *(σχέσεις)*. Ένα πρόσωπο μπορεί να
 * είναι **και τα δύο ταυτόχρονα**, οπότε ένα enum δεν μπορεί να τα εκφράσει — και
 * δεν έχει **καμία** τιμή για τοπογράφο, δικηγόρο, συμβολαιογράφο, λογιστή ή
 * διακοσμητή. **Εμείς τα κρατάμε χωριστά.**
 */
export const PERSONAS: readonly SeedIdentity[] = [
  // ── Ο ΠΟΛΙΤΗΣ — κανένα επάγγελμα, ιδιωτικός χώρος ─────────────────────────
  {
    email: 'ext.seeker@solo.local',
    displayName: 'Ελένη Ζητούσα',
    globalRole: 'external_user',
  },
  {
    email: 'ext.owner@solo.local',
    displayName: 'Κώστας Ιδιοκτήτης',
    globalRole: 'external_user',
  },

  // ── Ο ΑΥΤΟΝΟΜΟΣ ΕΠΑΓΓΕΛΜΑΤΙΑΣ — επάγγελμα ΧΩΡΙΣ οργανισμό ─────────────────
  {
    email: 'ext.architect@solo.local',
    displayName: 'Μαρία Αρχιτεκτονίδου',
    globalRole: 'external_user',
    occupation: {
      profession: 'Αρχιτέκτονας',
      escoLabel: 'αρχιτέκτονας',
      iscoCode: '2161',
      escoUri: 'http://data.europa.eu/esco/occupation/8c3f536e-ba66-4321-ba40-363dc39f129b',
    },
  },
  {
    email: 'ext.lawyer@solo.local',
    displayName: 'Νίκος Δικηγόρου',
    globalRole: 'external_user',
    occupation: {
      profession: 'Δικηγόρος',
      escoLabel: 'δικηγόρος',
      iscoCode: '2611',
      escoUri: 'http://data.europa.eu/esco/occupation/974d4eab-fbee-4c52-b16e-73bdd8c25b53',
    },
  },
  // ⚠️ Ο συμβολαιογράφος ΔΕΝ είναι «δικηγόρος με άλλο όνομα»: το ISCO τον
  // ταξινομεί στο 2619 (Επαγγελματίες νομικού κλάδου π.δ.κ.α.), αδελφή ομάδα
  // του 2611 — ίδια **δουλειά** (Πελάτες), **άλλη** δήλωση. Είναι ο μόνος που
  // ασκεί το γεγονός ότι ΔΥΟ δηλώσεις δείχνουν στην ίδια δουλειά.
  {
    email: 'ext.notary@solo.local',
    displayName: 'Ευαγγελία Συμβολαίου',
    globalRole: 'external_user',
    occupation: {
      profession: 'Συμβολαιογράφος',
      escoLabel: 'συμβολαιογράφος',
      iscoCode: '2619',
      escoUri: 'http://data.europa.eu/esco/occupation/d21890a3-cbe9-49df-9a19-a4120d866548',
    },
  },
  {
    email: 'ext.agent@solo.local',
    displayName: 'Θανάσης Μεσίτης',
    globalRole: 'external_user',
    occupation: {
      profession: 'Μεσίτης ακινήτων',
      escoLabel: 'μεσίτης ακίνητης περιουσίας',
      iscoCode: '3334',
      escoUri: 'http://data.europa.eu/esco/occupation/8ec8df02-e9dd-43b7-b416-5846ae0414ab',
    },
  },
  // ⚠️ Ο διακοσμητής είναι ο **μόνος** που φτάνει στο Σχέδιο από τη **μείζονα
  // ομάδα 3** (Τεχνικοί), όχι από τη 2 (Επαγγελματίες): αποδεικνύει ότι ο
  // πίνακας κρίνει **παραδοτέο**, όχι επίπεδο προσόντων.
  {
    email: 'ext.decorator@solo.local',
    displayName: 'Ιωάννα Διακοσμητή',
    globalRole: 'external_user',
    occupation: {
      profession: 'Διακοσμήτρια εσωτερικών χώρων',
      escoLabel: 'διακοσμητής εσωτερικών χώρων/διακοσμήτρια εσωτερικών χώρων',
      iscoCode: '3432',
      escoUri: 'http://data.europa.eu/esco/occupation/73e776fb-4d99-4031-bad4-7716f121155d',
    },
  },

  // ── Ο ΕΠΑΓΓΕΛΜΑΤΙΑΣ ΣΕ ΟΡΓΑΝΙΣΜΟ ─────────────────────────────────────────
  {
    email: 'int.architect@alpha.local',
    displayName: 'Άννα Αρχιτεκτονίδη',
    companyId: COMPANY_ID,
    globalRole: 'internal_user',
    occupation: {
      profession: 'Αρχιτέκτονας',
      escoLabel: 'αρχιτέκτονας',
      iscoCode: '2161',
      escoUri: 'http://data.europa.eu/esco/occupation/8c3f536e-ba66-4321-ba40-363dc39f129b',
    },
  },
  {
    email: 'int.surveyor@alpha.local',
    displayName: 'Πέτρος Τοπογράφου',
    companyId: COMPANY_ID,
    globalRole: 'internal_user',
    occupation: {
      profession: 'Τοπογράφος Μηχανικός',
      escoLabel: 'αγρονόμος τοπογράφος μηχανικός',
      iscoCode: '2165',
      escoUri: 'http://data.europa.eu/esco/occupation/d8e502b4-1be6-4d10-a224-151688f8f0c8',
    },
  },
  // ⚠️ `2411`, ΟΧΙ `241`: μέχρι 2026-08-26 σπερνόταν η **ελάσσων ομάδα**, τιμή
  // που **κανένα** ESCO occupation δεν κουβαλά — άρα άνθρωπος που ο picker δεν
  // θα μπορούσε να δημιουργήσει. Η δουλειά (`finance`) δεν άλλαξε: το `2411`
  // λύνεται μέσω του **ίδιου** προθέματος `241`.
  {
    email: 'int.accountant@alpha.local',
    displayName: 'Σοφία Λογιστού',
    companyId: COMPANY_ID,
    globalRole: 'internal_user',
    occupation: {
      profession: 'Λογιστής',
      escoLabel: 'λογιστής/λογίστρια',
      iscoCode: '2411',
      escoUri: 'http://data.europa.eu/esco/occupation/eda0d957-3c3c-4139-b89a-a18bc9e18897',
    },
  },
  // ⚠️ Ο μηχανολόγος **δεν** είναι αντίγραφο του πολιτικού: και οι δύο φτάνουν
  // στο Σχέδιο μέσω του **ίδιου** προθέματος `214`, αλλά το `isco-ifc-role.ts`
  // τους ξεχωρίζει σε `MECHANICALENGINEER` και `CIVILENGINEER`. Είναι το ζεύγος
  // που αποδεικνύει ότι οι **δύο** πίνακες μιλούν σε **άλλη ανάλυση**.
  {
    email: 'int.mechanical@alpha.local',
    displayName: 'Λευτέρης Μηχανολόγου',
    companyId: COMPANY_ID,
    globalRole: 'internal_user',
    occupation: {
      profession: 'Μηχανολόγος Μηχανικός',
      escoLabel: 'μηχανολόγος μηχανικός',
      iscoCode: '2144',
      escoUri: 'http://data.europa.eu/esco/occupation/579254cf-6d69-4889-9000-9c79dc568644',
    },
  },
  // ⚠️ «Εργαζόμενος» έχει **ΔΥΟ** αναγνώσεις και αυτός καλύπτει τη **μία**: το
  // επάγγελμα «εργάτης οικοδομών» (ISCO 9313). Η **άλλη** — «εργαζόμενος ΤΗΣ
  // εταιρείας» — δεν είναι επάγγελμα αλλά **συμμετοχή**, και την κουβαλούν ήδη
  // όλοι οι `int.*` μέσω `companyId` + `internal_user`. Είναι ο **μόνος** που
  // δίνει στο rig κάλυψη της δουλειάς **Εργοτάξιο**.
  {
    email: 'int.worker@alpha.local',
    displayName: 'Γιάννης Οικοδόμος',
    companyId: COMPANY_ID,
    globalRole: 'internal_user',
    occupation: {
      profession: 'Εργάτης οικοδομών',
      escoLabel: 'εργάτης οικοδομών/εργάτρια οικοδομών',
      iscoCode: '9313',
      escoUri: 'http://data.europa.eu/esco/occupation/fb7e2f4f-1545-42f1-972e-94082e49c6dc',
    },
  },
  {
    email: 'admin.civil@alpha.local',
    displayName: 'Δημήτρης Πολιτικός',
    companyId: COMPANY_ID,
    globalRole: 'company_admin',
    occupation: {
      profession: 'Πολιτικός Μηχανικός',
      escoLabel: 'πολιτικός μηχανικός',
      iscoCode: '2142',
      escoUri: 'http://data.europa.eu/esco/occupation/d7d986e1-7333-431b-9719-0c5c6939e360',
    },
  },
] as const;
