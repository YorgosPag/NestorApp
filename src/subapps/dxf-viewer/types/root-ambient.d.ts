/**
 * Γέφυρα ορατότητας **subapp → root**: ambient module declarations που ζουν στο
 * `src/types/` και πρέπει να φαίνονται στο standalone TypeScript program του subapp.
 *
 * ## Γιατί χρειάζεται
 *
 * Το `src/subapps/dxf-viewer/tsconfig.json` έχει `include: ["**\/*.ts", ...]` **σχετικά
 * με τον φάκελο του subapp** — άρα τα `.d.ts` του `src/types/` δεν μπαίνουν ποτέ στο
 * program του. Αρχεία εκτός subapp (π.χ. `src/lib/firebaseAdmin.ts`) μπαίνουν μεν μέσω
 * import-chain, αλλά οι ambient δηλώσεις τους όχι — κανένα import δεν τις τραβά. Το
 * αποτέλεσμα ήταν TS2307/TS7016 μέσα στο subapp για πακέτα ήδη τυποποιημένα στο root.
 *
 * Είναι η **κατοπτρική** εικόνα του `src/types/dxf-viewer-ambient.d.ts`, που λύνει το
 * ίδιο πρόβλημα προς την αντίθετη κατεύθυνση.
 *
 * ## Η ιστορική παγίδα που καταργεί
 *
 * Πριν το ADR-719 η λύση ήταν **αντιγραφή** μέσα σε ένα bundle
 * (`types/test-modules.d.ts`). Τα αντίγραφα απέκλιναν σιωπηλά: το `@google-cloud/storage`
 * είχε εδώ `Bucket.file() → unknown` ενώ το root δήλωνε `Bucket.file() → File` μαζί με
 * `File`/`Storage`/`DeleteFilesOptions`. Δηλαδή το subapp «έβλεπε» **ψεύτικο** SDK.
 * Το bundle ήταν και ο λόγος που η αντιγραφή ήταν αναπόφευκτη: δεν γίνεται reference σε
 * **μέρος** αρχείου, άρα μία δήλωση ανά αρχείο είναι δομική απαίτηση, όχι αισθητική.
 *
 * ⚠️ **ΠΟΤΕ αντίγραφο.** Το φυλάει το
 * `src/types/__tests__/ambient-declaration-ssot.test.ts`.
 *
 * @module subapps/dxf-viewer/types/root-ambient
 * @see docs/centralized-systems/reference/adrs/ADR-719-ambient-declaration-ssot.md
 */

/** `@google-cloud/storage` — μεταβατικό μέσω firebase-admin. Καταναλωτές: 9 αρχεία σε `src/lib`, `src/services`, `src/app/api`. */
/// <reference path="../../../types/google-cloud-storage.d.ts" />

/** `pako` — deflate/inflate. Καταναλωτές: `services/dxf-firestore-storage.impl.ts` (subapp) + 3 στο `src/services/floorplans`. */
/// <reference path="../../../types/pako.d.ts" />

/** `@jest/globals` — named imports αντί για globals. Καταναλωτές: ~145 test αρχεία. */
/// <reference path="../../../types/jest-globals.d.ts" />

/** `vitest` — δύο tests γραμμένα σε vitest API πάνω σε Jest runner. Βλ. σχόλιο στο ίδιο το αρχείο. */
/// <reference path="../../../types/vitest.d.ts" />

/**
 * `react` — JSX augmentation για το custom element `<model-viewer>` (ADR-845 Φ4.3).
 *
 * ⚠️ **Ο καταναλωτής ΔΕΝ είναι το `<model-viewer>`, είναι το ΙΔΙΟ ΤΟ `react`.** Το
 * subapp εισάγει React σε ~500 αρχεία· χωρίς τη γέφυρα το program του βλέπει
 * **άλλο** `react` από το root — και η απόκλιση δεν βγάζει σφάλμα, απλώς αφήνει το
 * ένα program να δέχεται ό,τι το άλλο απορρίπτει. Ακριβώς η κλάση που γέννησε το
 * ADR-719 *(«το subapp έβλεπε ψεύτικο SDK»)*, με πακέτο αντί για SDK.
 */
/// <reference path="../../../types/model-viewer.d.ts" />

/*
 * ── Σκοπίμως ΕΚΤΟΣ γέφυρας ───────────────────────────────────────────────────────
 *
 * `src/types/window.d.ts` — global augmentation του `Window` που **συγκρούεται** με το
 *   τοπικό `types/dxf-window.d.ts` (ίδιες ιδιότητες, αποκλίνουσες υπογραφές → TS2717
 *   αν βρεθούν στο ίδιο program). Συγχώνευση = ξεχωριστή εργασία, βλ. ADR-719 §7.
 *
 * `src/types/firebase-admin-timestamp.d.ts`, `src/types/vendor/*` — καθαρά server-side
 *   πακέτα χωρίς καταναλωτή μέσα στο subapp. Προστίθενται μόνο αν εμφανιστεί.
 */
