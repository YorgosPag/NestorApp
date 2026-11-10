# Handoff — ADR-249: κλείδωμα κατά ΑΛΛΑΓΗ ΤΙΜΗΣ + η φόρμα στέλνει μόνο ό,τι άλλαξε (επιλογή Γ)

**Ημερομηνία:** 2026-11-10 · **Worktree:** `C:\Nestor_Worktrees\pea-sold-truth` · **Κλαδί:** `agent/pea-sold-truth`
**Κλαδί HEAD:** `60d82f99` (ΟΧΙ land, ΟΧΙ push — και τα δύο **μόνο με εντολή Giorgio**)

## 1. Τι έγινε σε αυτή τη συνεδρία
- **ADR-935 ζωντανά επαληθευμένο** (nestorconstruct.gr, `ba85614`): στο «ΔΟΚΙΜΗ Υ2 — Διαμέρισμα Β (κρατημένο)» το «Επιβεβαίωση Πώλησης» μένει απενεργοποιημένο **και με επιλεγμένο αγοραστή**, με το μήνυμα του οριστικού.
- **Μεζονέτα 95 τ.μ.** → `reserved`: ακύρωση πρόχειρου Α-2 (Λογιστική, UI) + `scripts/migrations/correct-sold-without-final-contract.ts --apply`. ΔΟΚΙΜΗ Ε/ΣΤ/Υ2 δηλωμένα δείγματα. Όλα στο ADR-935 §6 (commit `60d82f99`).
- ⚠️ Το Α-2 δείχνει ακόμη «Εξοφλημένο» στην κατάσταση πληρωμής (ακυρωμένο, `payments: []`) — να το κοιτάξει η λογιστική αν ενοχλεί· **εκτός πεδίου**.
- Τρέξιμο scripts σε worktree χωρίς `.env.local`: προφόρτωση του `C:/Nestor_Pagonis/.env.local` με `NODE_OPTIONS=--require <preload>` (το scratchpad της συνεδρίας χάνεται — ξαναγράψ' το, 10 γραμμές).

## 2. Απόφαση Giorgio: **Γ** («κάνε τα όλα εσύ») — υλοποίησε με αυτή τη σειρά

### Έρευνα (έγινε, μην την ξανακάνεις)
- **AIP-203 IMMUTABLE**: «the service should ignore the field if the value matches» · σφάλμα **μόνο αν αλλάζει**. AIP-134: μάσκα πεδίων. RFC 7396 merge patch. AIP-154 etag. Figma: per-property LWW, ο πελάτης στέλνει μόνο τις αλλαγμένες ιδιότητες.
- Συναίνεση: πελάτης στέλνει μόνο ό,τι άλλαξε **ΚΑΙ** ο server κρίνει κλείδωμα από **αλλαγή τιμής**, με έλεγχο έκδοσης.

### SSoT audit (έγινε)
- Κλείδωμα: `src/lib/property/property-locked-fields.ts` `lockedFieldsAttempted(status, updateKeys)` — κρίνει **παρουσία κλειδιού**. Καταναλωτές: server `lib/firestore/property-field-locking.ts` (`validatePropertyFieldLocking` ← `validatePropertyFieldLockingUnlessRevert`, καλείται στο `api/properties/[id]/route.ts:115`) · πελάτης `services/property/property-mutation-gateway.ts:179` `assertFieldLocking` · `isFieldLocked`.
- Σύγκριση τιμών: `lib/audit/audit-diff.ts` (`serializeScalar`, `sortKeys`=`sortKeysDeep`, κενό→null). ⚠️ «τιμή → απούσα» ΔΕΝ μετρά ως αλλαγή (μετρημένο σήμερα).
- Diff φόρμας: `services/property/property-form-sync.ts` `buildFormDataFromProperty` + `diffServerSnapshot` (ADR-287 Batch 23).
- Σκόρπια «μόνο όταν άλλαξε» στο `features/property-details/components/property-fields-form-mapper.ts`: εμβαδά (`sameAreas`), ΠΕΑ (`sameEnergyCertificate`), κοινόχρηστα (`sameCommonCharges`), ποσά (`changedCommercialAmounts`). Σταθερά στέλνονται: `name/code/type/operationalStatus/commercialStatus/floor/floorId/layout/orientations` + `condition/systemsOverride/finishes/interiorFeatures/securityFeatures` όταν μη κενά.
- Έλεγχος έκδοσης: ο PATCH δέχεται ήδη `_v` (`withVersionCheck`).

### Βήμα Β (server — ο κριτής, πρώτο: ξεμπλοκάρει την «Αποθήκευση» σε κρατημένο/πωλημένο)
1. `lockedFieldsAttempted(status, updates, current?)` — όταν δίνεται `current`, κλειδωμένο πεδίο με **ίδια** τιμή δεν είναι απόπειρα (σύγκριση με `serializeScalar`/`sortKeysDeep` του `audit-diff`, όχι νέα ισότητα). Pure αρχείο — κοινό πελάτη/server.
2. Server: το `validatePropertyFieldLockingUnlessRevert(currentStatus, body, existing)` **αφαιρεί** από το `body` τα κλειδωμένα-αμετάβλητα (AIP-203 «ignore») και 403 μόνο για αλλαγμένα· μήνυμα με τα ονόματα πεδίων.
3. Πελάτης: `assertFieldLocking` περνά το `currentProperty` (το έχει ήδη το gateway).
4. Προσοχή: `commercialStatus` ίδιο σε sold = αμετάβλητο ⇒ επιτρέπεται (σήμερα 403)· `validateTransactionExit` μένει ως έχει.

### Βήμα Γ-πελάτη (μετά)
- Ο mapper παράγει πλήρες payload όπως σήμερα, μετά **ΕΝΑ** φίλτρο: κρατά μόνο ό,τι διαφέρει από το `property` (ίδιος comparator με το Β) — αντικαθιστά τα 4 σκόρπια `same*`/`changed*` (επέκταση, όχι 2ο diff). Πολυεπίπεδα (`levelData`→`areas/layout/orientations` συνάθροιση) να περνούν από το ίδιο φίλτρο.
- `_v` να στέλνεται πάντα από τη φόρμα (έλεγξε αν ήδη στέλνεται).

### Τεκμηρίωση
- **ADR-249** (επέκταση, όχι νέο ADR): §«κλείδωμα κατά αλλαγή τιμής (AIP-203)» + changelog. Πρώτα έλεγξε ADR-249 vs κώδικα (N.0.1).

## 3. Μετά
- §3.3 δοκιμή ΠΕΑ με τον Γιάννη στη «Μεζονέτα 95 τ.μ.» (τώρα `reserved`· τα πεδία ΠΕΑ ανοιχτά — ADR-915 §38). Μετά το Β + push, επιτρέπεται και «Αποθήκευση». ADR-915 §38.4 ⏳ → ✅.

## 4. ⛔ ΜΗΝ
- Tests/πύλες/tsc χωρίς έγκριση (N.17 · κανόνες 2026-11-05). `wt:land`/push μόνο με εντολή.
- Δεύτερη συνάρτηση ισότητας — χρησιμοποίησε τον serializer του `audit-diff`.
- Email σε επαφές.
