# ADR-923 · Κύμα 4 · Handoff #7 (2026-11-06) — Λ7: Ν10(α) γραμμένο → jest + επαλήθευση

Αντικαθιστά το `HANDOFFS/2026-11-06_ADR-923_wave4_L7-N11f-seal-N10a_handoff.md`. Τα «Μαθήματα» των προηγούμενων ισχύουν.

- **Worktree:** `C:\Nestor_Worktrees\adr-923-wave4` · **Κλαδί:** `agent/adr-923-wave4`. Η νέα συνεδρία συνεχίζει **στο ίδιο worktree**.
- Στο `main` **δεν** γίνεται commit. Commit στο κλαδί με ρητή λίστα αρχείων και πλήρες hook, ποτέ `--no-verify`.
- `wt:land` και push **μόνο** με ρητή εντολή Giorgio.
- **Κανένα jest χωρίς έγκρισή του.** Ο Giorgio **ενέκρινε** στις 06/11 την εντολή jest παρακάτω («ΟΚ ΣΥΜΦΩΝΩ»), αλλά ζήτησε να τρέξει σε νέα συνεδρία. Τρέξ' την ακριβώς όπως είναι· κάθε **άλλη** εντολή θέλει νέα έγκριση.
- **Οδηγία Giorgio:** ποιότητα Revit / ArchiCAD / Cinema 4D / Figma / Zillow / Idealista, χωρίς εκπτώσεις, full enterprise + full SSoT. Όπου δεν είσαι σίγουρος, έρευνα στο διαδίκτυο. Πριν από κάθε κώδικα, πραγματικό SSoT audit (grep).

## Έγινε (commits στο κλαδί)

- `7397326d`: **Ν11(στ)**, σελίδα έργου portfolio `/suppliers/<alias>/w/<έργο>`.
  - Σφράγιση εισδοχής 336 → 337, με έγκριση Giorgio.
  - Route slice 242 bytes, μετρημένο με `--measure`.
  - Πλήρες hook πράσινο.
- Το commit αυτού του handoff: **Ν10(α)**, γραμμένο, **χωρίς** να έχει τρέξει jest.

## Ν10(α): τι είναι (αποφάσεις 78–79 στο ADR-923)

**1. QR σε κάθε κάρτα του πλέγματος απλών προϊόντων**, από τον ίδιο δρόμο με τα μοντέλα.
- `linkableQrIds`: αντικατέστησε το `linkableModelIds` και προσθέτει τα id των καρτών.
- Ίδια πύλη ορατότητας (`publication-links.server.ts`) και ίδια άρνηση `qrOriginNotPublic`.
- `LayoutGridCard.qr?`. Η κάρτα χωρίς QR μένει ίδια με πριν, χωρίς κλειδί `qr`.
- Το `countLayoutQrCodes` μετρά και τις κάρτες.
- Typst: το `qr-symbol` μετακινήθηκε πάνω από το `card-of`. Η κάρτα ζωγραφίζει το QR κάτω δεξιά, χωρίς λεζάντα.
- IDML: το ίδιο `qrGroupXml` μέσα στο κελί της κάρτας.
- `PUBLICATION_RENDER_SCHEMA_VERSION` 8 → 9.

**2. Συμπαγής σύντομη διεύθυνση.** Μικρότερη έκδοση QR αντί για μικρότερη μονάδα.
- `src/lib/qr/compact-uuid.ts`: uuid ↔ 26 χαρακτήρες Crockford base32. Αντιστρέψιμο, χωρίς αποθήκευση, μία κανονική γραφή ανά id.
- `publicShortRoute`: δίνει `/Q/P<26>` για `cprod` και `/Q/M<26>` για `cpmod`. Κάθε άλλο id κρατά το `/q/<id>`.
- `printedModelUrl`: γράφει κεφαλαία και τη βάση, π.χ. `HTTPS://NESTORCONSTRUCT.GR/Q/P…`. Αποτέλεσμα **v4, 20,5 mm** στη μονάδα 0,5 mm, έναντι v6 / 24,5 mm πριν.
- `/q/[id]`: δέχεται και τις δύο γραφές (`publicIdOfShortSegment`).
- `next.config.js`: `rewrite` `/Q/:code` → `/q/:code` (`afterFiles`). Όχι φάκελος `Q`, γιατί σε NTFS συγκρούεται με τον `q`.
- Τα παλιά `/q/<id>` ισχύουν **για πάντα**.

**Έρευνα (πηγές στο changelog του ADR):**
- GS1 X: 0,396 / **0,495** / 0,990 mm, με ζώνη 4X.
- Το ISO/IEC 18004 δεν ορίζει ελάχιστη μονάδα.
- Η πρακτική «QR ανά είδος» στους τυπωμένους καταλόγους των μεγάλων **δεν επιβεβαιώθηκε από πηγή**. Μην την παρουσιάσεις ως γεγονός.

## ⏳ ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ

1. **Jest (εγκρίθηκε):**
```
npx jest src/lib/qr/__tests__/compact-uuid.test.ts src/services/public-catalog/__tests__/public-short-link.test.ts src/subapps/catalog/publishing/__tests__/publication-qr.test.ts src/subapps/catalog/publishing/__tests__/compose-publication.test.ts src/subapps/catalog/publishing/__tests__/idml-document.test.ts src/server/catalog/publishing/__tests__/publication-links.test.ts src/components/catalog/publishing/__tests__/publications.render.test.tsx src/subapps/catalog/public/__tests__/supplier-brand-expiry.test.ts src/lib/document-validity/__tests__/expiry-alert-stage.test.ts src/lib/cron/__tests__/cron-schedule.test.ts src/server/notifications/__tests__/notification-preference-policy.test.ts src/server/notifications/__tests__/notification-destination-rules.test.ts src/server/notifications/__tests__/notification-title.test.ts src/lib/geo/__tests__/geo-region-contact.test.ts src/lib/agency/__tests__/coverage-served-areas.test.ts src/lib/agency/__tests__/coverage-geometry.test.ts src/subapps/catalog/public/__tests__/public-catalog-routes.test.ts src/services/public-catalog/__tests__/public-catalog.reader.test.ts
```
   - Κόκκινο ⇒ διόρθωσε τον κώδικα, όχι την προσδοκία, εκτός αν η προσδοκία είναι λάθος (γράψε γιατί).
   - Το `public-catalog.reader.test.ts` ίσως θέλει mock για το `admin-boundaries.reader`, που είναι server-only.
   - Το `typst-real.test.ts` (νέοι έλεγχοι QR κάρτας 5 στηλών: αποκωδικοποίηση + κριτής διάταξης) τρέχει **μόνο στο CI** (CHECK 3.110, Typst + veraPDF).
2. **Commit** των διορθώσεων, αν χρειαστούν, στο κλαδί.
3. **Ζωντανή επαλήθευση, μόνο μετά από `wt:land` + push με εντολή Giorgio:**
   - Να ανοίγει το `https://nestorconstruct.gr/Q/P<26>`, με 307 `no-store`.
   - Να ανοίγει ακόμη ένα παλιό `/q/cprod_…`.
   - **Σάρωση QR κάρτας με την κάμερα iPhone και Android.** Το URL σε κεφαλαία δεν έχει δοκιμαστεί σε συσκευή. Αν αποτύχει, εναλλακτική: v6 με 0,4 mm (απόφαση 78).
   - Άνοιγμα του IDML σε InDesign.

## Άλλα ανοιχτά (από πριν)
- Πρόταση `refine` στο `schema/zod/catalog-import.schema.ts` (PDF + `priceLines`): περιμένει «ναι».
- **ΟΧΙ χωρίς απόφαση Giorgio:** Α1, Ν6, Ν8, Ν9β, Ν12 (§23.7).
- Η σάρωση λήξεων μάρκας δεν έχει jest. Το CHECK 3.91 ίσως ζητήσει δείκτη για το `grant.validUntil`.

## Μαθήματα αυτής της συνεδρίας
- **Το `routeSlices` πρέπει να έχει εγγραφή ΠΡΙΝ το `--measure`.** Η μέτρηση δείχνει μόνο δηλωμένες σελίδες. Βάλε προσωρινά `sealed: 1` με ιστορικό 0 → 1, μέτρα, και μετά γράψε τον αριθμό.
- **Το hook μπορεί να το σκοτώσει η πίεση μνήμης** αν τρέχει στο παρασκήνιο. Τρέξε το commit σε πρώτο πλάνο, με timeout 600 s.
- **Typst:** ορισμός πριν από χρήση. Μια `#let` που καλεί άλλη `#let` πρέπει να βρίσκεται κάτω από αυτήν.
- **Μετά από αλλαγή αρχείου που είναι ήδη σταδιοποιημένο** (εδώ το ADR), το commit παίρνει την έκδοση του index, όχι του δίσκου. Μην ξανακάνεις `git add` χωρίς λόγο.
