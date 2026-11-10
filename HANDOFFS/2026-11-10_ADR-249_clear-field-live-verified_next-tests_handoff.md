# HANDOFF — ADR-249 §7.8: το άδειασμα πεδίου (`null` ⇒ διαγραφή) είναι ΖΩΝΤΑΝΟ και επαληθευμένο — επόμενα: tests + ανοιχτά

**Ημερομηνία:** 2026-11-10 · **Worktree:** `C:\Nestor_Worktrees\pea-sold-truth` · **Κλαδί:** `agent/pea-sold-truth`
**Κανόνες:** commit μόνο στο κλαδί, με ρητή λίστα αρχείων — ΠΟΤΕ στο `main`. `wt:land` και push ΜΟΝΟ με εντολή Giorgio.
Κανένα test / πύλη / tsc χωρίς έγκρισή του. Κανένα email σε επαφές.

## 1. Τι έγινε (στην παραγωγή)

- Commit `a8f2f25f` — «clearing a field - null means delete, one translation point (ADR-249 §7.8)» — στο `main`, push
  `61679b87..a8f2f25f`· ζωντανό (το deploy `4a3b417` το περιέχει).
- Αρχεία: `src/app/api/properties/[id]/property-patch-helpers.ts` · `route.ts` · `property-energy-patch.ts` · ADR-249 §7.8 + changelog.
- Ουσία:
  - `PropertyPatchSchema`: `.nullable()` στα `commonCharges` · `energy` · `description` (κοινό σε PATCH **και** `impact-preview`).
  - `PROPERTY_CLEARABLE_FIELDS` — **κλειστό** σύνολο: `description · condition · areas · energy · commonCharges ·
    systemsOverride · finishes · interiorFeatures · securityFeatures`. Τα `floor/floorId/buildingId/projectId/area/price`
    κρατούν επίτηδες αποθηκευμένο `null` (ερωτήματα `== null`)· το `levelData` το κατέχει ο normalizer.
  - `firestoreUpdateOf(updateData)` — το ΕΝΑ σημείο `null → FieldValue.delete()`, μόνο στο `withVersionCheck`.
  - `propertyAfterUpdate(existing, updateData)` — η δημόσια προβολή βλέπει το έγγραφο χωρίς τα σβησμένα.
  - `energyDeclarationPatch(…, null, …)`: φεύγει η αυτο-δηλωμένη αξίωση· επιβιώνουν τα legacy (`certificateId` ·
    `certificateDate` · `validUntil`), αλλιώς `energy: null` ⇒ διαγραφή.

## 2. Ζωντανή επαλήθευση (nestorconstruct.gr) — ΟΛΑ ✅

| # | Μονάδα | Δοκιμή | Αποτέλεσμα |
|---|---|---|---|
| 1 | ΔΟΚΙΜΗ Ε (πωλημένο, `prop_a0000005-…`) | άδειασμα κοινοχρήστων (40 €) | impact-preview 200 · PATCH 200 · `commonCharges` **απόν** · `_v: 2` |
| 2 | ΔΟΚΙΜΗ Δ (`prop_a0000004-…`) | κλάση Β + περιγραφή → αποθήκευση | 200 · αξίωση `energy-performance:self-declared:B` γράφτηκε |
| 3 | ΔΟΚΙΜΗ Δ | «Χωρίς κλάση» + κενή περιγραφή | impact-preview 200 · PATCH 200 · `energy` + `description` **απόντα** · αξίωση **έφυγε** · `_v: 2` |
| 4 | ΔΟΚΙΜΗ Ε | αλλαγή ΠΕΑ σε πωλημένο | ο **πελάτης** αρνήθηκε (toast «κλειδωμένα πεδία») · **κανένα PATCH** · έγγραφο ανέγγιχτο |

Και οι δύο μονάδες είναι πίσω στην αρχική κατάσταση (χωρίς ΠΕΑ / περιγραφή / κοινόχρηστα).

## 3. Επόμενα βήματα (ΧΡΕΙΑΖΟΝΤΑΙ ΕΓΚΡΙΣΗ Giorgio — ρώτα πρώτα)

1. **Tests (άγκυρες)** — πρώτα SSoT audit των υπαρχόντων στο `src/app/api/properties/[id]/__tests__/`
   (`property-patch-common-charges.test.ts` · `property-patch-energy-certificate.test.ts` · `property-energy-import-chain.test.ts`):
   - σχήμα δέχεται `null` σε `commonCharges` / `energy` / `description`·
   - `firestoreUpdateOf`: `null` σε clearable ⇒ `FieldValue.delete()`· `null` σε `floorId`/`buildingId` ⇒ μένει `null`·
   - `propertyAfterUpdate`: τα σβησμένα λείπουν, τα υπόλοιπα συγχωνεύονται·
   - `energyDeclarationPatch(…, null, …)`: αξίωση φεύγει · legacy επιβιώνουν · χωρίς legacy ⇒ `energy: null`·
   - μετάλλαξη (π.χ. χωρίς `isClearing`) ⇒ κόκκινο.
   - Επίσης από §7 (ADR-249 §7.7): tests mapper (`property-form-areas.test.ts`, `property-form-commercial.test.ts`) να κρίνουν
     το `changedPropertyUpdatesFromForm`· άγκυρες `judgeLockedFields` / `changedPropertyFields`.
2. **Πρόταση (όχι υλοποιημένη):** άδειασμα `areas` δεν μηδενίζει τον καθρέφτη `area`
   (`property-write-normalizer.ts`, `applyLegacyFlatAreaDerivation`: `payload.areas ?? existing.areas`) — ίδια συμπεριφορά με
   το σημερινό `gross: 0`.
3. **Μικρό υπόλειμμα:** μετά το σβήσιμο ΠΕΑ μένει `legality: []` (πριν: απόν). Ισοδύναμο σημασιολογικά· να αποφασιστεί αν
   κενός πίνακας αξιώσεων ⇒ διαγραφή (θα έμπαινε στο ίδιο `firestoreUpdateOf`).
4. **Πρόταση SSoT (N.0.2, να ερωτηθεί):** το μοτίβο `null → FieldValue.delete()` ζει τοπικά και αλλού
   (`common-space-drawn-area.server.ts:126` · `opportunity-*.server.ts` · `soft-delete-engine.ts`) — υποψήφιο κοινό helper.
5. **Μη δοκιμασμένο ζωντανά:** 403 του **server** σε κλειδωμένο πεδίο (ο πελάτης αρνείται πρώτα) · σβήσιμο υπάρχοντος ΠΕΑ σε
   πωλημένο (καμία δοκιμαστική μονάδα πωλημένη με ΠΕΑ).

## 4. ΜΗΝ

- Μην τρέξεις tests / tsc / πύλες χωρίς έγκριση. Μην κάνεις `wt:land` / push χωρίς εντολή. Μην κάνεις commit στο `main`.
- Μην επεκτείνεις το `PROPERTY_CLEARABLE_FIELDS` σε πεδία σύνδεσης (`floorId` κ.λπ.) — σπάει ερωτήματα `== null`.
- Μην μετατρέψεις `null` σε `FieldValue.delete()` πριν από το ιστορικό/κλείδωμα/προβολή — μόνο στην εγγραφή.
