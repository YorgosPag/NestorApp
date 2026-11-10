# HANDOFF — ADR-249 §7.9: άγκυρες + καθρέφτης `area` + κοινό `null → delete` είναι στο `main` και PUSHED — επόμενα: ζωντανή επαλήθευση + §7.7

**Ημερομηνία:** 2026-11-11 · **Worktree:** `C:\Nestor_Worktrees\pea-sold-truth` · **Κλαδί:** `agent/pea-sold-truth`
**Κανόνες:** commit μόνο στο κλαδί, με ρητή λίστα αρχείων — ΠΟΤΕ στο `main`. `wt:land` και push ΜΟΝΟ με εντολή Giorgio.
Κανένα test / πύλη / tsc χωρίς έγκρισή του. Κανένα email σε επαφές. Πριν από land/push: έλεγξε αν τρέχει land/push άλλου
πράκτορα (`Get-CimInstance Win32_Process`, ψάξε `wt:land` / ` push`) και περίμενε να τελειώσει.

## 1. Τι έγινε

- Κλαδί: `da12873c` (άγκυρες) + `68067615` (fix) → `wt:land` ⇒ **ένα** commit στο `main`: **`026b50ee`**
  («fix(property): area mirror follows a cleared areas block; one shared null-to-delete translation (ADR-249 §7.9)»).
- **Push**: `c2e3ed60..026b50ee main -> main` (μόνο δικό μας commit). CHECK 3.86: καμία αλλαγή κανόνων/δεικτών Firestore.
- ⚠️ Το μήνυμα deploy που είδε ο Giorgio έλεγε `live 5fcca31` — **προηγούμενο** commit. Πριν τη ζωντανή επαλήθευση
  βεβαιώσου ότι το live deploy περιέχει το `026b50ee` (GitHub Actions / μήνυμα deploy).

### Αρχεία (στο `026b50ee`)
- **ΝΕΟ** `src/lib/firestore/merge-patch-deletes.ts` — `withMergePatchDeletes(patch, isClearable?)` ·
  `documentAfterMergePatch(existing, patch, isClearable?)` (RFC 7396 `null` → `FieldValue.delete()`, ο καλών λέει ποια πεδία).
  Καταναλωτές: `app/api/properties/[id]/property-patch-helpers.ts` (`firestoreUpdateOf` / `propertyAfterUpdate`, κριτής
  `PROPERTY_CLEARABLE_FIELDS`) και `lib/common-spaces/common-space-drawn-area.server.ts` (κάθε `null`, ίδια συμπεριφορά).
  Τα `opportunity-*` / `soft-delete-engine` / `thread-writer` **σκόπιμα όχι** (λίστα πεδίων μετάβασης, άλλο σχήμα).
- `src/lib/firestore/property-write-normalizer.ts` — αμετάβλητη 4: σώμα **με** `areas` (τιμή ή `null`) ⇒ `area` =
  μετρημένο μικτό (`measuredAreaOrNull`) αλλιώς **`null`** (και στη δημιουργία: `gross: 0` ⇒ `area: null`)· σώμα χωρίς
  `areas` ⇒ μόνο θεραπεία από το αποθηκευμένο. 🔴 Πριν: `payload.areas ?? existing.areas` ξαναέγραφε το παλιό μικτό.
- `legality: []` — **απόφαση: μένει** (κανονική μορφή «καμία αξίωση»· ίδια με owner service + δημόσια αγγελία, ADR-838).
- Tests: `__tests__/property-patch-clearing.test.ts` (Κ1–Κ5) · `lib/firestore/__tests__/merge-patch-deletes.test.ts`
  (Μ1–Μ2) · νέες περιπτώσεις στο `property-write-normalizer.test.ts` · διορθωμένες δύο μπαγιάτικες άγκυρες
  (`property-patch-common-charges` / `-energy-certificate`: `null` πλέον περνά). **5 σουίτες, 103/103 πράσινα.**
- ADR-249 §7.7 (καθαρίστηκε) + **§7.9** + changelog · ADR-931 changelog.

## 2. Επόμενα βήματα (ρώτα Giorgio πριν από tests / browser)

1. **Ζωντανή επαλήθευση στο nestorconstruct.gr** (αφού βεβαιωθεί deploy με `026b50ee`), σε δοκιμαστική μονάδα
   (π.χ. ΔΟΚΙΜΗ Δ `prop_a0000004-…`, ΟΧΙ πωλημένη — εκεί τα `areas` είναι κλειδωμένα):
   - δήλωσε μικτό (π.χ. 80) → αποθήκευση ⇒ `areas.gross: 80` **και** `area: 80`·
   - άδειασε όλα τα εμβαδά → αποθήκευση ⇒ `areas` **απόν**, `area: null` (ΟΧΙ 80) · `_v` +1 · impact-preview 200·
   - άδειασε μόνο το μικτό, κράτα καθαρό ⇒ `area: null`·
   - επανάφερε τη μονάδα στην αρχική κατάσταση.
2. **ADR-249 §7.7 — άγκυρες που εκκρεμούν**: τα tests του mapper (`property-form-areas.test.ts` ·
   `property-form-commercial.test.ts` · `property-energy-import-chain.test.ts`) να κρίνουν το
   `changedPropertyUpdatesFromForm` (όχι το «μόνο όταν άλλαξε» μέσα στον mapper)· άγκυρες για `judgeLockedFields` /
   `changedPropertyFields` (`lib/property/property-field-change.ts`). Πρώτα SSoT audit των υπαρχόντων tests.
3. **Μετάλλαξη (μη τρεγμένη)**: να επιβεβαιωθεί ότι οι άγκυρες κοκκινίζουν (χωρίς `isPropertyClearable` · επέκταση
   συνόλου σε `floorId` · normalizer με `?? existing.areas`). Επαναφορά στο ΙΔΙΟ tool call· μόνο με έγκριση.
4. **Μη δοκιμασμένο ζωντανά** (από το προηγούμενο handoff): 403 του **server** σε κλειδωμένο πεδίο (ο πελάτης αρνείται
   πρώτα) · σβήσιμο υπάρχοντος ΠΕΑ σε πωλημένο.

## 3. ΜΗΝ

- Μην τρέξεις tests / tsc / πύλες / browser χωρίς έγκριση. Μην κάνεις `wt:land` / push χωρίς εντολή. Μην κάνεις commit στο `main`.
- Μην επεκτείνεις το `PROPERTY_CLEARABLE_FIELDS` σε πεδία σύνδεσης (`floorId` κ.λπ.) — σπάει ερωτήματα `== null`.
- Μην κάνεις το `area` διαγραφή (`FieldValue.delete()`) — είναι πεδίο αποθηκευμένου `null`.
- Μην αλλάξεις το `legality: []` σε διαγραφή — απόφαση §7.9.
