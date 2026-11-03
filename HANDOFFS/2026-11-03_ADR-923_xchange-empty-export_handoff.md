# ADR-923 §5.14.1 · Εξαγωγή xChange χωρίς κενό αρχείο — handoff

**Ημερομηνία:** 2026-11-03 · **Worktree:** `C:\Nestor_Worktrees\xchange-report-typography` · **Κλαδί:** `agent/xchange-report-typography`
**`main` = `origin/main` = `1637a910`** (land + push έγιναν, deploy Netcup ✅). Το κλαδί έχει **1 commit μπροστά**: `d38fcb41`.

## 1. Τι έγινε
- **Βήμα 0** ✅: land + push `1637a910`. Στην παραγωγή: «8 προϊόντα … δεν **εξήχθησαν**», **μία** τελεία μετά το «μ.μ.».
- **Βήμα Α (απόφαση Ε3)**, commit `d38fcb41` (πλήρες hook, **όχι** στο main): ADR-923 §5.14.1 Ζ19–Ζ22.
  - Εύρημα: το σχήμα 2.0 έχει `Supplier.Product` `minItems: 1` ⇒ το `Product: []` ήταν **άκυρο** έγγραφο.
  - Άρνηση 422 `xchangeNothingToExport` + αιτία · `GET /api/catalog/xchange-export/preview` (ίδιο `judgeAudience`) ·
    κενή κατάσταση με σύνδεσμο διόρθωσης (`/catalog/discounts?tab=visibility` · προϊόντα) · κουμπί κλειστό · εμπόδια πριν το κλικ.
  - Tests: 7 + 5 + 6 · 3 μεταλλάξεις νεκρές · jscpd καθαρό.

## 2. Ζωντανοί έλεγχοι (παραγωγή, πριν το `d38fcb41`)
| # | Αποτέλεσμα |
|---|---|
| 3 χωρίς επωνυμία | ⛔ **Δεν γίνεται από την εφαρμογή**: `api/accounting/setup/route.ts:83` απορρίπτει κενή επωνυμία. Συμβαίνει μόνο σε χώρο χωρίς προφίλ λογιστικής. Καμία εγγραφή· καλύπτεται από jest |
| 4α διπλός κωδικός ομάδας | ✅ «Ο κωδικός «genika» υπάρχει ήδη εδώ.» / EN ✅ · καμία ομάδα δεν γράφτηκε |
| 4β κείμενο σε αριθμητικό | ✅ «Η μονάδα «abc» δεν ανήκει σε αυτή την οικογένεια.» (`aria-describedby`) · «Χωρίς αλλαγές» · πεδίο άδειο ξανά |
| 4γ PDF ως φωτογραφία | ⏸️ δεν έγινε: θα ανέβαζε αρχείο στο storage της παραγωγής |
| 6 αγγλικά | ✅ ευρήματα + αναφορά στα αγγλικά · επιστροφή σε Ελληνικά ✅ |

## 3. Επόμενα
1. **Με εντολή Giorgio**: `npm run wt:land -- xchange-report-typography` → push → ζωντανά: ο χώρος δοκιμής πρέπει να δείξει κενή κατάσταση
   «Κανένα προϊόν για εξαγωγή…» με αιτία `noVisibilityRules` και σύνδεσμο «Ρύθμιση ορατότητας», κουμπί κλειστό.
2. 4γ αν το θέλει ο Giorgio (ανέβασμα + αναίρεση).

## 4. Ευρήματα εκτός εργασίας
- 🔴 `src/components/shared/audit/__tests__/audit-field-descriptor.test.ts` **κόκκινο** (78 γραμμές: `catalog_publication_run.*`,
  `catalog_attribute.searchable` χωρίς μετάφραση στο `common-audit.json`). Άσχετο με αυτό το commit· υπάρχει ήδη στο `main`.
- ⚠️ Μετά την αλλαγή γλώσσας σε English το `<html lang>` μένει `"el"` (προσβασιμότητα: αναγνώστες οθόνης).
- Από πριν: `catalogReadRoute` χωρίς `Cache-Control: no-store` · δίδυμος `readExportData`/`readCatalogData` · `bogus!` ⇒ 404 αντί 400.
