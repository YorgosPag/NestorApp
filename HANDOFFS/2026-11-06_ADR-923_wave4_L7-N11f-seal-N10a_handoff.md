# ADR-923 · Κύμα 4 · Handoff #6 (2026-11-06) — Λ7: σφράγιση + commit Ν11(στ) · Ν10(α)

Αντικαθιστά το `HANDOFFS/2026-11-06_ADR-923_wave4_L7-N11ef-N10a_handoff.md` (τα «Μαθήματα» εκείνου και των προηγούμενων ισχύουν).

- **Worktree:** `C:\Nestor_Worktrees\adr-923-wave4` · **Κλαδί:** `agent/adr-923-wave4`. Συνέχεια **στο ίδιο worktree**.
- Στο `main` **δεν** γίνεται commit. Commit στο κλαδί με ρητή λίστα αρχείων, πλήρες hook, ποτέ `--no-verify`.
- `wt:land` και push **μόνο** με ρητή εντολή Giorgio. **Κανένα jest χωρίς έγκρισή του**: γράφεις τα tests και ζητάς έγκριση με την ακριβή εντολή.
- **Οδηγία Giorgio:** ποιότητα Revit / ArchiCAD / Cinema 4D / Figma / Zillow / Idealista, χωρίς εκπτώσεις, full enterprise + full SSoT. Όπου οι μεγάλοι κάνουν άλλο, ακολουθούμε τους μεγάλους. Όπου δεν είσαι σίγουρος, **έρευνα στο διαδίκτυο**. Πριν από κάθε κώδικα, πραγματικό SSoT audit (grep).

## Έγινε (commits στο κλαδί)

- `794298a7`: Ν10(γ)(δ) + Ν11(δ) της προηγούμενης συνεδρίας. Ήταν σταδιοποιημένα χωρίς commit, γιατί το hook είχε μπλοκάρει στο CHECK 3.35 (αδρανής εξαίρεση). Διόρθωση: στο `readBrandGrantsExpiringPage` η ανάθεση με τριαδικό τελεστή έγινε `let query …; if (after) query = query.startAfter(after);`, με το `// tenant-scope-exempt:` **πάνω από το `query.get()`**.
- `9fe12ab2`: **Ν11(ε)** `areaServed` για ακτίνα και πολύγωνο.
  - `coverageOutline`: κύκλος ⇒ 64-γωνο, περίγραμμα ⇒ ως έχει.
  - `outlineTouchesRegion`: αποδεδειγμένη επαφή πέρα από την ανοχή του ADR-883.
  - `servedAdminAreas`: Περιφέρεια → Π.Ε. → Δήμος, η λεπτότερη βαθμίδα με έως 20 ονόματα (GBP), χωρίς ποτέ αποκοπή.
  - Ο υπολογισμός γίνεται στον αναγνώστη. Η σελίδα και το JSON-LD δείχνουν τα ίδια ονόματα.

## ⏳ ΑΝΟΙΧΤΟ #1: Ν11(στ) σελίδα έργου portfolio — γραμμένο, ΧΩΡΙΣ commit (αρχεία στο worktree)

**Αρχεία** (όλα ανήκουν στο Ν11 στ):
- `src/app/(light)/suppliers/[alias]/w/[project]/page.tsx` (νέο)
- `src/components/public-catalog/PublicProjectView.tsx` (νέο)
- `src/components/public-catalog/SupplierPortfolio.tsx`: εξαγωγή `ProjectImage` + `SUPPLIER_PORTFOLIO_ANCHOR`, σύνδεσμος στον τίτλο
- `src/components/public-catalog/SupplierCatalogView.tsx`: `segment` προς το portfolio
- `src/subapps/catalog/public/public-catalog-routes.ts` (`publicProjectRoute`)
- `src/subapps/catalog/public/public-supplier-profile.ts` (`publicProjectTitle`, `publicProjectOf`)
- `src/lib/catalog/public-structured-data.ts` (`projectStructuredData`, `organisationRefOf`)
- `src/services/public-catalog/public-catalog.reader.ts` (έργα στο sitemap)
- `src/i18n/locales/{el,en}/public-catalog.json` (`project.*`)
- `src/types/i18n.ts` (παραγόμενο)
- `src/subapps/catalog/public/__tests__/public-catalog-routes.test.ts` (5 άγκυρες)
- `docs/centralized-systems/reference/adrs/ADR-923-supplier-product-catalog-pim.md`: changelog «Ν11 (στ)» + γραμμή Ν11 ✅

**Γιατί δεν έγινε commit:** το `npm run generate:i18n-shell-slice` αρνήθηκε («τίποτα δεν γράφτηκε»). Η νέα σελίδα φέρνει το `public-catalog` εκτός εκκίνησης, άρα το χρέος εισδοχής πάει 336 → 337. Χωρίς τον γεννήτορα λείπει το `src/i18n/generated/routes/suppliers__alias__w__project.el.json`, που το εισάγει το `PublicProjectView`.

**ΧΡΕΙΑΖΕΤΑΙ ΕΓΚΡΙΣΗ GIORGIO** για το ανέβασμα της σφράγισης (κανόνας του αρχείου: «ΜΗΝ ανεβάσεις τη σφράγιση για να γίνει πράσινο»). Το προηγούμενο, ίδιας μορφής: στις 02/11 οι `/suppliers` · `/c` · `/p` πήγαν 333 → 336 με έγκριση Giorgio. Η εναλλακτική (`public-catalog` στο κέλυφος) έχει απορριφθεί: θα βάραινε κάθε διαδρομή.

**Με το «ναι»**, στο `.i18n-shell-slice.json`:
1. Γραμμή στον χάρτη εισδοχής, δίπλα στις αδελφές (~γρ. 2921): `"src/app/(light)/suppliers/[alias]/w/[project]/page.tsx ⟵ (στατική)": ["public-catalog"]`.
2. `lazyAdmissionSeal.count` 336 → 337, με `why` στην αρχή της αιτιολογίας (ίδιο ύφος με τη γραμμή «ADR-923 §5.13 Σ4 (2026-11-02)»).
3. Εγγραφή `routeSlices` για τη σελίδα, όπως το `p/[model]` (~γρ. 1975): `npm run generate:i18n-shell-slice -- --measure`, και μετά γράψε το `why` με το χέρι.
4. `npm run generate:i18n-shell-slice`. Τα παραγόμενα αρχεία (`routes/*.json`, `shell-slice.manifest.json`) μπαίνουν στο commit.
5. `npm run jscpd:diff -- <τα src αρχεία>`, και commit με ρητή λίστα.

## ⏳ ΑΝΟΙΧΤΟ #2: Ν10(α) QR στο πλέγμα απλών προϊόντων — ΕΓΚΡΙΘΗΚΕ η κατεύθυνση

**Εύρημα (διαψεύδει το handoff #5):** τα απλά προϊόντα **έχουν** δημόσια σελίδα.
- Το `public-model-snapshot.server.ts` (`readTree`) προβάλλει κάθε προϊόν με `modelId === null` ως έγγραφο `kind: 'product'` στο `public_catalog_models`, με id το id του προϊόντος.
- Στο `publication-chapters.ts`, το `simpleCard` δίνει `card.id = product.id`.
- Το `readPublicModelTarget` και το `/q/[id]` δεν φιλτράρουν το είδος.

**Εγκρίθηκε:** ένα QR ανά κάρτα, προς `/q/<productId>`, από τον **ίδιο δρόμο** με τα μοντέλα:
- `publication-qr.ts` `linkableModelIds`: + τα id καρτών των `productGrid`.
- Ίδια πύλη ορατότητας (`publication-links.server.ts`), ίδια άρνηση `qrOriginNotPublic`.
- Ίδια μέτρηση `countLayoutQrCodes`/`printedQrCount`, ίδιο διανυσματικό QR στο IDML (`qrGroupXml`).
- Μη δημόσιο προϊόν δεν παίρνει QR. Η κάρτα δεν έχει λεζάντα URL.
- Ανέβασμα του `PUBLICATION_RENDER_VERSION`.

**Μέτρηση:** το URL `https://nestorconstruct.gr/q/cprod_<uuid>` έχει 71 χαρακτήρες και δίνει 41 μονάδες στη στάθμη Q (preset `print`), συν ζώνη ησυχίας 4+4.
- Με 0,5 mm (σημερινό `PUBLICATION_QR_MODULE_MM`): 24,5 mm, δεν χωρά στην κάρτα των 34–45 mm.
- Με 0,4 mm: 19,6 mm.

**Πριν από τον κώδικα (υποχρεωτική έρευνα):**
1. **GS1 General Specifications**: το ελάχιστο και ο στόχος X-dimension για QR (πιστεύω ελάχιστο 0,396 mm, στόχος 0,495 mm, **ανεπιβεβαίωτο**), και ISO/IEC 18004 / ISO/IEC 15415 για την ποιότητα εκτύπωσης.
2. **Πρακτική των μεγάλων στους τυπωμένους καταλόγους προϊόντων** (π.χ. Würth, Hilti, Schneider, Legrand, Hager, IKEA): QR ανά προϊόν ή ανά ομάδα; Διακόπτης στη συνταγή ή πάντα;
   - Ο Giorgio είπε: «ακολουθούμε τους μεγάλους, και αν γίνεται κάτι πιο έξυπνο».
   - Ιδέα για έρευνα: συντομότερη σύντομη διεύθυνση (μικρότερη έκδοση QR, μεγαλύτερη μονάδα στο ίδιο εμβαδόν).
3. **SSoT audit:** `QR_PRESETS` (`src/lib/qr/qr-code.ts`) · `publicationQrCode` · `entryHeading` / `gridCard` / `gridSection` (`compose-publication.ts`) · το πρότυπο Typst του πλέγματος (`typst-template.ts`) · `idml-story.ts` · `layout-model.ts` (`LayoutQrCode`).
   - Το μέγεθος μονάδας ανά θέση πρέπει να ζει **σε ένα** σημείο: σήμερα είναι σταθερά, ενώ η κάρτα θα θέλει άλλη τιμή.

Αν υπάρχει πραγματική επιλογή προϊόντος (π.χ. διακόπτης «QR ανά κάρτα» στη συνταγή), φέρε στον Giorgio **μία** προτεινόμενη απάντηση με τις πηγές, όχι μενού.

## ⏳ Jest που περιμένουν έγκριση (δεν έτρεξε κανένα)

```
npx jest src/subapps/catalog/publishing/__tests__/publication-qr.test.ts src/subapps/catalog/publishing/__tests__/idml-document.test.ts src/components/catalog/publishing/__tests__/publications.render.test.tsx src/subapps/catalog/public/__tests__/supplier-brand-expiry.test.ts src/lib/document-validity/__tests__/expiry-alert-stage.test.ts src/lib/cron/__tests__/cron-schedule.test.ts src/server/notifications/__tests__/notification-preference-policy.test.ts src/server/notifications/__tests__/notification-destination-rules.test.ts src/server/notifications/__tests__/notification-title.test.ts src/lib/geo/__tests__/geo-region-contact.test.ts src/lib/agency/__tests__/coverage-served-areas.test.ts src/lib/agency/__tests__/coverage-geometry.test.ts src/subapps/catalog/public/__tests__/public-catalog-routes.test.ts src/services/public-catalog/__tests__/public-catalog.reader.test.ts
```

Το `public-catalog.reader.test.ts` μπήκε επειδή ο αναγνώστης εισάγει πλέον το `admin-boundaries.reader` (server-only) και ίσως θέλει mock.

## Άλλα ανοιχτά (από πριν)
- Πρόταση `refine` στο `schema/zod/catalog-import.schema.ts` (PDF + `priceLines`): περιμένει «ναι».
- **ΟΧΙ χωρίς απόφαση Giorgio:** Α1, Ν6, Ν8, Ν9β, Ν12 (§23.7).
- Η σάρωση λήξεων μάρκας δεν έχει jest. Το CHECK 3.91 θα ζητήσει ίσως δείκτη για το `grant.validUntil`.

## Μαθήματα αυτής της συνεδρίας
- **Το CHECK 3.35 δεν βλέπει ερώτημα που εκτελείται μέσα σε τριαδικό τελεστή.** Για να το δεις, τρέξε τον σαρωτή απευθείας: `scanFile(file, createScanContext())` από `scripts/_shared/firestore-tenant-scope-scan.js` (script στο scratchpad).
- **Νέα δημόσια σελίδα = σφράγιση εισδοχής + route slice.** Ρώτα τον Giorgio **πριν** γράψεις τη σελίδα, όχι μετά.
- **ICU:** αριθμός σε `{year}` γίνεται «2.024»· πέρνα `String(year)`.
- **Η ripgrep σε όλο το `src/` λήγει στα 20″:** περιόρισε τη διαδρομή.
